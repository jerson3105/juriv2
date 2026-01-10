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
  // Crear un nuevo pergamino
  async createScroll(data: CreateScrollData): Promise<Scroll> {
    const now = new Date();
    
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
    
    if (todayScrolls[0].count >= classroom.scrollsMaxPerDay) {
      throw new Error(`Has alcanzado el límite de ${classroom.scrollsMaxPerDay} pergaminos por día`);
    }
    
    // Determinar estado inicial
    const initialStatus: ScrollStatus = classroom.scrollsRequireApproval ? 'PENDING' : 'APPROVED';
    
    const scrollId = uuidv4();
    
    await db.insert(scrolls).values({
      id: scrollId,
      classroomId: data.classroomId,
      authorId: data.authorId,
      message: data.message,
      imageUrl: data.imageUrl || null,
      category: data.category,
      recipientType: data.recipientType,
      recipientIds: data.recipientIds || null,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
    });
    
    // Si no requiere aprobación, notificar a los destinatarios
    if (!classroom.scrollsRequireApproval) {
      await this.notifyRecipients(scrollId);
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
    const now = new Date();
    
    await db.update(scrolls)
      .set({
        status: 'APPROVED',
        reviewedAt: now,
        reviewedBy: reviewerId,
        updatedAt: now,
      })
      .where(eq(scrolls.id, scrollId));
    
    // Notificar a los destinatarios
    await this.notifyRecipients(scrollId);
    
    // Notificar al autor que fue aprobado
    await this.notifyAuthor(scrollId, true);
    
    const scroll = await db.query.scrolls.findFirst({
      where: eq(scrolls.id, scrollId),
    });
    
    return scroll!;
  }

  // Rechazar un pergamino
  async rejectScroll(scrollId: string, reviewerId: string, reason: string): Promise<Scroll> {
    const now = new Date();
    
    await db.update(scrolls)
      .set({
        status: 'REJECTED',
        rejectionReason: reason,
        reviewedAt: now,
        reviewedBy: reviewerId,
        updatedAt: now,
      })
      .where(eq(scrolls.id, scrollId));
    
    // Notificar al autor que fue rechazado
    await this.notifyAuthor(scrollId, false, reason);
    
    const scroll = await db.query.scrolls.findFirst({
      where: eq(scrolls.id, scrollId),
    });
    
    return scroll!;
  }

  // Agregar reacción
  async addReaction(scrollId: string, studentProfileId: string, reactionType: string): Promise<void> {
    const existingReaction = await db.query.scrollReactions.findFirst({
      where: and(
        eq(scrollReactions.scrollId, scrollId),
        eq(scrollReactions.studentProfileId, studentProfileId),
        eq(scrollReactions.reactionType, reactionType)
      ),
    });
    
    if (existingReaction) {
      // Si ya existe, la quitamos (toggle)
      await db.delete(scrollReactions)
        .where(eq(scrollReactions.id, existingReaction.id));
    } else {
      // Si no existe, la agregamos
      await db.insert(scrollReactions).values({
        id: uuidv4(),
        scrollId,
        studentProfileId,
        reactionType,
        createdAt: new Date(),
      });
    }
  }

  // Eliminar pergamino (solo el autor o el profesor)
  async deleteScroll(scrollId: string): Promise<void> {
    // Eliminar reacciones primero
    await db.delete(scrollReactions)
      .where(eq(scrollReactions.scrollId, scrollId));
    
    // Eliminar el pergamino
    await db.delete(scrolls)
      .where(eq(scrolls.id, scrollId));
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
    const allScrolls = await db.select()
      .from(scrolls)
      .where(eq(scrolls.classroomId, classroomId));
    
    const stats = {
      total: allScrolls.length,
      pending: allScrolls.filter(s => s.status === 'PENDING').length,
      approved: allScrolls.filter(s => s.status === 'APPROVED').length,
      rejected: allScrolls.filter(s => s.status === 'REJECTED').length,
      byCategory: {} as Record<string, number>,
    };
    
    // Contar por categoría
    allScrolls.forEach(scroll => {
      stats.byCategory[scroll.category] = (stats.byCategory[scroll.category] || 0) + 1;
    });
    
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

  // Enriquecer pergamino con detalles
  private async enrichScroll(scroll: Scroll, currentStudentId?: string): Promise<ScrollWithDetails> {
    // Obtener autor
    const author = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, scroll.authorId),
    });
    
    // Obtener destinatarios si aplica
    let recipients: ScrollWithDetails['recipients'] = undefined;
    let clan: ScrollWithDetails['clan'] = undefined;
    
    if (scroll.recipientType === 'STUDENT' || scroll.recipientType === 'MULTIPLE') {
      if (scroll.recipientIds && scroll.recipientIds.length > 0) {
        const recipientProfiles = await db.select({
          id: studentProfiles.id,
          characterName: studentProfiles.characterName,
          displayName: studentProfiles.displayName,
        })
          .from(studentProfiles)
          .where(inArray(studentProfiles.id, scroll.recipientIds));
        
        recipients = recipientProfiles;
      }
    } else if (scroll.recipientType === 'CLAN') {
      if (scroll.recipientIds && scroll.recipientIds.length > 0) {
        const team = await db.query.teams.findFirst({
          where: eq(teams.id, scroll.recipientIds[0]),
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
    let recipientUserIds: string[] = [];
    
    if (scroll.recipientType === 'STUDENT' || scroll.recipientType === 'MULTIPLE') {
      if (scroll.recipientIds && scroll.recipientIds.length > 0) {
        const profiles = await db.select({ userId: studentProfiles.userId })
          .from(studentProfiles)
          .where(inArray(studentProfiles.id, scroll.recipientIds));
        
        recipientUserIds = profiles
          .filter(p => p.userId)
          .map(p => p.userId!);
      }
    } else if (scroll.recipientType === 'CLAN') {
      if (scroll.recipientIds && scroll.recipientIds.length > 0) {
        const clanMembers = await db.select({ userId: studentProfiles.userId })
          .from(studentProfiles)
          .where(eq(studentProfiles.teamId, scroll.recipientIds[0]));
        
        recipientUserIds = clanMembers
          .filter(m => m.userId)
          .map(m => m.userId!);
      }
    } else if (scroll.recipientType === 'CLASS') {
      const classStudents = await db.select({ userId: studentProfiles.userId })
        .from(studentProfiles)
        .where(and(
          eq(studentProfiles.classroomId, scroll.classroomId),
          eq(studentProfiles.isActive, true)
        ));
      
      recipientUserIds = classStudents
        .filter(s => s.userId && s.userId !== author?.userId)
        .map(s => s.userId!);
    } else if (scroll.recipientType === 'TEACHER') {
      const classroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.id, scroll.classroomId),
      });
      
      if (classroom) {
        recipientUserIds = [classroom.teacherId];
      }
    }
    
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
