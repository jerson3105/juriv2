import { and, asc, eq, gt, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { badges, levelUpLogs, studentBadges, studentProfiles } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { classroomIsArchived } from '../utils/access.js';

/**
 * Celebraciones del alumno: lo que pasó desde su última visita (subidas de nivel e insignias),
 * leído de los registros y no del texto de las notificaciones. `celebratedAt` marca hasta dónde
 * ya lo vio; null = primera vez (se fija sin celebrar lo antiguo).
 */
class CelebrationService {
  private async ownProfile(profileId: string, userId: string) {
    const [profile] = await db
      .select({ id: studentProfiles.id, userId: studentProfiles.userId, level: studentProfiles.level, celebratedAt: studentProfiles.celebratedAt, classroomId: studentProfiles.classroomId })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, profileId));
    if (!profile || profile.userId !== userId || (await classroomIsArchived(profile.classroomId))) throw new NotFoundError('Perfil no encontrado');
    return profile;
  }

  async getPending(profileId: string, userId: string) {
    const profile = await this.ownProfile(profileId, userId);
    // Corte en segundos completos y un segundo atrás: DATETIME guarda sin milisegundos (redondea),
    // así lo creado en el mismo segundo entra en la próxima consulta y nada se celebra dos veces ni se pierde.
    const until = new Date(Math.floor(Date.now() / 1000) * 1000 - 1000);
    const empty = { fromLevel: null as number | null, toLevel: null as number | null, badges: [] as Array<Record<string, unknown>>, until: until.toISOString() };
    if (!profile.celebratedAt) {
      await db.update(studentProfiles).set({ celebratedAt: until }).where(eq(studentProfiles.id, profileId));
      return empty;
    }

    const [levelRows, badgeRows] = await Promise.all([
      db.select({ fromLevel: levelUpLogs.fromLevel, toLevel: levelUpLogs.toLevel })
        .from(levelUpLogs)
        .where(and(
          eq(levelUpLogs.studentProfileId, profileId),
          eq(levelUpLogs.isReverted, false),
          gt(levelUpLogs.createdAt, profile.celebratedAt),
          lte(levelUpLogs.createdAt, until),
        ))
        .orderBy(asc(levelUpLogs.createdAt)),
      // El motivo y de quién vino: el modal del profe promete que el motivo «lo verá el estudiante».
      db.select({
        id: badges.id, name: badges.name, description: badges.description, icon: badges.icon,
        customImage: badges.customImage, rarity: badges.rarity, unlockedAt: studentBadges.unlockedAt,
        reason: studentBadges.awardReason, fromTeacher: sql<number>`${studentBadges.awardedBy} IS NOT NULL`,
      })
        .from(studentBadges)
        .innerJoin(badges, eq(badges.id, studentBadges.badgeId))
        .where(and(
          eq(studentBadges.studentProfileId, profileId),
          gt(studentBadges.unlockedAt, profile.celebratedAt),
          lte(studentBadges.unlockedAt, until),
        ))
        .orderBy(asc(studentBadges.unlockedAt)),
    ]);

    // Una sola celebración: del nivel más bajo al más alto (sin pasar del nivel actual).
    const fromLevel = levelRows.length ? Math.min(...levelRows.map((r) => r.fromLevel)) : null;
    const toLevel = levelRows.length ? Math.min(profile.level, Math.max(...levelRows.map((r) => r.toLevel))) : null;
    return {
      fromLevel: fromLevel !== null && toLevel !== null && toLevel > fromLevel ? fromLevel : null,
      toLevel: fromLevel !== null && toLevel !== null && toLevel > fromLevel ? toLevel : null,
      badges: badgeRows,
      until: until.toISOString(),
    };
  }

  /** Marca como visto hasta `until` (el instante devuelto por getPending), nunca hacia atrás. */
  async markSeen(profileId: string, userId: string, until: Date) {
    await this.ownProfile(profileId, userId);
    const at = until.getTime() > Date.now() ? new Date() : until;
    await db.update(studentProfiles)
      .set({ celebratedAt: at })
      .where(and(eq(studentProfiles.id, profileId), or(isNull(studentProfiles.celebratedAt), lt(studentProfiles.celebratedAt, at))));
  }
}

export const celebrationService = new CelebrationService();
