import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  announcements,
  classrooms,
  parentStudentLinks,
  parentProfiles,
  studentProfiles,
  users,
} from '../db/schema.js';
import { createNotifications, getIO } from '../utils/notificationEmitter.js';

class AnnouncementService {

  /**
   * Create an announcement and notify all parents with children in the classroom.
   * Returns the created announcement + emits via socket.
   */
  async createAnnouncement(classroomId: string, teacherId: string, message: string) {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error('El mensaje no puede estar vacío');
    }
    if (trimmed.length > 5000) {
      throw new Error('El mensaje no puede superar los 5000 caracteres');
    }

    // Verify the teacher owns this classroom
    const [classroom] = await db.select({ id: classrooms.id, name: classrooms.name, teacherId: classrooms.teacherId })
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));

    if (!classroom) {
      throw new Error('Aula no encontrada');
    }
    if (classroom.teacherId !== teacherId) {
      throw new Error('No tienes permiso para enviar avisos en esta aula');
    }

    const now = new Date();
    const id = uuidv4();

    await db.insert(announcements).values({
      id,
      classroomId,
      teacherId,
      message: trimmed,
      createdAt: now,
    });

    // Get the teacher name for the notification
    const [teacher] = await db.select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, teacherId));

    const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : 'Tu profesor';

    // Find all parent userIds linked to students in this classroom
    const parentUserIds = await this.getParentUserIdsForClassroom(classroomId);

    // Persist notifications for parents not currently connected
    if (parentUserIds.length > 0) {
      const notificationEntries = parentUserIds.map(userId => ({
        userId,
        classroomId,
        type: 'ANNOUNCEMENT' as const,
        title: `📢 Aviso de ${teacherName}`,
        message: trimmed.length > 200 ? trimmed.substring(0, 200) + '...' : trimmed,
        data: JSON.stringify({ announcementId: id }),
        createdAt: now,
      }));

      try {
        await createNotifications(notificationEntries);
      } catch {
        // Don't break announcement creation if notifications fail
      }
    }

    // Emit the full announcement to the classroom room via socket
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('announcement:new', {
        id,
        classroomId,
        teacherId,
        teacherName,
        message: trimmed,
        createdAt: now.toISOString(),
      });
    }

    return {
      id,
      classroomId,
      teacherId,
      teacherName,
      message: trimmed,
      createdAt: now,
    };
  }

  /**
   * Get announcements for a classroom, paginated (newest first).
   */
  async getAnnouncements(classroomId: string, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;

    const results = await db
      .select({
        id: announcements.id,
        classroomId: announcements.classroomId,
        teacherId: announcements.teacherId,
        teacherFirstName: users.firstName,
        teacherLastName: users.lastName,
        message: announcements.message,
        createdAt: announcements.createdAt,
      })
      .from(announcements)
      .innerJoin(users, eq(announcements.teacherId, users.id))
      .where(eq(announcements.classroomId, classroomId))
      .orderBy(desc(announcements.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(announcements)
      .where(eq(announcements.classroomId, classroomId));

    return {
      announcements: results.map(r => ({
        id: r.id,
        classroomId: r.classroomId,
        teacherId: r.teacherId,
        teacherName: `${r.teacherFirstName} ${r.teacherLastName}`.trim(),
        message: r.message,
        createdAt: r.createdAt,
      })),
      total: countResult?.total ?? 0,
      page,
      limit,
    };
  }

  /**
   * Get all parent userIds that have an ACTIVE link to a student in the given classroom.
   */
  async getParentUserIdsForClassroom(classroomId: string): Promise<string[]> {
    const results = await db
      .select({ userId: parentProfiles.userId })
      .from(parentStudentLinks)
      .innerJoin(parentProfiles, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
      .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(parentStudentLinks.status, 'ACTIVE'),
        eq(studentProfiles.isActive, true),
      ));

    return [...new Set(results.map(r => r.userId))];
  }

  /**
   * Get all classroomIds that a parent has access to (via linked students).
   */
  async getClassroomIdsForParent(userId: string): Promise<string[]> {
    const [profile] = await db.select({ id: parentProfiles.id })
      .from(parentProfiles)
      .where(eq(parentProfiles.userId, userId));

    if (!profile) return [];

    const results = await db
      .select({ classroomId: studentProfiles.classroomId })
      .from(parentStudentLinks)
      .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
      .where(and(
        eq(parentStudentLinks.parentProfileId, profile.id),
        eq(parentStudentLinks.status, 'ACTIVE'),
        eq(studentProfiles.isActive, true),
      ));

    return [...new Set(results.map(r => r.classroomId))];
  }
}

export const announcementService = new AnnouncementService();
