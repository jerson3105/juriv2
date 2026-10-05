import { and, count, desc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  schoolEnrollments, schools, schoolStudents, schoolTeachingAssignments, schoolWorkshops, schoolWorkshopSections, schoolYears, studentProfiles,
} from '../db/schema.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { missingByAssignment } from './schoolAssignment.service.js';
import { schoolAutoEnrollService } from './schoolAutoEnroll.service.js';
import { invalidateSchoolCalendar, syncCurrentPeriod, yearCalendars } from './schoolCalendar.service.js';

/**
 * Temporada nueva: «Iniciar 2027» pasa el año en preparación a ser el año en curso (con el anterior ya cerrado y sus
 * recuperaciones resueltas) y luego sus clases se llenan de a pocas: cada estudiante matriculado entra a las clases de su
 * sección con el avatar, las prendas y la familia de su clase del año anterior (lo demás empieza de cero).
 */

// Un llenado a la vez por año (el servidor corre en un proceso).
const fillingFor = new Set<string>();

/** Por taller de secciones con clase: cuántos de sus secciones aún no tienen perfil en ella. */
const missingByWorkshop = async (yearId: string, workshopIds: string[]) => {
  if (workshopIds.length === 0) return new Map<string, number>();
  const rows = await db.select({ id: schoolWorkshops.id, n: count() }).from(schoolWorkshops)
    .innerJoin(schoolWorkshopSections, eq(schoolWorkshopSections.workshopId, schoolWorkshops.id))
    .innerJoin(schoolEnrollments, and(eq(schoolEnrollments.sectionId, schoolWorkshopSections.sectionId), eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE')))
    .innerJoin(schoolStudents, and(eq(schoolStudents.id, schoolEnrollments.studentId), eq(schoolStudents.status, 'ACTIVE')))
    .leftJoin(studentProfiles, and(eq(studentProfiles.classroomId, schoolWorkshops.classroomId), eq(studentProfiles.schoolStudentId, schoolEnrollments.studentId)))
    .where(and(inArray(schoolWorkshops.id, workshopIds), isNotNull(schoolWorkshops.classroomId), eq(schoolWorkshops.mode, 'SECTION'), isNull(studentProfiles.id)))
    .groupBy(schoolWorkshops.id);
  return new Map(rows.map((r) => [r.id, Number(r.n)]));
};

export const schoolSeasonService = {
  /** El año en preparación empieza: requiere el anterior cerrado y sus recuperaciones resueltas. */
  async start(schoolId: string, yearId: string) {
    const result = await db.transaction(async (tx) => {
      await tx.select({ id: schools.id }).from(schools).where(eq(schools.id, schoolId)).for('update');
      const [year] = await tx.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status }).from(schoolYears)
        .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId))).for('update');
      if (!year) throw new NotFoundError('Año escolar no encontrado');
      if (year.status !== 'PLANNING') throw new ConflictError(year.status === 'ACTIVE' ? `${year.name} ya empezó` : `${year.name} ya cerró`);
      const [active] = await tx.select({ name: schoolYears.name }).from(schoolYears)
        .where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.status, 'ACTIVE')));
      if (active) throw new ConflictError(`Primero cierra ${active.name}: su promoción decide dónde sigue cada estudiante`);
      const [previous] = await tx.select({ id: schoolYears.id, name: schoolYears.name }).from(schoolYears)
        .where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.status, 'CLOSED'), lt(schoolYears.name, year.name)))
        .orderBy(desc(schoolYears.name)).limit(1);
      if (previous) {
        const [{ n }] = await tx.select({ n: count() }).from(schoolEnrollments)
          .where(and(eq(schoolEnrollments.yearId, previous.id), eq(schoolEnrollments.finalSituation, 'RECOVERY')));
        const pending = Number(n);
        if (pending > 0) {
          throw new ConflictError(`${pending === 1 ? 'Queda una recuperación' : `Quedan ${pending} recuperaciones`} de ${previous.name} por resolver en «Promoción»`);
        }
      }
      await tx.update(schoolYears).set({ status: 'ACTIVE', updatedAt: new Date() }).where(eq(schoolYears.id, yearId));
      return { name: year.name };
    });
    invalidateSchoolCalendar(schoolId);
    const calendar = (await yearCalendars([yearId])).get(yearId);
    if (calendar) await syncCurrentPeriod(calendar);
    return result;
  },

  /**
   * Llena de a pocas las clases del año en curso: las de cada asignación y las de los talleres de secciones a las que
   * aún les falta alguien. El cliente repite mientras queden (y se detiene si una vuelta no hace entrar a nadie).
   */
  async fill(schoolId: string, yearId: string, limit = 6) {
    const [year] = await db.select({ status: schoolYears.status }).from(schoolYears)
      .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
    if (!year) throw new NotFoundError('Año escolar no encontrado');
    if (year.status !== 'ACTIVE') throw new ConflictError('Las clases se llenan cuando el año empieza');
    if (fillingFor.has(yearId)) throw new ConflictError('Ya se están llenando las clases de este año');
    fillingFor.add(yearId);
    try {
      const assignments = await db.select({ id: schoolTeachingAssignments.id, sectionId: schoolTeachingAssignments.sectionId, classroomId: schoolTeachingAssignments.classroomId })
        .from(schoolTeachingAssignments)
        .where(and(eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId), isNotNull(schoolTeachingAssignments.classroomId)));
      const workshops = await db.select({ id: schoolWorkshops.id }).from(schoolWorkshops)
        .where(and(eq(schoolWorkshops.schoolId, schoolId), eq(schoolWorkshops.yearId, yearId), isNotNull(schoolWorkshops.classroomId), eq(schoolWorkshops.mode, 'SECTION')));
      const [missingA, missingW] = await Promise.all([
        missingByAssignment(yearId, assignments.map((a) => a.id)),
        missingByWorkshop(yearId, workshops.map((w) => w.id)),
      ]);
      const jobs = [
        ...assignments.filter((a) => (missingA.get(a.id) ?? 0) > 0).map((a) => ({ kind: 'assignment' as const, ...a })),
        ...workshops.filter((w) => (missingW.get(w.id) ?? 0) > 0).map((w) => ({ kind: 'workshop' as const, ...w })),
      ];
      let entered = 0;
      const batch = jobs.slice(0, limit);
      for (const job of batch) {
        const synced = job.kind === 'assignment'
          ? await schoolAutoEnrollService.syncClassroom({ schoolId, yearId, classroomId: job.classroomId!, sectionIds: [job.sectionId] })
          : await schoolAutoEnrollService.syncWorkshop(schoolId, yearId, job.id);
        entered += synced.created + synced.linked;
      }
      return { classes: batch.length, entered, remaining: jobs.length - batch.length };
    } finally {
      fillingFor.delete(yearId);
    }
  },
};
