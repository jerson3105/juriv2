import bcrypt from 'bcryptjs';
import { eq, or } from 'drizzle-orm';
import { db, users, parentProfiles } from '../db/index.js';
import { consumeRefreshToken, generateTokenPair, revokeRefreshToken, revokeAllUserTokens } from '../utils/jwt.js';
import { v4 as uuidv4 } from 'uuid';

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
}

// Constantes
const SALT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = '$2a$10$7EqJtq98hPqEX7fNZaFWoOHiZy6u9j9l56k97X3CJidb8sRP/6ID.';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeName = (value: string): string => value.trim();
const normalizeAvatarUrl = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const isDuplicateEntryError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const dbError = error as { code?: string; errno?: number };
  return dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062;
};

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

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: normalizedEmail,
        password: hashedPassword,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        role,
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
export const refreshTokens = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
  const normalizedRefreshToken = refreshToken.trim();
  if (!normalizedRefreshToken) {
    throw new Error('Token de actualización requerido');
  }

  const payload = await consumeRefreshToken(normalizedRefreshToken);
  
  if (!payload) {
    throw new Error('Token de actualización inválido o expirado');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
    columns: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new Error('Token de actualización inválido o expirado');
  }
  
  // Generar nuevos tokens
  const tokens = await generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  
  return tokens;
};

/**
 * Cerrar sesión
 */
export const logout = async (refreshToken: string): Promise<void> => {
  const normalizedRefreshToken = refreshToken.trim();
  if (!normalizedRefreshToken) {
    return;
  }

  await revokeRefreshToken(normalizedRefreshToken);
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
export const generateTokensForUser = async (userId: string): Promise<{ accessToken: string; refreshToken: string }> => {
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
