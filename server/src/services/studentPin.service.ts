import bcrypt from 'bcryptjs';
import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db, users, studentProfiles, classrooms, schools, schoolStudents } from '../db/index.js';
import { generateTokenPair, revokeAllUserTokens, type SessionTokens } from '../utils/jwt.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError, RateLimitError, UnauthorizedError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { formatDuration, generateRandomCode } from '../utils/helpers.js';
import { documentIndex, normalizeDocument } from '../utils/personalDocument.js';
import { piiReady } from '../utils/piiCrypto.js';
import { avatarService } from './avatar.service.js';
import { splitOfficialStudentName } from './auth.service.js';
import { teacherVerificationService, UNVERIFIED_CLASS_MESSAGE } from './teacherVerification.service.js';
import { recordAudit } from '../utils/audit.js';
import { isPinFormatValid, isWeakPin, PIN_BLOCK_LEVEL, PIN_LOCK_STEPS_MS, PIN_MAX_ATTEMPTS } from '../utils/pinPolicy.js';

/**
 * Alumnos sin correo. Primera vez: tarjeta (código personal) o código de clase + su nombre de la
 * lista (solo con la clase abierta) → crean un PIN de 4 números. Después: código de clase + nombre
 * + PIN. 5 fallos bloquean 15 minutos; otros 5, una hora; otros 5 dejan el acceso bloqueado hasta que
 * el docente lo restablezca (tarjeta nueva).
 *
 * Estudiantes de un colegio (E1.7): una cuenta para todas sus clases con un solo PIN (o la de correo/Google a la que
 * suman un PIN). Primera vez solo con tarjeta (la del colegio o la de una de sus clases); nadie crea su PIN tocando su
 * nombre. Después: código del colegio + DNI + PIN (error único, sin decir si el DNI existe) o su clase + nombre + PIN.
 * Su PIN lo restablecen la administración o su tutor.
 */

// Correo interno (dominio reservado .invalid): la columna es obligatoria, pero nunca se muestra ni recibe correos.
const PIN_EMAIL_DOMAIN = 'alumnos.juried.invalid';
const pinEmailFor = (userId: string) => `pin-${userId}@${PIN_EMAIL_DOMAIN}`;
const PIN_COST = 10;

const CLOSED_CLASS_MESSAGE = 'Esta clase no está recibiendo estudiantes ahora. Pídele tu tarjeta a tu profe.';
const RESET_MESSAGE = 'Tu profe restableció tu acceso: crea un PIN nuevo con la tarjeta que te dio.';
const BLOCKED_MESSAGE = 'Tu acceso quedó bloqueado por seguridad. Pídele a tu profe que lo restablezca.';
const SCHOOL_CARD_MESSAGE = 'Tu primera vez es con tu tarjeta del colegio: pídesela a tu tutor.';
/** Puerta del colegio: el mismo mensaje si el DNI no existe, no tiene PIN o el PIN no es correcto. */
export const SCHOOL_LOGIN_FAILED = 'DNI o PIN incorrecto.';

// Para igualar el tiempo cuando el DNI no existe (se compara igual contra este hash, con el mismo costo).
let dummyPinHash: string | null = null;
const dummyCompare = async (pin: string) => {
  dummyPinHash ??= await bcrypt.hash(`sin-cuenta-${uuidv4()}`, PIN_COST);
  await bcrypt.compare(pin, dummyPinHash);
};

/** 'card': estudiante del colegio que aún no tiene PIN (su primera vez es con tarjeta, no tocando su nombre). */
export type RosterState = 'new' | 'pin' | 'account' | 'card';
export interface ClassRoster {
  classroomName: string;
  open: boolean;
  teacherVerified: boolean;
  message?: string;
  /** Código del colegio de la clase (si usa el acceso con DNI): la lista ofrece «Entrar con mi DNI». */
  schoolCode?: string;
  schoolName?: string;
  students: Array<{ id: string; name: string; state: RosterState }>;
}

type StudentUser = { id: string; email: string; firstName: string; lastName: string; role: 'STUDENT'; avatarUrl: string | null; provider: 'LOCAL' | 'GOOGLE' | 'PIN' };

interface PinAuthResult extends SessionTokens {
  user: StudentUser;
  classroom: { name: string; code: string };
}

interface SchoolAuthResult extends SessionTokens {
  user: StudentUser;
  school: { name: string; code: string | null };
}

const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const assertNewPin = (pin: string) => {
  if (!isPinFormatValid(pin)) throw new ValidationError('El PIN tiene 4 números.');
  if (isWeakPin(pin)) throw new ValidationError('Ese PIN es muy fácil de adivinar. Inventa otro.');
};

const affectedRows = (result: unknown) => {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number }).affectedRows ?? 0);
};

/** Nombre de la lista: "María P."; si dos se parecen, más iniciales ("María P. G."). */
const rosterNames = (names: string[]): string[] => {
  const tokensOf = (name: string) => name.trim().split(/\s+/).filter(Boolean);
  const short = (name: string) => {
    const t = tokensOf(name);
    return t.length <= 1 ? (t[0] ?? 'Estudiante') : `${t[0]} ${t[t.length - 1].charAt(0).toUpperCase()}.`;
  };
  const long = (name: string) => {
    const t = tokensOf(name);
    return t.length <= 1 ? (t[0] ?? 'Estudiante') : `${t[0]} ${t.slice(1).map((w) => `${w.charAt(0).toUpperCase()}.`).join(' ')}`;
  };
  const count = (list: string[]) => list.reduce((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map<string, number>());
  const first = names.map(short);
  const firstCount = count(first);
  const second = names.map((n, i) => (firstCount.get(first[i])! > 1 ? long(n) : first[i]));
  const secondCount = count(second);
  const seen = new Map<string, number>();
  return second.map((n) => {
    if (secondCount.get(n)! <= 1) return n;
    const k = (seen.get(n) ?? 0) + 1;
    seen.set(n, k);
    return `${n} (${k})`;
  });
};

const stateOf = (row: { userId: string | null; provider: string | null; hasPin: number | boolean | null; schoolStudentId: string | null }): RosterState => {
  if (row.userId && row.hasPin) return 'pin';
  // Del colegio: entra con su cuenta de correo o Google, o activa su acceso con tarjeta (nunca tocando su nombre).
  if (row.schoolStudentId) return row.userId && row.provider !== 'PIN' ? 'account' : 'card';
  if (!row.userId || row.provider === 'PIN') return 'new';
  return 'account';
};

/** Perfil a reclamar con PIN: sin cuenta, o cuenta PIN restablecida por el docente. */
interface ClaimTarget {
  profileId: string;
  classroomId: string;
  classroomName: string;
  classroomCode: string;
  officialName: string;
  avatarGender: 'MALE' | 'FEMALE';
  /** Cuenta PIN existente sin PIN (restablecida). Null = cuenta nueva. */
  resetUserId: string | null;
  linkCode: string | null;
  /** Estudiante del colegio: su tarjeta de clase activa su cuenta del colegio. */
  schoolStudentId: string | null;
}

class StudentPinService {
  /**
   * Lista de la clase para la puerta /unirse (sin sesión). Nombres parciales; si el docente no está
   * verificado no se muestra nada. Excluye alumnos demo y retirados.
   */
  async getClassRoster(code: string): Promise<ClassRoster | null> {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, normalizeCode(code)),
      columns: { id: true, name: true, teacherId: true, isActive: true, acceptingStudents: true, schoolId: true },
    });
    if (!classroom || !classroom.isActive) return null;

    const teacherVerified = await teacherVerificationService.isVerified(classroom.teacherId);
    const [school] = classroom.schoolId
      ? await db.select({ name: schools.name, studentCode: schools.studentCode, isActive: schools.isActive }).from(schools).where(eq(schools.id, classroom.schoolId))
      : [];
    const base = {
      classroomName: classroom.name, open: classroom.acceptingStudents, teacherVerified,
      ...(school?.isActive && school.studentCode ? { schoolCode: school.studentCode, schoolName: school.name } : {}),
    };
    if (!teacherVerified) return { ...base, message: UNVERIFIED_CLASS_MESSAGE, students: [] };

    const rows = await db.select({
      id: studentProfiles.id,
      displayName: studentProfiles.displayName,
      characterName: studentProfiles.characterName,
      userId: studentProfiles.userId,
      schoolStudentId: studentProfiles.schoolStudentId,
      provider: users.provider,
      hasPin: sql<number>`(${users.pinHash} IS NOT NULL)`,
    }).from(studentProfiles)
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(and(
        eq(studentProfiles.classroomId, classroom.id),
        eq(studentProfiles.isActive, true),
        eq(studentProfiles.isDemo, false),
      ));

    const fullName = (r: (typeof rows)[number]) => (r.displayName || r.characterName || 'Estudiante').trim();
    const sorted = [...rows].sort((a, b) => fullName(a).localeCompare(fullName(b), 'es', { sensitivity: 'base' }));
    const names = rosterNames(sorted.map(fullName));
    return {
      ...base,
      students: sorted.map((r, i) => ({ id: r.id, name: names[i], state: stateOf({ ...r, hasPin: Number(r.hasPin) }) })),
    };
  }

  private async findClaimTarget(input: { linkCode?: string; classCode?: string; studentId?: string }): Promise<ClaimTarget> {
    let profile: { id: string; classroomId: string; userId: string | null; displayName: string | null; characterName: string | null; avatarGender: 'MALE' | 'FEMALE'; linkCode: string | null; isDemo: boolean; schoolStudentId: string | null } | undefined;
    let classroom: { id: string; name: string; code: string } | undefined;
    const profileColumns = { id: true, classroomId: true, userId: true, displayName: true, characterName: true, avatarGender: true, linkCode: true, isDemo: true, schoolStudentId: true } as const;

    if (input.linkCode) {
      profile = await db.query.studentProfiles.findFirst({
        where: and(eq(studentProfiles.linkCode, normalizeCode(input.linkCode)), eq(studentProfiles.isActive, true)),
        columns: profileColumns,
      });
      if (!profile) throw new NotFoundError('No encontramos ese código. Revísalo letra por letra con tu profe.');
      const owner = await db.query.classrooms.findFirst({ where: eq(classrooms.id, profile.classroomId), columns: { id: true, name: true, code: true, isActive: true } });
      if (!owner?.isActive) throw new ForbiddenError('Esta clase está archivada. Pídele ayuda a tu profe.');
      classroom = owner;
    } else if (input.classCode && input.studentId) {
      const found = await db.query.classrooms.findFirst({
        where: eq(classrooms.code, normalizeCode(input.classCode)),
        columns: { id: true, name: true, code: true, isActive: true, acceptingStudents: true },
      });
      if (!found || !found.isActive) throw new NotFoundError('No encontramos esa clase.');
      // Elegir el nombre de la lista solo mientras el docente recibe alumnos (si no, con su tarjeta).
      if (!found.acceptingStudents) throw new ForbiddenError(CLOSED_CLASS_MESSAGE);
      classroom = found;
      profile = await db.query.studentProfiles.findFirst({
        where: and(
          eq(studentProfiles.id, input.studentId),
          eq(studentProfiles.classroomId, found.id),
          eq(studentProfiles.isActive, true),
        ),
        columns: profileColumns,
      });
      if (!profile || profile.isDemo) throw new NotFoundError('No encontramos tu nombre en esta clase.');
      // Del colegio: tocando un nombre nadie crea el PIN de otro (antes, tras un restablecimiento, cualquiera podía).
      if (profile.schoolStudentId) throw new ForbiddenError(SCHOOL_CARD_MESSAGE);
    } else {
      throw new ValidationError('Falta tu código o tu nombre.');
    }
    if (!classroom) throw new NotFoundError('Clase no encontrada');

    // Del colegio con la tarjeta de su clase: activa su cuenta del colegio (sus propias comprobaciones).
    if (profile.schoolStudentId) {
      return {
        profileId: profile.id, classroomId: classroom.id, classroomName: classroom.name, classroomCode: classroom.code,
        officialName: (profile.displayName || profile.characterName || 'Estudiante').trim(), avatarGender: profile.avatarGender,
        resetUserId: null, linkCode: profile.linkCode, schoolStudentId: profile.schoolStudentId,
      };
    }

    let resetUserId: string | null = null;
    if (profile.userId) {
      const owner = await db.query.users.findFirst({
        where: eq(users.id, profile.userId),
        columns: { id: true, provider: true, pinHash: true, isActive: true },
      });
      if (!owner || owner.provider !== 'PIN' || owner.pinHash || !owner.isActive) {
        throw new ConflictError(owner?.provider === 'PIN'
          ? 'Ya tienes un PIN: entra con el código de tu clase, tu nombre y tu PIN.'
          : 'Este código ya se usó. Si es tuyo, entra con tu cuenta o pídele a tu profe uno nuevo.');
      }
      resetUserId = owner.id;
    }

    return {
      profileId: profile.id,
      classroomId: classroom.id,
      classroomName: classroom.name,
      classroomCode: classroom.code,
      officialName: (profile.displayName || profile.characterName || 'Estudiante').trim(),
      avatarGender: profile.avatarGender,
      resetUserId,
      linkCode: profile.linkCode,
      schoolStudentId: null,
    };
  }

  /** Crear el PIN (primera vez o tras un restablecimiento). Devuelve una sesión. */
  async setupPin(
    input: { linkCode?: string; classCode?: string; studentId?: string; pin: string; avatarGender?: 'MALE' | 'FEMALE' },
    userAgent?: string | null,
  ): Promise<PinAuthResult> {
    assertNewPin(input.pin);
    const target = await this.findClaimTarget(input);
    await teacherVerificationService.assertClassroomAcceptsAccounts(target.classroomId);

    if (target.schoolStudentId) {
      const activated = await this.activateSchoolAccount({
        studentId: target.schoolStudentId, pin: input.pin, avatarGender: input.avatarGender,
        classCard: input.linkCode ? { profileId: target.profileId, linkCode: normalizeCode(input.linkCode) } : undefined,
      }, userAgent);
      return { user: activated.user, classroom: { name: target.classroomName, code: target.classroomCode }, ...activated.tokens };
    }

    const pinHash = await bcrypt.hash(input.pin, PIN_COST);
    const now = new Date();
    const { firstName, lastName } = splitOfficialStudentName(target.officialName);
    const avatarGender = input.avatarGender ?? target.avatarGender;
    // Por la tarjeta, el código debe seguir siendo el mismo al escribir (dos pestañas a la vez).
    const sameLinkCode = input.linkCode ? eq(studentProfiles.linkCode, normalizeCode(input.linkCode)) : undefined;

    if (target.resetUserId) {
      const userId = target.resetUserId;
      const result = await db.transaction(async (tx) => {
        const updated = await tx.update(users)
          .set({ pinHash, pinFailedAttempts: 0, pinLockedUntil: null, pinLockLevel: 0, updatedAt: now })
          .where(and(eq(users.id, userId), eq(users.provider, 'PIN'), sql`${users.pinHash} IS NULL`));
        if (affectedRows(updated) !== 1) throw new ConflictError('Ya tienes un PIN: entra con el código de tu clase, tu nombre y tu PIN.');
        // La tarjeta de restablecimiento ya cumplió su función.
        await tx.update(studentProfiles).set({ linkCode: null, updatedAt: now })
          .where(and(eq(studentProfiles.id, target.profileId), ...(sameLinkCode ? [sameLinkCode] : [])));
        const user = await tx.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true, firstName: true, lastName: true, avatarUrl: true } });
        const tokens = await generateTokenPair({ userId, email: user!.email, role: 'STUDENT' }, tx, { userAgent });
        return { user: user!, tokens };
      });
      return {
        user: { id: userId, email: result.user.email, firstName: result.user.firstName, lastName: result.user.lastName, role: 'STUDENT', avatarUrl: result.user.avatarUrl, provider: 'PIN' },
        classroom: { name: target.classroomName, code: target.classroomCode },
        ...result.tokens,
      };
    }

    const userId = uuidv4();
    const email = pinEmailFor(userId);
    let tokens: SessionTokens;
    try {
      tokens = await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId, email, password: null, firstName, lastName, role: 'STUDENT', provider: 'PIN',
          pinHash, isActive: true, createdAt: now, updatedAt: now,
        });
        // Atómico: si otro alumno tomó el mismo perfil un instante antes, no se pisa.
        const linked = await tx.update(studentProfiles)
          .set({ userId, avatarGender, linkCode: null, updatedAt: now })
          .where(and(
            eq(studentProfiles.id, target.profileId),
            sql`${studentProfiles.userId} IS NULL`,
            ...(sameLinkCode ? [sameLinkCode] : []),
          ));
        if (affectedRows(linked) !== 1) throw new ConflictError('Este nombre ya tiene acceso. Si eres tú, entra con tu PIN.');
        return generateTokenPair({ userId, email, role: 'STUDENT' }, tx, { userAgent });
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Este nombre ya tiene acceso. Si eres tú, entra con tu PIN.');
      throw error;
    }
    await avatarService.assignDefaultItems(target.profileId, avatarGender);

    return {
      user: { id: userId, email, firstName, lastName, role: 'STUDENT', avatarUrl: null, provider: 'PIN' },
      classroom: { name: target.classroomName, code: target.classroomCode },
      ...tokens,
    };
  }

  /**
   * Revisa el PIN con la fila del usuario bloqueada (los intentos simultáneos no esquivan el
   * contador). Devuelve el error a lanzar FUERA de la transacción, para que el contador se guarde.
   */
  private async checkPinLocked(tx: any, userId: string, pin: string): Promise<{ error?: Error; lock?: { level: number; blocked: boolean }; user?: { email: string; firstName: string; lastName: string; avatarUrl: string | null; provider: StudentUser['provider'] } }> {
    const [user] = await tx.select({
      email: users.email, firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl,
      provider: users.provider, isActive: users.isActive, pinHash: users.pinHash,
      pinFailedAttempts: users.pinFailedAttempts, pinLockedUntil: users.pinLockedUntil, pinLockLevel: users.pinLockLevel,
    }).from(users).where(eq(users.id, userId)).for('update');

    // Una cuenta de correo o Google también entra con PIN si le sumó uno (estudiantes del colegio).
    if (!user || !user.isActive || (user.provider !== 'PIN' && !user.pinHash)) return { error: new UnauthorizedError('Este alumno no entra con PIN.') };
    if (!user.pinHash) return { error: new ConflictError(RESET_MESSAGE) };
    // Tras el último bloqueo ya no se prueba el PIN: solo el docente puede restablecer el acceso.
    if (user.pinLockLevel >= PIN_BLOCK_LEVEL) return { error: new ForbiddenError(BLOCKED_MESSAGE) };

    const now = Date.now();
    if (user.pinLockedUntil && new Date(user.pinLockedUntil).getTime() > now) {
      const minutes = Math.ceil((new Date(user.pinLockedUntil).getTime() - now) / 60_000);
      return { error: new RateLimitError(`Tu PIN está bloqueado por ${minutes} min. Espera o pídele ayuda a tu profe.`) };
    }

    if (!(await bcrypt.compare(pin, user.pinHash))) {
      const attempts = user.pinFailedAttempts + 1;
      if (attempts >= PIN_MAX_ATTEMPTS) {
        const level = user.pinLockLevel + 1;
        const lockMs = PIN_LOCK_STEPS_MS[level - 1];
        await tx.update(users)
          .set({ pinFailedAttempts: 0, pinLockLevel: level, pinLockedUntil: lockMs ? new Date(now + lockMs) : null })
          .where(eq(users.id, userId));
        const lock = { level, blocked: !lockMs };
        if (!lockMs) return { error: new ForbiddenError(BLOCKED_MESSAGE), lock };
        const next = level === PIN_LOCK_STEPS_MS.length
          ? ` Si fallas ${PIN_MAX_ATTEMPTS} más, tu profe tendrá que restablecer tu acceso.`
          : ' Si no lo recuerdas, pídele ayuda a tu profe.';
        return { error: new RateLimitError(`Fallaste ${PIN_MAX_ATTEMPTS} veces${level > 1 ? ' otra vez' : ''}: tu PIN quedó bloqueado ${formatDuration(lockMs)}.${next}`), lock };
      }
      await tx.update(users).set({ pinFailedAttempts: attempts }).where(eq(users.id, userId));
      const left = PIN_MAX_ATTEMPTS - attempts;
      return { error: new UnauthorizedError(`Ese PIN no es correcto. Te ${left === 1 ? 'queda 1 intento' : `quedan ${left} intentos`}.`) };
    }

    if (user.pinFailedAttempts > 0 || user.pinLockedUntil || user.pinLockLevel > 0) {
      await tx.update(users).set({ pinFailedAttempts: 0, pinLockedUntil: null, pinLockLevel: 0 }).where(eq(users.id, userId));
    }
    return { user };
  }

  /** Entrar: código de clase + nombre de la lista + PIN. */
  async loginWithPin(input: { classCode: string; studentId: string; pin: string }, userAgent?: string | null, ip?: string | null): Promise<PinAuthResult> {
    if (!isPinFormatValid(input.pin)) throw new ValidationError('El PIN tiene 4 números.');
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, normalizeCode(input.classCode)),
      columns: { id: true, name: true, code: true, isActive: true, schoolId: true },
    });
    if (!classroom || !classroom.isActive) throw new NotFoundError('No encontramos esa clase.');
    const profile = await db.query.studentProfiles.findFirst({
      where: and(
        eq(studentProfiles.id, input.studentId),
        eq(studentProfiles.classroomId, classroom.id),
        eq(studentProfiles.isActive, true),
      ),
      columns: { userId: true },
    });
    if (!profile) throw new NotFoundError('No encontramos tu nombre en esta clase.');
    if (!profile.userId) throw new ConflictError('Aún no tienes PIN: créalo con tu tarjeta o pídele ayuda a tu profe.');
    const userId = profile.userId;

    const result = await db.transaction(async (tx) => {
      const checked = await this.checkPinLocked(tx, userId, input.pin);
      if (checked.error) return checked;
      const tokens = await generateTokenPair({ userId, email: checked.user!.email, role: 'STUDENT' }, tx, { userAgent });
      return { ...checked, tokens };
    });
    if (result.error) {
      if (result.lock) {
        await recordAudit({
          action: 'student.pin_locked',
          schoolId: classroom.schoolId,
          target: { type: 'user', id: userId },
          metadata: { classroomId: classroom.id, via: 'login', level: result.lock.level, blocked: result.lock.blocked },
          ip: ip ?? null,
        });
      }
      throw result.error;
    }

    const user = result.user!;
    return {
      user: { id: userId, email: user.email, firstName: user.firstName, lastName: user.lastName, role: 'STUDENT', avatarUrl: user.avatarUrl, provider: user.provider },
      classroom: { name: classroom.name, code: classroom.code },
      ...(result as { tokens: SessionTokens }).tokens,
    };
  }

  /**
   * Puerta del colegio: código del colegio (o su QR) + documento + PIN. Si el documento no existe, aún no tiene PIN o
   * el PIN no es correcto, el mismo mensaje y el mismo tiempo (se compara igual contra un hash de relleno): no dice
   * quién estudia ahí. Los bloqueos sí se avisan (llegan después de varios fallos de esa misma cuenta).
   */
  async loginWithDocument(input: { schoolCode: string; document: string; pin: string }, userAgent?: string | null, ip?: string | null): Promise<SchoolAuthResult> {
    if (!isPinFormatValid(input.pin)) throw new ValidationError('El PIN tiene 4 números.');
    const [school] = await db.select({ id: schools.id, name: schools.name, studentCode: schools.studentCode, isActive: schools.isActive })
      .from(schools).where(eq(schools.studentCode, normalizeCode(input.schoolCode)));
    if (!school || !school.isActive) throw new NotFoundError('No encontramos ese colegio. Revisa el código con tu tutor.');
    if (!piiReady()) throw new ConflictError('Tu colegio aún no puede usar el acceso con DNI: entra con el código de tu clase.');

    const failed = async () => {
      await dummyCompare(input.pin);
      return new UnauthorizedError(SCHOOL_LOGIN_FAILED);
    };
    const normalized = normalizeDocument(input.document);
    if (normalized.length < 6 || normalized.length > 12) throw await failed();
    const [student] = await db.select({ userId: schoolStudents.userId }).from(schoolStudents)
      .where(and(eq(schoolStudents.schoolId, school.id), eq(schoolStudents.documentIndex, documentIndex(school.id, normalized)), eq(schoolStudents.status, 'ACTIVE')))
      .limit(1);
    if (!student?.userId) throw await failed();
    const userId = student.userId;
    const [owner] = await db.select({ pinHash: users.pinHash, role: users.role }).from(users).where(eq(users.id, userId));
    if (!owner?.pinHash || owner.role !== 'STUDENT') throw await failed();

    const result = await db.transaction(async (tx) => {
      const checked = await this.checkPinLocked(tx, userId, input.pin);
      if (checked.error) return checked;
      const tokens = await generateTokenPair({ userId, email: checked.user!.email, role: 'STUDENT' }, tx, { userAgent });
      return { ...checked, tokens };
    });
    if (result.error) {
      if (result.lock) {
        await recordAudit({
          action: 'student.pin_locked',
          schoolId: school.id,
          target: { type: 'user', id: userId },
          metadata: { via: 'school_login', level: result.lock.level, blocked: result.lock.blocked },
          ip: ip ?? null,
        });
      }
      // PIN equivocado (o sin PIN): el mismo mensaje de siempre. (AppError fija su prototipo: se compara el código.)
      if (result.error instanceof AppError && (result.error.statusCode === 401 || result.error.statusCode === 409)) throw new UnauthorizedError(SCHOOL_LOGIN_FAILED);
      throw result.error;
    }
    const user = result.user!;
    return {
      user: { id: userId, email: user.email, firstName: user.firstName, lastName: user.lastName, role: 'STUDENT', avatarUrl: user.avatarUrl, provider: user.provider },
      school: { name: school.name, code: school.studentCode },
      ...(result as { tokens: SessionTokens }).tokens,
    };
  }

  /** Primera vez (o tras un restablecimiento) con la tarjeta del colegio: crea su PIN y entra. */
  async activateWithCard(input: { code: string; pin: string; avatarGender?: 'MALE' | 'FEMALE' }, userAgent?: string | null): Promise<SchoolAuthResult> {
    assertNewPin(input.pin);
    const code = normalizeCode(input.code);
    const [card] = await db.select({ studentId: schoolStudents.id, schoolName: schools.name, schoolCode: schools.studentCode, schoolActive: schools.isActive })
      .from(schoolStudents)
      .innerJoin(schools, eq(schools.id, schoolStudents.schoolId))
      .where(eq(schoolStudents.accessCode, code))
      .limit(1);
    if (!card) throw new NotFoundError('No encontramos esa tarjeta. Revísala letra por letra o pídele una nueva a tu tutor.');
    if (!card.schoolActive) throw new ForbiddenError('Tu colegio no está activo en Juried. Pídele ayuda a tu tutor.');
    const activated = await this.activateSchoolAccount({ studentId: card.studentId, pin: input.pin, avatarGender: input.avatarGender, accessCode: code }, userAgent);
    return { user: activated.user, school: { name: card.schoolName, code: card.schoolCode }, ...activated.tokens };
  }

  /**
   * Activa la cuenta del colegio de un estudiante con su PIN: la que ya tiene (la del colegio, o la única que usa en sus
   * clases, de correo, Google o PIN) o una nueva. Sus perfiles del colegio sin cuenta pasan a ella, así entra a todas
   * sus clases con un solo PIN. Con la fila del estudiante bloqueada: dos pestañas no crean dos cuentas.
   */
  private async activateSchoolAccount(
    input: { studentId: string; pin: string; avatarGender?: 'MALE' | 'FEMALE'; accessCode?: string; classCard?: { profileId: string; linkCode: string } },
    userAgent?: string | null,
  ) {
    const pinHash = await bcrypt.hash(input.pin, PIN_COST);
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [student] = await tx.select({
        id: schoolStudents.id, schoolId: schoolStudents.schoolId, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames,
        status: schoolStudents.status, userId: schoolStudents.userId, accessCode: schoolStudents.accessCode,
      }).from(schoolStudents).where(eq(schoolStudents.id, input.studentId)).for('update');
      if (!student || student.status !== 'ACTIVE') throw new NotFoundError('No encontramos tu tarjeta. Pídele una nueva a tu tutor.');
      if (input.accessCode && student.accessCode !== input.accessCode) {
        throw new ConflictError('Esta tarjeta ya se usó o la reemplazaron por otra. Pídele una nueva a tu tutor.');
      }

      let accountId = student.userId;
      if (!accountId) {
        const owners = await tx.selectDistinct({ id: users.id }).from(studentProfiles)
          .innerJoin(users, eq(users.id, studentProfiles.userId))
          .where(and(eq(studentProfiles.schoolStudentId, student.id), eq(users.role, 'STUDENT'), eq(users.isActive, true)));
        if (owners.length > 1) throw new ConflictError('Tienes más de una cuenta en el colegio: pídele ayuda a la administración.');
        accountId = owners[0]?.id ?? null;
      }
      const newAccount = !accountId;
      let account: { id: string; email: string; firstName: string; lastName: string; avatarUrl: string | null; provider: StudentUser['provider'] };
      if (accountId) {
        const [owner] = await tx.select({
          id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl,
          provider: users.provider, pinHash: users.pinHash, isActive: users.isActive, role: users.role,
        }).from(users).where(eq(users.id, accountId)).for('update');
        if (!owner || !owner.isActive || owner.role !== 'STUDENT') throw new ConflictError('Tu cuenta está desactivada: pídele ayuda a la administración.');
        if (owner.pinHash) throw new ConflictError('Ya tienes tu PIN: entra con tu DNI y tu PIN.');
        await tx.update(users).set({ pinHash, pinFailedAttempts: 0, pinLockedUntil: null, pinLockLevel: 0, updatedAt: now }).where(eq(users.id, owner.id));
        account = owner;
      } else {
        const id = uuidv4();
        account = { id, email: pinEmailFor(id), firstName: student.firstNames, lastName: student.lastNames, avatarUrl: null, provider: 'PIN' };
        await tx.insert(users).values({
          id, email: account.email, password: null, firstName: account.firstName, lastName: account.lastName, role: 'STUDENT', provider: 'PIN',
          pinHash, isActive: true, createdAt: now, updatedAt: now,
        });
      }
      await tx.update(schoolStudents).set({ userId: account.id, accessCode: null, accessCodeAt: null, updatedAt: now }).where(eq(schoolStudents.id, student.id));
      if (input.classCard) {
        await tx.update(studentProfiles).set({ linkCode: null, updatedAt: now })
          .where(and(eq(studentProfiles.id, input.classCard.profileId), eq(studentProfiles.linkCode, input.classCard.linkCode)));
      }
      // Sus clases del colegio aún sin cuenta pasan a la suya (salvo una clase donde esa cuenta ya tiene perfil).
      const taken = (await tx.select({ classroomId: studentProfiles.classroomId }).from(studentProfiles).where(eq(studentProfiles.userId, account.id)))
        .map((p) => p.classroomId);
      const free = await tx.select({ id: studentProfiles.id, avatarGender: studentProfiles.avatarGender }).from(studentProfiles)
        .where(and(
          eq(studentProfiles.schoolStudentId, student.id), isNull(studentProfiles.userId),
          taken.length ? notInArray(studentProfiles.classroomId, taken) : undefined,
        ));
      const gender = newAccount ? input.avatarGender : undefined;
      if (free.length > 0) {
        await tx.update(studentProfiles).set({ userId: account.id, linkCode: null, ...(gender ? { avatarGender: gender } : {}), updatedAt: now })
          .where(inArray(studentProfiles.id, free.map((p) => p.id)));
      }
      const tokens = await generateTokenPair({ userId: account.id, email: account.email, role: 'STUDENT' }, tx, { userAgent });
      return { account, tokens, newAccount, schoolId: student.schoolId, regender: gender ? free.filter((p) => p.avatarGender !== gender).map((p) => p.id) : [], gender };
    });
    // Eligió chica o chico al crear su cuenta: sus avatares toman la ropa inicial de ese cuerpo.
    for (const profileId of result.regender) await avatarService.assignDefaultItems(profileId, result.gender!);
    await recordAudit({
      action: 'student.access_activated',
      schoolId: result.schoolId,
      target: { type: 'school_student', id: input.studentId },
      metadata: { via: input.accessCode ? 'school_card' : 'class_card', newAccount: result.newAccount },
    });
    const { account } = result;
    return {
      user: { id: account.id, email: account.email, firstName: account.firstName, lastName: account.lastName, role: 'STUDENT' as const, avatarUrl: account.avatarUrl, provider: account.provider },
      tokens: result.tokens,
    };
  }

  /**
   * El alumno cambia su PIN (con el actual). Cierra sus otras sesiones (por si alguien lo vio) y
   * devuelve una sesión nueva para este dispositivo.
   */
  async changePin(userId: string, currentPin: string, newPin: string, userAgent?: string | null, ip?: string | null): Promise<SessionTokens> {
    if (!isPinFormatValid(currentPin)) throw new ValidationError('Tu PIN actual tiene 4 números.');
    assertNewPin(newPin);
    if (currentPin === newPin) throw new ValidationError('El PIN nuevo debe ser distinto del actual.');
    const pinHash = await bcrypt.hash(newPin, PIN_COST);

    const result = await db.transaction(async (tx) => {
      const checked = await this.checkPinLocked(tx, userId, currentPin);
      if (checked.error) return checked;
      await tx.update(users).set({ pinHash, updatedAt: new Date() }).where(eq(users.id, userId));
      return checked;
    });
    if (result.error) {
      if (result.lock) {
        await recordAudit({
          action: 'student.pin_locked',
          actor: { id: userId, role: 'STUDENT' },
          target: { type: 'user', id: userId },
          metadata: { via: 'change_pin', level: result.lock.level, blocked: result.lock.blocked },
          ip: ip ?? null,
        });
      }
      // Un PIN actual equivocado no debe cerrar la sesión del alumno (el cliente renovaría por 401).
      // (AppError fija su prototipo: se compara el código, no la subclase.)
      if (result.error instanceof AppError && result.error.statusCode === 401) throw new ValidationError(result.error.message.replace('Ese PIN', 'Tu PIN actual'));
      throw result.error;
    }
    await revokeAllUserTokens(userId);
    return generateTokenPair({ userId, email: result.user!.email, role: 'STUDENT' }, db, { userAgent });
  }

  /**
   * Docente: "Restablecer acceso". Borra el PIN, cierra todas las sesiones del alumno y genera una
   * tarjeta nueva para que cree otro PIN. Solo cuentas con PIN (las de correo o Google no).
   */
  async resetAccess(studentProfileId: string, teacherId: string): Promise<{ linkCode: string; classroomId: string; schoolId: string | null }> {
    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, studentProfileId),
      columns: { id: true, classroomId: true, userId: true, schoolStudentId: true },
    });
    if (!profile) throw new NotFoundError('Estudiante no encontrado');
    const classroom = await db.query.classrooms.findFirst({ where: eq(classrooms.id, profile.classroomId), columns: { teacherId: true, schoolId: true } });
    if (!classroom || classroom.teacherId !== teacherId) throw new ForbiddenError('No tienes permiso para modificar este estudiante');
    // Del colegio: su PIN es de todas sus clases; lo restablecen la administración o su tutor (no cada docente).
    const [schoolAccount] = profile.userId
      ? await db.select({ id: schoolStudents.id }).from(schoolStudents).where(eq(schoolStudents.userId, profile.userId)).limit(1)
      : [];
    if (profile.schoolStudentId || schoolAccount) throw new ForbiddenError('Su acceso es del colegio: lo restablecen la administración o su tutor.');
    if (!profile.userId) throw new ConflictError('Este alumno aún no tiene acceso: usa su código de acceso.');
    const userId = profile.userId;
    const owner = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { provider: true } });
    if (owner?.provider !== 'PIN') throw new ConflictError('Este alumno entra con su correo o Google; su acceso no usa PIN.');

    const now = new Date();
    let linkCode = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      linkCode = generateRandomCode(6);
      try {
        await db.transaction(async (tx) => {
          await tx.update(users).set({ pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null, pinLockLevel: 0, updatedAt: now }).where(eq(users.id, userId));
          await tx.update(studentProfiles).set({ linkCode, updatedAt: now }).where(eq(studentProfiles.id, profile.id));
        });
        break;
      } catch (error) {
        if (!isDuplicateEntry(error) || attempt === 9) throw error;
      }
    }
    await revokeAllUserTokens(userId);
    return { linkCode, classroomId: profile.classroomId, schoolId: classroom.schoolId };
  }
}

export const studentPinService = new StudentPinService();
