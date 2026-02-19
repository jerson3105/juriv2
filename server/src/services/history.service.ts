import { db } from '../db/index.js';
import { 
  pointLogs, 
  studentProfiles, 
  classrooms,
  behaviors,
  purchases,
  shopItems,
  itemUsages,
  studentBadges,
  badges,
  attendanceRecords,
} from '../db/schema.js';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';

export interface ActivityLogEntry {
  id: string;
  type: 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'LEVEL_UP' | 'BADGE' | 'ATTENDANCE';
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
    // Asistencia
    attendanceStatus?: string;
    attendanceDate?: string;
  };
}

type HistoryFilterType = 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'BADGE' | 'ATTENDANCE' | 'ALL';

interface HistoryQueryOptions {
  limit?: number;
  offset?: number;
  type?: HistoryFilterType;
  studentId?: string;
}

const VALID_HISTORY_FILTERS: ReadonlySet<HistoryFilterType> = new Set([
  'POINTS',
  'PURCHASE',
  'ITEM_USED',
  'BADGE',
  'ATTENDANCE',
  'ALL',
]);

const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 200;
const MAX_HISTORY_OFFSET = 1_000;
const MAX_HISTORY_FETCH_WINDOW = 1_000;
const POINTS_FETCH_MULTIPLIER = 3;
const SECONDARY_FETCH_MULTIPLIER = 2;

class HistoryService {
  private normalizeHistoryOptions(options?: HistoryQueryOptions): {
    limit: number;
    offset: number;
    type: HistoryFilterType;
    studentId?: string;
  } {
    const parsedLimit = Number(options?.limit);
    const parsedOffset = Number(options?.offset);

    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.trunc(parsedLimit)
      : DEFAULT_HISTORY_LIMIT;
    const safeOffset = Number.isFinite(parsedOffset) ? Math.trunc(parsedOffset) : 0;

    const type = options?.type && VALID_HISTORY_FILTERS.has(options.type)
      ? options.type
      : 'ALL';

    const normalizedStudentId = typeof options?.studentId === 'string' && options.studentId.trim()
      ? options.studentId.trim()
      : undefined;

    return {
      limit: Math.min(Math.max(safeLimit, 1), MAX_HISTORY_LIMIT),
      offset: Math.min(Math.max(safeOffset, 0), MAX_HISTORY_OFFSET),
      type,
      studentId: normalizedStudentId,
    };
  }

  private getFetchWindow(limit: number, offset: number): number {
    return Math.min(limit + offset, MAX_HISTORY_FETCH_WINDOW);
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const classroom = await db.query.classrooms.findFirst({
      where: and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)),
      columns: { id: true },
    });

    return Boolean(classroom);
  }

  async verifyStudentBelongsToClassroom(studentId: string, classroomId: string): Promise<boolean> {
    const student = await db.query.studentProfiles.findFirst({
      where: and(eq(studentProfiles.id, studentId), eq(studentProfiles.classroomId, classroomId)),
      columns: { id: true },
    });

    return Boolean(student);
  }

  /**
   * Obtener historial completo de una clase
   */
  async getClassroomHistory(
    classroomId: string,
    options?: HistoryQueryOptions
  ): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    const { limit, offset, type: filterType, studentId } = this.normalizeHistoryOptions(options);
    const fetchWindow = this.getFetchWindow(limit, offset);
    const pointsFetchLimit = Math.min(fetchWindow * POINTS_FETCH_MULTIPLIER, MAX_HISTORY_FETCH_WINDOW * 3);
    const secondaryFetchLimit = Math.min(fetchWindow * SECONDARY_FETCH_MULTIPLIER, MAX_HISTORY_FETCH_WINDOW * 2);

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

    if (studentId && !studentMap.has(studentId)) {
      throw new Error('Sin acceso al estudiante seleccionado');
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
          studentId
            ? eq(pointLogs.studentId, studentId)
            : inArray(pointLogs.studentId, studentIds)
        )
        .orderBy(desc(pointLogs.createdAt))
        .limit(pointsFetchLimit); // Obtener más para agrupar

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
        // Crear clave única: behaviorId (o reason si no hay behavior) + studentId + timestamp al segundo
        const timestampKey = new Date(log.createdAt).toISOString().slice(0, 19);
        const groupKey = log.behaviorId 
          ? `${log.behaviorId}-${log.studentId}-${timestampKey}`
          : log.reason 
            ? `reason-${log.reason}-${log.studentId}-${timestampKey}` // Agrupar por reason (ej: expediciones)
            : `manual-${log.id}`; // Logs sin reason ni behavior no se agrupan

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
          studentId
            ? eq(purchases.studentId, studentId)
            : inArray(purchases.studentId, studentIds)
        )
        .orderBy(desc(purchases.purchasedAt))
        .limit(secondaryFetchLimit);

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
          studentId
            ? and(
              eq(itemUsages.studentId, studentId),
              eq(itemUsages.classroomId, classroomId)
            )
            : eq(itemUsages.classroomId, classroomId)
        )
        .orderBy(desc(itemUsages.usedAt))
        .limit(secondaryFetchLimit);

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
          studentId
            ? eq(studentBadges.studentProfileId, studentId)
            : inArray(studentBadges.studentProfileId, studentIds)
        )
        .orderBy(desc(studentBadges.unlockedAt))
        .limit(secondaryFetchLimit);

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

    // 5. Obtener registros de asistencia
    if (filterType === 'ALL' || filterType === 'ATTENDANCE') {
      const attendanceData = await db
        .select({
          id: attendanceRecords.id,
          studentId: attendanceRecords.studentProfileId,
          date: attendanceRecords.date,
          status: attendanceRecords.status,
          xpAwarded: attendanceRecords.xpAwarded,
          createdAt: attendanceRecords.createdAt,
        })
        .from(attendanceRecords)
        .where(
          studentId
            ? and(
              eq(attendanceRecords.studentProfileId, studentId),
              eq(attendanceRecords.classroomId, classroomId)
            )
            : eq(attendanceRecords.classroomId, classroomId)
        )
        .orderBy(desc(attendanceRecords.createdAt))
        .limit(secondaryFetchLimit);

      for (const att of attendanceData) {
        const student = studentMap.get(att.studentId);
        logs.push({
          id: att.id,
          type: 'ATTENDANCE',
          timestamp: att.createdAt,
          studentId: att.studentId,
          studentName: student?.characterName || null,
          studentClass: student?.characterClass || 'GUARDIAN',
          details: {
            attendanceStatus: att.status,
            attendanceDate: new Date(att.date).toISOString().split('T')[0],
            amount: att.xpAwarded || 0,
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
    topPositiveBehaviors: { name: string; icon: string | null; count: number }[];
    topNegativeBehaviors: { name: string; icon: string | null; count: number }[];
  }> {
    // Obtener TODOS los estudiantes de la clase para cálculos globales
    const allStudents = await db
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, classroomId));

    const allStudentIds = allStudents.map((s: { id: string }) => s.id);

    if (allStudentIds.length === 0) {
      return {
        totalXpGiven: 0,
        totalXpRemoved: 0,
        totalPurchases: 0,
        totalItemsUsed: 0,
        topStudents: [],
        topPositiveBehaviors: [],
        topNegativeBehaviors: [],
      };
    }

    // Top 5 estudiantes para el leaderboard
    const topStudentsData = await db
      .select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        xp: studentProfiles.xp,
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.classroomId, classroomId))
      .orderBy(desc(studentProfiles.xp))
      .limit(5);

    // Calcular XP dado/quitado usando TODOS los estudiantes
    const xpLogs = await db
      .select({
        action: pointLogs.action,
        total: sql<number>`SUM(${pointLogs.amount})`,
      })
      .from(pointLogs)
      .where(
        and(
          inArray(pointLogs.studentId, allStudentIds),
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
      .where(inArray(purchases.studentId, allStudentIds));

    // Contar items usados
    const [usageCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(itemUsages)
      .where(eq(itemUsages.classroomId, classroomId));

    // Top comportamientos positivos y negativos
    const behaviorCounts = await db
      .select({
        behaviorId: pointLogs.behaviorId,
        name: behaviors.name,
        icon: behaviors.icon,
        isPositive: behaviors.isPositive,
        count: sql<number>`COUNT(DISTINCT CONCAT(${pointLogs.studentId}, '-', DATE_FORMAT(${pointLogs.createdAt}, '%Y-%m-%d %H:%i:%s')))`,
      })
      .from(pointLogs)
      .innerJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id))
      .where(
        inArray(pointLogs.studentId, allStudentIds)
      )
      .groupBy(pointLogs.behaviorId, behaviors.name, behaviors.icon, behaviors.isPositive)
      .orderBy(sql`5 DESC`)
      .limit(20);

    const topPositiveBehaviors = behaviorCounts
      .filter(b => b.isPositive)
      .slice(0, 5)
      .map(b => ({ name: b.name, icon: b.icon, count: Number(b.count) }));

    const topNegativeBehaviors = behaviorCounts
      .filter(b => !b.isPositive)
      .slice(0, 5)
      .map(b => ({ name: b.name, icon: b.icon, count: Number(b.count) }));

    return {
      totalXpGiven: Number(xpGiven),
      totalXpRemoved: Number(xpRemoved),
      totalPurchases: Number(purchaseCount?.count || 0),
      totalItemsUsed: Number(usageCount?.count || 0),
      topStudents: topStudentsData.map((s: { id: string; characterName: string | null; xp: number }) => ({
        id: s.id,
        name: s.characterName || 'Sin nombre',
        xp: s.xp,
      })),
      topPositiveBehaviors,
      topNegativeBehaviors,
    };
  }
}

export const historyService = new HistoryService();
