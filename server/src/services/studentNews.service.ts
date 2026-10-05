import { and, asc, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core';
import { db } from '../db/index.js';
import { badges, classrooms, levelUpLogs, notifications, pointLogs, studentBadges, studentProfiles } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { emitUnreadCount } from '../utils/notificationEmitter.js';
import { isBadgeReward, isSelfSpend } from '../utils/pointReasons.js';

type PointType = 'XP' | 'HP' | 'GP';

export interface NewsLine {
  pointType: PointType;
  amount: number;
  count: number;
  /** null si la clase no muestra motivos al alumno. */
  reason: string | null;
}

// Lo que el alumno gastó por su cuenta no es una novedad (lo decidió él) y la recompensa de una insignia
// va en la línea de la insignia, no repetida como motivo (isSelfSpend / isBadgeReward).
// Notificaciones que "Lo nuevo" ya le mostró al alumno.
const NEWS_NOTIFICATION_TYPES = ['POINTS', 'BADGE', 'LEVEL_UP'] as const;
const MAX_LINES = 30;

/**
 * "Lo nuevo desde tu última visita" del inicio del alumno, por perfil (clase), leído de los
 * registros y no del texto de las notificaciones (que no traen clase ni cantidades).
 * Tiene su propio corte (`homeSeenAt`): la celebración al entrar no lo consume.
 */
class StudentNewsService {
  private async ownProfile(profileId: string, userId: string) {
    const [row] = await db
      .select({
        id: studentProfiles.id,
        userId: studentProfiles.userId,
        classroomId: studentProfiles.classroomId,
        level: studentProfiles.level,
        homeSeenAt: studentProfiles.homeSeenAt,
        showReason: classrooms.showReasonToStudent,
        classActive: classrooms.isActive,
      })
      .from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(eq(studentProfiles.id, profileId));
    if (!row || row.userId !== userId || !row.classActive) throw new NotFoundError('Perfil no encontrado');
    return row;
  }

  async getNews(profileId: string, userId: string) {
    const profile = await this.ownProfile(profileId, userId);
    // Corte en segundos completos y un segundo atrás (DATETIME redondea): lo del mismo segundo entra la próxima vez.
    const until = new Date(Math.floor(Date.now() / 1000) * 1000 - 1000);
    const since = profile.homeSeenAt;
    const inWindow = (column: AnyMySqlColumn) => (since ? and(gt(column, since), lte(column, until)) : lte(column, until));

    const [groups, levelRows, badgeRows, earned] = await Promise.all([
      db.select({
        pointType: pointLogs.pointType,
        action: pointLogs.action,
        reason: pointLogs.reason,
        amount: sql<string>`SUM(${pointLogs.amount})`,
        count: sql<string>`COUNT(*)`,
      })
        .from(pointLogs)
        .where(and(eq(pointLogs.studentId, profileId), eq(pointLogs.isReverted, false), inWindow(pointLogs.createdAt)))
        .groupBy(pointLogs.pointType, pointLogs.action, pointLogs.reason),
      db.select({ fromLevel: levelUpLogs.fromLevel, toLevel: levelUpLogs.toLevel })
        .from(levelUpLogs)
        .where(and(eq(levelUpLogs.studentProfileId, profileId), eq(levelUpLogs.isReverted, false), inWindow(levelUpLogs.createdAt))),
      db.select({
        id: badges.id, name: badges.name, icon: badges.icon, customImage: badges.customImage,
        rewardXp: badges.rewardXp, rewardGp: badges.rewardGp,
      })
        .from(studentBadges)
        .innerJoin(badges, eq(badges.id, studentBadges.badgeId))
        .where(and(eq(studentBadges.studentProfileId, profileId), inWindow(studentBadges.unlockedAt)))
        .orderBy(asc(studentBadges.unlockedAt))
        .limit(20),
      // ¿Alguna vez ganó XP? (Primeros pasos: "Gana tus primeros XP en clase")
      db.select({ one: sql<number>`1` })
        .from(pointLogs)
        .where(and(eq(pointLogs.studentId, profileId), eq(pointLogs.pointType, 'XP'), eq(pointLogs.action, 'ADD'), eq(pointLogs.isReverted, false)))
        .limit(1),
    ]);

    // Sin motivos visibles se agrupa solo por tipo (la clase decidió no mostrarlos).
    const gains = new Map<string, NewsLine>();
    const losses = new Map<string, NewsLine>();
    let xp = 0;
    let gp = 0;
    for (const group of groups) {
      const amount = Number(group.amount) || 0;
      const count = Number(group.count) || 0;
      if (amount <= 0) continue;
      const reason = profile.showReason ? group.reason : null;
      const key = `${group.pointType}|${reason ?? ''}`;
      if (group.action === 'ADD') {
        if (group.pointType === 'XP') xp += amount;
        if (group.pointType === 'GP') gp += amount;
        if (isBadgeReward(group.reason)) continue;
        const line = gains.get(key) ?? { pointType: group.pointType, amount: 0, count: 0, reason };
        gains.set(key, { ...line, amount: line.amount + amount, count: line.count + count });
      } else {
        if (group.pointType === 'GP' && isSelfSpend(group.reason)) continue;
        const line = losses.get(key) ?? { pointType: group.pointType, amount: 0, count: 0, reason };
        losses.set(key, { ...line, amount: line.amount + amount, count: line.count + count });
      }
    }
    const byAmount = (a: NewsLine, b: NewsLine) => b.amount - a.amount;

    // Una sola subida: del nivel más bajo al más alto (sin pasar del nivel actual).
    const fromLevel = levelRows.length ? Math.min(...levelRows.map((r) => r.fromLevel)) : null;
    const toLevel = levelRows.length ? Math.min(profile.level, Math.max(...levelRows.map((r) => r.toLevel))) : null;

    return {
      since: since ? since.toISOString() : null,
      until: until.toISOString(),
      everEarned: earned.length > 0,
      totals: { xp, gp },
      gains: [...gains.values()].sort(byAmount).slice(0, MAX_LINES),
      losses: [...losses.values()].sort(byAmount).slice(0, MAX_LINES),
      badges: badgeRows,
      level: fromLevel !== null && toLevel !== null && toLevel > fromLevel ? { from: fromLevel, to: toLevel } : null,
    };
  }

  /**
   * Visto hasta `until` (el instante que devolvió getNews), nunca hacia atrás. Marca como leídas
   * las notificaciones de puntos, insignias y niveles hasta ese instante (las de esta clase y las
   * que no dicen de qué clase son), y actualiza el globo de la campana.
   */
  async markSeen(profileId: string, userId: string, until: Date) {
    const profile = await this.ownProfile(profileId, userId);
    const at = until.getTime() > Date.now() ? new Date() : until;
    await db.update(studentProfiles)
      .set({ homeSeenAt: at })
      .where(and(eq(studentProfiles.id, profileId), or(isNull(studentProfiles.homeSeenAt), lt(studentProfiles.homeSeenAt, at))));
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        inArray(notifications.type, [...NEWS_NOTIFICATION_TYPES]),
        lte(notifications.createdAt, at),
        or(isNull(notifications.classroomId), eq(notifications.classroomId, profile.classroomId)),
      ));
    await emitUnreadCount(userId);
  }
}

export const studentNewsService = new StudentNewsService();
