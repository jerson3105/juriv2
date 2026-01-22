import { db } from '../db/index.js';
import { 
  pointLogs, 
  studentProfiles, 
  behaviors,
  purchases,
  shopItems,
  itemUsages,
  studentBadges,
  badges,
} from '../db/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

export interface ActivityLogEntry {
  id: string;
  type: 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'LEVEL_UP' | 'BADGE';
  timestamp: Date;
  studentId: string;
  studentName: string | null;
  studentClass: string;
  details: {
    pointType?: string;
    action?: string;
    amount?: number;
    reason?: string;
    itemName?: string;
    itemIcon?: string;
    totalPrice?: number;
    newLevel?: number;
    badgeName?: string;
    badgeIcon?: string;
    // Puntos combinados (cuando un comportamiento tiene XP+HP+GP)
    xpAmount?: number;
    hpAmount?: number;
    gpAmount?: number;
  };
}

class HistoryService {
  /**
   * Obtener historial completo de una clase
   */
  async getClassroomHistory(classroomId: string, options?: {
    limit?: number;
    offset?: number;
    type?: 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'BADGE' | 'ALL';
    studentId?: string;
    startDate?: Date;
  }): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const filterType = options?.type || 'ALL';

    // Obtener estudiantes de la clase
    const students = await db
      .select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        characterClass: studentProfiles.characterClass,
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, classroomId));

    const studentIds = students.map((s: { id: string }) => s.id);
    const studentMap = new Map(students.map((s: { id: string; characterName: string | null; characterClass: string }) => [s.id, s]));

    if (studentIds.length === 0) {
      return { logs: [], total: 0 };
    }

    const logs: ActivityLogEntry[] = [];

    // 1. Obtener logs de puntos
    if (filterType === 'ALL' || filterType === 'POINTS') {
      const pointLogsData = await db
        .select({
          id: pointLogs.id,
          studentId: pointLogs.studentId,
          behaviorId: pointLogs.behaviorId,
          pointType: pointLogs.pointType,
          action: pointLogs.action,
          amount: pointLogs.amount,
          reason: pointLogs.reason,
          createdAt: pointLogs.createdAt,
          behaviorName: behaviors.name,
        })
        .from(pointLogs)
        .leftJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id))
        .where(
          options?.studentId 
            ? eq(pointLogs.studentId, options.studentId)
            : sql`${pointLogs.studentId} IN (${sql.join(studentIds.map((id: string) => sql`${id}`), sql`, `)})`
        )
        .orderBy(desc(pointLogs.createdAt))
        .limit(limit * 3); // Obtener más para agrupar

      // Agrupar logs del mismo comportamiento aplicado al mismo estudiante en el mismo momento
      // Un comportamiento con XP+HP+GP genera 3 logs, pero deben mostrarse como 1 entrada
      const groupedLogs = new Map<string, {
        id: string;
        studentId: string;
        createdAt: Date;
        action: string;
        reason: string | null;
        behaviorName: string | null;
        xpAmount: number;
        hpAmount: number;
        gpAmount: number;
      }>();

      for (const log of pointLogsData) {
        // Crear clave única: behaviorId (o visibleId si no hay behavior) + studentId + timestamp al segundo
        const timestampKey = new Date(log.createdAt).toISOString().slice(0, 19);
        const groupKey = log.behaviorId 
          ? `${log.behaviorId}-${log.studentId}-${timestampKey}`
          : `manual-${log.id}`; // Logs manuales no se agrupan

        const existing = groupedLogs.get(groupKey);
        if (existing) {
          // Agregar al grupo existente
          if (log.pointType === 'XP') existing.xpAmount = log.amount;
          else if (log.pointType === 'HP') existing.hpAmount = log.amount;
          else if (log.pointType === 'GP') existing.gpAmount = log.amount;
        } else {
          // Crear nuevo grupo
          groupedLogs.set(groupKey, {
            id: log.id,
            studentId: log.studentId,
            createdAt: log.createdAt,
            action: log.action,
            reason: log.reason,
            behaviorName: log.behaviorName,
            xpAmount: log.pointType === 'XP' ? log.amount : 0,
            hpAmount: log.pointType === 'HP' ? log.amount : 0,
            gpAmount: log.pointType === 'GP' ? log.amount : 0,
          });
        }
      }

      // Convertir grupos a entradas de log
      for (const [, group] of groupedLogs) {
        const student = studentMap.get(group.studentId);
        
        // Construir descripción de puntos combinados
        const pointParts: string[] = [];
        if (group.xpAmount > 0) pointParts.push(`${group.xpAmount} XP`);
        if (group.hpAmount > 0) pointParts.push(`${group.hpAmount} HP`);
        if (group.gpAmount > 0) pointParts.push(`${group.gpAmount} GP`);
        
        // Si solo hay un tipo de punto, usar formato simple
        const isSingleType = pointParts.length === 1;
        const primaryType = group.xpAmount > 0 ? 'XP' : group.hpAmount > 0 ? 'HP' : 'GP';
        const primaryAmount = group.xpAmount || group.hpAmount || group.gpAmount;

        logs.push({
          id: group.id,
          type: 'POINTS',
          timestamp: group.createdAt,
          studentId: group.studentId,
          studentName: student?.characterName || null,
          studentClass: student?.characterClass || 'GUARDIAN',
          details: {
            pointType: isSingleType ? primaryType : 'MIXED',
            action: group.action,
            amount: isSingleType ? primaryAmount : 0,
            reason: group.reason || group.behaviorName || undefined,
            // Campos adicionales para puntos combinados
            xpAmount: group.xpAmount > 0 ? group.xpAmount : undefined,
            hpAmount: group.hpAmount > 0 ? group.hpAmount : undefined,
            gpAmount: group.gpAmount > 0 ? group.gpAmount : undefined,
          } as ActivityLogEntry['details'],
        });
      }
    }

    // 2. Obtener compras
    if (filterType === 'ALL' || filterType === 'PURCHASE') {
      const purchasesData = await db
        .select({
          id: purchases.id,
          studentId: purchases.studentId,
          purchasedAt: purchases.purchasedAt,
          quantity: purchases.quantity,
          totalPrice: purchases.totalPrice,
          purchaseType: purchases.purchaseType,
          itemName: shopItems.name,
          itemIcon: shopItems.icon,
        })
        .from(purchases)
        .innerJoin(shopItems, eq(purchases.itemId, shopItems.id))
        .where(
          options?.studentId 
            ? eq(purchases.studentId, options.studentId)
            : sql`${purchases.studentId} IN (${sql.join(studentIds.map((id: string) => sql`${id}`), sql`, `)})`
        )
        .orderBy(desc(purchases.purchasedAt))
        .limit(limit * 2);

      for (const purchase of purchasesData) {
        const student = studentMap.get(purchase.studentId);
        logs.push({
          id: purchase.id,
          type: 'PURCHASE',
          timestamp: purchase.purchasedAt,
          studentId: purchase.studentId,
          studentName: student?.characterName || null,
          studentClass: student?.characterClass || 'GUARDIAN',
          details: {
            itemName: purchase.itemName,
            itemIcon: purchase.itemIcon || undefined,
            amount: purchase.quantity,
            totalPrice: purchase.totalPrice,
          },
        });
      }
    }

    // 3. Obtener usos de items
    if (filterType === 'ALL' || filterType === 'ITEM_USED') {
      const usagesData = await db
        .select({
          id: itemUsages.id,
          studentId: itemUsages.studentId,
          usedAt: itemUsages.usedAt,
          status: itemUsages.status,
          itemName: shopItems.name,
          itemIcon: shopItems.icon,
        })
        .from(itemUsages)
        .innerJoin(shopItems, eq(itemUsages.itemId, shopItems.id))
        .where(
          options?.studentId 
            ? eq(itemUsages.studentId, options.studentId)
            : eq(itemUsages.classroomId, classroomId)
        )
        .orderBy(desc(itemUsages.usedAt))
        .limit(limit * 2);

      for (const usage of usagesData) {
        const student = studentMap.get(usage.studentId);
        logs.push({
          id: usage.id,
          type: 'ITEM_USED',
          timestamp: usage.usedAt,
          studentId: usage.studentId,
          studentName: student?.characterName || null,
          studentClass: student?.characterClass || 'GUARDIAN',
          details: {
            itemName: usage.itemName,
            itemIcon: usage.itemIcon || undefined,
            action: usage.status,
          },
        });
      }
    }

    // 4. Obtener insignias otorgadas
    if (filterType === 'ALL' || filterType === 'BADGE') {
      const badgesData = await db
        .select({
          id: studentBadges.id,
          studentId: studentBadges.studentProfileId,
          unlockedAt: studentBadges.unlockedAt,
          badgeName: badges.name,
          badgeIcon: badges.icon,
        })
        .from(studentBadges)
        .innerJoin(badges, eq(studentBadges.badgeId, badges.id))
        .where(
          options?.studentId 
            ? eq(studentBadges.studentProfileId, options.studentId)
            : sql`${studentBadges.studentProfileId} IN (${sql.join(studentIds.map((id: string) => sql`${id}`), sql`, `)})`
        )
        .orderBy(desc(studentBadges.unlockedAt))
        .limit(limit * 2);

      for (const badge of badgesData) {
        const student = studentMap.get(badge.studentId);
        logs.push({
          id: badge.id,
          type: 'BADGE',
          timestamp: badge.unlockedAt,
          studentId: badge.studentId,
          studentName: student?.characterName || null,
          studentClass: student?.characterClass || 'GUARDIAN',
          details: {
            badgeName: badge.badgeName,
            badgeIcon: badge.badgeIcon || undefined,
          },
        });
      }
    }

    // Ordenar por fecha y paginar
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const total = logs.length;
    const paginatedLogs = logs.slice(offset, offset + limit);

    return { logs: paginatedLogs, total };
  }

  /**
   * Obtener resumen de estadísticas de la clase
   */
  async getClassroomStats(classroomId: string): Promise<{
    totalXpGiven: number;
    totalXpRemoved: number;
    totalPurchases: number;
    totalItemsUsed: number;
    topStudents: { id: string; name: string; xp: number }[];
  }> {
    // Obtener estudiantes
    const studentsData = await db
      .select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        xp: studentProfiles.xp,
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, classroomId))
      .orderBy(desc(studentProfiles.xp))
      .limit(5);

    const studentIds = studentsData.map((s: { id: string }) => s.id);

    if (studentIds.length === 0) {
      return {
        totalXpGiven: 0,
        totalXpRemoved: 0,
        totalPurchases: 0,
        totalItemsUsed: 0,
        topStudents: [],
      };
    }

    // Calcular XP dado/quitado
    const xpLogs = await db
      .select({
        id: pointLogs.id,
        action: pointLogs.action,
        total: sql<number>`SUM(${pointLogs.amount})`,
      })
      .from(pointLogs)
      .where(
        and(
          sql`${pointLogs.studentId} IN (${sql.join(studentIds.map((id: string) => sql`${id}`), sql`, `)})`,
          eq(pointLogs.pointType, 'XP')
        )
      )
      .groupBy(pointLogs.action);

    const xpGiven = xpLogs.find((l: { action: string; total: number }) => l.action === 'ADD')?.total || 0;
    const xpRemoved = xpLogs.find((l: { action: string; total: number }) => l.action === 'REMOVE')?.total || 0;

    // Contar compras
    const [purchaseCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchases)
      .where(sql`${purchases.studentId} IN (${sql.join(studentIds.map((id: string) => sql`${id}`), sql`, `)})`);

    // Contar items usados
    const [usageCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(itemUsages)
      .where(eq(itemUsages.classroomId, classroomId));

    return {
      totalXpGiven: Number(xpGiven),
      totalXpRemoved: Number(xpRemoved),
      totalPurchases: Number(purchaseCount?.count || 0),
      totalItemsUsed: Number(usageCount?.count || 0),
      topStudents: studentsData.map((s: { id: string; characterName: string | null; xp: number }) => ({
        id: s.id,
        name: s.characterName || 'Sin nombre',
        xp: s.xp,
      })),
    };
  }
}

export const historyService = new HistoryService();
