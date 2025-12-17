import { v4 as uuid } from 'uuid';
import { eq, and, or, inArray, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { 
  badges, 
  studentBadges, 
  badgeProgress,
  studentProfiles,
  behaviors,
  pointLogs,
  notifications,
  classrooms,
  type Badge,
  type StudentBadge,
  type BadgeCategory,
  type BadgeRarity,
  type BadgeAssignment,
} from '../db/schema.js';

// Tipos para condiciones
export interface BadgeCondition {
  type: string;
  value?: number;
  count?: number;
  behaviorId?: string;
  category?: 'positive' | 'negative';
  period?: string;
  conditions?: BadgeCondition[];
  operator?: 'AND' | 'OR';
}

export interface BadgeEvent {
  type: 'POINTS_ADDED' | 'LEVEL_UP' | 'PURCHASE_MADE' | 'BEHAVIOR_APPLIED' | 'LOGIN';
  data: {
    studentProfileId: string;
    classroomId: string;
    totalXp?: number;
    level?: number;
    behaviorId?: string;
    behaviorType?: 'positive' | 'negative';
    totalPurchases?: number;
  };
}

export interface CreateBadgeDto {
  classroomId: string;
  name: string;
  description: string;
  icon: string;
  customImage?: string | null;
  category?: BadgeCategory;
  rarity?: BadgeRarity;
  assignmentMode: BadgeAssignment;
  unlockCondition?: BadgeCondition | null;
  rewardXp?: number;
  rewardGp?: number;
  isSecret?: boolean;
}

class BadgeService {
  
  // ═══════════════════════════════════════════════════════════
  // CRUD de Insignias
  // ═══════════════════════════════════════════════════════════
  
  async createBadge(data: CreateBadgeDto, teacherId: string): Promise<Badge> {
    const now = new Date();
    const newBadge = {
      id: uuid(),
      scope: 'CLASSROOM' as const,
      classroomId: data.classroomId,
      createdBy: teacherId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      customImage: data.customImage || null,
      category: data.category || 'CUSTOM' as const,
      rarity: data.rarity || 'COMMON' as const,
      assignmentMode: data.assignmentMode,
      unlockCondition: data.unlockCondition || null,
      rewardXp: data.rewardXp || 0,
      rewardGp: data.rewardGp || 0,
      maxAwards: 1,
      isSecret: data.isSecret || false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.insert(badges).values(newBadge);
    return newBadge as Badge;
  }
  
  async updateBadge(badgeId: string, data: Partial<CreateBadgeDto>): Promise<void> {
    await db.update(badges)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(badges.id, badgeId));
  }
  
  async deleteBadge(badgeId: string): Promise<void> {
    // Eliminar progreso y badges de estudiantes primero
    await db.delete(badgeProgress).where(eq(badgeProgress.badgeId, badgeId));
    await db.delete(studentBadges).where(eq(studentBadges.badgeId, badgeId));
    await db.delete(badges).where(eq(badges.id, badgeId));
  }
  
  async getBadgeById(badgeId: string): Promise<Badge | null> {
    const result = await db.select().from(badges).where(eq(badges.id, badgeId));
    return result[0] || null;
  }
  
  async getClassroomBadges(classroomId: string): Promise<Badge[]> {
    // Retorna insignias del sistema + insignias de la clase
    try {
      const result = await db.select().from(badges).where(
        and(
          eq(badges.isActive, true),
          or(
            eq(badges.scope, 'SYSTEM'),
            eq(badges.classroomId, classroomId)
          )
        )
      );
      return result;
    } catch (error) {
      console.error('Error getting classroom badges:', error);
      // Si falla, intentar solo las de la clase
      return await db.select().from(badges).where(
        and(
          eq(badges.isActive, true),
          eq(badges.classroomId, classroomId)
        )
      );
    }
  }
  
  async getSystemBadges(): Promise<Badge[]> {
    return await db.select().from(badges).where(
      and(
        eq(badges.scope, 'SYSTEM'),
        eq(badges.isActive, true)
      )
    );
  }
  
  async getClassroomBadgeStats(classroomId: string): Promise<{
    totalBadges: number;
    totalAwarded: number;
    studentsWithBadges: number;
    totalStudents: number;
    mostAwardedBadge: { name: string; icon: string; count: number } | null;
    recentAwards: { studentName: string; badgeName: string; badgeIcon: string; awardedAt: Date }[];
    badgeDistribution: { name: string; icon: string; count: number }[];
  }> {
    // Obtener todas las insignias de la clase
    const classroomBadges = await this.getClassroomBadges(classroomId);
    
    // Obtener estudiantes de la clase
    const students = await db.select().from(studentProfiles).where(eq(studentProfiles.classroomId, classroomId));
    
    if (students.length === 0) {
      return {
        totalBadges: classroomBadges.length,
        totalAwarded: 0,
        studentsWithBadges: 0,
        totalStudents: 0,
        mostAwardedBadge: null,
        recentAwards: [],
        badgeDistribution: [],
      };
    }
    
    const studentIds = students.map(s => s.id);
    const studentMap = new Map(students.map(s => [s.id, s]));
    
    // Obtener insignias otorgadas
    const allStudentBadges = await db.select()
      .from(studentBadges)
      .where(inArray(studentBadges.studentProfileId, studentIds));
    
    if (allStudentBadges.length === 0) {
      return {
        totalBadges: classroomBadges.length,
        totalAwarded: 0,
        studentsWithBadges: 0,
        totalStudents: students.length,
        mostAwardedBadge: null,
        recentAwards: [],
        badgeDistribution: [],
      };
    }
    
    // Obtener info de las insignias
    const badgeIdsList = [...new Set(allStudentBadges.map(sb => sb.badgeId))];
    const badgesList = await db.select().from(badges).where(inArray(badges.id, badgeIdsList));
    const badgeMap = new Map(badgesList.map(b => [b.id, b]));
    
    // Contar insignias por tipo
    const badgeCounts = new Map<string, { name: string; icon: string; count: number }>();
    for (const sb of allStudentBadges) {
      const badge = badgeMap.get(sb.badgeId);
      if (!badge) continue;
      const existing = badgeCounts.get(sb.badgeId);
      if (existing) {
        existing.count++;
      } else {
        badgeCounts.set(sb.badgeId, { 
          name: badge.name, 
          icon: badge.customImage || badge.icon, 
          count: 1 
        });
      }
    }
    
    // Estudiantes únicos con insignias
    const studentsWithBadgesSet = new Set(allStudentBadges.map(sb => sb.studentProfileId));
    
    // Insignia más otorgada
    let mostAwarded: { name: string; icon: string; count: number } | null = null;
    for (const badge of badgeCounts.values()) {
      if (!mostAwarded || badge.count > mostAwarded.count) {
        mostAwarded = badge;
      }
    }
    
    // Últimas 5 insignias otorgadas
    const sortedByDate = [...allStudentBadges].sort((a, b) => 
      new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
    );
    const recentAwards = sortedByDate.slice(0, 5).map(sb => {
      const badge = badgeMap.get(sb.badgeId);
      const student = studentMap.get(sb.studentProfileId);
      return {
        studentName: student?.characterName || 'Estudiante',
        badgeName: badge?.name || 'Insignia',
        badgeIcon: badge?.customImage || badge?.icon || '🏅',
        awardedAt: sb.unlockedAt,
      };
    });
    
    return {
      totalBadges: classroomBadges.length,
      totalAwarded: allStudentBadges.length,
      studentsWithBadges: studentsWithBadgesSet.size,
      totalStudents: students.length,
      mostAwardedBadge: mostAwarded,
      recentAwards,
      badgeDistribution: Array.from(badgeCounts.values()).sort((a, b) => b.count - a.count),
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // Insignias de Estudiantes
  // ═══════════════════════════════════════════════════════════
  
  async getStudentBadges(studentProfileId: string): Promise<(StudentBadge & { badge: Badge; count: number })[]> {
    const results = await db.select({
      studentBadge: studentBadges,
      badge: badges,
    })
    .from(studentBadges)
    .innerJoin(badges, eq(studentBadges.badgeId, badges.id))
    .where(eq(studentBadges.studentProfileId, studentProfileId));
    
    // Agrupar por badgeId y contar
    const grouped = new Map<string, { studentBadge: typeof results[0]['studentBadge']; badge: typeof results[0]['badge']; count: number }>();
    
    for (const r of results) {
      const existing = grouped.get(r.badge.id);
      if (existing) {
        existing.count++;
        // Mantener la fecha más reciente
        if (new Date(r.studentBadge.unlockedAt) > new Date(existing.studentBadge.unlockedAt)) {
          existing.studentBadge = r.studentBadge;
        }
      } else {
        grouped.set(r.badge.id, { studentBadge: r.studentBadge, badge: r.badge, count: 1 });
      }
    }
    
    return Array.from(grouped.values()).map(g => ({
      ...g.studentBadge,
      badge: g.badge,
      count: g.count,
    }));
  }
  
  async getStudentBadge(studentProfileId: string, badgeId: string): Promise<StudentBadge | null> {
    const result = await db.select().from(studentBadges).where(
      and(
        eq(studentBadges.studentProfileId, studentProfileId),
        eq(studentBadges.badgeId, badgeId)
      )
    );
    return result[0] || null;
  }
  
  async countStudentBadge(studentProfileId: string, badgeId: string): Promise<number> {
    const result = await db.select().from(studentBadges).where(
      and(
        eq(studentBadges.studentProfileId, studentProfileId),
        eq(studentBadges.badgeId, badgeId)
      )
    );
    return result.length;
  }
  
  async getDisplayedBadges(studentProfileId: string): Promise<(StudentBadge & { badge: Badge })[]> {
    const results = await db.select({
      studentBadge: studentBadges,
      badge: badges,
    })
    .from(studentBadges)
    .innerJoin(badges, eq(studentBadges.badgeId, badges.id))
    .where(
      and(
        eq(studentBadges.studentProfileId, studentProfileId),
        eq(studentBadges.isDisplayed, true)
      )
    );
    
    return results.map(r => ({
      ...r.studentBadge,
      badge: r.badge,
    }));
  }
  
  async setDisplayedBadges(studentProfileId: string, badgeIds: string[]): Promise<void> {
    // Quitar display de todas
    await db.update(studentBadges)
      .set({ isDisplayed: false })
      .where(eq(studentBadges.studentProfileId, studentProfileId));
    
    // Marcar las seleccionadas (máximo 3)
    if (badgeIds.length > 0) {
      const idsToDisplay = badgeIds.slice(0, 3);
      await db.update(studentBadges)
        .set({ isDisplayed: true })
        .where(
          and(
            eq(studentBadges.studentProfileId, studentProfileId),
            inArray(studentBadges.badgeId, idsToDisplay)
          )
        );
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // Otorgar Insignias
  // ═══════════════════════════════════════════════════════════
  
  async awardBadgeManually(
    studentProfileId: string, 
    badgeId: string, 
    teacherId: string,
    reason?: string
  ): Promise<StudentBadge> {
    const badge = await this.getBadgeById(badgeId);
    if (!badge) {
      throw new Error('Insignia no encontrada');
    }
    
    // Verificar que permite asignación manual
    if (badge.assignmentMode === 'AUTOMATIC') {
      throw new Error('Esta insignia solo se puede obtener automáticamente');
    }
    
    // Las insignias manuales son acumulables - contar cuántas tiene
    const existingCount = await this.countStudentBadge(studentProfileId, badgeId);
    
    // Otorgar
    const newStudentBadge = {
      id: uuid(),
      studentProfileId,
      badgeId,
      unlockedAt: new Date(),
      awardedBy: teacherId,
      awardReason: reason || null,
      isDisplayed: false,
    };
    
    await db.insert(studentBadges).values(newStudentBadge);
    
    // Dar recompensa si tiene
    if (badge.rewardXp > 0 || badge.rewardGp > 0) {
      await this.giveReward(studentProfileId, badge.rewardXp, badge.rewardGp);
    }
    
    // Crear notificación para el estudiante (solo si tiene cuenta vinculada)
    const student = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
    if (student.length > 0 && student[0].userId) {
      const newCount = existingCount + 1;
      const countText = newCount > 1 ? ` (x${newCount})` : '';
      await db.insert(notifications).values({
        id: uuid(),
        userId: student[0].userId,
        type: 'BADGE',
        title: '🏅 ¡Nueva insignia recibida!',
        message: `Tu profesor te ha otorgado la insignia "${badge.name}"${countText}`,
        isRead: false,
        createdAt: new Date(),
      });
    }
    
    return newStudentBadge as StudentBadge;
  }
  
  async awardBadgeAutomatic(studentProfileId: string, badgeId: string): Promise<StudentBadge> {
    const badge = await this.getBadgeById(badgeId);
    if (!badge) {
      throw new Error('Insignia no encontrada');
    }
    
    // Verificar si ya la tiene
    const existing = await this.getStudentBadge(studentProfileId, badgeId);
    if (existing) {
      throw new Error('El estudiante ya tiene esta insignia');
    }
    
    const newStudentBadge = {
      id: uuid(),
      studentProfileId,
      badgeId,
      unlockedAt: new Date(),
      awardedBy: null,
      awardReason: null,
      isDisplayed: false,
    };
    
    await db.insert(studentBadges).values(newStudentBadge);
    
    // Dar recompensa si tiene
    if (badge.rewardXp > 0 || badge.rewardGp > 0) {
      await this.giveReward(studentProfileId, badge.rewardXp, badge.rewardGp);
    }
    
    // Crear notificaciones
    const student = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
    if (student.length > 0) {
      // Notificación para el estudiante (solo si tiene cuenta vinculada)
      if (student[0].userId) {
        await db.insert(notifications).values({
          id: uuid(),
          userId: student[0].userId,
          type: 'BADGE',
          title: '🏅 ¡Nueva insignia desbloqueada!',
          message: `Has obtenido la insignia "${badge.name}"`,
          isRead: false,
          createdAt: new Date(),
        });
      }
      
      // Notificación para el profesor (obtener de la clase)
      const classroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.id, student[0].classroomId),
      });
      if (classroom) {
        await db.insert(notifications).values({
          id: uuid(),
          userId: classroom.teacherId,
          classroomId: classroom.id,
          type: 'BADGE',
          title: '🏅 ¡Insignia desbloqueada!',
          message: `${student[0].characterName || 'Un estudiante'} ha obtenido la insignia "${badge.name}"`,
          isRead: false,
          createdAt: new Date(),
        });
      }
    }
    
    return newStudentBadge as StudentBadge;
  }
  
  async revokeBadge(studentProfileId: string, badgeId: string): Promise<void> {
    await db.delete(studentBadges).where(
      and(
        eq(studentBadges.studentProfileId, studentProfileId),
        eq(studentBadges.badgeId, badgeId)
      )
    );
  }
  
  // ═══════════════════════════════════════════════════════════
  // Verificación Automática
  // ═══════════════════════════════════════════════════════════
  
  async checkAndAwardBadges(event: BadgeEvent): Promise<Badge[]> {
    const { studentProfileId, classroomId } = event.data;
    const unlockedBadges: Badge[] = [];
    
    // Obtener insignias automáticas no desbloqueadas
    const allBadges = await this.getClassroomBadges(classroomId);
    
    const studentBadgesList = await this.getStudentBadges(studentProfileId);
    const unlockedIds = new Set(studentBadgesList.map(sb => sb.badgeId));
    
    const pendingBadges = allBadges.filter(b => 
      !unlockedIds.has(b.id) && 
      (b.assignmentMode === 'AUTOMATIC' || b.assignmentMode === 'BOTH') &&
      b.unlockCondition !== null
    );
    
    
    for (const badge of pendingBadges) {
      try {
        const conditionMet = await this.checkCondition(studentProfileId, badge, event);
        
        if (conditionMet) {
          await this.awardBadgeAutomatic(studentProfileId, badge.id);
          unlockedBadges.push(badge);
        }
      } catch (error) {
        // Si ya tiene la insignia, continuar
        console.error(`Error checking badge ${badge.id}:`, error);
      }
    }
    
    return unlockedBadges;
  }
  
  private async checkCondition(
    studentProfileId: string, 
    badge: Badge, 
    event: BadgeEvent
  ): Promise<boolean> {
    let condition = badge.unlockCondition as BadgeCondition | string | null;
    if (!condition) return false;
    
    // Si la condición es string, parsearla como JSON
    if (typeof condition === 'string') {
      try {
        condition = JSON.parse(condition) as BadgeCondition;
      } catch (e) {
        console.error('Error parsing badge condition:', e);
        return false;
      }
    }
    
    switch (condition.type) {
      case 'XP_TOTAL':
        // Obtener XP actual del estudiante
        const studentXp = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
        const currentXp = studentXp[0]?.xp || 0;
        return currentXp >= (condition.value || 0);
        
      case 'LEVEL':
        // Obtener nivel actual del estudiante
        const studentLevel = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
        const currentLevel = studentLevel[0]?.level || 1;
        return currentLevel >= (condition.value || 0);
        
      case 'BEHAVIOR_COUNT':
        if (!condition.behaviorId) return false;
        // Contar solo desde que se creó la insignia
        const badgeCreatedAt = badge.createdAt ? new Date(badge.createdAt) : undefined;
        const behaviorCount = await this.countBehaviorApplications(
          studentProfileId, 
          condition.behaviorId,
          badgeCreatedAt
        );
        return behaviorCount >= (condition.count || 0);
        
      case 'BEHAVIOR_CATEGORY':
        const catBadgeCreatedAt = badge.createdAt ? new Date(badge.createdAt) : undefined;
        const categoryCount = await this.countBehaviorsByCategory(
          studentProfileId,
          condition.category || 'positive',
          catBadgeCreatedAt
        );
        return categoryCount >= (condition.count || 0);
        
      case 'ANY_BEHAVIOR':
        const anyBadgeCreatedAt = badge.createdAt ? new Date(badge.createdAt) : undefined;
        const totalBehaviors = await this.countAllBehaviors(studentProfileId, anyBadgeCreatedAt);
        return totalBehaviors >= (condition.count || 0);
        
      case 'PURCHASES':
        return (event.data.totalPurchases || 0) >= (condition.value || 0);
        
      case 'COMPOUND':
        if (!condition.conditions) return false;
        for (const subCondition of condition.conditions) {
          const subBadge = { ...badge, unlockCondition: subCondition };
          if (!await this.checkCondition(studentProfileId, subBadge, event)) {
            return false;
          }
        }
        return true;
        
      default:
        return false;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════
  
  private async countBehaviorApplications(
    studentProfileId: string, 
    behaviorId: string,
    sinceDate?: Date
  ): Promise<number> {
    const conditions = [
      eq(pointLogs.studentId, studentProfileId),
      eq(pointLogs.behaviorId, behaviorId)
    ];
    
    // Solo contar desde la fecha de creación de la insignia
    if (sinceDate) {
      conditions.push(gte(pointLogs.createdAt, sinceDate));
    }
    
    const result = await db.select()
      .from(pointLogs)
      .where(and(...conditions));
    
    // Contar aplicaciones únicas por timestamp (un comportamiento puede generar múltiples logs)
    // Agrupamos por createdAt redondeado al segundo para considerar logs del mismo momento
    const uniqueApplications = new Set<string>();
    for (const log of result) {
      // Usar timestamp truncado al segundo como identificador único
      const timestamp = new Date(log.createdAt).toISOString().slice(0, 19);
      uniqueApplications.add(timestamp);
    }
    return uniqueApplications.size;
  }
  
  private async countBehaviorsByCategory(
    studentProfileId: string, 
    category: 'positive' | 'negative',
    sinceDate?: Date
  ): Promise<number> {
    // Obtener comportamientos de la categoría
    const behaviorsList = await db.select()
      .from(behaviors)
      .where(eq(behaviors.isPositive, category === 'positive'));
    
    const behaviorIds = behaviorsList.map((b: { id: string }) => b.id);
    if (behaviorIds.length === 0) return 0;
    
    const conditions = [
      eq(pointLogs.studentId, studentProfileId),
      inArray(pointLogs.behaviorId, behaviorIds)
    ];
    
    if (sinceDate) {
      conditions.push(gte(pointLogs.createdAt, sinceDate));
    }
    
    const result = await db.select()
      .from(pointLogs)
      .where(and(...conditions));
    
    // Contar aplicaciones únicas por behaviorId + timestamp
    const uniqueApplications = new Set<string>();
    for (const log of result) {
      const timestamp = new Date(log.createdAt).toISOString().slice(0, 19);
      uniqueApplications.add(`${log.behaviorId}-${timestamp}`);
    }
    return uniqueApplications.size;
  }
  
  private async countAllBehaviors(studentProfileId: string, sinceDate?: Date): Promise<number> {
    const conditions = [eq(pointLogs.studentId, studentProfileId)];
    
    if (sinceDate) {
      conditions.push(gte(pointLogs.createdAt, sinceDate));
    }
    
    const result = await db.select()
      .from(pointLogs)
      .where(and(...conditions));
    
    // Contar aplicaciones únicas por behaviorId + timestamp
    const uniqueApplications = new Set<string>();
    for (const log of result) {
      if (log.behaviorId) {
        const timestamp = new Date(log.createdAt).toISOString().slice(0, 19);
        uniqueApplications.add(`${log.behaviorId}-${timestamp}`);
      }
    }
    return uniqueApplications.size;
  }
  
  private async giveReward(studentProfileId: string, xp: number, gp: number): Promise<void> {
    if (xp === 0 && gp === 0) return;
    
    const student = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
    if (student.length === 0) return;
    
    const current = student[0];
    const newXp = current.xp + xp;
    
    // Obtener configuración de la clase para calcular nivel
    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, current.classroomId),
    });
    
    const xpPerLevel = classroom?.xpPerLevel || 100;
    
    // Calcular nuevo nivel usando la fórmula progresiva
    const calculateLevel = (totalXp: number, xpPerLvl: number): number => {
      const level = Math.floor((1 + Math.sqrt(1 + (8 * totalXp) / xpPerLvl)) / 2);
      return Math.max(1, level);
    };
    
    const newLevel = xp > 0 ? calculateLevel(newXp, xpPerLevel) : current.level;
    const leveledUp = newLevel > current.level;
    
    await db.update(studentProfiles)
      .set({
        xp: newXp,
        gp: current.gp + gp,
        level: newLevel,
      })
      .where(eq(studentProfiles.id, studentProfileId));
    
    // Notificar subida de nivel si aplica
    if (leveledUp && current.userId) {
      await db.insert(notifications).values({
        id: uuid(),
        userId: current.userId,
        classroomId: current.classroomId,
        type: 'LEVEL_UP',
        title: '🎉 ¡Subiste de nivel!',
        message: `¡Felicidades! Has alcanzado el nivel ${newLevel}`,
        isRead: false,
        createdAt: new Date(),
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // Progreso
  // ═══════════════════════════════════════════════════════════
  
  async getStudentProgress(studentProfileId: string, classroomId: string): Promise<{
    badge: Badge;
    currentValue: number;
    targetValue: number;
    percentage: number;
  }[]> {
    const allBadges = await this.getClassroomBadges(classroomId);
    const studentBadgesList = await this.getStudentBadges(studentProfileId);
    const unlockedIds = new Set(studentBadgesList.map(sb => sb.badgeId));
    
    // Filtrar insignias no desbloqueadas con condiciones
    const pendingBadges = allBadges.filter(b => 
      !unlockedIds.has(b.id) && 
      !b.isSecret &&
      b.unlockCondition !== null
    );
    
    const progress: {
      badge: Badge;
      currentValue: number;
      targetValue: number;
      percentage: number;
    }[] = [];
    
    for (const badge of pendingBadges) {
      let condition = badge.unlockCondition as BadgeCondition | string;
      if (!condition) continue;
      
      // Parsear si es string
      if (typeof condition === 'string') {
        try {
          condition = JSON.parse(condition) as BadgeCondition;
        } catch (e) {
          continue;
        }
      }
      
      let currentValue = 0;
      let targetValue = condition.value || condition.count || 0;
      const badgeCreatedAt = badge.createdAt ? new Date(badge.createdAt) : undefined;
      
      switch (condition.type) {
        case 'XP_TOTAL':
          const student = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
          currentValue = student[0]?.xp || 0;
          break;
        case 'LEVEL':
          const studentLevel = await db.select().from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
          currentValue = studentLevel[0]?.level || 1;
          break;
        case 'BEHAVIOR_COUNT':
          if (condition.behaviorId) {
            currentValue = await this.countBehaviorApplications(studentProfileId, condition.behaviorId, badgeCreatedAt);
          }
          break;
        case 'BEHAVIOR_CATEGORY':
          currentValue = await this.countBehaviorsByCategory(studentProfileId, condition.category || 'positive', badgeCreatedAt);
          break;
        case 'ANY_BEHAVIOR':
          currentValue = await this.countAllBehaviors(studentProfileId, badgeCreatedAt);
          break;
      }
      
      if (targetValue > 0) {
        progress.push({
          badge,
          currentValue,
          targetValue,
          percentage: Math.min(100, Math.round((currentValue / targetValue) * 100)),
        });
      }
    }
    
    // Ordenar por porcentaje descendente
    return progress.sort((a, b) => b.percentage - a.percentage);
  }
}

export const badgeService = new BadgeService();
