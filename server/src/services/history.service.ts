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
import { v4 as uuidv4 } from 'uuid';

export interface ActivityLogEntry {
  id: string;
  type: 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'LEVEL_UP' | 'BADGE' | 'ATTENDANCE';
  timestamp: Date;
  studentId: string;
  studentName: string | null;
  studentClass: string;
  isReverted?: boolean;
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
          isReverted: pointLogs.isReverted,
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
        isReverted: boolean;
        xpAmount: number;
        hpAmount: number;
        gpAmount: number;
      }>();

      for (const log of pointLogsData) {
        // No mostrar logs inversos de revertidos (los que empiezan con ⟲)
        if (log.reason?.startsWith('⟲')) continue;

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
            isReverted: log.isReverted ?? false,
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
          isReverted: group.isReverted,
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
          isReverted: attendanceRecords.isReverted,
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
          isReverted: att.isReverted ?? false,
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

  /**
   * Revertir una entrada de puntos (crea log inverso + marca como revertido + ajusta perfil)
   */
  async revertPointLog(pointLogId: string, teacherId: string): Promise<{ message: string }> {
    const [log] = await db.select().from(pointLogs).where(eq(pointLogs.id, pointLogId));
    if (!log) throw new Error('Registro de puntos no encontrado');
    if (log.isReverted) throw new Error('Este registro ya fue revertido');

    // Verificar que el profesor tiene acceso al aula del estudiante
    const [student] = await db.select().from(studentProfiles).where(eq(studentProfiles.id, log.studentId));
    if (!student) throw new Error('Estudiante no encontrado');

    const hasAccess = await this.verifyTeacherOwnsClassroom(teacherId, student.classroomId);
    if (!hasAccess) throw new Error('Sin acceso a este salón');

    const [classroom] = await db.select({ xpPerLevel: classrooms.xpPerLevel }).from(classrooms).where(eq(classrooms.id, student.classroomId));
    const xpPerLevel = classroom?.xpPerLevel || 100;

    const now = new Date();
    const inverseAction = log.action === 'ADD' ? 'REMOVE' : 'ADD';
    const pointDelta = log.action === 'ADD' ? -log.amount : log.amount;

    // Calcular nuevo valor del punto
    const fieldKey = log.pointType.toLowerCase() as 'xp' | 'hp' | 'gp';
    const currentValue = student[fieldKey];
    const newValue = Math.max(0, currentValue + pointDelta);

    // Recalcular nivel si es XP
    const newLevel = log.pointType === 'XP'
      ? Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * newValue) / xpPerLevel)) / 2))
      : student.level;

    await db.transaction(async (tx) => {
      // 1. Marcar log original como revertido
      await tx.update(pointLogs).set({ isReverted: true }).where(eq(pointLogs.id, pointLogId));

      // 2. Crear log inverso (marcado como revertido para que no se pueda re-revertir)
      await tx.insert(pointLogs).values({
        id: uuidv4(),
        studentId: log.studentId,
        behaviorId: log.behaviorId,
        competencyId: log.competencyId,
        pointType: log.pointType,
        action: inverseAction,
        amount: log.amount,
        reason: `⟲ Revertido: ${log.reason || 'Sin razón'}`,
        givenBy: teacherId,
        isReverted: true,
        createdAt: now,
      });

      // 3. Actualizar perfil del estudiante
      const updateData: Record<string, unknown> = { updatedAt: now };
      updateData[fieldKey] = newValue;
      if (log.pointType === 'XP') {
        updateData.level = newLevel;
      }
      await tx.update(studentProfiles).set(updateData).where(eq(studentProfiles.id, log.studentId));
    });

    const sign = log.action === 'ADD' ? '-' : '+';
    return { message: `Revertido: ${sign}${log.amount} ${log.pointType}` };
  }

  /**
   * Revertir una insignia (elimina student_badge + revierte XP/GP de recompensa)
   */
  async revertBadge(studentBadgeId: string, teacherId: string): Promise<{ message: string }> {
    const [sb] = await db.select().from(studentBadges).where(eq(studentBadges.id, studentBadgeId));
    if (!sb) throw new Error('Registro de insignia no encontrado');

    const [student] = await db.select().from(studentProfiles).where(eq(studentProfiles.id, sb.studentProfileId));
    if (!student) throw new Error('Estudiante no encontrado');

    const hasAccess = await this.verifyTeacherOwnsClassroom(teacherId, student.classroomId);
    if (!hasAccess) throw new Error('Sin acceso a este salón');

    const [badge] = await db.select().from(badges).where(eq(badges.id, sb.badgeId));
    const badgeName = badge?.name || 'Insignia';
    const rewardXp = badge?.rewardXp || 0;
    const rewardGp = badge?.rewardGp || 0;

    const [classroom] = await db.select({ xpPerLevel: classrooms.xpPerLevel }).from(classrooms).where(eq(classrooms.id, student.classroomId));
    const xpPerLevel = classroom?.xpPerLevel || 100;

    const now = new Date();

    await db.transaction(async (tx) => {
      // 1. Eliminar el registro de student_badges
      await tx.delete(studentBadges).where(eq(studentBadges.id, studentBadgeId));

      // 2. Si la insignia tenía recompensas, revertirlas
      if (rewardXp > 0 || rewardGp > 0) {
        const newXp = Math.max(0, student.xp - rewardXp);
        const newGp = Math.max(0, student.gp - rewardGp);
        const newLevel = rewardXp > 0
          ? Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * newXp) / xpPerLevel)) / 2))
          : student.level;

        await tx.update(studentProfiles).set({
          xp: newXp,
          gp: newGp,
          level: newLevel,
          updatedAt: now,
        }).where(eq(studentProfiles.id, student.id));

        // Marcar los pointLogs de recompensa relacionados como revertidos
        // (los que tienen reason = "Insignia: <name>" y fueron creados alrededor del mismo tiempo)
        const badgeReason = `Insignia: ${badgeName}`;
        const relatedLogs = await tx.select({ id: pointLogs.id }).from(pointLogs).where(and(
          eq(pointLogs.studentId, student.id),
          eq(pointLogs.reason, badgeReason),
          eq(pointLogs.isReverted, false),
        ));
        if (relatedLogs.length > 0) {
          await tx.update(pointLogs).set({ isReverted: true }).where(
            inArray(pointLogs.id, relatedLogs.map(l => l.id))
          );
        }

        // Crear logs inversos para las recompensas
        const inverseLogs: typeof pointLogs.$inferInsert[] = [];
        if (rewardXp > 0) {
          inverseLogs.push({
            id: uuidv4(),
            studentId: student.id,
            pointType: 'XP',
            action: 'REMOVE',
            amount: rewardXp,
            reason: `⟲ Revertido: ${badgeReason}`,
            givenBy: teacherId,
            isReverted: true,
            createdAt: now,
          });
        }
        if (rewardGp > 0) {
          inverseLogs.push({
            id: uuidv4(),
            studentId: student.id,
            pointType: 'GP',
            action: 'REMOVE',
            amount: rewardGp,
            reason: `⟲ Revertido: ${badgeReason}`,
            givenBy: teacherId,
            isReverted: true,
            createdAt: now,
          });
        }
        if (inverseLogs.length > 0) {
          await tx.insert(pointLogs).values(inverseLogs);
        }
      }
    });

    return { message: `Insignia "${badgeName}" revertida` };
  }

  /**
   * Revertir un registro de asistencia (marca como revertido + revierte XP si lo hubo)
   */
  async revertAttendance(attendanceId: string, teacherId: string): Promise<{ message: string }> {
    const [record] = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, attendanceId));
    if (!record) throw new Error('Registro de asistencia no encontrado');
    if (record.isReverted) throw new Error('Este registro ya fue revertido');

    const hasAccess = await this.verifyTeacherOwnsClassroom(teacherId, record.classroomId);
    if (!hasAccess) throw new Error('Sin acceso a este salón');

    const now = new Date();
    const xpToRevert = record.xpAwarded || 0;

    await db.transaction(async (tx) => {
      // 1. Marcar registro como revertido
      await tx.update(attendanceRecords).set({ isReverted: true, updatedAt: now }).where(eq(attendanceRecords.id, attendanceId));

      // 2. Si hubo XP de asistencia, revertirlo
      if (xpToRevert > 0) {
        const [student] = await tx.select().from(studentProfiles).where(eq(studentProfiles.id, record.studentProfileId));
        if (student) {
          const [classroom] = await tx.select({ xpPerLevel: classrooms.xpPerLevel }).from(classrooms).where(eq(classrooms.id, student.classroomId));
          const xpPerLevel = classroom?.xpPerLevel || 100;
          const newXp = Math.max(0, student.xp - xpToRevert);
          const newLevel = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * newXp) / xpPerLevel)) / 2));

          await tx.update(studentProfiles).set({
            xp: newXp,
            level: newLevel,
            updatedAt: now,
          }).where(eq(studentProfiles.id, record.studentProfileId));

          // Marcar pointLog de asistencia relacionado como revertido
          const relatedLogs = await tx.select({ id: pointLogs.id }).from(pointLogs).where(and(
            eq(pointLogs.studentId, record.studentProfileId),
            eq(pointLogs.reason, 'Asistencia'),
            eq(pointLogs.amount, xpToRevert),
            eq(pointLogs.isReverted, false),
          ));
          if (relatedLogs.length > 0) {
            // Marcar solo el más reciente que coincida
            await tx.update(pointLogs).set({ isReverted: true }).where(eq(pointLogs.id, relatedLogs[relatedLogs.length - 1].id));
          }
        }
      }
    });

    const statusLabels: Record<string, string> = {
      PRESENT: 'Presente',
      ABSENT: 'Ausente',
      LATE: 'Tardanza',
      EXCUSED: 'Justificado',
    };

    return { message: `Asistencia "${statusLabels[record.status] || record.status}" revertida` };
  }
}

export const historyService = new HistoryService();
