import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, sql, inArray, gte, lte } from 'drizzle-orm';
import { 
  db, 
  scrolls, 
  scrollReactions, 
  studentProfiles, 
  classrooms, 
  users,
  notifications,
  teams
} from '../db/index.js';
import type { 
  Scroll, 
  NewScroll, 
  ScrollCategory, 
  ScrollStatus, 
  ScrollRecipientType 
} from '../db/schema.js';

const ALLOWED_REACTION_TYPES = new Set(['heart', 'star', 'fire', 'clap', 'smile']);

// Interfaces
interface CreateScrollData {
  classroomId: string;
  authorId: string; // studentProfileId
  message: string;
  imageUrl?: string;
  category: ScrollCategory;
  recipientType: ScrollRecipientType;
  recipientIds?: string[]; // studentProfileIds o teamId
}

interface ScrollWithDetails extends Scroll {
  author: {
    id: string;
    characterName: string | null;
    avatarUrl: string | null;
    displayName: string | null;
  };
  recipients?: Array<{
    id: string;
    characterName: string | null;
    displayName: string | null;
  }>;
  clan?: {
    id: string;
    name: string;
  };
  reactions: Array<{
    type: string;
    count: number;
    hasReacted: boolean;
  }>;
  totalReactions: number;
}

class ScrollService {
  async getClassroomIdByScroll(scrollId: string): Promise<string | null> {
    const [scroll] = await db.select({ classroomId: scrolls.classroomId })
      .from(scrolls)
      .where(eq(scrolls.id, scrollId));

    return scroll?.classroomId ?? null;
  }

  async getAuthorIdByScroll(scrollId: string): Promise<string | null> {
    const [scroll] = await db.select({ authorId: scrolls.authorId })
      .from(scrolls)
      .where(eq(scrolls.id, scrollId));

    return scroll?.authorId ?? null;
  }

  async getClassroomIdByStudentProfile(studentProfileId: string): Promise<string | null> {
    const [student] = await db.select({ classroomId: studentProfiles.classroomId })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    return student?.classroomId ?? null;
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [classroom] = await db.select({ id: classrooms.id })
      .from(classrooms)
      .where(and(
        eq(classrooms.id, classroomId),
        eq(classrooms.teacherId, teacherId)
      ));

    return !!classroom;
  }

  async verifyStudentBelongsToUser(studentProfileId: string, userId: string): Promise<boolean> {
    const [student] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.id, studentProfileId),
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.isActive, true)
      ));

    return !!student;
  }

  async verifyStudentUserInClassroom(userId: string, classroomId: string): Promise<boolean> {
    const [student] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    return !!student;
  }

  async getStudentProfileInClassroomByUser(userId: string, classroomId: string): Promise<string | null> {
    const [student] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(
        eq(studentProfiles.userId, userId),
        eq(studentProfiles.classroomId, classroomId),
        eq(studentProfiles.isActive, true)
      ));

    return student?.id ?? null;
  }

  // Crear un nuevo pergamino
  async createScroll(data: CreateScrollData): Promise<Scroll> {
    const now = new Date();
    const message = data.message.trim();

    if (!message) {
      throw new Error('El mensaje no puede estar vacío');
    }

    if (message.length > 2000) {
      throw new Error('El mensaje no puede superar los 2000 caracteres');
    }
    
    // Verificar que el aula existe y tiene pergaminos habilitados
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, data.classroomId),
    });
    
    if (!classroom) {
      throw new Error('Aula no encontrada');
    }
    
    if (!classroom.scrollsEnabled) {
      throw new Error('Los Pergaminos del Aula no están habilitados en esta clase');
    }
    
    if (!classroom.scrollsOpen) {
      throw new Error('El mural de pergaminos está cerrado actualmente');
    }

    // Verificar que el autor pertenece al aula
    const [author] = await db.select({
      id: studentProfiles.id,
      classroomId: studentProfiles.classroomId,
      isActive: studentProfiles.isActive,
    })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, data.authorId));

    if (!author || author.classroomId !== data.classroomId || !author.isActive) {
      throw new Error('El autor no pertenece a esta clase');
    }

    const uniqueRecipientIds = [...new Set((data.recipientIds || []).filter(Boolean))];
    let normalizedRecipientIds: string[] | null = null;

    if (data.recipientType === 'STUDENT') {
      if (uniqueRecipientIds.length !== 1) {
        throw new Error('Debes seleccionar un único estudiante destinatario');
      }

      const [recipient] = await db.select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(and(
          eq(studentProfiles.id, uniqueRecipientIds[0]),
          eq(studentProfiles.classroomId, data.classroomId),
          eq(studentProfiles.isActive, true)
        ));

      if (!recipient) {
        throw new Error('El destinatario no pertenece a esta clase');
      }

      normalizedRecipientIds = [recipient.id];
    } else if (data.recipientType === 'MULTIPLE') {
      if (uniqueRecipientIds.length === 0) {
        throw new Error('Debes seleccionar al menos un destinatario');
      }

      const recipients = await db.select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(and(
          eq(studentProfiles.classroomId, data.classroomId),
          eq(studentProfiles.isActive, true),
          inArray(studentProfiles.id, uniqueRecipientIds)
        ));

      if (recipients.length !== uniqueRecipientIds.length) {
        throw new Error('Uno o más destinatarios no pertenecen a esta clase');
      }

      normalizedRecipientIds = uniqueRecipientIds;
    } else if (data.recipientType === 'CLAN') {
      if (uniqueRecipientIds.length !== 1) {
        throw new Error('Debes seleccionar un único clan destinatario');
      }

      const [team] = await db.select({ id: teams.id })
        .from(teams)
        .where(and(
          eq(teams.id, uniqueRecipientIds[0]),
          eq(teams.classroomId, data.classroomId)
        ));

      if (!team) {
        throw new Error('El clan no pertenece a esta clase');
      }

      normalizedRecipientIds = [team.id];
    }
    
    // Verificar límite diario
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayScrolls = await db.select({ count: sql<number>`count(*)` })
      .from(scrolls)
      .where(and(
        eq(scrolls.authorId, data.authorId),
        eq(scrolls.classroomId, data.classroomId),
        gte(scrolls.createdAt, todayStart)
      ));
    
    if (Number(todayScrolls[0]?.count || 0) >= classroom.scrollsMaxPerDay) {
      throw new Error(`Has alcanzado el límite de ${classroom.scrollsMaxPerDay} pergaminos por día`);
    }
    
    // Determinar estado inicial
    const initialStatus: ScrollStatus = classroom.scrollsRequireApproval ? 'PENDING' : 'APPROVED';
    
    const scrollId = uuidv4();
    
    await db.insert(scrolls).values({
      id: scrollId,
      classroomId: data.classroomId,
      authorId: data.authorId,
      message,
      imageUrl: data.imageUrl || null,
      category: data.category,
      recipientType: data.recipientType,
      recipientIds: normalizedRecipientIds,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
    });
    
    // Si no requiere aprobación, notificar a los destinatarios
    if (!classroom.scrollsRequireApproval) {
      try {
        await this.notifyRecipients(scrollId);
      } catch {
        // Silently fail - don't break scroll creation
      }
    }
    
    const scroll = await db.query.scrolls.findFirst({
      where: eq(scrolls.id, scrollId),
    });
    
    return scroll!;
  }

  // Obtener pergaminos aprobados del aula (para el mural público)
  async getApprovedScrolls(
    classroomId: string, 
    currentStudentId?: string,
    filters?: {
      category?: ScrollCategory;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<ScrollWithDetails[]> {
    let conditions = [
      eq(scrolls.classroomId, classroomId),
      eq(scrolls.status, 'APPROVED'),
    ];
    
    if (filters?.category) {
      conditions.push(eq(scrolls.category, filters.category));
    }
    
    if (filters?.startDate) {
      conditions.push(gte(scrolls.createdAt, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(scrolls.createdAt, filters.endDate));
    }
    
    const rawScrolls = await db.select()
      .from(scrolls)
      .where(and(...conditions))
      .orderBy(desc(scrolls.createdAt));
    
    // Enriquecer con detalles
    const enrichedScrolls = await Promise.all(
      rawScrolls.map(scroll => this.enrichScroll(scroll, currentStudentId))
    );
    
    return enrichedScrolls;
  }

  // Obtener pergaminos pendientes (para moderación del profesor)
  async getPendingScrolls(classroomId: string): Promise<ScrollWithDetails[]> {
    const rawScrolls = await db.select()
      .from(scrolls)
      .where(and(
        eq(scrolls.classroomId, classroomId),
        eq(scrolls.status, 'PENDING')
      ))
      .orderBy(desc(scrolls.createdAt));
    
    const enrichedScrolls = await Promise.all(
      rawScrolls.map(scroll => this.enrichScroll(scroll))
    );
    
    return enrichedScrolls;
  }

  // Aprobar un pergamino
  async approveScroll(scrollId: string, reviewerId: string): Promise<Scroll> {
    const [existing] = await db.select()
      .from(scrolls)
      .where(eq(scrolls.id, scrollId));

    if (!existing) {
      throw new Error('Pergamino no encontrado');
    }

    if (existing.status === 'APPROVED') {
      return existing;
    }

    if (existing.status === 'REJECTED') {
      throw new Error('No se puede aprobar un pergamino rechazado');
    }

    const now = new Date();
    
    await db.transaction(async (tx) => {
      await tx.update(scrolls)
        .set({
          status: 'APPROVED',
          reviewedAt: now,
          reviewedBy: reviewerId,
          updatedAt: now,
        })
        .where(and(
          eq(scrolls.id, scrollId),
          eq(scrolls.status, 'PENDING')
        ));
    });
    
    // Notificar a los destinatarios
    try {
      await this.notifyRecipients(scrollId);
    } catch {
      // Silently fail
    }
    
    // Notificar al autor que fue aprobado
    try {
      await this.notifyAuthor(scrollId, true);
    } catch {
      // Silently fail
    }
    
    const scroll = await db.query.scrolls.findFirst({
      where: eq(scrolls.id, scrollId),
    });
    
    return scroll!;
  }

  // Rechazar un pergamino
  async rejectScroll(scrollId: string, reviewerId: string, reason: string): Promise<Scroll> {
    const [existing] = await db.select()
      .from(scrolls)
      .where(eq(scrolls.id, scrollId));

    if (!existing) {
      throw new Error('Pergamino no encontrado');
    }

    if (existing.status === 'REJECTED') {
      return existing;
    }

    if (existing.status === 'APPROVED') {
      throw new Error('No se puede rechazar un pergamino aprobado');
    }

    const sanitizedReason = reason.trim();
    if (!sanitizedReason) {
      throw new Error('Debes indicar una razón para el rechazo');
    }

    const now = new Date();
    
    await db.transaction(async (tx) => {
      await tx.update(scrolls)
        .set({
          status: 'REJECTED',
          rejectionReason: sanitizedReason,
          reviewedAt: now,
          reviewedBy: reviewerId,
          updatedAt: now,
        })
        .where(and(
          eq(scrolls.id, scrollId),
          eq(scrolls.status, 'PENDING')
        ));
    });
    
    // Notificar al autor que fue rechazado
    try {
      await this.notifyAuthor(scrollId, false, sanitizedReason);
    } catch {
      // Silently fail
    }
    
    const scroll = await db.query.scrolls.findFirst({
      where: eq(scrolls.id, scrollId),
    });
    
    return scroll!;
  }

  // Agregar reacción
  async addReaction(scrollId: string, studentProfileId: string, reactionType: string): Promise<void> {
    if (!ALLOWED_REACTION_TYPES.has(reactionType)) {
      throw new Error('Tipo de reacción inválido');
    }

    const [scroll] = await db.select({
      id: scrolls.id,
      classroomId: scrolls.classroomId,
      status: scrolls.status,
    })
      .from(scrolls)
      .where(eq(scrolls.id, scrollId));

    if (!scroll || scroll.status !== 'APPROVED') {
      throw new Error('El pergamino no está disponible para reacciones');
    }

    const [student] = await db.select({
      id: studentProfiles.id,
      classroomId: studentProfiles.classroomId,
      isActive: studentProfiles.isActive,
    })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId));

    if (!student || !student.isActive || student.classroomId !== scroll.classroomId) {
      throw new Error('No tienes acceso para reaccionar a este pergamino');
    }

    await db.transaction(async (tx) => {
      const existingReaction = await tx.query.scrollReactions.findFirst({
        where: and(
          eq(scrollReactions.scrollId, scrollId),
          eq(scrollReactions.studentProfileId, studentProfileId),
          eq(scrollReactions.reactionType, reactionType)
        ),
      });

      if (existingReaction) {
        await tx.delete(scrollReactions)
          .where(eq(scrollReactions.id, existingReaction.id));
      } else {
        await tx.insert(scrollReactions).values({
          id: uuidv4(),
          scrollId,
          studentProfileId,
          reactionType,
          createdAt: new Date(),
        });
      }
    });
  }

  // Eliminar pergamino (solo el autor o el profesor)
  async deleteScroll(scrollId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(scrollReactions)
        .where(eq(scrollReactions.scrollId, scrollId));

      await tx.delete(scrolls)
        .where(eq(scrolls.id, scrollId));
    });
  }

  // Obtener pergaminos del estudiante (enviados)
  async getStudentScrolls(studentProfileId: string): Promise<ScrollWithDetails[]> {
    const rawScrolls = await db.select()
      .from(scrolls)
      .where(eq(scrolls.authorId, studentProfileId))
      .orderBy(desc(scrolls.createdAt));
    
    const enrichedScrolls = await Promise.all(
      rawScrolls.map(scroll => this.enrichScroll(scroll, studentProfileId))
    );
    
    return enrichedScrolls;
  }

  // Obtener estadísticas del mural
  async getScrollStats(classroomId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byCategory: Record<string, number>;
  }> {
    const [totals] = await db.select({
      total: sql<number>`count(*)`,
      pending: sql<number>`sum(case when ${scrolls.status} = 'PENDING' then 1 else 0 end)`,
      approved: sql<number>`sum(case when ${scrolls.status} = 'APPROVED' then 1 else 0 end)`,
      rejected: sql<number>`sum(case when ${scrolls.status} = 'REJECTED' then 1 else 0 end)`,
    })
      .from(scrolls)
      .where(eq(scrolls.classroomId, classroomId));

    const byCategoryRows = await db.select({
      category: scrolls.category,
      count: sql<number>`count(*)`,
    })
      .from(scrolls)
      .where(eq(scrolls.classroomId, classroomId))
      .groupBy(scrolls.category);

    const byCategory: Record<string, number> = {};
    byCategoryRows.forEach((row) => {
      byCategory[row.category] = Number(row.count || 0);
    });

    const stats = {
      total: Number(totals?.total || 0),
      pending: Number(totals?.pending || 0),
      approved: Number(totals?.approved || 0),
      rejected: Number(totals?.rejected || 0),
      byCategory,
    };
    
    return stats;
  }

  // Configurar el mural (abrir/cerrar)
  async toggleScrollsOpen(classroomId: string, isOpen: boolean): Promise<void> {
    await db.update(classrooms)
      .set({
        scrollsOpen: isOpen,
        updatedAt: new Date(),
      })
      .where(eq(classrooms.id, classroomId));
  }

  // Actualizar configuración del mural
  async updateScrollsConfig(classroomId: string, config: {
    enabled?: boolean;
    maxPerDay?: number;
    requireApproval?: boolean;
  }): Promise<void> {
    const updates: any = { updatedAt: new Date() };
    
    if (config.enabled !== undefined) {
      updates.scrollsEnabled = config.enabled;
      // Cuando se habilita, también abrir el mural automáticamente
      if (config.enabled === true) {
        updates.scrollsOpen = true;
      }
    }
    if (config.maxPerDay !== undefined) {
      updates.scrollsMaxPerDay = config.maxPerDay;
    }
    if (config.requireApproval !== undefined) {
      updates.scrollsRequireApproval = config.requireApproval;
    }
    
    await db.update(classrooms)
      .set(updates)
      .where(eq(classrooms.id, classroomId));
  }

  // ==================== MÉTODOS PRIVADOS ====================

  private parseRecipientIds(recipientIds: unknown): string[] {
    if (!recipientIds) return [];

    if (Array.isArray(recipientIds)) {
      return recipientIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
    }

    if (typeof recipientIds === 'string') {
      try {
        const parsed = JSON.parse(recipientIds);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
        }
      } catch {
        return [];
      }
    }

    return [];
  }

  // Enriquecer pergamino con detalles
  private async enrichScroll(scroll: Scroll, currentStudentId?: string): Promise<ScrollWithDetails> {
    // Obtener autor
    const author = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, scroll.authorId),
    });
    
    // Obtener destinatarios si aplica
    let recipients: ScrollWithDetails['recipients'] = undefined;
    let clan: ScrollWithDetails['clan'] = undefined;
    const recipientIds = this.parseRecipientIds(scroll.recipientIds);
    
    if (scroll.recipientType === 'STUDENT' || scroll.recipientType === 'MULTIPLE') {
      if (recipientIds.length > 0) {
        const recipientProfiles = await db.select({
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          displayName: studentProfiles.displayName,
        })
          .from(studentProfiles)
          .where(inArray(studentProfiles.id, recipientIds));
        
        recipients = recipientProfiles;
      }
    } else if (scroll.recipientType === 'CLAN') {
      if (recipientIds.length > 0) {
        const team = await db.query.teams.findFirst({
          where: eq(teams.id, recipientIds[0]),
        });
        
        if (team) {
          clan = { id: team.id, name: team.name };
        }
      }
    }
    
    // Obtener reacciones agrupadas
    const allReactions = await db.select()
      .from(scrollReactions)
      .where(eq(scrollReactions.scrollId, scroll.id));
    
    const reactionTypes = ['heart', 'star', 'fire', 'clap', 'smile'];
    const reactions = reactionTypes.map(type => ({
      type,
      count: allReactions.filter(r => r.reactionType === type).length,
      hasReacted: currentStudentId 
        ? allReactions.some(r => r.reactionType === type && r.studentProfileId === currentStudentId)
        : false,
    }));
    
    return {
      ...scroll,
      author: {
        id: author?.id || '',
        characterName: author?.characterName || null,
        avatarUrl: author?.avatarUrl || null,
        displayName: author?.displayName || null,
      },
      recipients,
      clan,
      reactions,
      totalReactions: allReactions.length,
    };
  }

  // Notificar a los destinatarios
  private async notifyRecipients(scrollId: string): Promise<void> {
    const scroll = await db.query.scrolls.findFirst({
      where: eq(scrolls.id, scrollId),
    });
    
    if (!scroll) return;
    
    const author = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, scroll.authorId),
    });
    
    const authorName = author?.characterName || author?.displayName || 'Un compañero';
    const recipientIds = this.parseRecipientIds(scroll.recipientIds);
    const recipientUserSet = new Set<string>();
    
    if (scroll.recipientType === 'STUDENT' || scroll.recipientType === 'MULTIPLE') {
      if (recipientIds.length > 0) {
        const profiles = await db.select({ userId: studentProfiles.userId })
          .from(studentProfiles)
          .where(inArray(studentProfiles.id, recipientIds));
        
        profiles
          .filter(p => p.userId)
          .forEach((p) => {
            recipientUserSet.add(p.userId!);
          });
      }
    } else if (scroll.recipientType === 'CLAN') {
      if (recipientIds.length > 0) {
        const clanMembers = await db.select({ userId: studentProfiles.userId })
          .from(studentProfiles)
          .where(and(
            eq(studentProfiles.teamId, recipientIds[0]),
            eq(studentProfiles.classroomId, scroll.classroomId),
            eq(studentProfiles.isActive, true)
          ));
        
        clanMembers
          .filter(m => m.userId)
          .forEach((member) => {
            recipientUserSet.add(member.userId!);
          });
      }
    } else if (scroll.recipientType === 'CLASS') {
      const classStudents = await db.select({ userId: studentProfiles.userId })
        .from(studentProfiles)
        .where(and(
          eq(studentProfiles.classroomId, scroll.classroomId),
          eq(studentProfiles.isActive, true)
        ));
      
      classStudents
        .filter(s => s.userId)
        .forEach((student) => {
          recipientUserSet.add(student.userId!);
        });
    } else if (scroll.recipientType === 'TEACHER') {
      const classroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.id, scroll.classroomId),
      });
      
      if (classroom) {
        recipientUserSet.add(classroom.teacherId);
      }
    }

    const recipientUserIds = Array.from(recipientUserSet)
      .filter(userId => userId && userId !== author?.userId);
    
    // Crear notificaciones
    const now = new Date();
    const notificationValues = recipientUserIds.map(userId => ({
      id: uuidv4(),
      userId,
      classroomId: scroll.classroomId,
      type: 'SCROLL_RECEIVED' as const,
      title: '📜 ¡Nuevo pergamino!',
      message: `${authorName} te ha enviado un mensaje en el mural`,
      data: JSON.stringify({ scrollId }),
      isRead: false,
      createdAt: now,
    }));
    
    if (notificationValues.length > 0) {
      await db.insert(notifications).values(notificationValues);
    }
  }

  // Notificar al autor sobre el estado de su pergamino
  private async notifyAuthor(scrollId: string, approved: boolean, reason?: string): Promise<void> {
    const scroll = await db.query.scrolls.findFirst({
      where: eq(scrolls.id, scrollId),
    });
    
    if (!scroll) return;
    
    const author = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, scroll.authorId),
    });
    
    if (!author?.userId) return;
    
    await db.insert(notifications).values({
      id: uuidv4(),
      userId: author.userId,
      classroomId: scroll.classroomId,
      type: approved ? 'SCROLL_APPROVED' : 'SCROLL_REJECTED',
      title: approved ? '✅ Pergamino aprobado' : '❌ Pergamino rechazado',
      message: approved 
        ? 'Tu mensaje ha sido aprobado y ya está visible en el mural'
        : `Tu mensaje fue rechazado: ${reason || 'Sin razón especificada'}`,
      data: JSON.stringify({ scrollId }),
      isRead: false,
      createdAt: new Date(),
    });
  }
}

export const scrollService = new ScrollService();
