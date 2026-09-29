import { db } from '../db/index.js';
import { attendanceRecords, classrooms, pointLogs, type AttendanceStatus } from '../db/schema.js';
import { applyPointDeltas } from '../utils/points.js';
import { eq, and, between, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const attendanceService = {
  // Registrar (o corregir) la asistencia de un estudiante en un día.
  // xpAwarded del registro = XP realmente otorgado por esa asistencia. Si cambia el estado, el XP
  // del alumno se ajusta por la diferencia (p. ej. Ausente → Presente suma, Presente → Tarde resta).
  // Si el estado no cambia, no se toca el XP aunque cambie el valor de "XP por asistir".
  async recordAttendance(
    classroomId: string,
    studentProfileId: string,
    date: Date,
    status: AttendanceStatus,
    notes?: string,
    xpForPresent: number = 0,
    xpPerLevel?: number
  ) {
    const id = uuidv4();
    const now = new Date();

    // Normalizar fecha a inicio del día
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    const levelStep = xpPerLevel ?? (await db
      .select({ xpPerLevel: classrooms.xpPerLevel })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId)))[0]?.xpPerLevel ?? 100;

    return db.transaction(async (tx) => {
      // Bloquea el registro del día: dos guardados simultáneos no duplican ni pierden el ajuste.
      const [existing] = await tx
        .select()
        .from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.classroomId, classroomId),
          eq(attendanceRecords.studentProfileId, studentProfileId),
          eq(attendanceRecords.date, normalizedDate)
        ))
        .limit(1)
        .for('update');

      const previousXp = existing?.xpAwarded ?? 0;
      const statusChanged = !existing || existing.status !== status;
      const xpAwarded = statusChanged
        ? (status === 'PRESENT' ? Math.max(0, Math.trunc(xpForPresent)) : 0)
        : previousXp;
      const delta = xpAwarded - previousXp;

      if (existing) {
        await tx
          .update(attendanceRecords)
          .set({ status, notes, xpAwarded, updatedAt: now })
          .where(eq(attendanceRecords.id, existing.id));
      } else {
        await tx.insert(attendanceRecords).values({
          id,
          classroomId,
          studentProfileId,
          date: normalizedDate,
          status,
          notes,
          xpAwarded,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (delta !== 0) {
        await applyPointDeltas(tx, studentProfileId, { xp: delta }, { xpPerLevel: levelStep, xpMin: 0 });
        await tx.insert(pointLogs).values({
          id: uuidv4(),
          studentId: studentProfileId,
          pointType: 'XP',
          action: delta > 0 ? 'ADD' : 'REMOVE',
          amount: Math.abs(delta),
          reason: existing ? 'Asistencia (corrección)' : 'Asistencia',
          createdAt: now,
        });
      }

      return existing
        ? { ...existing, status, notes, xpAwarded, updatedAt: now }
        : { id, classroomId, studentProfileId, date: normalizedDate, status, notes, xpAwarded };
    });
  },

  // Registrar asistencia masiva para toda la clase
  async recordBulkAttendance(
    classroomId: string,
    date: Date,
    attendanceData: Array<{
      studentProfileId: string;
      status: AttendanceStatus;
      notes?: string;
    }>,
    xpForPresent: number = 5
  ) {
    const [classroom] = await db
      .select({ xpPerLevel: classrooms.xpPerLevel })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));
    const results = [];

    for (const record of attendanceData) {
      const result = await this.recordAttendance(
        classroomId,
        record.studentProfileId,
        date,
        record.status,
        record.notes,
        xpForPresent,
        classroom?.xpPerLevel ?? 100
      );
      results.push(result);
    }

    return results;
  },

  // Obtener asistencia de un día específico
  async getAttendanceByDate(classroomId: string, date: Date) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return db
      .select({
        id: attendanceRecords.id,
        studentProfileId: attendanceRecords.studentProfileId,
        status: attendanceRecords.status,
        notes: attendanceRecords.notes,
        xpAwarded: attendanceRecords.xpAwarded,
        date: attendanceRecords.date,
      })
      .from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.classroomId, classroomId),
        eq(attendanceRecords.date, normalizedDate)
      ));
  },

  // Obtener historial de asistencia de un estudiante
  async getStudentAttendanceHistory(studentProfileId: string, limit: number = 30) {
    return db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentProfileId, studentProfileId))
      .orderBy(desc(attendanceRecords.date))
      .limit(limit);
  },

  // Obtener estadísticas de asistencia de un estudiante
  async getStudentAttendanceStats(studentProfileId: string) {
    const records = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentProfileId, studentProfileId));

    const total = records.length;
    const present = records.filter(r => r.status === 'PRESENT').length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const excused = records.filter(r => r.status === 'EXCUSED').length;
    const totalXp = records.reduce((sum, r) => sum + (r.xpAwarded || 0), 0);

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      totalXpEarned: totalXp,
    };
  },

  // Obtener estadísticas de asistencia de una clase
  async getClassroomAttendanceStats(classroomId: string, startDate?: Date, endDate?: Date) {
    let query = db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.classroomId, classroomId));

    const records = await query;

    const filteredRecords = records.filter(r => {
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });

    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status === 'PRESENT').length;
    const absent = filteredRecords.filter(r => r.status === 'ABSENT').length;
    const late = filteredRecords.filter(r => r.status === 'LATE').length;
    const excused = filteredRecords.filter(r => r.status === 'EXCUSED').length;

    // Agrupar por fecha para obtener días únicos
    const uniqueDates = new Set(filteredRecords.map(r => r.date.toISOString().split('T')[0]));

    return {
      totalRecords: total,
      present,
      absent,
      late,
      excused,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      daysRecorded: uniqueDates.size,
    };
  },

  // Obtener asistencia por rango de fechas
  async getAttendanceByDateRange(classroomId: string, startDate: Date, endDate: Date) {
    return db
      .select()
      .from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.classroomId, classroomId),
        between(attendanceRecords.date, startDate, endDate)
      ))
      .orderBy(desc(attendanceRecords.date));
  },
};
