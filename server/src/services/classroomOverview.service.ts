import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { attendanceRecords, classrooms, itemUsages, pointLogs, purchases, shopItems, studentProfiles } from '../db/schema.js';

export interface ClassroomOverview {
  id: string;
  lastActivityAt: Date | null; // último punto dado en los últimos 30 días
  xpToday: number;
  scorersToday: number;
  pendingPurchases: number;
  pendingUsages: number;
  attendanceToday: number; // registros de asistencia del día (0 = sin tomar)
}

const ACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

class ClassroomOverviewService {
  // "Hoy" de cada clase del profesor: XP dado, alumnos que sumaron, pendientes de tienda, asistencia y última actividad.
  // Unas pocas consultas agrupadas por clase, sin importar cuántas clases tenga.
  async getOverview(teacherId: string, since: Date, day: Date): Promise<ClassroomOverview[]> {
    const rooms = await db.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.teacherId, teacherId));
    const ids = rooms.map((r) => r.id);
    if (ids.length === 0) return [];

    const xpNet = sql<string>`COALESCE(SUM(IF(${pointLogs.action} = 'ADD', ${pointLogs.amount}, -${pointLogs.amount})), 0)`;
    const today = await db
      .select({
        classroomId: studentProfiles.classroomId,
        xp: xpNet,
        scorers: sql<string>`COUNT(DISTINCT IF(${pointLogs.action} = 'ADD', ${pointLogs.studentId}, NULL))`,
      })
      .from(pointLogs)
      .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
      .where(and(
        inArray(studentProfiles.classroomId, ids),
        eq(pointLogs.pointType, 'XP'),
        eq(pointLogs.isReverted, false),
        gte(pointLogs.createdAt, since),
      ))
      .groupBy(studentProfiles.classroomId);

    const lastActivity = await db
      .select({ classroomId: studentProfiles.classroomId, at: sql<Date>`MAX(${pointLogs.createdAt})` })
      .from(pointLogs)
      .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
      .where(and(
        inArray(studentProfiles.classroomId, ids),
        gte(pointLogs.createdAt, new Date(Date.now() - ACTIVITY_WINDOW_MS)),
      ))
      .groupBy(studentProfiles.classroomId);

    const pendingPurchases = await db
      .select({ classroomId: shopItems.classroomId, n: sql<string>`COUNT(*)` })
      .from(purchases)
      .innerJoin(shopItems, eq(purchases.itemId, shopItems.id))
      .where(and(inArray(shopItems.classroomId, ids), eq(purchases.status, 'PENDING')))
      .groupBy(shopItems.classroomId);

    const pendingUsages = await db
      .select({ classroomId: itemUsages.classroomId, n: sql<string>`COUNT(*)` })
      .from(itemUsages)
      .where(and(inArray(itemUsages.classroomId, ids), eq(itemUsages.status, 'PENDING')))
      .groupBy(itemUsages.classroomId);

    const attendance = await db
      .select({ classroomId: attendanceRecords.classroomId, n: sql<string>`COUNT(*)` })
      .from(attendanceRecords)
      .where(and(inArray(attendanceRecords.classroomId, ids), eq(attendanceRecords.date, day)))
      .groupBy(attendanceRecords.classroomId);

    const todayBy = new Map(today.map((r) => [r.classroomId, r]));
    const lastBy = new Map(lastActivity.map((r) => [r.classroomId, r.at]));
    const countBy = (rows: { classroomId: string; n: string }[]) => new Map(rows.map((r) => [r.classroomId, Number(r.n)]));
    const purchasesBy = countBy(pendingPurchases);
    const usagesBy = countBy(pendingUsages);
    const attendanceBy = countBy(attendance);

    return ids.map((id) => ({
      id,
      lastActivityAt: lastBy.get(id) ? new Date(lastBy.get(id)!) : null,
      xpToday: Number(todayBy.get(id)?.xp ?? 0),
      scorersToday: Number(todayBy.get(id)?.scorers ?? 0),
      pendingPurchases: purchasesBy.get(id) ?? 0,
      pendingUsages: usagesBy.get(id) ?? 0,
      attendanceToday: attendanceBy.get(id) ?? 0,
    }));
  }

  async setArchived(classroomId: string, archived: boolean) {
    await db.update(classrooms)
      .set({ isActive: !archived, updatedAt: new Date() })
      .where(eq(classrooms.id, classroomId));
  }
}

export const classroomOverviewService = new ClassroomOverviewService();
