import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schoolEnrollments, schoolSections, schoolStudents, schools, users } from '../db/schema.js';
import { isSchoolManagerRole, verifiedSchoolRole } from '../utils/access.js';
import { ConflictError, ForbiddenError, NotFoundError, isDuplicateEntry } from '../utils/errors.js';
import { generateRandomCode } from '../utils/helpers.js';
import { revokeAllUserTokens } from '../utils/jwt.js';
import { piiReady } from '../utils/piiCrypto.js';
import { accessStates } from './schoolAccessState.js';
import { loadYear } from './schoolRoster.service.js';
import { sectionDisplayName } from './schoolSection.service.js';

/**
 * Acceso de los estudiantes con DNI y PIN (consola). El código del colegio abre su puerta (código o QR → DNI → PIN).
 * Las tarjetas de un solo uso son para quien aún no tiene PIN (con ella lo crea). Restablecer el PIN borra el actual,
 * cierra sus sesiones y le da una tarjeta nueva: lo hacen la administración o el tutor de su sección.
 */

/**
 * Códigos de 7 caracteres que ningún colegio ni tarjeta usa (colegios y tarjetas comparten la longitud, distinta de
 * las clases y familias, 8, y de las tarjetas de una clase, 6).
 */
const freshCodes = async (count: number) => {
  const codes = new Set<string>();
  for (let round = 0; round < 8 && codes.size < count; round++) {
    const batch = new Set<string>();
    while (batch.size < (count - codes.size) * 2) {
      const code = generateRandomCode(7);
      if (!codes.has(code)) batch.add(code);
    }
    const list = [...batch];
    const [schoolRows, cardRows] = await Promise.all([
      db.select({ code: schools.studentCode }).from(schools).where(inArray(schools.studentCode, list)),
      db.select({ code: schoolStudents.accessCode }).from(schoolStudents).where(inArray(schoolStudents.accessCode, list)),
    ]);
    const taken = new Set([...schoolRows, ...cardRows].map((r) => r.code));
    for (const code of list) {
      if (codes.size >= count) break;
      if (!taken.has(code)) codes.add(code);
    }
  }
  if (codes.size < count) throw new Error('No se pudieron generar códigos');
  return [...codes];
};

/** La administración, o el tutor de esa sección. */
const assertAccessHandler = async (schoolId: string, actorId: string, tutorUserId: string | null) => {
  const role = await verifiedSchoolRole(actorId, schoolId);
  if (role && (isSchoolManagerRole(role) || tutorUserId === actorId)) return;
  throw new ForbiddenError('Esto lo hacen la administración o el tutor de su sección');
};

const loadSchool = async (schoolId: string) => {
  const [school] = await db.select({ id: schools.id, name: schools.name, studentCode: schools.studentCode }).from(schools).where(eq(schools.id, schoolId));
  if (!school) throw new NotFoundError('Escuela no encontrada');
  return school;
};

const loadSection = async (schoolId: string, yearId: string, sectionId: string) => {
  const [section] = await db.select({
    id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name, tutorUserId: schoolSections.tutorUserId,
  }).from(schoolSections)
    .where(and(eq(schoolSections.id, sectionId), eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)));
  if (!section) throw new NotFoundError('Sección no encontrada');
  return section;
};

/** Su matrícula del año (para saber su sección y, con ella, su tutor). */
const loadStudentInYear = async (schoolId: string, yearId: string, studentId: string) => {
  const [row] = await db.select({
    id: schoolStudents.id, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames, status: schoolStudents.status,
    userId: schoolStudents.userId, accessCode: schoolStudents.accessCode, sectionId: schoolEnrollments.sectionId,
    tutorUserId: schoolSections.tutorUserId, level: schoolSections.level, grade: schoolSections.grade, sectionName: schoolSections.name,
  }).from(schoolStudents)
    .leftJoin(schoolEnrollments, and(eq(schoolEnrollments.studentId, schoolStudents.id), eq(schoolEnrollments.yearId, yearId)))
    .leftJoin(schoolSections, eq(schoolSections.id, schoolEnrollments.sectionId))
    .where(and(eq(schoolStudents.id, studentId), eq(schoolStudents.schoolId, schoolId)));
  if (!row) throw new NotFoundError('Estudiante no encontrado');
  return row;
};

/** Le asigna una tarjeta (si ya tenía una sin usar, la misma: imprimir otra vez no invalida la anterior). */
const ensureCards = async (students: Array<{ id: string; accessCode: string | null }>) => {
  const missing = students.filter((s) => !s.accessCode);
  const codes = new Map(students.filter((s) => s.accessCode).map((s) => [s.id, s.accessCode!]));
  if (missing.length === 0) return { codes, issued: 0 };
  const fresh = await freshCodes(missing.length);
  const now = new Date();
  for (const [i, student] of missing.entries()) {
    let code = fresh[i];
    for (let attempt = 0; ; attempt++) {
      try {
        await db.update(schoolStudents).set({ accessCode: code, accessCodeAt: now, updatedAt: now })
          .where(and(eq(schoolStudents.id, student.id), isNull(schoolStudents.accessCode)));
        break;
      } catch (error) {
        if (!isDuplicateEntry(error) || attempt === 3) throw error;
        [code] = await freshCodes(1);
      }
    }
    // Otra pestaña pudo asignarle una antes: vale la que quedó.
    const [saved] = await db.select({ code: schoolStudents.accessCode }).from(schoolStudents).where(eq(schoolStudents.id, student.id));
    codes.set(student.id, saved?.code ?? code);
  }
  return { codes, issued: missing.length };
};

export const schoolAccessService = {
  /** El código del colegio y cómo va el acceso del año, en total y por sección. */
  async overview(schoolId: string, yearId: string) {
    await loadYear(schoolId, yearId, false);
    const school = await loadSchool(schoolId);
    const [sections, enrolled] = await Promise.all([
      db.select({
        id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name, tutorUserId: schoolSections.tutorUserId,
      }).from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)))
        .orderBy(asc(schoolSections.level), asc(schoolSections.grade), asc(schoolSections.name)),
      db.select({ studentId: schoolEnrollments.studentId, sectionId: schoolEnrollments.sectionId }).from(schoolEnrollments)
        .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
        .where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE'), eq(schoolStudents.schoolId, schoolId), eq(schoolStudents.status, 'ACTIVE'))),
    ]);
    const states = await accessStates(enrolled.map((e) => e.studentId));
    const empty = () => ({ students: 0, pin: 0, account: 0, none: 0, withoutDocument: 0, cards: 0 });
    const totals = empty();
    const bySection = new Map<string, ReturnType<typeof empty>>();
    for (const e of enrolled) {
      const access = states.get(e.studentId);
      if (!access) continue;
      const buckets = [totals];
      if (e.sectionId) {
        if (!bySection.has(e.sectionId)) bySection.set(e.sectionId, empty());
        buckets.push(bySection.get(e.sectionId)!);
      }
      for (const bucket of buckets) {
        bucket.students++;
        bucket[access.state]++;
        if (!access.hasDocument) bucket.withoutDocument++;
        if (access.hasCard) bucket.cards++;
      }
    }
    return {
      school: { name: school.name, studentCode: school.studentCode },
      piiReady: piiReady(),
      totals,
      sections: sections.map((s) => ({ id: s.id, level: s.level, grade: s.grade, name: s.name, label: sectionDisplayName(s.level, s.grade, s.name), ...(bySection.get(s.id) ?? empty()) })),
    };
  },

  /** Activa el acceso con DNI (o cambia el código: los pósters anteriores dejan de servir). */
  async setCode(schoolId: string) {
    await loadSchool(schoolId);
    for (let attempt = 0; ; attempt++) {
      const [code] = await freshCodes(1);
      try {
        await db.update(schools).set({ studentCode: code, updatedAt: new Date() }).where(eq(schools.id, schoolId));
        return { studentCode: code };
      } catch (error) {
        if (!isDuplicateEntry(error) || attempt === 3) throw error;
      }
    }
  },

  async poster(schoolId: string) {
    const school = await loadSchool(schoolId);
    if (!school.studentCode) throw new ConflictError('Primero activa el acceso con DNI');
    return { name: school.name, studentCode: school.studentCode };
  },

  /** Tarjetas de una sección: para quienes aún no tienen PIN (con la misma tarjeta si ya tenían una sin usar). */
  async sectionCards(schoolId: string, yearId: string, sectionId: string, actorId: string) {
    await loadYear(schoolId, yearId, false);
    const section = await loadSection(schoolId, yearId, sectionId);
    await assertAccessHandler(schoolId, actorId, section.tutorUserId);
    const school = await loadSchool(schoolId);
    if (!school.studentCode) throw new ConflictError('Primero activa el acceso con DNI: el código del colegio va en cada tarjeta');
    const students = await db.select({
      id: schoolStudents.id, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames, accessCode: schoolStudents.accessCode,
    }).from(schoolEnrollments)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.sectionId, sectionId), eq(schoolEnrollments.status, 'ACTIVE'), eq(schoolStudents.status, 'ACTIVE')))
      .orderBy(asc(schoolStudents.lastNames), asc(schoolStudents.firstNames));
    const states = await accessStates(students.map((s) => s.id));
    const pending = students.filter((s) => states.get(s.id)?.state !== 'pin');
    if (pending.length === 0) throw new ConflictError('Todos en esta sección ya tienen su PIN');
    const { codes, issued } = await ensureCards(pending);
    const label = sectionDisplayName(section.level, section.grade, section.name);
    return {
      school: { name: school.name, studentCode: school.studentCode },
      section: label,
      cards: pending.map((s) => ({ name: `${s.firstNames} ${s.lastNames}`.trim(), section: label, code: codes.get(s.id)! })),
      issued,
      skipped: students.length - pending.length,
    };
  },

  /** Su tarjeta (si aún no tiene PIN). */
  async studentCard(schoolId: string, yearId: string, studentId: string, actorId: string) {
    await loadYear(schoolId, yearId, false);
    const student = await loadStudentInYear(schoolId, yearId, studentId);
    await assertAccessHandler(schoolId, actorId, student.tutorUserId);
    const school = await loadSchool(schoolId);
    if (!school.studentCode) throw new ConflictError('Primero activa el acceso con DNI: el código del colegio va en la tarjeta');
    if (student.status !== 'ACTIVE') throw new ConflictError('Está retirado: reincorpóralo antes');
    const access = (await accessStates([studentId])).get(studentId);
    if (access?.state === 'pin') throw new ConflictError('Ya tiene su PIN: si lo olvidó, restablécelo');
    const { codes } = await ensureCards([student]);
    const label = student.level ? sectionDisplayName(student.level, student.grade!, student.sectionName!) : 'Sin sección';
    return {
      school: { name: school.name, studentCode: school.studentCode },
      cards: [{ name: `${student.firstNames} ${student.lastNames}`.trim(), section: label, code: codes.get(studentId)! }],
    };
  },

  /** Restablecer su PIN: se borra, se cierran sus sesiones y recibe una tarjeta nueva (la anterior deja de servir). */
  async resetPin(schoolId: string, yearId: string, studentId: string, actorId: string) {
    await loadYear(schoolId, yearId, false);
    const student = await loadStudentInYear(schoolId, yearId, studentId);
    await assertAccessHandler(schoolId, actorId, student.tutorUserId);
    if (student.status !== 'ACTIVE') throw new ConflictError('Está retirado: reincorpóralo antes');
    const access = (await accessStates([studentId])).get(studentId)!;
    const now = new Date();
    const hadPin = access.state === 'pin';
    if (hadPin && access.accountId) {
      await db.update(users).set({ pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null, pinLockLevel: 0, updatedAt: now }).where(eq(users.id, access.accountId));
      await revokeAllUserTokens(access.accountId);
    }
    // Una tarjeta nueva siempre: si alguien vio la anterior, ya no sirve.
    await db.update(schoolStudents).set({ accessCode: null, accessCodeAt: null, ...(access.accountId ? { userId: access.accountId } : {}), updatedAt: now })
      .where(eq(schoolStudents.id, studentId));
    const { codes } = await ensureCards([{ id: studentId, accessCode: null }]);
    return { hadPin, code: codes.get(studentId)!, accountId: access.accountId };
  },
};
