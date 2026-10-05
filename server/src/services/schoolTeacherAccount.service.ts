import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { schoolMembers, users, verifiedDomains } from '../db/schema.js';
import type { SchoolRole } from '../utils/access.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { revokeAllUserTokens } from '../utils/jwt.js';
import { cleanText } from '../utils/textClean.js';
import { teacherVerificationService } from './teacherVerification.service.js';

/**
 * Cuentas de docentes que crea la administración del colegio. Solo con un correo de un dominio verificado del colegio
 * (nadie crea cuentas con correos ajenos). Si ya tiene cuenta de docente, entra directo al colegio; si no, la cuenta
 * nace verificada y dentro del colegio, con una clave temporal que se muestra una sola vez (no se guarda en claro).
 */

const LETTERS_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LETTERS_LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const ANY = LETTERS_UPPER + LETTERS_LOWER + DIGITS;
const pick = (chars: string) => chars[randomInt(chars.length)];

/** «Kx7m-Qp2r-Zt9w»: fácil de dictar y cumple la política (mayúscula, minúscula, número y signo). */
export const temporaryPassword = () => {
  const groups = [
    pick(LETTERS_UPPER) + pick(LETTERS_LOWER) + pick(DIGITS) + pick(ANY),
    Array.from({ length: 4 }, () => pick(ANY)).join(''),
    Array.from({ length: 4 }, () => pick(ANY)).join(''),
  ];
  return groups.join('-');
};

export const personName = (raw: string, label: string) => {
  const value = cleanText(raw);
  if (value.length < 1 || value.length > 100 || !/\p{L}/u.test(value)) throw new ValidationError(`${label}: de 1 a 100 caracteres, con letras`);
  return value;
};

export const schoolTeacherAccountService = {
  /** Dominios verificados del colegio (con ellos se crean cuentas). */
  async domains(schoolId: string) {
    const rows = await db.select({ domain: verifiedDomains.domain }).from(verifiedDomains).where(eq(verifiedDomains.schoolId, schoolId));
    return rows.map((r) => r.domain.toLowerCase()).sort();
  },

  async create(schoolId: string, input: { firstName: string; lastName: string; email: string }) {
    const email = input.email.trim().toLowerCase();
    const domain = email.split('@')[1] ?? '';
    const domains = await this.domains(schoolId);
    if (domains.length === 0) throw new ConflictError('Tu colegio aún no tiene un dominio verificado: invita con el enlace o el código');
    if (!domains.includes(domain)) throw new ValidationError(`El correo debe ser del colegio (${domains.map((d) => `@${d}`).join(' o ')})`);
    const firstName = personName(input.firstName, 'Nombres');
    const lastName = personName(input.lastName, 'Apellidos');
    const now = new Date();

    const [existing] = await db.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      if (existing.role !== 'TEACHER') throw new ConflictError('Ese correo es de una cuenta que no es de docente');
      if (!existing.isActive) throw new ConflictError('Esa cuenta está desactivada: pídele al equipo de Juried que la active');
      const [member] = await db.select({ id: schoolMembers.id, status: schoolMembers.status }).from(schoolMembers)
        .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.userId, existing.id)));
      if (member?.status === 'VERIFIED') throw new ConflictError('Ese docente ya es parte del colegio');
      if (member) {
        // Tenía una solicitud o un rechazo: la administración lo agrega.
        await db.update(schoolMembers).set({ status: 'VERIFIED', role: 'TEACHER', rejectionReason: null, joinedAt: now, updatedAt: now })
          .where(eq(schoolMembers.id, member.id));
      } else {
        await db.insert(schoolMembers).values({ id: uuidv4(), schoolId, userId: existing.id, role: 'TEACHER', status: 'VERIFIED', joinedAt: now, createdAt: now, updatedAt: now });
      }
      await teacherVerificationService.markVerified(existing.id, 'SCHOOL');
      return { userId: existing.id, email, created: false as const };
    }

    const password = temporaryPassword();
    const userId = uuidv4();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId, email, firstName, lastName, password: await bcrypt.hash(password, 12), role: 'TEACHER',
          teacherStatus: 'VERIFIED', teacherVerifiedVia: 'SCHOOL', teacherVerifiedAt: now, provider: 'LOCAL', isActive: true,
          notifyBadges: true, notifyLevelUp: true, createdAt: now, updatedAt: now,
        });
        await tx.insert(schoolMembers).values({ id: uuidv4(), schoolId, userId, role: 'TEACHER', status: 'VERIFIED', joinedAt: now, createdAt: now, updatedAt: now });
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Esa cuenta se acaba de crear: recarga la lista de docentes');
      throw error;
    }
    return { userId, email, created: true as const, temporaryPassword: password };
  },

  /**
   * La administración restablece la clave de un docente con el correo del colegio (una cuenta que ella podría crear):
   * clave temporal nueva, que se ve una sola vez, y se cierran sus sesiones. La del responsable no se restablece aquí;
   * la de la administración, solo el responsable; la propia, en Configuración.
   */
  async resetPassword(schoolId: string, memberId: string, actor: { userId: string; role: SchoolRole }) {
    const [member] = await db.select({
      userId: schoolMembers.userId, role: schoolMembers.role, status: schoolMembers.status,
      email: users.email, provider: users.provider, userRole: users.role, isActive: users.isActive, firstName: users.firstName, lastName: users.lastName,
    }).from(schoolMembers).innerJoin(users, eq(users.id, schoolMembers.userId))
      .where(and(eq(schoolMembers.id, memberId), eq(schoolMembers.schoolId, schoolId)));
    if (!member || member.status !== 'VERIFIED') throw new NotFoundError('Docente no encontrado en el colegio');
    if (member.userId === actor.userId) throw new ValidationError('Tu propia clave la cambias en Configuración');
    if (member.role === 'OWNER') throw new ForbiddenError('La clave del responsable no se restablece desde aquí');
    if (member.role === 'ADMIN' && actor.role !== 'OWNER') throw new ForbiddenError('Solo el responsable restablece la clave de la administración');
    if (member.userRole !== 'TEACHER' || !member.isActive) throw new ConflictError('Esa cuenta no está activa');
    if (member.provider !== 'LOCAL') throw new ConflictError('Entra con Google: no tiene una clave que restablecer');
    const domains = await this.domains(schoolId);
    if (!domains.includes(member.email.split('@')[1]?.toLowerCase() ?? '')) {
      throw new ForbiddenError(domains.length
        ? `Solo se restablecen cuentas con el correo del colegio (${domains.map((d) => `@${d}`).join(' o ')})`
        : 'Tu colegio aún no tiene un dominio verificado: sin él no se restablecen claves');
    }
    const password = temporaryPassword();
    await db.update(users).set({ password: await bcrypt.hash(password, 12), updatedAt: new Date() }).where(eq(users.id, member.userId));
    // Quien tuviera la sesión abierta (o la clave anterior) queda fuera.
    await revokeAllUserTokens(member.userId);
    return { userId: member.userId, email: member.email, name: `${member.firstName} ${member.lastName}`.trim(), temporaryPassword: password };
  },
};
