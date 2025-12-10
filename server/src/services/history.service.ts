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
  battleResults,
  bossBattles,
} from '../db/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

export interface ActivityLogEntry {
  id: string;
  type: 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'LEVEL_UP' | 'BADGE' | 'BOSS_BATTLE';
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
    // Boss Battle
    battleName?: string;
    xpEarned?: number;
    gpEarned?: number;
    damageDealt?: number;
    isVictory?: boolean;
  };
}

class HistoryService {
  /**
   * Obtener historial completo de una clase
   */
  async getClassroomHistory(classroomId: string, options?: {
    limit?: number;
    offset?: number;
    type?: 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'BADGE' | 'BOSS_BATTLE' | 'ALL';
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
        .limit(limit * 2); // Obtener más para combinar

      for (const log of pointLogsData) {
        const student = studentMap.get(log.studentId);
        logs.push({
          id: log.id,
          type: 'POINTS',
          timestamp: log.createdAt,
          studentId: log.studentId,
          studentName: student?.characterName || null,
          studentClass: student?.characterClass || 'GUARDIAN',
          details: {
            pointType: log.pointType,
            action: log.action,
            amount: log.amount,
            reason: log.reason || log.behaviorName || undefined,
          },
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

    // 5. Obtener resultados de Boss Battles
    if (filterType === 'ALL' || filterType === 'BOSS_BATTLE') {
      const battlesData = await db
        .select({
          id: battleResults.id,
          studentId: battleResults.studentId,
          completedAt: battleResults.completedAt,
          xpEarned: battleResults.xpEarned,
          gpEarned: battleResults.gpEarned,
          damageDealt: battleResults.damageDealt,
          battleName: bossBattles.name,
          bossName: bossBattles.bossName,
          battleStatus: bossBattles.status,
        })
        .from(battleResults)
        .innerJoin(bossBattles, eq(battleResults.battleId, bossBattles.id))
        .where(
          options?.studentId 
            ? eq(battleResults.studentId, options.studentId)
            : eq(bossBattles.classroomId, classroomId)
        )
        .orderBy(desc(battleResults.completedAt))
        .limit(limit * 2);

      for (const battle of battlesData) {
        const student = studentMap.get(battle.studentId);
        logs.push({
          id: battle.id,
          type: 'BOSS_BATTLE',
          timestamp: battle.completedAt,
          studentId: battle.studentId,
          studentName: student?.characterName || null,
          studentClass: student?.characterClass || 'GUARDIAN',
          details: {
            battleName: battle.bossName || battle.battleName,
            xpEarned: battle.xpEarned,
            gpEarned: battle.gpEarned,
            damageDealt: battle.damageDealt,
            isVictory: battle.battleStatus === 'VICTORY',
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
