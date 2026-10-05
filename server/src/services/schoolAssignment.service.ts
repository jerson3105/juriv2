import { and, asc, count, eq, gte, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classrooms, curriculumAreas, schoolEnrollmentEvents, schoolEnrollments, schoolMembers, schoolSections, schoolStudents,
  schoolTeachingAssignments, schoolYearLevels, schoolYears, studentProfiles, users,
} from '../db/schema.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { classroomService } from './classroom.service.js';
import { schoolAutoEnrollService, type SyncResult } from './schoolAutoEnroll.service.js';
import { effectivePlan, type PlanArea } from './schoolPlan.service.js';
import { sectionDisplayName } from './schoolSection.service.js';
import type { SchoolLevel } from './schoolYear.service.js';

/**
 * Asignaciones: en cada sección, qué docente enseña cada área del plan y con qué clase. Vincular una clase pone en
 * ella a los estudiantes de la sección (matrícula automática). La clase sigue siendo del docente: la administración la
 * crea o la vincula, pero no la abre.
 */

export type ClassroomChoice = { mode: 'create' } | { mode: 'link'; classroomId: string } | { mode: 'none' };

const LEVEL_ORDER: SchoolLevel[] = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'];
const SCALE_OF: Record<string, 'PERU_LETTERS' | 'PERU_VIGESIMAL'> = { LITERAL: 'PERU_LETTERS', VIGESIMAL: 'PERU_VIGESIMAL' };
const tutors = alias(users, 'tutor');

const fullName = (u: { firstName: string | null; lastName: string | null }) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
const initialsOf = (u: { firstName: string | null; lastName: string | null }) => `${(u.firstName ?? '').trim()[0] ?? ''}${(u.lastName ?? '').trim()[0] ?? ''}`.toUpperCase();
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const loadYear = async (schoolId: string, yearId: string, forWrite: boolean) => {
  const [year] = await db.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status }).from(schoolYears)
    .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (forWrite && year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
  return year;
};

const loadSection = async (schoolId: string, sectionId: string) => {
  const [section] = await db.select({
    id: schoolSections.id, yearId: schoolSections.yearId, level: schoolSections.level, grade: schoolSections.grade,
    name: schoolSections.name, tutorUserId: schoolSections.tutorUserId,
  }).from(schoolSections).where(and(eq(schoolSections.id, sectionId), eq(schoolSections.schoolId, schoolId)));
  if (!section) throw new NotFoundError('Sección no encontrada');
  return section;
};
type Section = Awaited<ReturnType<typeof loadSection>>;

const loadAssignment = async (schoolId: string, assignmentId: string) => {
  const [assignment] = await db.select().from(schoolTeachingAssignments)
    .where(and(eq(schoolTeachingAssignments.id, assignmentId), eq(schoolTeachingAssignments.schoolId, schoolId)));
  if (!assignment) throw new NotFoundError('Asignación no encontrada');
  return assignment;
};

/** El docente es miembro verificado de la escuela (cualquier rol: la administración también enseña) y está activo. */
const assertTeacher = async (schoolId: string, userId: string) => {
  const [member] = await db.select({ status: schoolMembers.status, active: users.isActive, role: users.role, firstName: users.firstName, lastName: users.lastName })
    .from(schoolMembers).innerJoin(users, eq(users.id, schoolMembers.userId))
    .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.userId, userId)));
  if (!member || member.status !== 'VERIFIED' || !member.active || member.role !== 'TEACHER') {
    throw new ValidationError('Ese docente no es parte del equipo de la escuela');
  }
  return member;
};

/** El área está en el plan del año para el grado de la sección. */
const planAreaFor = async (yearId: string, section: Section, areaId: string): Promise<PlanArea> => {
  const plan = await effectivePlan(yearId, section.level);
  const area = plan.areas.find((a) => a.areaId === areaId && a.grades.includes(section.grade));
  if (!area) throw new ValidationError('Esa área no está en el plan de estudios de este grado');
  return area;
};

/**
 * La clase de una asignación: ninguna, una que el docente ya tiene en la escuela (libre y de esa sección y área, o sin
 * ellas), o una nueva a su nombre. Devuelve su id (o null).
 */
const resolveClassroom = async (schoolId: string, section: Section, area: PlanArea, teacherUserId: string, choice: ClassroomChoice, exceptAssignmentId?: string) => {
  if (choice.mode === 'none') return null;
  if (choice.mode === 'link') {
    const [classroom] = await db.select({
      id: classrooms.id, teacherId: classrooms.teacherId, schoolId: classrooms.schoolId, isActive: classrooms.isActive,
      schoolSectionId: classrooms.schoolSectionId, curriculumAreaId: classrooms.curriculumAreaId, gradeLevel: classrooms.gradeLevel,
      useCompetencies: classrooms.useCompetencies,
    }).from(classrooms).where(eq(classrooms.id, choice.classroomId));
    if (!classroom || classroom.teacherId !== teacherUserId || classroom.schoolId !== schoolId) throw new ValidationError('Esa clase no es de este docente en la escuela');
    if (!classroom.isActive) throw new ConflictError('Esa clase está archivada');
    const [other] = await db.select({ id: schoolTeachingAssignments.id }).from(schoolTeachingAssignments)
      .where(and(eq(schoolTeachingAssignments.classroomId, classroom.id), exceptAssignmentId ? ne(schoolTeachingAssignments.id, exceptAssignmentId) : undefined));
    if (other) throw new ConflictError('Esa clase ya está vinculada a otra asignación');
    if (classroom.schoolSectionId && classroom.schoolSectionId !== section.id) throw new ConflictError('Esa clase es de otra sección');
    if (classroom.curriculumAreaId && classroom.curriculumAreaId !== area.areaId) throw new ConflictError(`Esa clase es de otra área, no de ${area.name}`);
    await db.update(classrooms).set({
      schoolSectionId: section.id,
      curriculumAreaId: area.areaId,
      gradeLevel: classroom.gradeLevel || `${section.level}_${section.grade}`,
      updatedAt: new Date(),
    }).where(eq(classrooms.id, classroom.id));
    // Sin área hasta ahora: recibe las competencias oficiales del área (como al configurar el registro).
    if (!classroom.curriculumAreaId && classroom.useCompetencies) await classroomService.syncClassroomCompetencies(classroom.id, area.areaId);
    return classroom.id;
  }
  const [scale] = await db.select({ gradeScale: schoolYearLevels.gradeScale }).from(schoolYearLevels)
    .where(and(eq(schoolYearLevels.yearId, section.yearId), eq(schoolYearLevels.level, section.level)));
  const created = await classroomService.create({
    name: `${area.name} ${sectionDisplayName(section.level, section.grade, section.name)}`,
    teacherId: teacherUserId,
    gradeLevel: `${section.level}_${section.grade}`,
    useCompetencies: true,
    curriculumAreaId: area.areaId,
    gradeScaleType: scale ? SCALE_OF[scale.gradeScale] ?? null : null,
    schoolId,
    schoolSectionId: section.id,
  });
  if (!created) throw new Error('No se pudo crear la clase');
  return created.id;
};

const syncFor = async (schoolId: string, yearId: string, sectionId: string, classroomId: string | null): Promise<SyncResult> => {
  if (!classroomId) return { created: 0, linked: 0, withAccount: 0 };
  return schoolAutoEnrollService.syncClassroom({ schoolId, yearId, sectionId, classroomId });
};

/** Estudiantes activos de cada sección del año. */
const enrolledBySection = async (yearId: string, sectionIds: string[]) => {
  if (sectionIds.length === 0) return new Map<string, number>();
  const rows = await db.select({ sectionId: schoolEnrollments.sectionId, n: count() }).from(schoolEnrollments)
    .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
    .where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE'), eq(schoolStudents.status, 'ACTIVE'), inArray(schoolEnrollments.sectionId, sectionIds)))
    .groupBy(schoolEnrollments.sectionId);
  return new Map(rows.map((r) => [r.sectionId!, Number(r.n)]));
};

/** Por asignación con clase: cuántos de la sección aún no tienen perfil en ella. */
const missingByAssignment = async (yearId: string, assignmentIds: string[]) => {
  if (assignmentIds.length === 0) return new Map<string, number>();
  const rows = await db.select({ id: schoolTeachingAssignments.id, n: count() }).from(schoolTeachingAssignments)
    .innerJoin(schoolEnrollments, and(eq(schoolEnrollments.sectionId, schoolTeachingAssignments.sectionId), eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE')))
    .innerJoin(schoolStudents, and(eq(schoolStudents.id, schoolEnrollments.studentId), eq(schoolStudents.status, 'ACTIVE')))
    .leftJoin(studentProfiles, and(eq(studentProfiles.classroomId, schoolTeachingAssignments.classroomId), eq(studentProfiles.schoolStudentId, schoolEnrollments.studentId)))
    .where(and(inArray(schoolTeachingAssignments.id, assignmentIds), isNotNull(schoolTeachingAssignments.classroomId), isNull(studentProfiles.id)))
    .groupBy(schoolTeachingAssignments.id);
  return new Map(rows.map((r) => [r.id, Number(r.n)]));
};

/** Perfiles activos (sin demo) de cada clase. */
const studentsByClassroom = async (classroomIds: string[]) => {
  if (classroomIds.length === 0) return new Map<string, number>();
  const rows = await db.select({ classroomId: studentProfiles.classroomId, n: count() }).from(studentProfiles)
    .where(and(inArray(studentProfiles.classroomId, classroomIds), eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false)))
    .groupBy(studentProfiles.classroomId);
  return new Map(rows.map((r) => [r.classroomId, Number(r.n)]));
};

/** La clase vinculada tal como se muestra (sin clase si se borró o salió de la escuela). */
const assignmentRows = async (schoolId: string, yearId: string, where?: ReturnType<typeof and>) => {
  const rows = await db.select({
    id: schoolTeachingAssignments.id, sectionId: schoolTeachingAssignments.sectionId, areaId: schoolTeachingAssignments.areaId,
    teacherUserId: schoolTeachingAssignments.teacherUserId, classroomId: schoolTeachingAssignments.classroomId,
    className: classrooms.name, classActive: classrooms.isActive, classSchoolId: classrooms.schoolId,
  }).from(schoolTeachingAssignments)
    .leftJoin(classrooms, eq(classrooms.id, schoolTeachingAssignments.classroomId))
    .where(and(eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId), where));
  return rows.map((r) => ({ ...r, classroomId: r.classroomId && r.className !== null && r.classSchoolId === schoolId ? r.classroomId : null }));
};

const teamOf = async (schoolId: string) => db.select({
  userId: schoolMembers.userId, role: schoolMembers.role, firstName: users.firstName, lastName: users.lastName,
}).from(schoolMembers).innerJoin(users, eq(users.id, schoolMembers.userId))
  .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.status, 'VERIFIED'), eq(users.isActive, true)))
  .orderBy(asc(users.firstName), asc(users.lastName));

export const schoolAssignmentService = {
  /** La matriz de un nivel: secciones × áreas del plan, con tutoría, docentes, clases y lo que falta. */
  async matrix(schoolId: string, yearId: string, level?: SchoolLevel) {
    await loadYear(schoolId, yearId, false);
    const sections = await db.select({
      id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name, tutorUserId: schoolSections.tutorUserId,
    }).from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)))
      .orderBy(asc(schoolSections.level), asc(schoolSections.grade), asc(schoolSections.name));
    const levels = LEVEL_ORDER.filter((l) => sections.some((s) => s.level === l));
    const chosen = level && levels.includes(level) ? level : levels[0] ?? null;
    const all = await assignmentRows(schoolId, yearId);
    const team = await teamOf(schoolId);
    const sectionLabel = new Map(sections.map((s) => [s.id, sectionDisplayName(s.level, s.grade, s.name)]));
    const teachers = team.map((m) => ({
      userId: m.userId,
      name: fullName(m),
      initials: initialsOf(m),
      role: m.role,
      assignments: all.filter((a) => a.teacherUserId === m.userId).length,
      tutorOf: sections.filter((s) => s.tutorUserId === m.userId).map((s) => sectionLabel.get(s.id)!),
    }));
    if (!chosen) {
      return { levels, level: null, plan: [], sections: [], assignments: [], teachers, counts: { required: 0, assigned: 0, withoutClass: 0, missing: 0 } };
    }
    const plan = (await effectivePlan(yearId, chosen)).areas;
    const levelSections = sections.filter((s) => s.level === chosen);
    const enrolled = await enrolledBySection(yearId, levelSections.map((s) => s.id));
    const levelIds = new Set(levelSections.map((s) => s.id));
    const assignments = all.filter((a) => levelIds.has(a.sectionId));
    const missing = await missingByAssignment(yearId, assignments.filter((a) => a.classroomId).map((a) => a.id));
    const classStudents = await studentsByClassroom(assignments.map((a) => a.classroomId).filter((id): id is string => !!id));
    const byUser = new Map(team.map((m) => [m.userId, m]));
    const inPlan = (sectionGrade: number, areaId: string) => plan.some((p) => p.areaId === areaId && p.grades.includes(sectionGrade));
    const gradeOf = new Map(levelSections.map((s) => [s.id, s.grade]));
    const cells = assignments.filter((a) => inPlan(gradeOf.get(a.sectionId)!, a.areaId));
    return {
      levels,
      level: chosen,
      plan,
      sections: levelSections.map((s) => {
        const tutor = s.tutorUserId ? byUser.get(s.tutorUserId) : undefined;
        return {
          id: s.id, grade: s.grade, name: s.name, label: sectionLabel.get(s.id)!,
          tutor: tutor ? { userId: tutor.userId, name: fullName(tutor), initials: initialsOf(tutor) } : null,
          students: enrolled.get(s.id) ?? 0,
        };
      }),
      assignments: assignments.map((a) => ({
        id: a.id,
        sectionId: a.sectionId,
        areaId: a.areaId,
        teacherUserId: a.teacherUserId,
        classroom: a.classroomId
          ? { id: a.classroomId, name: a.className!, archived: !a.classActive, students: classStudents.get(a.classroomId) ?? 0, missing: missing.get(a.id) ?? 0 }
          : null,
      })),
      teachers,
      counts: {
        required: levelSections.reduce((sum, s) => sum + plan.filter((p) => p.grades.includes(s.grade)).length, 0),
        assigned: cells.length,
        withoutClass: cells.filter((a) => !a.classroomId).length,
        missing: cells.reduce((sum, a) => sum + (missing.get(a.id) ?? 0), 0),
      },
    };
  },

  /** Las clases de un docente en la escuela, para «Usar una clase que ya tiene». */
  async teacherClassrooms(schoolId: string, teacherUserId: string) {
    const rows = await db.select({
      id: classrooms.id, name: classrooms.name, schoolSectionId: classrooms.schoolSectionId, curriculumAreaId: classrooms.curriculumAreaId,
      linked: schoolTeachingAssignments.id,
    }).from(classrooms)
      .leftJoin(schoolTeachingAssignments, eq(schoolTeachingAssignments.classroomId, classrooms.id))
      .where(and(eq(classrooms.schoolId, schoolId), eq(classrooms.teacherId, teacherUserId), eq(classrooms.isActive, true)))
      .orderBy(asc(classrooms.name));
    const students = await studentsByClassroom(rows.map((r) => r.id));
    return rows.map((r) => ({
      id: r.id, name: r.name, sectionId: r.schoolSectionId, areaId: r.curriculumAreaId, linked: !!r.linked, students: students.get(r.id) ?? 0,
    }));
  },

  async create(schoolId: string, yearId: string, input: { sectionId: string; areaId: string; teacherUserId: string; classroom: ClassroomChoice }, actorId: string) {
    await loadYear(schoolId, yearId, true);
    const section = await loadSection(schoolId, input.sectionId);
    if (section.yearId !== yearId) throw new NotFoundError('Sección no encontrada');
    const area = await planAreaFor(yearId, section, input.areaId);
    await assertTeacher(schoolId, input.teacherUserId);
    const [taken] = await db.select({ id: schoolTeachingAssignments.id }).from(schoolTeachingAssignments)
      .where(and(eq(schoolTeachingAssignments.sectionId, section.id), eq(schoolTeachingAssignments.areaId, area.areaId)));
    if (taken) throw new ConflictError(`${area.name} ya tiene docente en ${sectionDisplayName(section.level, section.grade, section.name)}`);
    const classroomId = await resolveClassroom(schoolId, section, area, input.teacherUserId, input.classroom);
    const id = uuidv4();
    const now = new Date();
    try {
      await db.insert(schoolTeachingAssignments).values({
        id, schoolId, yearId, sectionId: section.id, areaId: area.areaId, teacherUserId: input.teacherUserId, classroomId,
        createdBy: actorId, createdAt: now, updatedAt: now,
      });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        if (input.classroom.mode === 'create') logger.warn('Asignación repetida tras crear la clase', { schoolId, classroomId });
        throw new ConflictError('Esa asignación se acaba de hacer desde otra sesión: recarga la matriz');
      }
      throw error;
    }
    const sync = await syncFor(schoolId, yearId, section.id, classroomId);
    return { id, classroomId, sync };
  },

  /** Cambia el docente o la clase. Al cambiar de docente, la clase del anterior se desvincula (sigue siendo suya). */
  async update(schoolId: string, assignmentId: string, patch: { teacherUserId?: string; classroom?: ClassroomChoice }) {
    const assignment = await loadAssignment(schoolId, assignmentId);
    await loadYear(schoolId, assignment.yearId, true);
    const section = await loadSection(schoolId, assignment.sectionId);
    const area = await planAreaFor(assignment.yearId, section, assignment.areaId);
    const teacherUserId = patch.teacherUserId ?? assignment.teacherUserId;
    if (teacherUserId !== assignment.teacherUserId) await assertTeacher(schoolId, teacherUserId);
    let classroomId = teacherUserId === assignment.teacherUserId ? assignment.classroomId : null;
    if (patch.classroom) classroomId = await resolveClassroom(schoolId, section, area, teacherUserId, patch.classroom, assignment.id);
    try {
      await db.update(schoolTeachingAssignments).set({ teacherUserId, classroomId, updatedAt: new Date() })
        .where(eq(schoolTeachingAssignments.id, assignment.id));
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Esa clase ya está vinculada a otra asignación');
      throw error;
    }
    const sync = classroomId && classroomId !== assignment.classroomId
      ? await syncFor(schoolId, assignment.yearId, section.id, classroomId)
      : { created: 0, linked: 0, withAccount: 0 };
    return { id: assignment.id, teacherChanged: teacherUserId !== assignment.teacherUserId, classroomId, sync };
  },

  /** Quita la asignación. La clase y sus estudiantes siguen tal cual (son del docente). */
  async remove(schoolId: string, assignmentId: string) {
    const assignment = await loadAssignment(schoolId, assignmentId);
    await loadYear(schoolId, assignment.yearId, true);
    await db.delete(schoolTeachingAssignments).where(eq(schoolTeachingAssignments.id, assignment.id));
    return assignment;
  },

  /** El docente de una asignación (para que sincronice solo la suya). */
  async ownerOf(schoolId: string, assignmentId: string) {
    return (await loadAssignment(schoolId, assignmentId)).teacherUserId;
  },

  /** «Sincronizar»: completa la matrícula automática de la clase vinculada. */
  async sync(schoolId: string, assignmentId: string) {
    const assignment = await loadAssignment(schoolId, assignmentId);
    await loadYear(schoolId, assignment.yearId, true);
    if (!assignment.classroomId) throw new ConflictError('Esta asignación aún no tiene clase');
    return syncFor(schoolId, assignment.yearId, assignment.sectionId, assignment.classroomId);
  },

  /**
   * «Completar desde las clases»: cada clase de la escuela con sección (del armado) y área se vuelve la asignación de
   * su docente. Se omite lo dudoso: dos clases para la misma celda, área fuera del plan, celda de otro docente.
   */
  async fromClassesPreview(schoolId: string, yearId: string) {
    await loadYear(schoolId, yearId, false);
    const sections = await db.select({
      id: schoolSections.id, yearId: schoolSections.yearId, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name,
      tutorUserId: schoolSections.tutorUserId,
    }).from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)));
    const sectionById = new Map(sections.map((s) => [s.id, s]));
    const candidates = sections.length === 0 ? [] : await db.select({
      id: classrooms.id, name: classrooms.name, teacherId: classrooms.teacherId, sectionId: classrooms.schoolSectionId,
      areaId: classrooms.curriculumAreaId, areaName: curriculumAreas.name,
    }).from(classrooms)
      .leftJoin(curriculumAreas, eq(curriculumAreas.id, classrooms.curriculumAreaId))
      .where(and(
        eq(classrooms.schoolId, schoolId), eq(classrooms.isActive, true), isNotNull(classrooms.curriculumAreaId),
        inArray(classrooms.schoolSectionId, sections.map((s) => s.id)),
      ))
      .orderBy(asc(classrooms.name));
    const existing = await db.select().from(schoolTeachingAssignments)
      .where(and(eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId)));
    const bySectionArea = new Map(existing.map((a) => [`${a.sectionId}|${a.areaId}`, a]));
    const linkedClasses = new Set(existing.map((a) => a.classroomId).filter(Boolean));
    const team = new Map((await teamOf(schoolId)).map((m) => [m.userId, m]));
    const plans = new Map<SchoolLevel, PlanArea[]>();
    for (const level of new Set(sections.map((s) => s.level))) plans.set(level, (await effectivePlan(yearId, level)).areas);
    const perCell = new Map<string, number>();
    for (const c of candidates) perCell.set(`${c.sectionId}|${c.areaId}`, (perCell.get(`${c.sectionId}|${c.areaId}`) ?? 0) + 1);

    type Reason = 'two_classes' | 'out_of_plan' | 'not_member' | 'taken';
    const proposals: Array<{ classroomId: string; className: string; sectionId: string; sectionLabel: string; areaId: string; areaName: string; teacherUserId: string; teacherName: string; kind: 'create' | 'link' }> = [];
    const skipped: Array<{ classroomId: string; className: string; sectionLabel: string; areaName: string; reason: Reason }> = [];
    let already = 0;
    for (const c of candidates) {
      const section = sectionById.get(c.sectionId!)!;
      const label = sectionDisplayName(section.level, section.grade, section.name);
      const cell = `${c.sectionId}|${c.areaId}`;
      const assignment = bySectionArea.get(cell);
      if (assignment?.classroomId === c.id) { already++; continue; }
      const skip = (reason: Reason) => skipped.push({ classroomId: c.id, className: c.name, sectionLabel: label, areaName: c.areaName ?? '', reason });
      if (linkedClasses.has(c.id)) { already++; continue; }
      if ((perCell.get(cell) ?? 0) > 1) { skip('two_classes'); continue; }
      if (!plans.get(section.level)?.some((p) => p.areaId === c.areaId && p.grades.includes(section.grade))) { skip('out_of_plan'); continue; }
      const teacher = team.get(c.teacherId);
      if (!teacher) { skip('not_member'); continue; }
      if (assignment && (assignment.classroomId || assignment.teacherUserId !== c.teacherId)) { skip('taken'); continue; }
      proposals.push({
        classroomId: c.id, className: c.name, sectionId: section.id, sectionLabel: label, areaId: c.areaId!, areaName: c.areaName ?? '',
        teacherUserId: c.teacherId, teacherName: fullName(teacher), kind: assignment ? 'link' : 'create',
      });
    }
    return { proposals, skipped, already };
  },

  async fromClassesConfirm(schoolId: string, yearId: string, actorId: string) {
    await loadYear(schoolId, yearId, true);
    const { proposals } = await this.fromClassesPreview(schoolId, yearId);
    if (proposals.length === 0) throw new ConflictError('No hay clases nuevas para asignar');
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        for (const p of proposals) {
          if (p.kind === 'link') {
            await tx.update(schoolTeachingAssignments).set({ classroomId: p.classroomId, updatedAt: now })
              .where(and(eq(schoolTeachingAssignments.sectionId, p.sectionId), eq(schoolTeachingAssignments.areaId, p.areaId), isNull(schoolTeachingAssignments.classroomId)));
          } else {
            await tx.insert(schoolTeachingAssignments).values({
              id: uuidv4(), schoolId, yearId, sectionId: p.sectionId, areaId: p.areaId, teacherUserId: p.teacherUserId, classroomId: p.classroomId,
              createdBy: actorId, createdAt: now, updatedAt: now,
            });
          }
        }
      });
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ConflictError('Alguna de esas asignaciones se hizo desde otra sesión: vuelve a revisar');
      throw error;
    }
    let sync: SyncResult = { created: 0, linked: 0, withAccount: 0 };
    for (const p of proposals) {
      const r = await syncFor(schoolId, yearId, p.sectionId, p.classroomId);
      sync = { created: sync.created + r.created, linked: sync.linked + r.linked, withAccount: sync.withAccount + r.withAccount };
    }
    return { assigned: proposals.length, sync };
  },

  /** Mi carga (cualquier miembro verificado): mis asignaciones del año, mis tutorías y mis clases para vincular. */
  async myLoad(schoolId: string, yearId: string, userId: string) {
    await loadYear(schoolId, yearId, false);
    const mine = await db.select({
      id: schoolTeachingAssignments.id, sectionId: schoolTeachingAssignments.sectionId, areaId: schoolTeachingAssignments.areaId,
      classroomId: schoolTeachingAssignments.classroomId, areaName: curriculumAreas.name, areaShort: curriculumAreas.shortName,
      level: schoolSections.level, grade: schoolSections.grade, sectionName: schoolSections.name,
      className: classrooms.name, classActive: classrooms.isActive, classSchoolId: classrooms.schoolId,
    }).from(schoolTeachingAssignments)
      .innerJoin(schoolSections, eq(schoolSections.id, schoolTeachingAssignments.sectionId))
      .innerJoin(curriculumAreas, eq(curriculumAreas.id, schoolTeachingAssignments.areaId))
      .leftJoin(classrooms, eq(classrooms.id, schoolTeachingAssignments.classroomId))
      .where(and(eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId), eq(schoolTeachingAssignments.teacherUserId, userId)))
      .orderBy(asc(curriculumAreas.displayOrder), asc(schoolSections.level), asc(schoolSections.grade), asc(schoolSections.name));
    const rows = mine.map((r) => ({ ...r, classroomId: r.classroomId && r.className !== null && r.classSchoolId === schoolId ? r.classroomId : null }));
    const tutored = await db.select({
      id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name,
    }).from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId), eq(schoolSections.tutorUserId, userId)));
    const sectionIds = [...new Set([...rows.map((r) => r.sectionId), ...tutored.map((t) => t.id)])];
    const enrolled = await enrolledBySection(yearId, sectionIds);
    const missing = await missingByAssignment(yearId, rows.filter((r) => r.classroomId).map((r) => r.id));
    const classStudents = await studentsByClassroom(rows.map((r) => r.classroomId).filter((id): id is string => !!id));

    // Llegadas a la sección (alta o sección asignada) hoy, y en la semana para la tutoría.
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const arrivals = sectionIds.length === 0 ? [] : await db.select({
      sectionId: schoolEnrollmentEvents.toSectionId, fromSectionId: schoolEnrollmentEvents.fromSectionId, createdAt: schoolEnrollmentEvents.createdAt,
      firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames,
    }).from(schoolEnrollmentEvents)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollmentEvents.studentId))
      .where(and(
        eq(schoolEnrollmentEvents.schoolId, schoolId), inArray(schoolEnrollmentEvents.toSectionId, sectionIds), gte(schoolEnrollmentEvents.createdAt, weekAgo),
        inArray(schoolEnrollmentEvents.type, ['ENROLLED', 'SECTION_CHANGED', 'BUILT_FROM_CLASSES']),
      ));
    const departures = sectionIds.length === 0 ? [] : await db.select({ sectionId: schoolEnrollmentEvents.fromSectionId, createdAt: schoolEnrollmentEvents.createdAt })
      .from(schoolEnrollmentEvents)
      .where(and(eq(schoolEnrollmentEvents.schoolId, schoolId), inArray(schoolEnrollmentEvents.fromSectionId, sectionIds), gte(schoolEnrollmentEvents.createdAt, startOfToday())));
    const today = startOfToday().getTime();
    const countToday = (list: Array<{ sectionId: string | null; createdAt: Date }>, sectionId: string) =>
      list.filter((e) => e.sectionId === sectionId && new Date(e.createdAt).getTime() >= today).length;

    const allSections = await db.select({ id: schoolSections.id, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name })
      .from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.yearId, yearId)));
    const labelOf = new Map(allSections.map((s) => [s.id, sectionDisplayName(s.level, s.grade, s.name)]));

    // Tutoría: datos por completar y áreas sin docente.
    const incomplete = tutored.length === 0 ? [] : await db.select({ sectionId: schoolEnrollments.sectionId, n: count() }).from(schoolEnrollments)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .where(and(
        eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.status, 'ACTIVE'), eq(schoolStudents.status, 'ACTIVE'),
        inArray(schoolEnrollments.sectionId, tutored.map((t) => t.id)),
        or(isNull(schoolStudents.documentIndex), isNull(schoolStudents.birthDate)),
      )).groupBy(schoolEnrollments.sectionId);
    const incompleteOf = new Map(incomplete.map((r) => [r.sectionId!, Number(r.n)]));
    const sectionAssignments = tutored.length === 0 ? [] : await db.select({ sectionId: schoolTeachingAssignments.sectionId, areaId: schoolTeachingAssignments.areaId })
      .from(schoolTeachingAssignments).where(inArray(schoolTeachingAssignments.sectionId, tutored.map((t) => t.id)));
    const plans = new Map<SchoolLevel, PlanArea[]>();
    for (const level of new Set(tutored.map((t) => t.level))) plans.set(level, (await effectivePlan(yearId, level)).areas);

    const myClasses = await this.teacherClassrooms(schoolId, userId);
    return {
      assignments: rows.map((r) => ({
        id: r.id,
        area: { id: r.areaId, name: r.areaName, shortName: r.areaShort },
        section: { id: r.sectionId, label: sectionDisplayName(r.level, r.grade, r.sectionName), level: r.level, grade: r.grade },
        students: enrolled.get(r.sectionId) ?? 0,
        classroom: r.classroomId ? { id: r.classroomId, name: r.className!, archived: !r.classActive, students: classStudents.get(r.classroomId) ?? 0 } : null,
        missing: missing.get(r.id) ?? 0,
        arrivedToday: countToday(arrivals, r.sectionId),
        leftToday: countToday(departures, r.sectionId),
      })),
      tutoring: tutored.map((t) => {
        const required = (plans.get(t.level) ?? []).filter((p) => p.grades.includes(t.grade));
        const covered = new Set(sectionAssignments.filter((a) => a.sectionId === t.id).map((a) => a.areaId));
        return {
          section: { id: t.id, label: sectionDisplayName(t.level, t.grade, t.name) },
          students: enrolled.get(t.id) ?? 0,
          incomplete: incompleteOf.get(t.id) ?? 0,
          arrivals: arrivals.filter((a) => a.sectionId === t.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 8)
            .map((a) => ({ name: `${a.firstNames} ${a.lastNames}`, from: a.fromSectionId ? labelOf.get(a.fromSectionId) ?? null : null, at: a.createdAt })),
          coverage: { required: required.length, assigned: required.filter((p) => covered.has(p.areaId)).length, missingAreas: required.filter((p) => !covered.has(p.areaId)).map((p) => p.name) },
        };
      }),
      myClasses,
    };
  },

  /** El docente de la asignación (o la administración) le pone su clase: una suya o una nueva. */
  async setClassroom(schoolId: string, assignmentId: string, choice: ClassroomChoice, actor: { id: string; manager: boolean }) {
    const assignment = await loadAssignment(schoolId, assignmentId);
    if (!actor.manager && assignment.teacherUserId !== actor.id) throw new ForbiddenError('Esta asignación no es tuya');
    return this.update(schoolId, assignmentId, { classroom: choice });
  },

  /** La sección de una tutoría (su tutor o la administración): estudiantes sin datos sensibles. */
  async tutoringSection(schoolId: string, yearId: string, sectionId: string, actor: { id: string; manager: boolean }) {
    await loadYear(schoolId, yearId, false);
    const section = await loadSection(schoolId, sectionId);
    if (section.yearId !== yearId) throw new NotFoundError('Sección no encontrada');
    if (!actor.manager && section.tutorUserId !== actor.id) throw new ForbiddenError('No eres tutor de esta sección');
    const students = await db.select({
      id: schoolStudents.id, firstNames: schoolStudents.firstNames, lastNames: schoolStudents.lastNames,
      hasDocument: sql<number>`${schoolStudents.documentIndex} IS NOT NULL`, birthDate: schoolStudents.birthDate,
    }).from(schoolEnrollments)
      .innerJoin(schoolStudents, eq(schoolStudents.id, schoolEnrollments.studentId))
      .where(and(eq(schoolEnrollments.yearId, yearId), eq(schoolEnrollments.sectionId, sectionId), eq(schoolEnrollments.status, 'ACTIVE'), eq(schoolStudents.status, 'ACTIVE')))
      .orderBy(asc(schoolStudents.lastNames), asc(schoolStudents.firstNames));
    const classes = students.length === 0 ? [] : await db.select({ studentId: studentProfiles.schoolStudentId, n: count() }).from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(and(inArray(studentProfiles.schoolStudentId, students.map((s) => s.id)), eq(studentProfiles.isActive, true), eq(classrooms.schoolId, schoolId), eq(classrooms.isActive, true)))
      .groupBy(studentProfiles.schoolStudentId);
    const classesOf = new Map(classes.map((c) => [c.studentId!, Number(c.n)]));
    const [tutor] = section.tutorUserId
      ? await db.select({ firstName: tutors.firstName, lastName: tutors.lastName }).from(tutors).where(eq(tutors.id, section.tutorUserId))
      : [];
    return {
      section: { id: section.id, label: sectionDisplayName(section.level, section.grade, section.name), tutor: tutor ? fullName(tutor) : null },
      students: students.map((s) => ({
        id: s.id, firstNames: s.firstNames, lastNames: s.lastNames, hasDocument: !!Number(s.hasDocument), birthDate: s.birthDate,
        classes: classesOf.get(s.id) ?? 0,
      })),
    };
  },
};
