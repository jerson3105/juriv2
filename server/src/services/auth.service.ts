import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { and, eq, or, sql } from 'drizzle-orm';
import { db, users, parentProfiles, studentProfiles, classrooms } from '../db/index.js';
import { schoolMembers, schools } from '../db/schema.js';
import { cache, CACHE_KEYS } from '../utils/cache.js';
import {
  generateTokenPair, revokeAllUserTokens, revokeRefreshToken, revokeSession, rotateRefreshToken, sessionIdForRefreshToken,
  type SessionTokens,
} from '../utils/jwt.js';
import { v4 as uuidv4 } from 'uuid';
import { avatarService } from './avatar.service.js';
import { studentService } from './student.service.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { maskPersonName } from '../utils/helpers.js';
import { teacherVerificationService, UNVERIFIED_CLASS_MESSAGE } from './teacherVerification.service.js';

// Tipos
type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
}

interface GoogleAuthInput {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    avatarUrl: string | null;
  };
  accessToken: string;
  refreshToken: string;
  /** De la sesión: el controlador decide la cookie (persistente o de sesión) y no los envía en el cuerpo. */
  sessionId?: string;
  persistent?: boolean;
  expiresAt?: Date;
}

export interface StudentCodeVerificationResult {
  studentName: string | null;
  classroomName: string | null;
  alreadyLinked: boolean;
  /** 'new' = crea su acceso (PIN, correo o Google); 'pin-reset' = su profe restableció el PIN: solo PIN nuevo. */
  access: 'new' | 'pin-reset';
  teacherVerified: boolean;
  message?: string;
}

// Constantes
const SALT_ROUNDS = 12;
// Hash de relleno con el MISMO costo que los reales: si fuera más barato, el tiempo de respuesta
// delataría qué correos tienen cuenta.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), SALT_ROUNDS);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeName = (value: string): string => value.trim();
const normalizeStudentCode = (code: string): string => code.trim().toUpperCase();
const normalizeAvatarUrl = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const splitOfficialStudentName = (value: string): { firstName: string; lastName: string } => {
  const tokens = normalizeName(value)
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return { firstName: 'Estudiante', lastName: 'Juried' };
  }

  if (tokens.length === 1) {
    return { firstName: tokens[0], lastName: 'Estudiante' };
  }

  if (tokens.length === 2) {
    return { firstName: tokens[0], lastName: tokens[1] };
  }

  if (tokens.length === 3) {
    return { firstName: tokens[0], lastName: tokens.slice(1).join(' ') };
  }

  return {
    firstName: tokens.slice(0, 2).join(' '),
    lastName: tokens.slice(2).join(' '),
  };
};

const isDuplicateEntryError = isDuplicateEntry;

/**
 * Registrar nuevo usuario
 */
export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const { email, password, firstName, lastName, role } = input;
  const normalizedEmail = normalizeEmail(email);
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);
  
  // Hashear contraseña
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date();
  const userId = uuidv4();
  // Docente con contraseña: nace sin verificar (nadie confirmó su correo; el dominio solo cuenta con Google).
  const teacherFields = role === 'TEACHER' ? await teacherVerificationService.initialStatusFor(normalizedEmail, 'LOCAL') : {};

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: normalizedEmail,
        password: hashedPassword,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        role,
        ...teacherFields,
        provider: 'LOCAL',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Si es padre, crear el perfil de padre en la misma transacción
      if (role === 'PARENT') {
        await tx.insert(parentProfiles).values({
          id: uuidv4(),
          userId,
          relationship: 'GUARDIAN',
          notifyByEmail: true,
          notifyWeeklySummary: true,
          notifyAlerts: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      throw new Error('El correo electrónico ya está registrado');
    }
    throw error;
  }
  
  // Generar tokens
  const tokens = await generateTokenPair({
    userId,
    email: normalizedEmail,
    role,
  });
  
  return {
    user: {
      id: userId,
      email: normalizedEmail,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      role,
      avatarUrl: null,
    },
    ...tokens,
  };
};

export type JoinCodeVerification =
  | { type: 'classroom'; classroomName: string; teacherName: string | null; open: boolean; teacherVerified: boolean; message?: string }
  | ({ type: 'student' } & StudentCodeVerificationResult);

/**
 * Puerta /unirse (sin sesión): el alumno escribe el código de su clase o su código personal y ve
 * a qué clase entra antes de crear su acceso. Nombres parciales: no expone a un menor.
 */
export const verifyJoinCode = async (code: string): Promise<JoinCodeVerification | null> => {
  const normalizedCode = normalizeStudentCode(code).replace(/[^A-Z0-9]/g, '');
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.code, normalizedCode),
    columns: { id: true, name: true, teacherId: true, isActive: true, acceptingStudents: true },
  });
  if (classroom) {
    const teacherVerified = await teacherVerificationService.isVerified(classroom.teacherId);
    const teacher = await db.query.users.findFirst({
      where: eq(users.id, classroom.teacherId),
      columns: { firstName: true, lastName: true },
    });
    return {
      type: 'classroom',
      classroomName: classroom.name,
      teacherName: teacher ? maskPersonName(`${teacher.firstName} ${teacher.lastName}`) : null,
      open: classroom.isActive && classroom.acceptingStudents,
      teacherVerified,
      ...(teacherVerified ? {} : { message: UNVERIFIED_CLASS_MESSAGE }),
    };
  }
  const student = await verifyStudentRegistrationCode(normalizedCode);
  return student ? { type: 'student', ...student } : null;
};

export const verifyStudentRegistrationCode = async (code: string): Promise<StudentCodeVerificationResult | null> => {
  const normalizedCode = normalizeStudentCode(code);

  const profile = await db.query.studentProfiles.findFirst({
    where: and(
      eq(studentProfiles.linkCode, normalizedCode),
      eq(studentProfiles.isActive, true)
    ),
    columns: {
      userId: true,
      classroomId: true,
      displayName: true,
      characterName: true,
    },
  });

  if (!profile) {
    return null;
  }

  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, profile.classroomId),
    columns: {
      name: true,
      teacherId: true,
    },
  });
  const teacherVerified = classroom ? await teacherVerificationService.isVerified(classroom.teacherId) : false;

  // Tarjeta nueva tras "Restablecer acceso": la cuenta PIN sigue vinculada pero sin PIN.
  let pinReset = false;
  if (profile.userId) {
    const owner = await db.query.users.findFirst({
      where: eq(users.id, profile.userId),
      columns: { provider: true, pinHash: true },
    });
    pinReset = owner?.provider === 'PIN' && !owner.pinHash;
  }

  return {
    studentName: maskPersonName(profile.displayName || profile.characterName),
    classroomName: classroom?.name || null,
    alreadyLinked: !!profile.userId && !pinReset,
    access: pinReset ? 'pin-reset' : 'new',
    teacherVerified,
    ...(teacherVerified ? {} : { message: UNVERIFIED_CLASS_MESSAGE }),
  };
};

/**
 * Perfil de la lista al que se vincula la cuenta nueva: por la tarjeta (código personal) o por el
 * nombre que el alumno tocó en la lista de su clase (solo con la clase abierta, como el PIN).
 */
const findStudentTarget = async (
  q: Pick<typeof db, 'query'>,
  target: { linkCode: string } | { classCode: string; studentId: string },
) => {
  const columns = { id: true, userId: true, classroomId: true, displayName: true, characterName: true } as const;
  if ('linkCode' in target) {
    return q.query.studentProfiles.findFirst({
      where: and(eq(studentProfiles.linkCode, target.linkCode), eq(studentProfiles.isActive, true)),
      columns,
    });
  }
  const classroom = await q.query.classrooms.findFirst({
    where: eq(classrooms.code, normalizeStudentCode(target.classCode)),
    columns: { id: true, isActive: true, acceptingStudents: true },
  });
  if (!classroom || !classroom.isActive) return undefined;
  if (!classroom.acceptingStudents) {
    throw new ForbiddenError('Esta clase no está recibiendo estudiantes ahora. Pídele tu tarjeta a tu profe.');
  }
  return q.query.studentProfiles.findFirst({
    where: and(
      eq(studentProfiles.id, target.studentId),
      eq(studentProfiles.classroomId, classroom.id),
      eq(studentProfiles.isActive, true),
      eq(studentProfiles.isDemo, false),
    ),
    columns,
  });
};

export const registerStudentWithCode = async (input: {
  code?: string;
  classCode?: string;
  studentId?: string;
  email: string;
  password: string;
  avatarGender?: 'MALE' | 'FEMALE';
}): Promise<AuthResponse> => {
  const normalizedCode = input.code ? normalizeStudentCode(input.code) : null;
  if (!normalizedCode && !(input.classCode && input.studentId)) {
    throw new ValidationError('Falta tu código o tu nombre.');
  }
  const target = normalizedCode
    ? { linkCode: normalizedCode }
    : { classCode: input.classCode!, studentId: input.studentId! };
  const normalizedEmail = normalizeEmail(input.email);
  const avatarGender = input.avatarGender || 'MALE';

  // Primero el código: sin uno válido y libre no se dice nada del correo (antes, con un código
  // inventado, la respuesta delataba si el correo era de un docente o de un alumno).
  const codeProfile = await findStudentTarget(db, target);
  if (!codeProfile) {
    if (normalizedCode) throw new Error('Código inválido');
    throw new NotFoundError('No encontramos tu nombre en esta clase.');
  }
  if (codeProfile.userId) {
    if (normalizedCode) throw new Error('Este código ya fue usado');
    throw new ConflictError('Ese nombre ya tiene acceso. Si es tuyo, entra con tu cuenta o pídele ayuda a tu profe.');
  }
  await teacherVerificationService.assertClassroomAcceptsAccounts(codeProfile.classroomId);

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
    columns: {
      id: true,
      email: true,
      password: true,
      firstName: true,
      lastName: true,
      role: true,
      provider: true,
      isActive: true,
      avatarUrl: true,
    },
  });

  if (existingUser) {
    const passwordHash = existingUser.password || DUMMY_PASSWORD_HASH;
    const isValidPassword = await bcrypt.compare(input.password, passwordHash);

    if (!existingUser.isActive) {
      throw new Error('Tu cuenta no está activa. Contacta a soporte.');
    }

    if (existingUser.role !== 'STUDENT') {
      throw new Error('Este correo ya está registrado con otro tipo de cuenta. Usa otro correo o entra con tu cuenta actual.');
    }

    if (existingUser.provider !== 'LOCAL' || !existingUser.password) {
      throw new Error('Este correo ya tiene otro método de acceso. Inicia sesión con ese método y luego vincula este código desde tu cuenta.');
    }

    if (!isValidPassword) {
      throw new Error('Ese correo ya tiene una cuenta. Usa tu contraseña actual para agregar esta nueva clase.');
    }

    if (normalizedCode) {
      await studentService.linkStudentAccount({ userId: existingUser.id, linkCode: normalizedCode, avatarGender });
    } else {
      await studentService.linkRosterProfile({
        userId: existingUser.id, classCode: input.classCode!, studentId: input.studentId!, avatarGender,
      });
    }

    const tokens = await generateTokenPair({
      userId: existingUser.id,
      email: existingUser.email,
      role: existingUser.role as UserRole,
    });

    return {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        role: existingUser.role as UserRole,
        avatarUrl: existingUser.avatarUrl,
      },
      ...tokens,
    };
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);
  const now = new Date();
  const userId = uuidv4();
  let firstName = 'Estudiante';
  let lastName = 'Juried';
  let linkedProfileId: string | null = null;

  try {
    await db.transaction(async (tx) => {
      const profile = await findStudentTarget(tx, target);

      if (!profile) {
        throw new Error('Código inválido');
      }

      if (profile.userId) {
        throw new Error('Este código ya fue usado');
      }

      linkedProfileId = profile.id;

      const officialName = normalizeName(profile.displayName || profile.characterName || 'Estudiante');
      const parsedName = splitOfficialStudentName(officialName);
      firstName = parsedName.firstName;
      lastName = parsedName.lastName;

      await tx.insert(users).values({
        id: userId,
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'STUDENT',
        provider: 'LOCAL',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const updateResult = await tx
        .update(studentProfiles)
        .set({
          userId,
          avatarGender,
          linkCode: null,
          updatedAt: now,
        })
        .where(and(
          eq(studentProfiles.id, profile.id),
          // Por la tarjeta, el código debe seguir siendo el mismo al escribir.
          ...(normalizedCode ? [eq(studentProfiles.linkCode, normalizedCode)] : []),
          sql`${studentProfiles.userId} IS NULL`
        ));

      const header = Array.isArray(updateResult) ? updateResult[0] : updateResult;
      const affectedRows = Number((header as { affectedRows?: number }).affectedRows ?? 0);
      if (affectedRows !== 1) {
        throw new Error('Este código ya fue usado');
      }
    });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      throw new Error('El correo electrónico ya está registrado');
    }
    throw error;
  }

  if (linkedProfileId) {
    await avatarService.assignDefaultItems(linkedProfileId, avatarGender);
  }

  const tokens = await generateTokenPair({
    userId,
    email: normalizedEmail,
    role: 'STUDENT',
  });

  return {
    user: {
      id: userId,
      email: normalizedEmail,
      firstName,
      lastName,
      role: 'STUDENT',
      avatarUrl: null,
    },
    ...tokens,
  };
};

/**
 * Iniciar sesión con email y contraseña
 */
export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const { email, password } = input;
  const normalizedEmail = normalizeEmail(email);
  
  // Buscar usuario
  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  // Verificación constante para reducir filtrado por tiempo
  const passwordHash = user?.password || DUMMY_PASSWORD_HASH;
  const isValidPassword = await bcrypt.compare(password, passwordHash);

  if (!user || !user.isActive || user.provider !== 'LOCAL' || !user.password || !isValidPassword) {
    throw new Error('Credenciales inválidas');
  }

  if (bcrypt.getRounds(user.password) < SALT_ROUNDS) {
    const upgraded = await bcrypt.hash(password, SALT_ROUNDS);
    await db.update(users).set({ password: upgraded }).where(eq(users.id, user.id));
  }
  
  // Generar tokens
  const tokens = await generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
    },
    ...tokens,
  };
};

/**
 * Autenticación con Google
 */
export const googleAuth = async (input: GoogleAuthInput): Promise<AuthResponse> => {
  const { googleId, email, firstName, lastName, avatarUrl, role } = input;
  const normalizedGoogleId = googleId.trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedFirstName = normalizeName(firstName) || 'Usuario';
  const normalizedLastName = normalizeName(lastName);
  const normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl);

  if (!normalizedGoogleId) {
    throw new Error('Cuenta de Google inválida');
  }
  
  // Buscar usuario existente por googleId o email
  let user = await db.query.users.findFirst({
    where: or(
      eq(users.googleId, normalizedGoogleId),
      eq(users.email, normalizedEmail)
    ),
  });
  
  const now = new Date();
  
  if (user) {
    if (!user.isActive) {
      throw new Error('Tu cuenta ha sido desactivada');
    }

    const shouldUpdateProvider = user.provider !== 'GOOGLE';
    const shouldUpdateGoogleId = user.googleId !== normalizedGoogleId;
    const shouldUpdateAvatar = !user.avatarUrl && !!normalizedAvatarUrl;

    // Actualizar información de Google si es necesario
    if (shouldUpdateProvider || shouldUpdateGoogleId || shouldUpdateAvatar) {
      await db.update(users)
        .set({
          googleId: normalizedGoogleId,
          provider: 'GOOGLE',
          avatarUrl: user.avatarUrl || normalizedAvatarUrl,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
      
      user = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });
    }
  } else {
    // Crear nuevo usuario
    const userId = uuidv4();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          email: normalizedEmail,
          googleId: normalizedGoogleId,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          role,
          provider: 'GOOGLE',
          avatarUrl: normalizedAvatarUrl,
          password: '', // No password para usuarios de Google
          isActive: true,
          notifyBadges: true,
          notifyLevelUp: true,
          createdAt: now,
          updatedAt: now,
        });

        // Si es padre, crear el perfil de padre en la misma transacción
        if (role === 'PARENT') {
          await tx.insert(parentProfiles).values({
            id: uuidv4(),
            userId,
            relationship: 'GUARDIAN',
            notifyByEmail: true,
            notifyWeeklySummary: true,
            notifyAlerts: true,
            createdAt: now,
            updatedAt: now,
          });
        }
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw new Error('Esta cuenta de Google ya está registrada');
      }
      throw error;
    }

    user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
  }
  
  if (!user || !user.isActive) {
    throw new Error('Error al autenticar con Google');
  }
  
  // Generar tokens
  const tokens = await generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
    },
    ...tokens,
  };
};

/**
 * Refrescar tokens
 */
export const refreshTokens = async (refreshToken: string, userAgent?: string | null): Promise<SessionTokens> =>
  rotateRefreshToken(refreshToken, userAgent);

/**
 * Cerrar sesión: cierra la sesión entera de ese dispositivo (refresh, access token y sockets).
 */
export const logout = async (refreshToken: string): Promise<void> => {
  const normalizedRefreshToken = refreshToken.trim();
  if (!normalizedRefreshToken) {
    return;
  }
  const sessionId = await sessionIdForRefreshToken(normalizedRefreshToken);
  if (sessionId) await revokeSession(sessionId);
  else await revokeRefreshToken(normalizedRefreshToken);
};

/** Cerrar la sesión indicada por el access token (cuando no llega la cookie). */
export const logoutSession = async (sessionId: string): Promise<void> => {
  await revokeSession(sessionId);
};

/**
 * Cerrar todas las sesiones de un usuario
 */
export const logoutAll = async (userId: string): Promise<void> => {
  await revokeAllUserTokens(userId);
};

/**
 * Cambiar contraseña
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user || !user.password) {
    throw new Error('Usuario no encontrado o usa autenticación externa');
  }
  
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  
  if (!isValidPassword) {
    throw new Error('Contraseña actual incorrecta');
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  
  await db.update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, userId));
  
  // Revocar todos los tokens para forzar re-login
  await revokeAllUserTokens(userId);
};

/**
 * Obtener perfil de usuario
 */
export const getProfile = async (userId: string) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      avatarUrl: true,
      provider: true,
      notifyBadges: true,
      notifyLevelUp: true,
      createdAt: true,
    },
  });
  
  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  
  return user;
};

/**
 * Actualizar perfil de usuario
 */
export const updateProfile = async (
  userId: string, 
  data: { firstName?: string; lastName?: string; avatarUrl?: string | null }
) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  
  const updateData: Record<string, any> = { updatedAt: new Date() };
  
  if (data.firstName !== undefined) {
    updateData.firstName = data.firstName;
  }
  if (data.lastName !== undefined) {
    updateData.lastName = data.lastName;
  }
  if (data.avatarUrl !== undefined) {
    updateData.avatarUrl = data.avatarUrl;
  }
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId));
  
  return getProfile(userId);
};

/**
 * Actualizar preferencias de notificaciones
 */
export const updateNotifications = async (
  userId: string, 
  data: { notifyBadges?: boolean; notifyLevelUp?: boolean }
) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  
  const updateData: Record<string, any> = { updatedAt: new Date() };
  
  if (data.notifyBadges !== undefined) {
    updateData.notifyBadges = data.notifyBadges;
  }
  if (data.notifyLevelUp !== undefined) {
    updateData.notifyLevelUp = data.notifyLevelUp;
  }
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId));
  
  return getProfile(userId);
};

/**
 * Generar tokens para un usuario existente (usado en Google OAuth callback)
 */
export const generateTokensForUser = async (userId: string): Promise<SessionTokens> => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });
  
  if (!user || !user.isActive) {
    throw new Error('Usuario no autorizado');
  }
  
  const tokens = await generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  
  return tokens;
};

/**
 * Completar registro de usuario de Google con rol seleccionado
 */
export const completeGoogleRegistration = async (googleData: {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}, role: UserRole) => {
  const normalizedGoogleId = googleData.googleId.trim();
  const normalizedEmail = normalizeEmail(googleData.email);
  const normalizedFirstName = normalizeName(googleData.firstName) || 'Usuario';
  const normalizedLastName = normalizeName(googleData.lastName);
  const normalizedAvatarUrl = normalizeAvatarUrl(googleData.avatarUrl);

  if (!normalizedGoogleId) {
    throw new Error('Cuenta de Google inválida');
  }

  // Verificar que el email/googleId no existan
  const existingUser = await db.query.users.findFirst({
    where: or(
      eq(users.email, normalizedEmail),
      eq(users.googleId, normalizedGoogleId)
    ),
    columns: {
      email: true,
      googleId: true,
    },
  });
  
  if (existingUser) {
    if (existingUser.googleId === normalizedGoogleId) {
      throw new Error('Esta cuenta de Google ya está registrada');
    }

    throw new Error('Este email ya está registrado');
  }
  
  const newUserId = uuidv4();
  const now = new Date();

  // Registro con Google (correo comprobado por Google): el dominio institucional verifica.
  const teacherFields = role === 'TEACHER' ? await teacherVerificationService.initialStatusFor(normalizedEmail, 'GOOGLE') : {};
  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: newUserId,
        email: normalizedEmail,
        googleId: normalizedGoogleId,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        password: '',
        role,
        ...teacherFields,
        provider: 'GOOGLE',
        avatarUrl: normalizedAvatarUrl,
        isActive: true,
        notifyBadges: true,
        notifyLevelUp: true,
        createdAt: now,
        updatedAt: now,
      });

      if (role === 'PARENT') {
        await tx.insert(parentProfiles).values({
          id: uuidv4(),
          userId: newUserId,
          relationship: 'GUARDIAN',
          notifyByEmail: true,
          notifyWeeklySummary: true,
          notifyAlerts: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      throw new Error('Esta cuenta de Google ya está registrada');
    }
    throw error;
  }
  
  const tokens = await generateTokenPair({
    userId: newUserId,
    email: normalizedEmail,
    role,
  });
  
  return {
    user: {
      id: newUserId,
      email: normalizedEmail,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      role,
      avatarUrl: normalizedAvatarUrl,
    },
    ...tokens,
  };
};

/**
 * "Soy estudiante, me equivoqué": un alumno que eligió "Docente" al registrarse no tenía salida
 * (no puede unirse a clases y el correo ya estaba usado). Solo se permite si la cuenta no tiene
 * alumnos (salvo el de demostración) ni escuela: así nunca se rompe la clase de un docente real.
 */
export const getStudentSwitchEligibility = async (userId: string): Promise<{ eligible: boolean; reason?: string }> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { role: true } });
  if (!user || user.role !== 'TEACHER') return { eligible: false, reason: 'Solo una cuenta de docente puede cambiarse a estudiante' };

  const [school] = await db.select({ id: schools.id }).from(schools).where(eq(schools.createdBy, userId)).limit(1);
  const [membership] = await db.select({ id: schoolMembers.id }).from(schoolMembers).where(eq(schoolMembers.userId, userId)).limit(1);
  if (school || membership) return { eligible: false, reason: 'Esta cuenta pertenece a una escuela. Pide ayuda al responsable de tu escuela.' };

  const [realStudent] = await db
    .select({ id: studentProfiles.id })
    .from(studentProfiles)
    .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
    .where(and(eq(classrooms.teacherId, userId), eq(studentProfiles.isDemo, false)))
    .limit(1);
  if (realStudent) return { eligible: false, reason: 'Tus clases ya tienen estudiantes, así que esta cuenta es de docente.' };

  return { eligible: true };
};

export const switchTeacherToStudent = async (userId: string): Promise<AuthResponse> => {
  const eligibility = await getStudentSwitchEligibility(userId);
  if (!eligibility.eligible) {
    throw new ConflictError(eligibility.reason ?? 'No se puede cambiar esta cuenta');
  }

  // Sus clases solo tienen el alumno de demostración: se borran con el servicio (limpia dependencias).
  const { classroomService } = await import('./classroom.service.js');
  const own = await db.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.teacherId, userId));
  for (const classroom of own) {
    await db.update(classrooms).set({ isActive: false }).where(eq(classrooms.id, classroom.id));
    await classroomService.delete(classroom.id, userId);
  }

  await db.update(users)
    .set({ role: 'STUDENT', teacherStatus: null, teacherVerifiedVia: null, teacherVerifiedAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  cache.delete(CACHE_KEYS.user(userId));
  await revokeAllUserTokens(userId);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error('Usuario no encontrado');
  const tokens = await generateTokenPair({ userId: user.id, email: user.email, role: 'STUDENT' });
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: 'STUDENT',
      avatarUrl: user.avatarUrl,
    },
    ...tokens,
  };
};
