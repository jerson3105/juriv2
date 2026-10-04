import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db, users, studentProfiles, classrooms } from '../db/index.js';
import { generateTokenPair, revokeAllUserTokens, type SessionTokens } from '../utils/jwt.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError, RateLimitError, UnauthorizedError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { formatDuration, generateRandomCode } from '../utils/helpers.js';
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
 */

// Correo interno (dominio reservado .invalid): la columna es obligatoria, pero nunca se muestra ni recibe correos.
const PIN_EMAIL_DOMAIN = 'alumnos.juried.invalid';
const pinEmailFor = (userId: string) => `pin-${userId}@${PIN_EMAIL_DOMAIN}`;
const PIN_COST = 10;

const CLOSED_CLASS_MESSAGE = 'Esta clase no está recibiendo estudiantes ahora. Pídele tu tarjeta a tu profe.';
const RESET_MESSAGE = 'Tu profe restableció tu acceso: crea un PIN nuevo con la tarjeta que te dio.';
const BLOCKED_MESSAGE = 'Tu acceso quedó bloqueado por seguridad. Pídele a tu profe que lo restablezca.';

export type RosterState = 'new' | 'pin' | 'account';
export interface ClassRoster {
  classroomName: string;
  open: boolean;
  teacherVerified: boolean;
  message?: string;
  students: Array<{ id: string; name: string; state: RosterState }>;
}

interface PinAuthResult extends SessionTokens {
  user: { id: string; email: string; firstName: string; lastName: string; role: 'STUDENT'; avatarUrl: string | null; provider: 'PIN' };
  classroom: { name: string; code: string };
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

const stateOf = (row: { userId: string | null; provider: string | null; hasPin: number | boolean | null }): RosterState => {
  if (!row.userId) return 'new';
  if (row.provider === 'PIN') return row.hasPin ? 'pin' : 'new';
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
}

class StudentPinService {
  /**
   * Lista de la clase para la puerta /unirse (sin sesión). Nombres parciales; si el docente no está
   * verificado no se muestra nada. Excluye alumnos demo y retirados.
   */
  async getClassRoster(code: string): Promise<ClassRoster | null> {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, normalizeCode(code)),
      columns: { id: true, name: true, teacherId: true, isActive: true, acceptingStudents: true },
    });
    if (!classroom || !classroom.isActive) return null;

    const teacherVerified = await teacherVerificationService.isVerified(classroom.teacherId);
    const base = { classroomName: classroom.name, open: classroom.acceptingStudents, teacherVerified };
    if (!teacherVerified) return { ...base, message: UNVERIFIED_CLASS_MESSAGE, students: [] };

    const rows = await db.select({
      id: studentProfiles.id,
      displayName: studentProfiles.displayName,
      characterName: studentProfiles.characterName,
      userId: studentProfiles.userId,
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
    let profile: { id: string; classroomId: string; userId: string | null; displayName: string | null; characterName: string | null; avatarGender: 'MALE' | 'FEMALE'; linkCode: string | null; isDemo: boolean } | undefined;
    let classroom: { id: string; name: string; code: string } | undefined;
    const profileColumns = { id: true, classroomId: true, userId: true, displayName: true, characterName: true, avatarGender: true, linkCode: true, isDemo: true } as const;

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
    } else {
      throw new ValidationError('Falta tu código o tu nombre.');
    }
    if (!classroom) throw new NotFoundError('Clase no encontrada');

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
  private async checkPinLocked(tx: any, userId: string, pin: string): Promise<{ error?: Error; lock?: { level: number; blocked: boolean }; user?: { email: string; firstName: string; lastName: string; avatarUrl: string | null } }> {
    const [user] = await tx.select({
      email: users.email, firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl,
      provider: users.provider, isActive: users.isActive, pinHash: users.pinHash,
      pinFailedAttempts: users.pinFailedAttempts, pinLockedUntil: users.pinLockedUntil, pinLockLevel: users.pinLockLevel,
    }).from(users).where(eq(users.id, userId)).for('update');

    if (!user || user.provider !== 'PIN' || !user.isActive) return { error: new UnauthorizedError('Este alumno no entra con PIN.') };
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
      user: { id: userId, email: user.email, firstName: user.firstName, lastName: user.lastName, role: 'STUDENT', avatarUrl: user.avatarUrl, provider: 'PIN' },
      classroom: { name: classroom.name, code: classroom.code },
      ...(result as { tokens: SessionTokens }).tokens,
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
      columns: { id: true, classroomId: true, userId: true },
    });
    if (!profile) throw new NotFoundError('Estudiante no encontrado');
    const classroom = await db.query.classrooms.findFirst({ where: eq(classrooms.id, profile.classroomId), columns: { teacherId: true, schoolId: true } });
    if (!classroom || classroom.teacherId !== teacherId) throw new ForbiddenError('No tienes permiso para modificar este estudiante');
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
