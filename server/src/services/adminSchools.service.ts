import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { schoolMembers, schools, users } from '../db/schema.js';
import { ConflictError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { cleanText } from '../utils/textClean.js';
import { personName, temporaryPassword } from './schoolTeacherAccount.service.js';
import { teacherVerificationService } from './teacherVerification.service.js';

/**
 * El equipo de Juried crea un colegio ya verificado, con su responsable y (si lo tiene) el dominio de su correo
 * institucional ligado a él: con ese dominio la administración del colegio crea las cuentas de sus docentes.
 * El responsable: si su correo ya es de una cuenta de docente, se suma (y queda verificado); si no, la cuenta nace con
 * una clave temporal que se muestra una sola vez.
 */

export interface AdminSchoolInput {
  name: string;
  modularCode?: string | null;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  owner: { email: string; firstNames?: string; lastNames?: string };
  domain?: { domain: string; scope: 'TEACHERS_ONLY' | 'SHARED' } | null;
}

const optional = (value: string | null | undefined, max: number) => {
  const text = cleanText(value ?? '');
  return text ? text.slice(0, max) : null;
};

export const adminSchoolsService = {
  async create(adminId: string, input: AdminSchoolInput) {
    const name = cleanText(input.name);
    if (name.length < 3 || name.length > 255) throw new ValidationError('El nombre del colegio: de 3 a 255 caracteres');
    const modularCode = input.modularCode?.replace(/\s+/g, '') || null;
    if (modularCode && !/^\d{7}$/.test(modularCode)) throw new ValidationError('El código modular tiene 7 números');
    if (modularCode) {
      const [taken] = await db.select({ name: schools.name }).from(schools).where(eq(schools.modularCode, modularCode)).limit(1);
      if (taken) throw new ConflictError(`Ese código modular ya es de «${taken.name}»`);
    }
    // El dominio se revisa antes de crear nada (formato, que no sea de correo personal y que no esté ya en la lista).
    const domain = input.domain ? await teacherVerificationService.checkNewDomain(input.domain.domain) : null;

    const email = input.owner.email.trim().toLowerCase();
    const [existing] = await db.select({ id: users.id, role: users.role, isActive: users.isActive, teacherStatus: users.teacherStatus })
      .from(users).where(eq(users.email, email)).limit(1);
    if (existing && existing.role !== 'TEACHER') throw new ConflictError('El correo del responsable es de una cuenta que no es de docente');
    if (existing && !existing.isActive) throw new ConflictError('La cuenta del responsable está desactivada: actívala antes');
    const firstName = existing ? '' : personName(input.owner.firstNames ?? '', 'Nombres del responsable');
    const lastName = existing ? '' : personName(input.owner.lastNames ?? '', 'Apellidos del responsable');

    const now = new Date();
    const schoolId = uuidv4();
    const ownerId = existing?.id ?? uuidv4();
    const password = existing ? null : temporaryPassword();
    try {
      await db.transaction(async (tx) => {
        if (!existing) {
          await tx.insert(users).values({
            id: ownerId, email, firstName, lastName, password: await bcrypt.hash(password!, 12), role: 'TEACHER',
            teacherStatus: 'VERIFIED', teacherVerifiedVia: 'ADMIN', teacherVerifiedAt: now, provider: 'LOCAL', isActive: true,
            notifyBadges: true, notifyLevelUp: true, createdAt: now, updatedAt: now,
          });
        }
        await tx.insert(schools).values({
          id: schoolId, name, modularCode,
          address: optional(input.address, 300), city: optional(input.city, 100), province: optional(input.region, 100), country: 'Perú',
          isVerified: true, isActive: true, createdBy: adminId, createdAt: now, updatedAt: now,
        });
        await tx.insert(schoolMembers).values({ id: uuidv4(), schoolId, userId: ownerId, role: 'OWNER', status: 'VERIFIED', joinedAt: now, createdAt: now, updatedAt: now });
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Ese correo o ese código modular se acaban de usar: recarga e inténtalo otra vez');
      throw error;
    }
    if (existing && existing.teacherStatus !== 'VERIFIED') await teacherVerificationService.markVerified(ownerId, 'ADMIN');

    let linkedDomain: { domain: string; verified: number } | null = null;
    let domainError: string | null = null;
    if (domain) {
      try {
        const added = await teacherVerificationService.addDomain(adminId, { domain, scope: input.domain!.scope, schoolId });
        linkedDomain = { domain: added.domain, verified: added.verified };
      } catch (error) {
        // El colegio ya quedó creado: se avisa y el dominio se agrega luego desde «Dominios».
        domainError = error instanceof Error ? error.message : 'No se pudo agregar el dominio';
      }
    }
    return {
      schoolId,
      name,
      owner: { userId: ownerId, email, created: !existing, ...(password ? { temporaryPassword: password } : {}) },
      domain: linkedDomain,
      ...(domainError ? { domainError } : {}),
    };
  },
};
