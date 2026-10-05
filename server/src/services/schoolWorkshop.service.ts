import { and, asc, eq, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classrooms, curriculumAreas, schoolEnrollments, schoolSections, schoolStudents, schoolWorkshops, schoolWorkshopSections, schoolWorkshopStudents,
  schoolYearLevels, schoolYears, studentProfiles, users,
} from '../db/schema.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { cleanText } from '../utils/textClean.js';
import { classroomService } from './classroom.service.js';
import { assertTeacher, buildSchoolClass, classroomTaken, previousYearId, sourceForWorkshop, type ClassroomChoice } from './schoolAssignment.service.js';
import { schoolAutoEnrollService, type SyncResult } from './schoolAutoEnroll.service.js';
import { effectivePlan, type PlanArea } from './schoolPlan.service.js';
import { sectionDisplayName } from './schoolSection.service.js';
import type { SchoolLevel } from './schoolYear.service.js';

/**
 * Talleres: clases que son parte de un área del plan (Panadería → EPT, Karate → Educación Física). Su nota cuenta
 * dentro del área con un peso (la libreta lo usa). Los lleva toda una o varias secciones del nivel (entran solas, como
 * un área) o solo los inscritos, aunque sean de varias secciones. La clase es del docente, sin sección propia.
 */

export type WorkshopMode = 'SECTION' | 'CHOSEN';
export interface WorkshopInput {
  name: string;
  level: SchoolLevel;
  areaId: string;
  teacherUserId: string;
  mode: WorkshopMode;
  sectionIds: string[];
  studentIds: string[];
  weight: number;
  classroom: ClassroomChoice;
}
export type WorkshopPatch = Partial<Omit<WorkshopInput, 'classroom'>> & { classroom?: ClassroomChoice };

const ZERO: SyncResult = { created: 0, linked: 0, withAccount: 0 };
const fullName = (u: { firstName: string | null; lastName: string | null }) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();

const loadYear = async (schoolId: string, yearId: string, forWrite: boolean) => {
  const [year] = await db.select({ id: schoolYears.id, status: schoolYears.status }).from(schoolYears)
    .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (forWrite && year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
  return year;
};

const loadWorkshop = async (schoolId: string, workshopId: string) => {
  const [workshop] = await db.select().from(schoolWorkshops).where(and(eq(schoolWorkshops.id, workshopId), eq(schoolWorkshops.schoolId, schoolId)));
  if (!workshop) throw new NotFoundError('Taller no encontrado');
  return workshop;
};

const cleanName = (raw: string) => {
  const name = cleanText(raw).slice(0, 80);
  if (name.length < 2) throw new ValidationError('Escribe el nombre del taller');
  return name;
};

/** El área está en el plan del nivel y cada participante (sección o estudiante) es del nivel y la lleva en su grado. */
const validateParticipants = async (schoolId: string, yearId: string, level: SchoolLevel, areaId: string, mode: WorkshopMode, sectionIds: string[], studentIds: string[]) => {
  const plan = await effectivePlan(yearId, level);
  const area = plan.areas.find((a) => a.areaId === areaId);
  if (!area) throw new ValidationError('Esa área no está en el plan de estudios de ese nivel');
  const grades = new Set<number>();
  if (mode === 'SECTION') {
    const ids = [...new Set(sectionIds)];
    if (ids.length === 0) throw new ValidationError('Elige al menos una sección');
    const sections = await db.select({ id: schoolSections.id, grade: schoolSections.grade, name: schoolSections.name }).from(schoolSections)
      .where(and(inArray(schoolSections.id, ids), eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId), eq(schoolSections.level, level)));
    if (sections.length !== ids.length) throw new ValidationError('Alguna sección no es de ese nivel en este año');
    const outside = sections.find((s) => !area.grades.includes(s.grade));
    if (outside) throw new ValidationError(`${sectionDisplayName(level, outside.grade, outside.name)} no lleva ${area.name} en su plan`);
    sections.forEach((s) => grades.add(s.grade));
    return { area, sectionIds: ids, studentIds: [] as string[], grades };
  }
  const ids = [...new Set(studentIds)];
  if (ids.length > 0) {
    const students = await db.select({ id: schoolStudents.id, grade: schoolSections.grade }).from(schoolEnrollments)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .innerJoin(schoolSections, eq(schoolSections.id, schoolEnrollments.sectionId))
      .where(and(
        inArray(schoolEnrollments.studentId, ids), eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE'),
        eq(schoolStudents.schoolId, schoolId), eq(schoolStudents.status, 'ACTIVE'), eq(schoolSections.level, level),
      ));
    if (students.length !== ids.length) throw new ValidationError('Algún estudiante no está matriculado en ese nivel este año');
    if (students.some((s) => !area.grades.includes(s.grade))) throw new ValidationError(`Algún estudiante es de un grado que no lleva ${area.name}`);
    students.forEach((s) => grades.add(s.grade));
  }
  return { area, sectionIds: [] as string[], studentIds: ids, grades };
};

/**
 * La clase del taller: ninguna, una del docente en la escuela (libre y sin sección: las clases con sección son de un
 * área) o una nueva a su nombre con las competencias del área.
 */
const resolveClassroom = async (
  schoolId: string, yearId: string, level: SchoolLevel, area: PlanArea, name: string, teacherUserId: string, grades: Set<number>,
  choice: ClassroomChoice, exceptWorkshopId?: string,
) => {
  if (choice.mode === 'none') return null;
  const gradeLevel = grades.size === 1 ? `${level}_${[...grades][0]}` : null;
  if (choice.mode === 'link') {
    const [classroom] = await db.select({
      id: classrooms.id, teacherId: classrooms.teacherId, schoolId: classrooms.schoolId, isActive: classrooms.isActive,
      schoolSectionId: classrooms.schoolSectionId, curriculumAreaId: classrooms.curriculumAreaId, gradeLevel: classrooms.gradeLevel,
      useCompetencies: classrooms.useCompetencies,
    }).from(classrooms).where(eq(classrooms.id, choice.classroomId));
    if (!classroom || classroom.teacherId !== teacherUserId || classroom.schoolId !== schoolId) throw new ValidationError('Esa clase no es de este docente en la escuela');
    if (!classroom.isActive) throw new ConflictError('Esa clase está archivada');
    if (await classroomTaken(classroom.id, { workshopId: exceptWorkshopId })) throw new ConflictError('Esa clase ya está vinculada a otra asignación o a un taller');
    if (classroom.schoolSectionId) throw new ConflictError('Esa clase es de una sección: vincúlala como la clase del área');
    if (classroom.curriculumAreaId && classroom.curriculumAreaId !== area.areaId) throw new ConflictError(`Esa clase es de otra área, no de ${area.name}`);
    await db.update(classrooms).set({
      curriculumAreaId: area.areaId,
      gradeLevel: classroom.gradeLevel || gradeLevel,
      updatedAt: new Date(),
    }).where(eq(classrooms.id, classroom.id));
    if (!classroom.curriculumAreaId && classroom.useCompetencies) await classroomService.syncClassroomCompetencies(classroom.id, area.areaId);
    return classroom.id;
  }
  const [scale] = await db.select({ gradeScale: schoolYearLevels.gradeScale }).from(schoolYearLevels)
    .where(and(eq(schoolYearLevels.yearId, yearId), eq(schoolYearLevels.level, level)));
  // En un año en preparación, la clase copia la del taller del año anterior (mismo docente y área).
  const [year] = await db.select({ name: schoolYears.name, status: schoolYears.status }).from(schoolYears).where(eq(schoolYears.id, yearId));
  const prev = year?.status === 'PLANNING' ? await previousYearId(schoolId, year.name) : null;
  const built = await buildSchoolClass({
    schoolId,
    teacherUserId,
    name,
    areaId: area.areaId,
    gradeLevel,
    gradeScale: scale?.gradeScale ?? null,
    schoolSectionId: null,
    sourceId: prev ? await sourceForWorkshop(prev, teacherUserId, area.areaId, name) : null,
  });
  return built.id;
};

const checkWeight = (weight: number) => {
  if (!Number.isInteger(weight) || weight < 5 || weight > 90) throw new ValidationError('El peso del taller va de 5 % a 90 % de la nota del área');
  return weight;
};

/** Participantes activos de cada taller (sus secciones o sus inscritos) y cuántos aún no tienen perfil en su clase. */
const participantsOf = async (yearId: string, workshop: { id: string; mode: WorkshopMode; classroomId: string | null }) => {
  const base = and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE'), eq(schoolStudents.status, 'ACTIVE'));
  const rows = workshop.mode === 'SECTION'
    ? await db.select({ studentId: schoolEnrollments.studentId }).from(schoolEnrollments)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .innerJoin(schoolWorkshopSections, eq(schoolWorkshopSections.sectionId, schoolEnrollments.sectionId))
      .where(and(base, eq(schoolWorkshopSections.workshopId, workshop.id)))
    : await db.select({ studentId: schoolEnrollments.studentId }).from(schoolEnrollments)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .innerJoin(schoolWorkshopStudents, eq(schoolWorkshopStudents.studentId, schoolEnrollments.studentId))
      .where(and(base, eq(schoolWorkshopStudents.workshopId, workshop.id)));
  const ids = rows.map((r) => r.studentId);
  if (!workshop.classroomId || ids.length === 0) return { count: ids.length, missing: 0 };
  const present = await db.select({ id: studentProfiles.schoolStudentId }).from(studentProfiles)
    .where(and(eq(studentProfiles.classroomId, workshop.classroomId), inArray(studentProfiles.schoolStudentId, ids)));
  const has = new Set(present.map((p) => p.id));
  return { count: ids.length, missing: ids.filter((id) => !has.has(id)).length };
};

type WorkshopRow = typeof schoolWorkshops.$inferSelect;

/** Cómo se muestra un taller en la lista (y en Mis asignaciones). */
const describe = async (schoolId: string, yearId: string, rows: WorkshopRow[]) => {
  if (rows.length === 0) return [];
  const areaIds = [...new Set(rows.map((r) => r.areaId))];
  const areas = new Map((await db.select({ id: curriculumAreas.id, name: curriculumAreas.name, shortName: curriculumAreas.shortName })
    .from(curriculumAreas).where(inArray(curriculumAreas.id, areaIds))).map((a) => [a.id, a]));
  const teachers = new Map((await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users).where(inArray(users.id, [...new Set(rows.map((r) => r.teacherUserId))]))).map((u) => [u.id, fullName(u)]));
  const classIds = rows.map((r) => r.classroomId).filter((id): id is string => !!id);
  const classes = new Map(classIds.length === 0 ? [] : (await db.select({ id: classrooms.id, name: classrooms.name, isActive: classrooms.isActive, schoolId: classrooms.schoolId })
    .from(classrooms).where(inArray(classrooms.id, classIds))).map((c) => [c.id, c]));
  const sectionRows = await db.select({ workshopId: schoolWorkshopSections.workshopId, id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
    .from(schoolWorkshopSections).innerJoin(schoolSections, eq(schoolSections.id, schoolWorkshopSections.sectionId))
    .where(inArray(schoolWorkshopSections.workshopId, rows.map((r) => r.id)))
    .orderBy(asc(schoolSections.grade), asc(schoolSections.name));
  return Promise.all(rows.map(async (w) => {
    const classroom = w.classroomId ? classes.get(w.classroomId) : undefined;
    const linked = classroom && classroom.schoolId === schoolId ? classroom : undefined;
    const participants = await participantsOf(yearId, { id: w.id, mode: w.mode, classroomId: linked ? w.classroomId : null });
    const area = areas.get(w.areaId);
    return {
      id: w.id,
      name: w.name,
      level: w.level,
      area: { id: w.areaId, name: area?.name ?? '', shortName: area?.shortName ?? null },
      teacherUserId: w.teacherUserId,
      teacherName: teachers.get(w.teacherUserId) ?? '',
      mode: w.mode,
      weight: w.weight,
      sections: sectionRows.filter((s) => s.workshopId === w.id).map((s) => ({ id: s.id, label: sectionDisplayName(s.level, s.grade, s.name) })),
      participants: participants.count,
      classroom: linked ? { id: linked.id, name: linked.name, archived: !linked.isActive, missing: participants.missing } : null,
    };
  }));
};

export const schoolWorkshopService = {
  /** Los talleres del año (de un nivel, si se pide). */
  async list(schoolId: string, yearId: string, level?: SchoolLevel) {
    await loadYear(schoolId, yearId, false);
    const rows = await db.select().from(schoolWorkshops)
      .where(and(eq(schoolWorkshops.schoolId, schoolId), eq(schoolWorkshops.yearId, yearId), level ? eq(schoolWorkshops.level, level) : undefined))
      .orderBy(asc(schoolWorkshops.name));
    return describe(schoolId, yearId, rows);
  },

  /** Un taller con sus inscritos (para editarlo). */
  async get(schoolId: string, workshopId: string) {
    const workshop = await loadWorkshop(schoolId, workshopId);
    const [described] = await describe(schoolId, workshop.yearId, [workshop]);
    const students = await db.select({
      id: schoolStudents.id, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames,
      level: schoolSections.level, grade: schoolSections.grade, sectionName: schoolSections.name,
    }).from(schoolWorkshopStudents)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolWorkshopStudents.studentId))
      .leftJoin(schoolEnrollments, and(eq(schoolEnrollments.studentId, schoolStudents.id), eq(schoolEnrollments.yearId, workshop.yearId)))
      .leftJoin(schoolSections, eq(schoolSections.id, schoolEnrollments.sectionId))
      .where(eq(schoolWorkshopStudents.workshopId, workshop.id))
      .orderBy(asc(schoolStudents.lastNames), asc(schoolStudents.firstNames));
    return {
      ...described,
      students: students.map((s) => ({
        id: s.id, firstNames: s.firstNames, lastNames: s.lastNames,
        section: s.level && s.grade ? sectionDisplayName(s.level, s.grade, s.sectionName ?? '') : null,
      })),
    };
  },

  async create(schoolId: string, yearId: string, input: WorkshopInput, actorId: string) {
    await loadYear(schoolId, yearId, true);
    const name = cleanName(input.name);
    const weight = checkWeight(input.weight);
    const participants = await validateParticipants(schoolId, yearId, input.level, input.areaId, input.mode, input.sectionIds, input.studentIds);
    await assertTeacher(schoolId, input.teacherUserId);
    const classroomId = await resolveClassroom(schoolId, yearId, input.level, participants.area, name, input.teacherUserId, participants.grades, input.classroom);
    const id = uuidv4();
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schoolWorkshops).values({
          id, schoolId, yearId, level: input.level, areaId: input.areaId, name, teacherUserId: input.teacherUserId, classroomId,
          mode: input.mode, weight, createdBy: actorId, createdAt: now, updatedAt: now,
        });
        if (participants.sectionIds.length) await tx.insert(schoolWorkshopSections).values(participants.sectionIds.map((sectionId) => ({ workshopId: id, sectionId })));
        if (participants.studentIds.length) {
          await tx.insert(schoolWorkshopStudents).values(participants.studentIds.map((studentId) => ({ workshopId: id, studentId, createdBy: actorId, createdAt: now })));
        }
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Esa clase ya está vinculada a otro taller');
      throw error;
    }
    const sync = classroomId ? await schoolAutoEnrollService.syncWorkshop(schoolId, yearId, id) : ZERO;
    return { id, classroomId, sync };
  },

  /** Cambia nombre, área, docente, quién lo lleva, peso o clase. Al cambiar de docente, su clase se desvincula. */
  async update(schoolId: string, workshopId: string, patch: WorkshopPatch, actorId: string) {
    const workshop = await loadWorkshop(schoolId, workshopId);
    await loadYear(schoolId, workshop.yearId, true);
    const current = {
      sectionIds: (await db.select({ id: schoolWorkshopSections.sectionId }).from(schoolWorkshopSections).where(eq(schoolWorkshopSections.workshopId, workshop.id))).map((s) => s.id),
      studentIds: (await db.select({ id: schoolWorkshopStudents.studentId }).from(schoolWorkshopStudents).where(eq(schoolWorkshopStudents.workshopId, workshop.id))).map((s) => s.id),
    };
    const next = {
      name: patch.name !== undefined ? cleanName(patch.name) : workshop.name,
      level: patch.level ?? workshop.level,
      areaId: patch.areaId ?? workshop.areaId,
      teacherUserId: patch.teacherUserId ?? workshop.teacherUserId,
      mode: patch.mode ?? workshop.mode,
      weight: patch.weight !== undefined ? checkWeight(patch.weight) : workshop.weight,
      sectionIds: patch.sectionIds ?? current.sectionIds,
      studentIds: patch.studentIds ?? current.studentIds,
    };
    const participants = await validateParticipants(schoolId, workshop.yearId, next.level, next.areaId, next.mode, next.sectionIds, next.studentIds);
    if (next.teacherUserId !== workshop.teacherUserId) await assertTeacher(schoolId, next.teacherUserId);
    if (next.areaId !== workshop.areaId && workshop.classroomId && !patch.classroom) {
      throw new ConflictError('Su clase es de otra área: elige otra clase para el taller o quítale la clase');
    }
    let classroomId = next.teacherUserId === workshop.teacherUserId ? workshop.classroomId : null;
    if (patch.classroom) {
      classroomId = await resolveClassroom(schoolId, workshop.yearId, next.level, participants.area, next.name, next.teacherUserId, participants.grades, patch.classroom, workshop.id);
    }
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        await tx.update(schoolWorkshops).set({
          name: next.name, level: next.level, areaId: next.areaId, teacherUserId: next.teacherUserId, mode: next.mode, weight: next.weight,
          classroomId, updatedAt: now,
        }).where(eq(schoolWorkshops.id, workshop.id));
        await tx.delete(schoolWorkshopSections).where(eq(schoolWorkshopSections.workshopId, workshop.id));
        if (participants.sectionIds.length) await tx.insert(schoolWorkshopSections).values(participants.sectionIds.map((sectionId) => ({ workshopId: workshop.id, sectionId })));
        // Los inscritos que siguen conservan su fecha; los nuevos se agregan.
        const keep = new Set(participants.studentIds);
        const gone = current.studentIds.filter((id) => !keep.has(id));
        if (gone.length) await tx.delete(schoolWorkshopStudents).where(and(eq(schoolWorkshopStudents.workshopId, workshop.id), inArray(schoolWorkshopStudents.studentId, gone)));
        const added = participants.studentIds.filter((id) => !current.studentIds.includes(id));
        if (added.length) await tx.insert(schoolWorkshopStudents).values(added.map((studentId) => ({ workshopId: workshop.id, studentId, createdBy: actorId, createdAt: now })));
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Esa clase ya está vinculada a otro taller');
      throw error;
    }
    const sync = classroomId ? await schoolAutoEnrollService.syncWorkshop(schoolId, workshop.yearId, workshop.id) : ZERO;
    return { id: workshop.id, teacherChanged: next.teacherUserId !== workshop.teacherUserId, classroomId, sync };
  },

  /** Quita el taller. Su clase y sus estudiantes siguen con su docente. */
  async remove(schoolId: string, workshopId: string) {
    const workshop = await loadWorkshop(schoolId, workshopId);
    await loadYear(schoolId, workshop.yearId, true);
    await db.transaction(async (tx) => {
      await tx.delete(schoolWorkshopSections).where(eq(schoolWorkshopSections.workshopId, workshop.id));
      await tx.delete(schoolWorkshopStudents).where(eq(schoolWorkshopStudents.workshopId, workshop.id));
      await tx.delete(schoolWorkshops).where(eq(schoolWorkshops.id, workshop.id));
    });
    return workshop;
  },

  /** «Sincronizar»: completa la matrícula automática de la clase del taller (su docente o la administración). */
  async sync(schoolId: string, workshopId: string, actor: { id: string; manager: boolean }) {
    const workshop = await loadWorkshop(schoolId, workshopId);
    if (!actor.manager && workshop.teacherUserId !== actor.id) throw new ForbiddenError('Este taller no es tuyo');
    await loadYear(schoolId, workshop.yearId, true);
    if (!workshop.classroomId) throw new ConflictError('Este taller aún no tiene clase');
    return schoolAutoEnrollService.syncWorkshop(schoolId, workshop.yearId, workshop.id);
  },

  /** El docente del taller (o la administración) le pone su clase: una suya o una nueva. */
  async setClassroom(schoolId: string, workshopId: string, choice: ClassroomChoice, actor: { id: string; manager: boolean }) {
    const workshop = await loadWorkshop(schoolId, workshopId);
    if (!actor.manager && workshop.teacherUserId !== actor.id) throw new ForbiddenError('Este taller no es tuyo');
    return this.update(schoolId, workshopId, { classroom: choice }, actor.id);
  },

  /** Mis talleres del año (para Mis asignaciones). */
  async mine(schoolId: string, yearId: string, userId: string) {
    const rows = await db.select().from(schoolWorkshops)
      .where(and(eq(schoolWorkshops.schoolId, schoolId), eq(schoolWorkshops.yearId, yearId), eq(schoolWorkshops.teacherUserId, userId)))
      .orderBy(asc(schoolWorkshops.name));
    return describe(schoolId, yearId, rows);
  },
};
