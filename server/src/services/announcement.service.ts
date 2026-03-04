import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  announcements,
  announcementReads,
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

    // Get read counts for all fetched announcements in a single query
    const announcementIds = results.map(r => r.id);
    let readCountMap = new Map<string, number>();
    if (announcementIds.length > 0) {
      const readCounts = await db
        .select({
          announcementId: announcementReads.announcementId,
          count: sql<number>`COUNT(*)`,
        })
        .from(announcementReads)
        .where(inArray(announcementReads.announcementId, announcementIds))
        .groupBy(announcementReads.announcementId);
      readCountMap = new Map(readCounts.map(r => [r.announcementId, r.count]));
    }

    // Get total parent count for this classroom
    const parentUserIds = await this.getParentUserIdsForClassroom(classroomId);
    const totalParents = parentUserIds.length;

    return {
      announcements: results.map(r => ({
        id: r.id,
        classroomId: r.classroomId,
        teacherId: r.teacherId,
        teacherName: `${r.teacherFirstName} ${r.teacherLastName}`.trim(),
        message: r.message,
        createdAt: r.createdAt,
        readCount: readCountMap.get(r.id) ?? 0,
        totalParents,
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
  /**
   * Get parent stats for a classroom: registered count, total students with parent links.
   */
  async getParentStats(classroomId: string) {
    // Count distinct parent userIds linked to active students in this classroom
    const parentUserIds = await this.getParentUserIdsForClassroom(classroomId);

    // Count total active students in the classroom
    const [studentCount] = await db
      .select({ total: sql<number>`COUNT(*)` })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true),
      ));

    // Count connected parents via socket rooms
    const connectedCount = await this.getConnectedParentCount(classroomId, parentUserIds);

    return {
      registeredParents: parentUserIds.length,
      totalStudents: studentCount?.total ?? 0,
      connectedParents: connectedCount,
    };
  }

  /**
   * Count how many of the given parent userIds are currently connected via socket.
   */
  async getConnectedParentCount(classroomId: string, parentUserIds?: string[]): Promise<number> {
    const io = getIO();
    if (!io) return 0;

    const ids = parentUserIds ?? await this.getParentUserIdsForClassroom(classroomId);
    if (ids.length === 0) return 0;

    let count = 0;
    for (const userId of ids) {
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      if (sockets.length > 0) count++;
    }
    return count;
  }

  /**
   * Mark all announcements in a classroom as read by a parent user.
   * Called when a parent opens the announcements view.
   */
  async markAnnouncementsAsRead(classroomId: string, userId: string) {
    // Get all announcement IDs for this classroom
    const classroomAnnouncements = await db
      .select({ id: announcements.id })
      .from(announcements)
      .where(eq(announcements.classroomId, classroomId));

    if (classroomAnnouncements.length === 0) return;

    const now = new Date();
    const announcementIds = classroomAnnouncements.map(a => a.id);

    // Find which ones this user has already read
    const alreadyRead = await db
      .select({ announcementId: announcementReads.announcementId })
      .from(announcementReads)
      .where(and(
        inArray(announcementReads.announcementId, announcementIds),
        eq(announcementReads.userId, userId),
      ));

    const alreadyReadSet = new Set(alreadyRead.map(r => r.announcementId));
    const toInsert = announcementIds.filter(id => !alreadyReadSet.has(id));

    if (toInsert.length === 0) return;

    await db.insert(announcementReads).values(
      toInsert.map(announcementId => ({
        id: uuidv4(),
        announcementId,
        userId,
        readAt: now,
      }))
    );

    // Emit read receipt update to the classroom room so teacher sees it in real-time
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}`).emit('announcement:read_update', {
        classroomId,
        userId,
        announcementIds: toInsert,
        readAt: now.toISOString(),
      });
    }
  }
  /**
   * Get the families list for a classroom: each student with parent registration status,
   * parent name (if registered), and parentLinkCode (for unregistered ones).
   * Sorted: unregistered students first (actionable), registered at the end.
   */
  async getFamilies(classroomId: string) {
    // 1. Get all active, non-demo students in the classroom
    const students = await db
      .select({
        id: studentProfiles.id,
        displayName: studentProfiles.displayName,
        characterName: studentProfiles.characterName,
        parentLinkCode: studentProfiles.parentLinkCode,
      })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true),
        eq(studentProfiles.isDemo, false),
      ));

    if (students.length === 0) return { families: [], registered: 0, total: 0 };

    const studentIds = students.map(s => s.id);

    // 2. Get all ACTIVE parent links for these students (batch)
    const links = await db
      .select({
        studentProfileId: parentStudentLinks.studentProfileId,
        parentProfileId: parentStudentLinks.parentProfileId,
      })
      .from(parentStudentLinks)
      .where(and(
        inArray(parentStudentLinks.studentProfileId, studentIds),
        eq(parentStudentLinks.status, 'ACTIVE'),
      ));

    // 3. Get parent profile → user info for linked parents (batch)
    const parentProfileIds = [...new Set(links.map(l => l.parentProfileId))];
    let parentUserMap = new Map<string, { firstName: string; lastName: string; relationship: string }>();

    if (parentProfileIds.length > 0) {
      const parentRows = await db
        .select({
          profileId: parentProfiles.id,
          firstName: users.firstName,
          lastName: users.lastName,
          relationship: parentProfiles.relationship,
        })
        .from(parentProfiles)
        .innerJoin(users, eq(parentProfiles.userId, users.id))
        .where(inArray(parentProfiles.id, parentProfileIds));

      for (const r of parentRows) {
        parentUserMap.set(r.profileId, {
          firstName: r.firstName,
          lastName: r.lastName,
          relationship: r.relationship,
        });
      }
    }

    // 4. Check which parents are connected via socket
    const connectedParentUserIds = new Set<string>();
    const io = getIO();
    if (io && parentProfileIds.length > 0) {
      // Get parent userIds
      const parentUserIds = await db
        .select({ profileId: parentProfiles.id, userId: parentProfiles.userId })
        .from(parentProfiles)
        .where(inArray(parentProfiles.id, parentProfileIds));

      for (const p of parentUserIds) {
        const sockets = await io.in(`user:${p.userId}`).fetchSockets();
        if (sockets.length > 0) connectedParentUserIds.add(p.profileId);
      }
    }

    // 5. Build student→parent link map
    const studentLinkMap = new Map<string, string>(); // studentId → parentProfileId
    for (const link of links) {
      studentLinkMap.set(link.studentProfileId, link.parentProfileId);
    }

    // 6. Build result
    const families = students.map(student => {
      const parentProfileId = studentLinkMap.get(student.id);
      const parentInfo = parentProfileId ? parentUserMap.get(parentProfileId) : null;
      const isRegistered = !!parentInfo;

      return {
        studentId: student.id,
        studentName: student.displayName || student.characterName || 'Sin nombre',
        isRegistered,
        parentName: parentInfo ? `${parentInfo.firstName} ${parentInfo.lastName}`.trim() : null,
        parentRelationship: parentInfo?.relationship ?? null,
        parentLinkCode: !isRegistered ? (student.parentLinkCode || null) : null,
        isConnected: parentProfileId ? connectedParentUserIds.has(parentProfileId) : false,
      };
    });

    // Sort: unregistered first, then alphabetically by studentName
    families.sort((a, b) => {
      if (a.isRegistered !== b.isRegistered) return a.isRegistered ? 1 : -1;
      return a.studentName.localeCompare(b.studentName);
    });

    const registered = families.filter(f => f.isRegistered).length;

    return { families, registered, total: families.length };
  }
}

export const announcementService = new AnnouncementService();
