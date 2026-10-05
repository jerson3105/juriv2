import bcrypt from 'bcryptjs';
import { and, eq, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { schoolMembers, schools, users } from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { cleanText } from '../utils/textClean.js';
import { removeMemberIn } from './schoolManagement.service.js';
import { personName, temporaryPassword } from './schoolTeacherAccount.service.js';
import { teacherVerificationService } from './teacherVerification.service.js';

/**
 * El equipo de Juried crea un colegio ya verificado, con su responsable y (si lo tiene) el dominio de su correo
 * institucional ligado a él: con ese dominio la administración del colegio crea las cuentas de sus docentes.
 * El responsable: si su correo ya es de una cuenta de docente, se suma (y queda verificado); si no, la cuenta nace con
 * una clave temporal que se muestra una sola vez.
 */

export interface AdminSchoolData {
  name: string;
  modularCode?: string | null;
  region?: string | null;
  city?: string | null;
  address?: string | null;
}

/** Al cambiar de responsable, el anterior queda en la administración, como docente, o sale del colegio. */
export type PreviousOwner = 'ADMIN' | 'TEACHER' | 'REMOVE';

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

/** Nombre y código modular (7 números, único entre colegios; except = el colegio que se edita). */
const checkSchoolData = async (input: AdminSchoolData, except?: string) => {
  const name = cleanText(input.name);
  if (name.length < 3 || name.length > 255) throw new ValidationError('El nombre del colegio: de 3 a 255 caracteres');
  const modularCode = input.modularCode?.replace(/\s+/g, '') || null;
  if (modularCode && !/^\d{7}$/.test(modularCode)) throw new ValidationError('El código modular tiene 7 números');
  if (modularCode) {
    const [taken] = await db.select({ name: schools.name }).from(schools)
      .where(and(eq(schools.modularCode, modularCode), except ? ne(schools.id, except) : undefined)).limit(1);
    if (taken) throw new ConflictError(`Ese código modular ya es de «${taken.name}»`);
  }
  return { name, modularCode, address: optional(input.address, 300), city: optional(input.city, 100), province: optional(input.region, 100) };
};

/** La cuenta del responsable por su correo: una de docente activa, o una nueva (con sus nombres) con clave temporal. */
const ownerAccount = async (owner: { email: string; firstNames?: string; lastNames?: string }) => {
  const email = owner.email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id, role: users.role, isActive: users.isActive, teacherStatus: users.teacherStatus, firstName: users.firstName, lastName: users.lastName })
    .from(users).where(eq(users.email, email)).limit(1);
  if (existing && existing.role !== 'TEACHER') throw new ConflictError('El correo del responsable es de una cuenta que no es de docente');
  if (existing && !existing.isActive) throw new ConflictError('La cuenta del responsable está desactivada: actívala antes');
  return {
    email,
    existing: existing ?? null,
    firstName: existing ? existing.firstName : personName(owner.firstNames ?? '', 'Nombres del responsable'),
    lastName: existing ? existing.lastName : personName(owner.lastNames ?? '', 'Apellidos del responsable'),
  };
};

export const adminSchoolsService = {
  async create(adminId: string, input: AdminSchoolInput) {
    const { name, modularCode, address, city, province } = await checkSchoolData(input);
    // El dominio se revisa antes de crear nada (formato, que no sea de correo personal y que no esté ya en la lista).
    const domain = input.domain ? await teacherVerificationService.checkNewDomain(input.domain.domain) : null;

    const { email, existing, firstName, lastName } = await ownerAccount(input.owner);

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
          id: schoolId, name, modularCode, address, city, province, country: 'Perú',
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

  /** Corrige los datos del colegio (nombre, código modular, región, ciudad y dirección), con las reglas de crearlo. */
  async update(schoolId: string, input: AdminSchoolData) {
    const [school] = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, schoolId));
    if (!school) throw new NotFoundError('Colegio no encontrado');
    const data = await checkSchoolData(input, schoolId);
    try {
      await db.update(schools).set({ ...data, updatedAt: new Date() }).where(eq(schools.id, schoolId));
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Ese código modular se acaba de usar: recarga e inténtalo otra vez');
      throw error;
    }
    return { schoolId, name: data.name };
  },

  /**
   * Pasa el rol de responsable a otro docente (del colegio o no) o a un correo nuevo (cuenta con clave temporal, como al
   * crear). El anterior queda en la administración, como docente o sale del colegio (sus clases vuelven a ser personales).
   */
  async changeOwner(schoolId: string, input: { email: string; firstNames?: string; lastNames?: string; previous: PreviousOwner }) {
    const [school] = await db.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.id, schoolId));
    if (!school) throw new NotFoundError('Colegio no encontrado');
    const { email, existing, firstName, lastName } = await ownerAccount(input);
    const owners = await db.select({ id: schoolMembers.id, userId: schoolMembers.userId, firstName: users.firstName, lastName: users.lastName })
      .from(schoolMembers).innerJoin(users, eq(users.id, schoolMembers.userId))
      .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.role, 'OWNER')));
    if (existing && owners.some((o) => o.userId === existing.id)) throw new ConflictError('Ese docente ya es el responsable del colegio');

    const now = new Date();
    const ownerId = existing?.id ?? uuidv4();
    const password = existing ? null : temporaryPassword();
    let unassignedClassrooms = 0;
    try {
      await db.transaction(async (tx) => {
        if (!existing) {
          await tx.insert(users).values({
            id: ownerId, email, firstName, lastName, password: await bcrypt.hash(password!, 12), role: 'TEACHER',
            teacherStatus: 'VERIFIED', teacherVerifiedVia: 'ADMIN', teacherVerifiedAt: now, provider: 'LOCAL', isActive: true,
            notifyBadges: true, notifyLevelUp: true, createdAt: now, updatedAt: now,
          });
        }
        // El nuevo: si ya era miembro (de cualquier forma), pasa a responsable verificado; si no, entra como tal.
        const [member] = await tx.select({ id: schoolMembers.id, joinedAt: schoolMembers.joinedAt }).from(schoolMembers)
          .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.userId, ownerId)));
        if (member) {
          await tx.update(schoolMembers)
            .set({ role: 'OWNER', status: 'VERIFIED', rejectionReason: null, joinedAt: member.joinedAt ?? now, updatedAt: now })
            .where(eq(schoolMembers.id, member.id));
        } else {
          await tx.insert(schoolMembers).values({ id: uuidv4(), schoolId, userId: ownerId, role: 'OWNER', status: 'VERIFIED', joinedAt: now, createdAt: now, updatedAt: now });
        }
        // El anterior: lo que eligió el equipo de Juried.
        for (const previous of owners) {
          if (input.previous === 'REMOVE') {
            unassignedClassrooms += (await removeMemberIn(tx, schoolId, previous)).unassignedClassrooms;
          } else {
            await tx.update(schoolMembers).set({ role: input.previous, updatedAt: now }).where(eq(schoolMembers.id, previous.id));
          }
        }
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Ese correo se acaba de usar: recarga e inténtalo otra vez');
      throw error;
    }
    if (existing && existing.teacherStatus !== 'VERIFIED') await teacherVerificationService.markVerified(ownerId, 'ADMIN');
    return {
      schoolId,
      schoolName: school.name,
      owner: { userId: ownerId, email, name: `${firstName ?? ''} ${lastName ?? ''}`.trim(), created: !existing, ...(password ? { temporaryPassword: password } : {}) },
      previous: owners.map((o) => ({ userId: o.userId, name: `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim(), outcome: input.previous })),
      unassignedClassrooms,
    };
  },
};
