import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { schoolMembers, users, verifiedDomains } from '../db/schema.js';
import { ConflictError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
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

const personName = (raw: string, label: string) => {
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
};
