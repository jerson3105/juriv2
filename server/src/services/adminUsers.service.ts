import bcrypt from 'bcryptjs';
import { and, count, eq, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, classrooms, studentProfiles } from '../db/schema.js';
import { cache, CACHE_KEYS } from '../utils/cache.js';
import { revokeAllUserTokens } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { teacherVerificationService } from './teacherVerification.service.js';

export type AssignableRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

const PIN_EMAIL = /@alumnos\.juried\.invalid$/i;

const affectedRows = (result: unknown): number => {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number }).affectedRows ?? 0);
};

/** Administradores activos sin contar a `excludeId` (para no dejar el sistema sin administración). */
const otherActiveAdmins = async (excludeId: string): Promise<number> => {
  const [row] = await db.select({ n: count() }).from(users)
    .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true), ne(users.id, excludeId)));
  return Number(row?.n ?? 0);
};

const findTarget = async (userId: string) => {
  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, role: true, provider: true, isActive: true },
  });
  if (!target) throw new NotFoundError('Usuario no encontrado');
  return target;
};

/**
 * Cambios de rol y de estado hechos desde el panel. Hasta que exista la bitácora, cada cambio deja
 * una línea en el log de la app (quién, a quién, de qué a qué).
 */
export const adminUsersService = {
  async changeRole(actorId: string, targetId: string, role: AssignableRole, currentPassword?: string) {
    if (actorId === targetId) throw new ConflictError('No puedes cambiar tu propio rol.');
    const target = await findTarget(targetId);
    if (target.role === role) return { role };
    if (target.role === 'PARENT') throw new ConflictError('Las cuentas de familia no cambian de rol.');
    if (role !== 'STUDENT' && (target.provider === 'PIN' || PIN_EMAIL.test(target.email))) {
      throw new ConflictError('Una cuenta con PIN es de alumno: no puede ser profesor ni administrador.');
    }

    // Dar acceso total pide la contraseña de quien lo da: una sesión robada no basta.
    if (role === 'ADMIN') {
      const actor = await db.query.users.findFirst({ where: eq(users.id, actorId), columns: { password: true, provider: true } });
      if (!actor?.password || actor.provider !== 'LOCAL') {
        throw new ForbiddenError('Para dar el rol de administrador entra con tu correo y contraseña.');
      }
      if (!currentPassword) throw new ForbiddenError('Escribe tu contraseña para dar el rol de administrador.');
      if (!(await bcrypt.compare(currentPassword, actor.password))) throw new ForbiddenError('Tu contraseña no es correcta.');
    }

    if (target.role === 'TEACHER') {
      const [row] = await db.select({ n: count() }).from(classrooms)
        .where(and(eq(classrooms.teacherId, targetId), eq(classrooms.isActive, true)));
      const n = Number(row?.n ?? 0);
      if (n > 0) throw new ConflictError(`Tiene ${n === 1 ? '1 clase activa' : `${n} clases activas`}: archívalas antes de cambiarle el rol.`);
    }
    if (target.role === 'STUDENT') {
      const [row] = await db.select({ n: count() }).from(studentProfiles)
        .where(and(eq(studentProfiles.userId, targetId), eq(studentProfiles.isActive, true)));
      const n = Number(row?.n ?? 0);
      if (n > 0) throw new ConflictError(`Es alumno en ${n === 1 ? '1 clase' : `${n} clases`}: sácalo de ellas antes de cambiarle el rol.`);
    }
    if (target.role === 'ADMIN' && (await otherActiveAdmins(targetId)) < 1) {
      throw new ConflictError('No puede quedar el sistema sin administrador.');
    }

    const result = await db.update(users)
      .set({
        role,
        ...(role === 'TEACHER' ? {} : { teacherStatus: null, teacherVerifiedVia: null, teacherVerifiedAt: null }),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, targetId), eq(users.role, target.role)));
    if (affectedRows(result) < 1) throw new ConflictError('La cuenta cambió mientras tanto. Recarga e inténtalo de nuevo.');

    if (role === 'TEACHER') await teacherVerificationService.markVerified(targetId, 'ADMIN');
    // El rol viaja en el token y en el socket: se cierran sus sesiones para que entre con el nuevo.
    cache.delete(CACHE_KEYS.user(targetId));
    await revokeAllUserTokens(targetId);
    logger.info('admin.role_change', { actorId, targetId, from: target.role, to: role });
    return { role };
  },

  async setActive(actorId: string, targetId: string, isActive: boolean) {
    if (actorId === targetId) throw new ConflictError('No puedes desactivar tu propia cuenta.');
    const target = await findTarget(targetId);
    if (target.isActive === isActive) return { isActive };
    if (!isActive && target.role === 'ADMIN' && (await otherActiveAdmins(targetId)) < 1) {
      throw new ConflictError('No puede quedar el sistema sin administrador.');
    }

    await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, targetId));
    cache.delete(CACHE_KEYS.user(targetId));
    // Desactivar corta ya: sesiones, refresh y sockets (el login, el PIN y Google ya rechazan cuentas inactivas).
    if (!isActive) await revokeAllUserTokens(targetId);
    logger.info('admin.user_status', { actorId, targetId, isActive });
    return { isActive };
  },
};
