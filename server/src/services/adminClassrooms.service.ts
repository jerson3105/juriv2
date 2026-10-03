import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classrooms, pointLogs, schools, studentProfiles, users } from '../db/schema.js';

const DAY = 24 * 60 * 60 * 1000;
/** La actividad se mira en los últimos 90 días (una clase sin puntos en ese tiempo está quieta). */
const ACTIVITY_WINDOW_DAYS = 90;

/** Puntos de una clase desde una fecha: la señal real de uso (comportamientos y puntos a diario). */
const pointsSince = (since: Date) => db
  .select({
    classroomId: studentProfiles.classroomId,
    last: sql<Date | null>`MAX(${pointLogs.createdAt})`,
    week: sql<number>`SUM(${pointLogs.createdAt} >= ${new Date(Date.now() - 7 * DAY)})`,
  })
  .from(pointLogs)
  .innerJoin(studentProfiles, eq(studentProfiles.id, pointLogs.studentId))
  .where(and(gte(pointLogs.createdAt, since), eq(pointLogs.isReverted, false)))
  .groupBy(studentProfiles.classroomId);

export const adminClassroomsService = {
  /** Clases con lo que importa para revisarlas: docente, escuela, alumnos y última actividad real. */
  async list() {
    const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * DAY);
    const [rows, students, activity] = await Promise.all([
      db.select({
        id: classrooms.id,
        name: classrooms.name,
        code: classrooms.code,
        gradeLevel: classrooms.gradeLevel,
        isActive: classrooms.isActive,
        createdAt: classrooms.createdAt,
        schoolName: schools.name,
        teacher: { id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email },
      })
        .from(classrooms)
        .innerJoin(users, eq(classrooms.teacherId, users.id))
        .leftJoin(schools, eq(schools.id, classrooms.schoolId))
        .orderBy(desc(classrooms.createdAt)),
      db.select({ classroomId: studentProfiles.classroomId, total: count() }).from(studentProfiles)
        .where(and(eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false)))
        .groupBy(studentProfiles.classroomId),
      pointsSince(since),
    ]);
    const studentsOf = new Map(students.map((row) => [row.classroomId, Number(row.total)]));
    const activityOf = new Map(activity.map((row) => [row.classroomId, row]));
    return rows.map((row) => ({
      ...row,
      students: studentsOf.get(row.id) ?? 0,
      lastPointAt: activityOf.get(row.id)?.last ?? null,
      pointsThisWeek: Number(activityOf.get(row.id)?.week ?? 0),
    }));
  },

  /** Actividad de una clase para su detalle (sin límite de días). */
  async activity(classroomId: string) {
    const [row] = await db
      .select({
        last: sql<Date | null>`MAX(${pointLogs.createdAt})`,
        week: sql<number>`SUM(${pointLogs.createdAt} >= ${new Date(Date.now() - 7 * DAY)})`,
        studentsWeek: sql<number>`COUNT(DISTINCT CASE WHEN ${pointLogs.createdAt} >= ${new Date(Date.now() - 7 * DAY)} THEN ${pointLogs.studentId} END)`,
      })
      .from(pointLogs)
      .innerJoin(studentProfiles, eq(studentProfiles.id, pointLogs.studentId))
      .where(and(eq(studentProfiles.classroomId, classroomId), eq(pointLogs.isReverted, false)));
    return { lastPointAt: row?.last ?? null, pointsThisWeek: Number(row?.week ?? 0), studentsThisWeek: Number(row?.studentsWeek ?? 0) };
  },
};
