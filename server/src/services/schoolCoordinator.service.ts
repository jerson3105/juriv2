import { and, asc, count, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  attendanceRecords, badges, behaviors, classrooms, curriculumAreas, pointLogs, schoolAreaCoordinators, schoolBadges, schoolBehaviors,
  schoolMembers, schoolSections, schoolTeachingAssignments, schoolWorkshopSections, schoolWorkshops, schoolYearLevels, schoolYears,
  studentBadges, studentProfiles, users,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { gradeService } from './grade.service.js';
import { assertTeacher } from './schoolAssignment.service.js';
import { effectivePlan } from './schoolPlan.service.js';
import { sectionDisplayName } from './schoolSection.service.js';
import { SCHOOL_LEVELS, type SchoolLevel } from './schoolYear.service.js';

/**
 * Coordinadores de área: la administración nombra uno por área y nivel en el año. El coordinador ve la información de
 * las clases y talleres de su área (participación, asistencia y avance de notas, sin entrar a ellas ni ver a cada
 * estudiante) y propone comportamientos e insignias para su área en la Biblioteca, que importan los docentes del área.
 */

const DAY_MS = 86_400_000;
const fullName = (u: { firstName: string | null; lastName: string | null }) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
const initialsOf = (u: { firstName: string | null; lastName: string | null }) => `${(u.firstName ?? '').trim()[0] ?? ''}${(u.lastName ?? '').trim()[0] ?? ''}`.toUpperCase();
const keyOf = (level: string, areaId: string) => `${level}|${areaId}`;

const loadYear = async (schoolId: string, yearId: string, forWrite: boolean) => {
  const [year] = await db.select({ id: schoolYears.id, name: schoolYears.name, status: schoolYears.status }).from(schoolYears)
    .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (forWrite && year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
  return year;
};

/** El año en curso: los nombramientos que valen hoy (Biblioteca del área). */
const activeYearOf = async (schoolId: string) => {
  const [year] = await db.select({ id: schoolYears.id }).from(schoolYears)
    .where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.status, 'ACTIVE'))).limit(1);
  return year?.id ?? null;
};

const levelsOf = async (yearId: string) =>
  (await db.select({ level: schoolYearLevels.level }).from(schoolYearLevels).where(eq(schoolYearLevels.yearId, yearId)))
    .map((l) => l.level)
    .sort((a, b) => SCHOOL_LEVELS.indexOf(a) - SCHOOL_LEVELS.indexOf(b));

/** Docentes que se pueden nombrar: miembros verificados y activos (como en las asignaciones). */
const teamOf = async (schoolId: string) => db.select({ userId: schoolMembers.userId, firstName: users.firstName, lastName: users.lastName })
  .from(schoolMembers).innerJoin(users, eq(users.id, schoolMembers.userId))
  .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.status, 'VERIFIED'), eq(users.isActive, true), eq(users.role, 'TEACHER')))
  .orderBy(asc(users.firstName), asc(users.lastName));

const coordinationsOf = async (schoolId: string, yearId: string, userId: string) => (await db.select({
  id: schoolAreaCoordinators.id, level: schoolAreaCoordinators.level, areaId: schoolAreaCoordinators.areaId,
  name: curriculumAreas.name, shortName: curriculumAreas.shortName,
}).from(schoolAreaCoordinators).innerJoin(curriculumAreas, eq(curriculumAreas.id, schoolAreaCoordinators.areaId))
  .where(and(eq(schoolAreaCoordinators.schoolId, schoolId), eq(schoolAreaCoordinators.yearId, yearId), eq(schoolAreaCoordinators.userId, userId)))
  .orderBy(asc(curriculumAreas.displayOrder), asc(schoolAreaCoordinators.level)))
  .map((r) => ({ id: r.id, level: r.level, area: { id: r.areaId, name: r.name, shortName: r.shortName } }));

export interface ClassMetrics {
  students: number;
  gamification: {
    lastActivityAt: Date | null;
    xp30: number;
    xp7: number;
    positive30: number;
    negative30: number;
    badges30: number;
    top: Array<{ name: string; icon: string | null; count: number }>;
    imported: { behaviors: number; badges: number };
  };
  attendance: { rate: number; records: number; late: number; absent: number; days: number } | null;
}

/**
 * Participación y asistencia de unas clases (sin datos de cada estudiante). Un comportamiento deja un registro por tipo
 * de punto: un reconocimiento es estudiante + comportamiento + momento. imported: lo de la Biblioteca del área que la
 * clase ya usa.
 */
const classMetrics = async (classroomIds: string[], library: { behaviorIds: string[]; badgeIds: string[] }) => {
  const result = new Map<string, ClassMetrics>();
  if (classroomIds.length === 0) return result;
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY_MS);
  const since7 = new Date(now - 7 * DAY_MS);
  const logsOfClasses = and(inArray(studentProfiles.classroomId, classroomIds), eq(pointLogs.isReverted, false));
  const recognition = sql`CONCAT(${pointLogs.studentId}, '|', ${pointLogs.behaviorId}, '|', ${pointLogs.createdAt})`;
  const [students, points, last, top, badgesWon, attendance, importedBehaviors, importedBadges] = await Promise.all([
    db.select({ classroomId: studentProfiles.classroomId, n: count() }).from(studentProfiles)
      .where(and(inArray(studentProfiles.classroomId, classroomIds), eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false)))
      .groupBy(studentProfiles.classroomId),
    db.select({
      classroomId: studentProfiles.classroomId,
      xp30: sql<number>`COALESCE(SUM(CASE WHEN ${pointLogs.pointType} = 'XP' AND ${pointLogs.action} = 'ADD' THEN ${pointLogs.amount} ELSE 0 END), 0)`,
      // sql.param con la columna: la fecha va en UTC, como se guarda (no en la hora local del servidor).
      xp7: sql<number>`COALESCE(SUM(CASE WHEN ${pointLogs.pointType} = 'XP' AND ${pointLogs.action} = 'ADD' AND ${pointLogs.createdAt} >= ${sql.param(since7, pointLogs.createdAt)} THEN ${pointLogs.amount} ELSE 0 END), 0)`,
      positive: sql<number>`COUNT(DISTINCT CASE WHEN ${pointLogs.action} = 'ADD' AND ${pointLogs.behaviorId} IS NOT NULL THEN ${recognition} END)`,
      negative: sql<number>`COUNT(DISTINCT CASE WHEN ${pointLogs.action} = 'REMOVE' AND ${pointLogs.behaviorId} IS NOT NULL THEN ${recognition} END)`,
    }).from(pointLogs).innerJoin(studentProfiles, eq(studentProfiles.id, pointLogs.studentId))
      .where(and(logsOfClasses, gte(pointLogs.createdAt, since30)))
      .groupBy(studentProfiles.classroomId),
    db.select({ classroomId: studentProfiles.classroomId, last: sql<Date | null>`MAX(${pointLogs.createdAt})`.mapWith(pointLogs.createdAt) })
      .from(pointLogs).innerJoin(studentProfiles, eq(studentProfiles.id, pointLogs.studentId))
      .where(logsOfClasses)
      .groupBy(studentProfiles.classroomId),
    db.select({
      classroomId: studentProfiles.classroomId, behaviorId: pointLogs.behaviorId, name: behaviors.name, icon: behaviors.icon,
      n: sql<number>`COUNT(DISTINCT ${pointLogs.studentId}, ${pointLogs.createdAt})`,
    }).from(pointLogs)
      .innerJoin(studentProfiles, eq(studentProfiles.id, pointLogs.studentId))
      .innerJoin(behaviors, eq(behaviors.id, pointLogs.behaviorId))
      .where(and(logsOfClasses, gte(pointLogs.createdAt, since30), eq(pointLogs.action, 'ADD')))
      .groupBy(studentProfiles.classroomId, pointLogs.behaviorId, behaviors.name, behaviors.icon),
    // Insignias ganadas en la clase (sin las copias que trajo un traslado).
    db.select({ classroomId: studentProfiles.classroomId, n: count() }).from(studentBadges)
      .innerJoin(studentProfiles, eq(studentProfiles.id, studentBadges.studentProfileId))
      .where(and(inArray(studentProfiles.classroomId, classroomIds), gte(studentBadges.unlockedAt, since30), isNull(studentBadges.originBadgeId)))
      .groupBy(studentProfiles.classroomId),
    db.select({
      classroomId: attendanceRecords.classroomId,
      total: count(),
      present: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'PRESENT' THEN 1 ELSE 0 END)`,
      late: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'LATE' THEN 1 ELSE 0 END)`,
      absent: sql<number>`SUM(CASE WHEN ${attendanceRecords.status} = 'ABSENT' THEN 1 ELSE 0 END)`,
      days: sql<number>`COUNT(DISTINCT DATE(${attendanceRecords.date}))`,
    }).from(attendanceRecords)
      .where(and(inArray(attendanceRecords.classroomId, classroomIds), gte(attendanceRecords.date, since30), eq(attendanceRecords.isReverted, false)))
      .groupBy(attendanceRecords.classroomId),
    library.behaviorIds.length === 0 ? Promise.resolve([]) : db.select({ classroomId: behaviors.classroomId, n: count() }).from(behaviors)
      .where(and(inArray(behaviors.classroomId, classroomIds), inArray(behaviors.schoolBehaviorId, library.behaviorIds), eq(behaviors.isActive, true)))
      .groupBy(behaviors.classroomId),
    library.badgeIds.length === 0 ? Promise.resolve([]) : db.select({ classroomId: badges.classroomId, n: count() }).from(badges)
      .where(and(isNotNull(badges.classroomId), inArray(badges.classroomId, classroomIds), inArray(badges.schoolBadgeId, library.badgeIds), eq(badges.isActive, true)))
      .groupBy(badges.classroomId),
  ]);
  const byClass = <T extends { classroomId: string | null }>(rows: T[]) => new Map(rows.filter((r) => r.classroomId).map((r) => [r.classroomId!, r]));
  const studentsOf = byClass(students);
  const pointsOf = byClass(points);
  const lastOf = byClass(last);
  const badgesOf = byClass(badgesWon);
  const attendanceOf = byClass(attendance);
  const behaviorsImported = byClass(importedBehaviors);
  const badgesImported = byClass(importedBadges);
  for (const id of classroomIds) {
    const p = pointsOf.get(id);
    const a = attendanceOf.get(id);
    const total = Number(a?.total ?? 0);
    result.set(id, {
      students: Number(studentsOf.get(id)?.n ?? 0),
      gamification: {
        lastActivityAt: lastOf.get(id)?.last ?? null,
        xp30: Number(p?.xp30 ?? 0),
        xp7: Number(p?.xp7 ?? 0),
        positive30: Number(p?.positive ?? 0),
        negative30: Number(p?.negative ?? 0),
        badges30: Number(badgesOf.get(id)?.n ?? 0),
        top: top.filter((t) => t.classroomId === id)
          .map((t) => ({ name: t.name, icon: t.icon, count: Number(t.n) }))
          .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'es'))
          .slice(0, 3),
        imported: { behaviors: Number(behaviorsImported.get(id)?.n ?? 0), badges: Number(badgesImported.get(id)?.n ?? 0) },
      },
      // Como en los informes del colegio: presentes sobre el total de registros.
      attendance: total > 0
        ? { rate: Math.round((Number(a?.present ?? 0) / total) * 100), records: total, late: Number(a?.late ?? 0), absent: Number(a?.absent ?? 0), days: Number(a?.days ?? 0) }
        : null,
    });
  }
  return result;
};

export const schoolCoordinatorService = {
  /** Las áreas del plan de cada nivel del año con su coordinador (para nombrarlos) y el equipo que se puede elegir. */
  async list(schoolId: string, yearId: string) {
    await loadYear(schoolId, yearId, false);
    const levels = await levelsOf(yearId);
    const [rows, team, sectionCounts, workshopCounts] = await Promise.all([
      db.select({ level: schoolAreaCoordinators.level, areaId: schoolAreaCoordinators.areaId, userId: schoolAreaCoordinators.userId, firstName: users.firstName, lastName: users.lastName })
        .from(schoolAreaCoordinators).innerJoin(users, eq(users.id, schoolAreaCoordinators.userId))
        .where(and(eq(schoolAreaCoordinators.schoolId, schoolId), eq(schoolAreaCoordinators.yearId, yearId))),
      teamOf(schoolId),
      db.select({ level: schoolSections.level, areaId: schoolTeachingAssignments.areaId, n: count() }).from(schoolTeachingAssignments)
        .innerJoin(schoolSections, eq(schoolSections.id, schoolTeachingAssignments.sectionId))
        .where(and(eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId)))
        .groupBy(schoolSections.level, schoolTeachingAssignments.areaId),
      db.select({ level: schoolWorkshops.level, areaId: schoolWorkshops.areaId, n: count() }).from(schoolWorkshops)
        .where(and(eq(schoolWorkshops.schoolId, schoolId), eq(schoolWorkshops.yearId, yearId)))
        .groupBy(schoolWorkshops.level, schoolWorkshops.areaId),
    ]);
    const coordinatorOf = new Map(rows.map((r) => [keyOf(r.level, r.areaId), r]));
    const sectionsOf = new Map(sectionCounts.map((r) => [keyOf(r.level, r.areaId), Number(r.n)]));
    const workshopsOf = new Map(workshopCounts.map((r) => [keyOf(r.level, r.areaId), Number(r.n)]));
    const inTeam = new Set(team.map((m) => m.userId));
    return {
      levels: await Promise.all(levels.map(async (level) => ({
        level,
        areas: (await effectivePlan(yearId, level)).areas.map((area) => {
          const key = keyOf(level, area.areaId);
          const coordinator = coordinatorOf.get(key);
          return {
            areaId: area.areaId,
            name: area.name,
            shortName: area.shortName,
            sections: sectionsOf.get(key) ?? 0,
            workshops: workshopsOf.get(key) ?? 0,
            coordinator: coordinator
              ? { userId: coordinator.userId, name: fullName(coordinator), initials: initialsOf(coordinator), inTeam: inTeam.has(coordinator.userId) }
              : null,
          };
        }),
      }))),
      team: team.map((m) => ({ userId: m.userId, name: fullName(m), initials: initialsOf(m) })),
    };
  },

  /** Nombra (o quita) al coordinador de un área del plan en un nivel. Uno por área y nivel en el año. */
  async set(schoolId: string, yearId: string, input: { level: SchoolLevel; areaId: string; userId: string | null }, actorId: string) {
    await loadYear(schoolId, yearId, true);
    if (!(await levelsOf(yearId)).includes(input.level)) throw new ValidationError('Ese nivel no está en este año escolar');
    const area = (await effectivePlan(yearId, input.level)).areas.find((a) => a.areaId === input.areaId);
    if (!area) throw new ValidationError('Esa área no está en el plan de estudios del nivel');
    const where = and(eq(schoolAreaCoordinators.yearId, yearId), eq(schoolAreaCoordinators.level, input.level), eq(schoolAreaCoordinators.areaId, input.areaId));
    const [previous] = await db.select({ userId: schoolAreaCoordinators.userId }).from(schoolAreaCoordinators).where(where);
    if (input.userId === null) {
      await db.delete(schoolAreaCoordinators).where(where);
      return { area: area.name, coordinator: null, previousUserId: previous?.userId ?? null };
    }
    const member = await assertTeacher(schoolId, input.userId);
    const now = new Date();
    // La clave única (año, nivel, área) resuelve dos nombramientos a la vez: queda el último.
    await db.insert(schoolAreaCoordinators)
      .values({ id: uuidv4(), schoolId, yearId, level: input.level, areaId: input.areaId, userId: input.userId, createdBy: actorId, createdAt: now })
      .onDuplicateKeyUpdate({ set: { userId: input.userId, createdBy: actorId, createdAt: now } });
    return { area: area.name, coordinator: { userId: input.userId, name: fullName(member) }, previousUserId: previous?.userId ?? null };
  },

  /** Lo que coordino en el año (menú y Biblioteca). */
  async mine(schoolId: string, yearId: string, userId: string) {
    await loadYear(schoolId, yearId, false);
    return coordinationsOf(schoolId, yearId, userId);
  },

  /**
   * Panel del coordinador: por cada área que coordina, sus clases (asignaciones del nivel) y talleres con participación
   * (30 días), asistencia (30 días) y avance de notas del bimestre actual de cada clase (promedios, sin estudiantes).
   */
  async panel(schoolId: string, yearId: string, userId: string) {
    const year = await loadYear(schoolId, yearId, false);
    const mine = await coordinationsOf(schoolId, yearId, userId);
    if (mine.length === 0) return { year: { id: year.id, name: year.name }, coordinations: [] };
    const keys = new Set(mine.map((c) => keyOf(c.level, c.area.id)));
    const areaIds = [...new Set(mine.map((c) => c.area.id))];
    const [assignmentRows, workshopRows, behaviorItems, badgeItems] = await Promise.all([
      db.select({
        id: schoolTeachingAssignments.id, areaId: schoolTeachingAssignments.areaId, teacherUserId: schoolTeachingAssignments.teacherUserId,
        classroomId: schoolTeachingAssignments.classroomId, level: schoolSections.level, grade: schoolSections.grade, sectionName: schoolSections.name,
      }).from(schoolTeachingAssignments).innerJoin(schoolSections, eq(schoolSections.id, schoolTeachingAssignments.sectionId))
        .where(and(eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId), inArray(schoolTeachingAssignments.areaId, areaIds)))
        .orderBy(asc(schoolSections.grade), asc(schoolSections.name)),
      db.select().from(schoolWorkshops)
        .where(and(eq(schoolWorkshops.schoolId, schoolId), eq(schoolWorkshops.yearId, yearId), inArray(schoolWorkshops.areaId, areaIds)))
        .orderBy(asc(schoolWorkshops.name)),
      db.select({ id: schoolBehaviors.id, level: schoolBehaviors.level, areaId: schoolBehaviors.areaId }).from(schoolBehaviors)
        .where(and(eq(schoolBehaviors.schoolId, schoolId), inArray(schoolBehaviors.areaId, areaIds))),
      db.select({ id: schoolBadges.id, level: schoolBadges.level, areaId: schoolBadges.areaId }).from(schoolBadges)
        .where(and(eq(schoolBadges.schoolId, schoolId), inArray(schoolBadges.areaId, areaIds))),
    ]);
    const assignments = assignmentRows.filter((a) => keys.has(keyOf(a.level, a.areaId)));
    const workshops = workshopRows.filter((w) => keys.has(keyOf(w.level, w.areaId)));
    const ofKey = <T extends { level: string | null; areaId: string | null }>(rows: T[], key: string) => rows.filter((r) => r.level && r.areaId && keyOf(r.level, r.areaId) === key);
    const workshopSections = workshops.length === 0 ? [] : await db.select({
      workshopId: schoolWorkshopSections.workshopId, level: schoolSections.level, grade: schoolSections.grade, name: schoolSections.name,
    }).from(schoolWorkshopSections).innerJoin(schoolSections, eq(schoolSections.id, schoolWorkshopSections.sectionId))
      .where(inArray(schoolWorkshopSections.workshopId, workshops.map((w) => w.id)))
      .orderBy(asc(schoolSections.grade), asc(schoolSections.name));
    const teacherIds = [...new Set([...assignments.map((a) => a.teacherUserId), ...workshops.map((w) => w.teacherUserId)])];
    const teachers = new Map(teacherIds.length === 0 ? [] : (await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(inArray(users.id, teacherIds))).map((u) => [u.id, fullName(u)]));
    // Solo las clases que siguen en el colegio (como en Mis asignaciones).
    const classIds = [...new Set([...assignments, ...workshops].map((r) => r.classroomId).filter((id): id is string => !!id))];
    const classInfo = new Map(classIds.length === 0 ? [] : (await db.select({
      id: classrooms.id, name: classrooms.name, isActive: classrooms.isActive, schoolId: classrooms.schoolId, useCompetencies: classrooms.useCompetencies,
    }).from(classrooms).where(inArray(classrooms.id, classIds))).filter((c) => c.schoolId === schoolId).map((c) => [c.id, c]));

    const coordinations = [];
    for (const c of mine) {
      const key = keyOf(c.level, c.area.id);
      const library = { behaviorIds: ofKey(behaviorItems, key).map((b) => b.id), badgeIds: ofKey(badgeItems, key).map((b) => b.id) };
      const rows = [
        ...assignments.filter((a) => keyOf(a.level, a.areaId) === key).map((a) => ({
          kind: 'SECTION' as const, id: a.id, label: sectionDisplayName(a.level, a.grade, a.sectionName), detail: null as string | null,
          teacherUserId: a.teacherUserId, classroomId: a.classroomId,
        })),
        ...workshops.filter((w) => keyOf(w.level, w.areaId) === key).map((w) => ({
          kind: 'WORKSHOP' as const, id: w.id, label: w.name,
          detail: w.mode === 'CHOSEN' ? 'Inscritos' : workshopSections.filter((s) => s.workshopId === w.id).map((s) => sectionDisplayName(s.level, s.grade, s.name)).join(', ') || null,
          teacherUserId: w.teacherUserId, classroomId: w.classroomId,
        })),
      ];
      const linked = rows.map((r) => (r.classroomId ? classInfo.get(r.classroomId) : undefined)).filter((x): x is NonNullable<typeof x> => !!x);
      const metrics = await classMetrics(linked.map((l) => l.id), library);
      const grades = new Map(await Promise.all(linked.filter((l) => l.isActive && l.useCompetencies)
        .map(async (l) => [l.id, await gradeService.competencySummary(l.id)] as const)));
      coordinations.push({
        id: c.id,
        level: c.level,
        area: c.area,
        library: { behaviors: library.behaviorIds.length, badges: library.badgeIds.length },
        classes: rows.map((r) => {
          const classroom = r.classroomId ? classInfo.get(r.classroomId) : undefined;
          return {
            kind: r.kind,
            id: r.id,
            label: r.label,
            detail: r.detail,
            teacher: { userId: r.teacherUserId, name: teachers.get(r.teacherUserId) ?? '' },
            classroom: classroom ? { id: classroom.id, name: classroom.name, archived: !classroom.isActive, usesGrades: classroom.useCompetencies } : null,
            ...(classroom ? metrics.get(classroom.id) : null) ?? { students: 0, gamification: null, attendance: null },
            grades: classroom ? grades.get(classroom.id) ?? null : null,
          };
        }),
      });
    }
    return { year: { id: year.id, name: year.name }, coordinations };
  },

  /**
   * Biblioteca: qué áreas ve y gestiona el usuario en el año en curso. Ve las propuestas de las áreas que enseña
   * (asignaciones y talleres) o coordina; la administración las ve todas.
   */
  async libraryScope(schoolId: string, userId: string, manager: boolean) {
    const yearId = await activeYearOf(schoolId);
    const coordinates = new Set<string>();
    const teaches = new Set<string>();
    if (yearId) {
      const [coordinated, assigned, workshops] = await Promise.all([
        db.select({ level: schoolAreaCoordinators.level, areaId: schoolAreaCoordinators.areaId }).from(schoolAreaCoordinators)
          .where(and(eq(schoolAreaCoordinators.schoolId, schoolId), eq(schoolAreaCoordinators.yearId, yearId), eq(schoolAreaCoordinators.userId, userId))),
        db.select({ level: schoolSections.level, areaId: schoolTeachingAssignments.areaId }).from(schoolTeachingAssignments)
          .innerJoin(schoolSections, eq(schoolSections.id, schoolTeachingAssignments.sectionId))
          .where(and(eq(schoolTeachingAssignments.schoolId, schoolId), eq(schoolTeachingAssignments.yearId, yearId), eq(schoolTeachingAssignments.teacherUserId, userId))),
        db.select({ level: schoolWorkshops.level, areaId: schoolWorkshops.areaId }).from(schoolWorkshops)
          .where(and(eq(schoolWorkshops.schoolId, schoolId), eq(schoolWorkshops.yearId, yearId), eq(schoolWorkshops.teacherUserId, userId))),
      ]);
      for (const r of coordinated) coordinates.add(keyOf(r.level, r.areaId));
      for (const r of [...assigned, ...workshops]) teaches.add(keyOf(r.level, r.areaId));
    }
    return {
      yearId,
      /** ¿Ve este ítem? Los del colegio, todos; los de un área, quien la enseña o coordina (la administración, todos). */
      sees: (item: { areaId: string | null; level: string | null }) =>
        !item.areaId || !item.level || manager || coordinates.has(keyOf(item.level, item.areaId)) || teaches.has(keyOf(item.level, item.areaId)),
      /** ¿Lo crea, edita o quita? Los del colegio, la administración; los de un área, también su coordinador. */
      manages: (item: { areaId: string | null; level: string | null }) =>
        manager || (!!item.areaId && !!item.level && coordinates.has(keyOf(item.level, item.areaId))),
    };
  },

  /** Las propuestas de un área se crean para un área del plan del año en curso. */
  async assertLibraryArea(schoolId: string, level: SchoolLevel, areaId: string) {
    const yearId = await activeYearOf(schoolId);
    if (!yearId) throw new ValidationError('Las propuestas de un área son del año escolar en curso: aún no hay uno activo');
    if (!(await effectivePlan(yearId, level)).areas.some((a) => a.areaId === areaId)) {
      throw new ValidationError('Esa área no está en el plan de estudios del nivel');
    }
  },

  /** Nombre de las áreas de unos ítems de la Biblioteca. */
  async areaNames(areaIds: string[]) {
    const ids = [...new Set(areaIds)];
    if (ids.length === 0) return new Map<string, { name: string; shortName: string | null }>();
    return new Map((await db.select({ id: curriculumAreas.id, name: curriculumAreas.name, shortName: curriculumAreas.shortName })
      .from(curriculumAreas).where(inArray(curriculumAreas.id, ids))).map((a) => [a.id, { name: a.name, shortName: a.shortName }]));
  },
};
