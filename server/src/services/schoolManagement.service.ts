import { randomInt } from 'crypto';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { classrooms, curriculumAreas, pointLogs, schoolMembers, schools, studentProfiles, users } from '../db/schema.js';
import { affectedRows } from '../utils/points.js';
import { historyService } from './history.service.js';
import { attendanceService } from './attendance.service.js';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para dictarlo sin errores
const INVITE_LENGTH = 8;
const ACTIVITY_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

const newInviteCode = () => Array.from({ length: INVITE_LENGTH }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');

export class SchoolManagementError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

class SchoolManagementService {
  // Aceptar/rechazar solo solicitudes pendientes (no toca a profesores ya verificados ni al responsable).
  async reviewPendingRequest(memberId: string, approved: boolean, reason?: string) {
    const now = new Date();
    const result = await db.update(schoolMembers)
      .set({
        status: approved ? 'VERIFIED' : 'REJECTED',
        rejectionReason: approved ? null : (reason || null),
        joinedAt: approved ? now : null,
        updatedAt: now,
      })
      .where(and(eq(schoolMembers.id, memberId), eq(schoolMembers.status, 'PENDING_OWNER')));
    if (affectedRows(result) !== 1) throw new SchoolManagementError('Esta solicitud ya fue atendida', 409);
  }

  // Retirar a un profesor: sus clases vuelven a ser personales (las conserva) y deja de ser miembro.
  async removeTeacher(schoolId: string, memberId: string) {
    const [member] = await db.select().from(schoolMembers)
      .where(and(eq(schoolMembers.id, memberId), eq(schoolMembers.schoolId, schoolId)));
    if (!member) throw new SchoolManagementError('Profesor no encontrado en esta escuela', 404);
    if (member.role === 'OWNER') throw new SchoolManagementError('No se puede retirar al responsable de la escuela', 400);

    return db.transaction(async (tx) => {
      const unassign = await tx.update(classrooms)
        .set({ schoolId: null, updatedAt: new Date() })
        .where(and(eq(classrooms.schoolId, schoolId), eq(classrooms.teacherId, member.userId)));
      await tx.delete(schoolMembers).where(eq(schoolMembers.id, memberId));
      return { unassignedClassrooms: affectedRows(unassign) };
    });
  }

  // Clases de la escuela con su profesor y última actividad (60 días).
  async getSchoolClassrooms(schoolId: string) {
    const rows = await db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        code: classrooms.code,
        gradeLevel: classrooms.gradeLevel,
        teacherId: classrooms.teacherId,
        teacherFirstName: users.firstName,
        teacherLastName: users.lastName,
        curriculumAreaId: classrooms.curriculumAreaId,
        curriculumAreaName: curriculumAreas.name,
        isActive: classrooms.isActive,
        studentCount: sql<string>`(SELECT COUNT(*) FROM student_profiles WHERE classroom_id = ${classrooms.id})`,
      })
      .from(classrooms)
      .innerJoin(users, eq(classrooms.teacherId, users.id))
      .leftJoin(curriculumAreas, eq(classrooms.curriculumAreaId, curriculumAreas.id))
      .where(eq(classrooms.schoolId, schoolId));
    if (rows.length === 0) return [];

    const last = await db
      .select({ classroomId: studentProfiles.classroomId, at: sql<Date>`MAX(${pointLogs.createdAt})` })
      .from(pointLogs)
      .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
      .where(and(
        inArray(studentProfiles.classroomId, rows.map((r) => r.id)),
        gte(pointLogs.createdAt, new Date(Date.now() - ACTIVITY_WINDOW_MS)),
      ))
      .groupBy(studentProfiles.classroomId);
    const lastBy = new Map(last.map((l) => [l.classroomId, l.at]));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      gradeLevel: r.gradeLevel,
      teacherId: r.teacherId,
      teacherName: `${r.teacherFirstName} ${r.teacherLastName}`.trim(),
      curriculumAreaId: r.curriculumAreaId,
      curriculumAreaName: r.curriculumAreaName,
      isActive: r.isActive,
      studentCount: Number(r.studentCount),
      lastActivityAt: lastBy.get(r.id) ? new Date(lastBy.get(r.id)!) : null,
    }));
  }

  // Reporte de una clase para el responsable (la clase debe ser de su escuela).
  async getClassroomReport(schoolId: string, classroomId: string) {
    const [room] = await db.select({ schoolId: classrooms.schoolId }).from(classrooms).where(eq(classrooms.id, classroomId));
    if (!room || room.schoolId !== schoolId) throw new SchoolManagementError('Clase no encontrada en esta escuela', 404);
    const [stats, attendance] = await Promise.all([
      historyService.getClassroomStats(classroomId),
      attendanceService.getClassroomAttendanceStats(classroomId),
    ]);
    return { stats, attendance };
  }

  // ── Invitación ──────────────────────────────────────────────────────────
  async getInviteCode(schoolId: string) {
    const [row] = await db.select({ inviteCode: schools.inviteCode }).from(schools).where(eq(schools.id, schoolId));
    return row?.inviteCode ?? null;
  }

  // Genera (o renueva, invalidando el anterior) el código de invitación.
  async regenerateInviteCode(schoolId: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newInviteCode();
      try {
        await db.update(schools).set({ inviteCode: code, updatedAt: new Date() }).where(eq(schools.id, schoolId));
        return code;
      } catch (error) {
        if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error;
      }
    }
    throw new SchoolManagementError('No se pudo generar el código, inténtalo de nuevo', 500);
  }

  async disableInviteCode(schoolId: string) {
    await db.update(schools).set({ inviteCode: null, updatedAt: new Date() }).where(eq(schools.id, schoolId));
  }

  // Escuela de un código válido (solo verificada y activa).
  async findByInviteCode(code: string) {
    const [school] = await db
      .select({ id: schools.id, name: schools.name, city: schools.city, country: schools.country })
      .from(schools)
      .where(and(eq(schools.inviteCode, code), eq(schools.isVerified, true), eq(schools.isActive, true)));
    return school ?? null;
  }

  // Unirse con el enlace: el responsable ya dio su visto bueno al compartirlo, así que entra verificado.
  async joinByInvite(userId: string, code: string) {
    const school = await this.findByInviteCode(code);
    if (!school) throw new SchoolManagementError('El enlace de invitación no es válido o fue desactivado', 404);
    const now = new Date();
    const [existing] = await db.select().from(schoolMembers)
      .where(and(eq(schoolMembers.schoolId, school.id), eq(schoolMembers.userId, userId)));

    if (existing?.status === 'VERIFIED') return { school, alreadyMember: true };
    if (existing) {
      await db.update(schoolMembers)
        .set({ status: 'VERIFIED', rejectionReason: null, joinedAt: now, updatedAt: now })
        .where(eq(schoolMembers.id, existing.id));
    } else {
      await db.insert(schoolMembers).values({
        id: uuidv4(), schoolId: school.id, userId, role: 'TEACHER', status: 'VERIFIED', joinedAt: now, createdAt: now, updatedAt: now,
      });
    }
    return { school, alreadyMember: false };
  }
}

export const schoolManagementService = new SchoolManagementService();
