import { eq, and, desc, sql, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classroomMessages,
  classroomChatSettings,
  classrooms,
  parentStudentLinks,
  parentProfiles,
  studentProfiles,
  users,
} from '../db/schema.js';
import { createNotification, getIO } from '../utils/notificationEmitter.js';

class ChatService {

  // ── Messages ──

  /**
   * Get messages for a classroom chat, paginated backwards (newest first).
   * `before` is an optional cursor (message createdAt ISO string) for infinite scroll.
   */
  async getMessages(classroomId: string, limit: number = 50, before?: string) {
    const conditions = [eq(classroomMessages.classroomId, classroomId)];
    if (before) {
      conditions.push(lt(classroomMessages.createdAt, new Date(before)));
    }

    const rows = await db
      .select({
        id: classroomMessages.id,
        classroomId: classroomMessages.classroomId,
        senderId: classroomMessages.senderId,
        senderRole: classroomMessages.senderRole,
        message: classroomMessages.message,
        deletedAt: classroomMessages.deletedAt,
        deletedBy: classroomMessages.deletedBy,
        createdAt: classroomMessages.createdAt,
        senderFirstName: users.firstName,
        senderLastName: users.lastName,
      })
      .from(classroomMessages)
      .innerJoin(users, eq(classroomMessages.senderId, users.id))
      .where(and(...conditions))
      .orderBy(desc(classroomMessages.createdAt))
      .limit(limit);

    // For parent senders, resolve "padre/madre de [estudiante]"
    const parentSenderIds = rows
      .filter(r => r.senderRole === 'PARENT')
      .map(r => r.senderId);

    const parentChildMap = new Map<string, string>();
    if (parentSenderIds.length > 0) {
      // Get parent profile → linked student name for each unique parent userId
      const uniqueParentIds = [...new Set(parentSenderIds)];
      for (const parentUserId of uniqueParentIds) {
        const childName = await this.getLinkedChildName(parentUserId, classroomId);
        if (childName) parentChildMap.set(parentUserId, childName);
      }
    }

    return rows.map(r => ({
      id: r.id,
      classroomId: r.classroomId,
      senderId: r.senderId,
      senderRole: r.senderRole,
      senderName: `${r.senderFirstName} ${r.senderLastName}`.trim(),
      childName: parentChildMap.get(r.senderId) || null,
      message: r.deletedAt ? null : r.message,
      isDeleted: !!r.deletedAt,
      createdAt: r.createdAt,
    })).reverse(); // Return in chronological order
  }

  /**
   * Send a message to the classroom chat.
   */
  async sendMessage(classroomId: string, senderId: string, senderRole: 'TEACHER' | 'PARENT', message: string) {
    const trimmed = message.trim();
    if (!trimmed) throw new Error('El mensaje no puede estar vacío');
    if (trimmed.length > 5000) throw new Error('El mensaje no puede superar los 5000 caracteres');

    // If parent, check chat is open
    if (senderRole === 'PARENT') {
      const settings = await this.getSettings(classroomId);
      if (!settings.isOpen) {
        throw new Error('El chat está cerrado. No puedes escribir en este momento.');
      }
      // Verify parent has active link in this classroom
      const hasAccess = await this.parentHasAccess(senderId, classroomId);
      if (!hasAccess) throw new Error('No tienes acceso a este chat');
    }

    const now = new Date();
    const id = uuidv4();

    await db.insert(classroomMessages).values({
      id,
      classroomId,
      senderId,
      senderRole,
      message: trimmed,
      createdAt: now,
    });

    // Get sender info
    const [sender] = await db.select({ firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.id, senderId));
    const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Usuario';

    let childName: string | null = null;
    if (senderRole === 'PARENT') {
      childName = await this.getLinkedChildName(senderId, classroomId);
    }

    const messageData = {
      id,
      classroomId,
      senderId,
      senderRole,
      senderName,
      childName,
      message: trimmed,
      isDeleted: false,
      createdAt: now.toISOString(),
    };

    // Emit via socket
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}:chat`).emit('chat:message', messageData);
    }

    // If parent writes, notify teacher
    if (senderRole === 'PARENT') {
      const [classroom] = await db.select({ teacherId: classrooms.teacherId, name: classrooms.name })
        .from(classrooms).where(eq(classrooms.id, classroomId));
      if (classroom) {
        try {
          await createNotification({
            userId: classroom.teacherId,
            classroomId,
            type: 'ANNOUNCEMENT', // Re-use existing type
            title: `💬 ${senderName} escribió en el chat grupal`,
            message: trimmed.length > 200 ? trimmed.substring(0, 200) + '...' : trimmed,
            data: JSON.stringify({ chatMessageId: id, classroomName: classroom.name }),
          });
        } catch { /* best effort */ }
      }
    }

    return messageData;
  }

  /**
   * Soft-delete a message (teacher only).
   */
  async deleteMessage(messageId: string, deletedByUserId: string) {
    const now = new Date();
    const [msg] = await db.select({
      id: classroomMessages.id,
      classroomId: classroomMessages.classroomId,
    }).from(classroomMessages).where(eq(classroomMessages.id, messageId));

    if (!msg) throw new Error('Mensaje no encontrado');

    await db.update(classroomMessages).set({
      deletedAt: now,
      deletedBy: deletedByUserId,
    }).where(eq(classroomMessages.id, messageId));

    // Emit deletion via socket
    const io = getIO();
    if (io) {
      io.to(`classroom:${msg.classroomId}:chat`).emit('chat:message_deleted', {
        messageId,
        classroomId: msg.classroomId,
      });
    }

    return { messageId, classroomId: msg.classroomId };
  }

  // ── Settings ──

  async getSettings(classroomId: string): Promise<{ classroomId: string; isOpen: boolean; closedAt: string | null; closedBy: string | null }> {
    const [row] = await db.select().from(classroomChatSettings)
      .where(eq(classroomChatSettings.classroomId, classroomId));

    if (!row) {
      return { classroomId, isOpen: true, closedAt: null, closedBy: null };
    }

    return {
      classroomId: row.classroomId,
      isOpen: row.isOpen,
      closedAt: row.closedAt?.toISOString() || null,
      closedBy: row.closedBy || null,
    };
  }

  async updateSettings(classroomId: string, isOpen: boolean, userId: string) {
    const now = new Date();
    const [existing] = await db.select().from(classroomChatSettings)
      .where(eq(classroomChatSettings.classroomId, classroomId));

    if (existing) {
      await db.update(classroomChatSettings).set({
        isOpen,
        closedAt: isOpen ? null : now,
        closedBy: isOpen ? null : userId,
      }).where(eq(classroomChatSettings.classroomId, classroomId));
    } else {
      await db.insert(classroomChatSettings).values({
        classroomId,
        isOpen,
        closedAt: isOpen ? null : now,
        closedBy: isOpen ? null : userId,
      });
    }

    const settings = {
      classroomId,
      isOpen,
      closedAt: isOpen ? null : now.toISOString(),
      closedBy: isOpen ? null : userId,
    };

    // Emit status change via socket
    const io = getIO();
    if (io) {
      io.to(`classroom:${classroomId}:chat`).emit('chat:status_changed', settings);
    }

    return settings;
  }

  // ── Helpers ──

  /**
   * Get the linked child's display name for a parent user in a specific classroom.
   */
  private async getLinkedChildName(parentUserId: string, classroomId: string): Promise<string | null> {
    const rows = await db
      .select({
        displayName: studentProfiles.displayName,
        characterName: studentProfiles.characterName,
      })
      .from(parentStudentLinks)
      .innerJoin(parentProfiles, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
      .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
      .where(and(
        eq(parentProfiles.userId, parentUserId),
        eq(studentProfiles.classroomId, classroomId),
        eq(parentStudentLinks.status, 'ACTIVE'),
        eq(studentProfiles.isActive, true),
      ))
      .limit(1);

    if (rows.length === 0) return null;
    return rows[0].displayName || rows[0].characterName || null;
  }

  /**
   * Check if a parent user has an active link to a student in the classroom.
   */
  async parentHasAccess(parentUserId: string, classroomId: string): Promise<boolean> {
    const rows = await db
      .select({ id: parentStudentLinks.id })
      .from(parentStudentLinks)
      .innerJoin(parentProfiles, eq(parentStudentLinks.parentProfileId, parentProfiles.id))
      .innerJoin(studentProfiles, eq(parentStudentLinks.studentProfileId, studentProfiles.id))
      .where(and(
        eq(parentProfiles.userId, parentUserId),
        eq(studentProfiles.classroomId, classroomId),
        eq(parentStudentLinks.status, 'ACTIVE'),
        eq(studentProfiles.isActive, true),
      ))
      .limit(1);

    return rows.length > 0;
  }

  /**
   * Get count of unread messages since a given timestamp for a user in a classroom chat.
   */
  async getUnreadCount(classroomId: string, since: Date): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(classroomMessages)
      .where(and(
        eq(classroomMessages.classroomId, classroomId),
        sql`${classroomMessages.createdAt} > ${since}`,
      ));
    return result?.count ?? 0;
  }
}

export const chatService = new ChatService();
