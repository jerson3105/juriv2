import { and, eq, gte, inArray, like, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  badges,
  behaviors,
  classrooms,
  curriculumCompetencies,
  pointLogs,
  purchases,
  studentBadges,
  studentProfiles,
  type Badge,
} from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import {
  conditionBehaviorIds,
  isCompleteCondition,
  isNegativeCondition,
  parseBadgeCondition,
  safeBadgeImage,
  type BadgeConditionShape,
} from '../utils/badgeConditions.js';

export type AwardOrigin = 'TEACHER' | 'AUTO' | 'STORY' | 'ALBUM';
type Unit = 'times' | 'xp' | 'level' | 'purchases';

const secondKey = (date: Date) => new Date(date).toISOString().slice(0, 19);

/**
 * «Mis insignias» del alumno en una carga: lo que ganó (con cada vez, su porqué y lo que le dio), lo que
 * puede ganar y cómo (escrito aquí: el alumno no puede listar comportamientos), el progreso honesto y
 * cuántas secretas hay. Solo el dueño del perfil; otro perfil → 404.
 *
 * Reglas: nunca se promete lo imposible (automáticas sin condición o con condición negativa no se
 * muestran); el progreso no llega al 100 % sin ganarla; las de nivel se miden en XP; las de
 * comportamientos cuentan desde que se creó la insignia, igual que al otorgarlas.
 */
class StudentBadgesService {
  private async loadProfile(profileId: string) {
    const [profile] = await db
      .select({
        id: studentProfiles.id,
        userId: studentProfiles.userId,
        classroomId: studentProfiles.classroomId,
        xp: studentProfiles.xp,
        classroomName: classrooms.name,
        gradeLevel: classrooms.gradeLevel,
        xpPerLevel: classrooms.xpPerLevel,
      })
      .from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(eq(studentProfiles.id, profileId));
    return profile ?? null;
  }

  async getView(profileId: string, userId: string) {
    const profile = await this.loadProfile(profileId);
    if (!profile || profile.userId !== userId) throw new NotFoundError('Perfil no encontrado');
    return this.buildView(profile);
  }

  /**
   * Para la ficha del alumno que ve el profe (la ruta ya comprobó el acceso): las automáticas que aún no
   * gana, con el mismo progreso honesto que ve el alumno, en el formato de antes.
   */
  async getStaffProgress(profileId: string) {
    const profile = await this.loadProfile(profileId);
    if (!profile) throw new NotFoundError('Estudiante no encontrado');
    const view = await this.buildView(profile);
    return view.toEarn
      .filter((badge) => badge.kind !== 'TEACHER' && badge.progress)
      .map((badge) => ({
        badge: { id: badge.id, name: badge.name, icon: badge.icon, customImage: badge.customImage, rarity: badge.rarity },
        currentValue: Math.min(badge.progress!.current, badge.progress!.target),
        targetValue: badge.progress!.target,
        percentage: badge.percent ?? 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  private async buildView(profile: NonNullable<Awaited<ReturnType<StudentBadgesService['loadProfile']>>>) {
    const profileId = profile.id;
    const xpPerLevel = profile.xpPerLevel || 100;

    const [catalog, awards] = await Promise.all([
      db.select().from(badges).where(and(
        eq(badges.isActive, true),
        or(eq(badges.scope, 'SYSTEM'), eq(badges.classroomId, profile.classroomId)),
      )),
      db.select({ award: studentBadges, badge: badges })
        .from(studentBadges)
        .innerJoin(badges, eq(badges.id, studentBadges.badgeId))
        .where(eq(studentBadges.studentProfileId, profileId)),
    ]);

    // Condiciones leídas una vez; comportamientos citados (nombre y si es positivo).
    const conditionOf = new Map<string, BadgeConditionShape | null>();
    for (const badge of [...catalog, ...awards.map((row) => row.badge)]) {
      if (!conditionOf.has(badge.id)) conditionOf.set(badge.id, parseBadgeCondition(badge.unlockCondition));
    }
    const behaviorIds = [...new Set([...conditionOf.values()].flatMap(conditionBehaviorIds))];
    const competencyIds = [...new Set([...catalog, ...awards.map((row) => row.badge)].map((badge) => badge.competencyId).filter((id): id is string => !!id))];

    const [behaviorRows, competencyRows, rewardLogs] = await Promise.all([
      behaviorIds.length
        ? db.select({ id: behaviors.id, name: behaviors.name, isPositive: behaviors.isPositive }).from(behaviors).where(inArray(behaviors.id, behaviorIds))
        : Promise.resolve([]),
      competencyIds.length
        ? db.select({ id: curriculumCompetencies.id, name: curriculumCompetencies.name }).from(curriculumCompetencies).where(inArray(curriculumCompetencies.id, competencyIds))
        : Promise.resolve([]),
      awards.length
        ? db.select({ pointType: pointLogs.pointType, amount: pointLogs.amount, reason: pointLogs.reason, createdAt: pointLogs.createdAt })
          .from(pointLogs)
          .where(and(eq(pointLogs.studentId, profileId), eq(pointLogs.isReverted, false), eq(pointLogs.action, 'ADD'), like(pointLogs.reason, 'Insignia:%')))
        : Promise.resolve([]),
    ]);
    const behaviorById = new Map(behaviorRows.map((row) => [row.id, row]));
    const competencyById = new Map(competencyRows.map((row) => [row.id, row.name]));
    const isNegativeBehavior = (id: string) => behaviorById.get(id)?.isPositive === false;

    // Lo que dio cada otorgamiento: la recompensa se registra en el mismo instante que la insignia, con
    // el motivo «Insignia: nombre» (así dos insignias del mismo segundo no se mezclan).
    const rewardAt = new Map<string, { xp: number; gp: number }>();
    for (const log of rewardLogs) {
      for (const key of [`${secondKey(log.createdAt)}|${log.reason}`, secondKey(log.createdAt)]) {
        const entry = rewardAt.get(key) ?? { xp: 0, gp: 0 };
        if (log.pointType === 'XP') entry.xp += log.amount;
        if (log.pointType === 'GP') entry.gp += log.amount;
        rewardAt.set(key, entry);
      }
    }
    const rewardOf = (at: Date, badgeName: string) =>
      rewardAt.get(`${secondKey(at)}|Insignia: ${badgeName}`) ?? rewardAt.get(secondKey(at)) ?? { xp: 0, gp: 0 };

    const conditionText = (condition: BadgeConditionShape | null): string | null => {
      if (!condition) return null;
      const times = (n?: number) => `${n ?? 0} ${n === 1 ? 'vez' : 'veces'}`;
      switch (condition.type) {
        case 'BEHAVIOR_COUNT':
          return `al recibir «${behaviorById.get(condition.behaviorId ?? '')?.name ?? 'un comportamiento'}» ${times(condition.count)}`;
        case 'BEHAVIOR_CATEGORY':
        case 'ANY_BEHAVIOR':
          return `al recibir ${condition.count ?? 0} comportamientos positivos`;
        case 'XP_TOTAL':
          return `al juntar ${condition.value ?? 0} XP`;
        case 'LEVEL':
          return `al llegar al nivel ${condition.value ?? 0}`;
        case 'PURCHASES':
          return `al hacer ${condition.value ?? 0} ${condition.value === 1 ? 'compra' : 'compras'} en la tienda`;
        case 'COMPOUND':
          return 'al cumplir varias condiciones';
        default:
          return null;
      }
    };

    // ── Ganadas ──
    const earnedById = new Map<string, { badge: Badge; rows: (typeof awards)[number]['award'][] }>();
    for (const row of awards) {
      const entry = earnedById.get(row.badge.id) ?? { badge: row.badge, rows: [] };
      entry.rows.push(row.award);
      earnedById.set(row.badge.id, entry);
    }
    const originOf = (award: { awardedBy: string | null; awardReason: string | null }): AwardOrigin => {
      const reason = award.awardReason ?? '';
      if (reason.startsWith('Historia:')) return 'STORY';
      if (!award.awardedBy && reason.startsWith('Álbum completado:')) return 'ALBUM';
      return award.awardedBy ? 'TEACHER' : 'AUTO';
    };
    const baseOf = (badge: Badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description || null,
      icon: badge.icon,
      customImage: safeBadgeImage(badge.customImage),
      rarity: badge.rarity,
      competency: badge.competencyId ? competencyById.get(badge.competencyId) ?? null : null,
      // Las manuales de la clase se pueden ganar más de una vez.
      cumulative: badge.scope === 'CLASSROOM' && badge.assignmentMode !== 'AUTOMATIC',
    });

    const earned = [...earnedById.values()].map(({ badge, rows }) => {
      const sorted = [...rows].sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime());
      return {
        ...baseOf(badge),
        isSecret: badge.isSecret,
        archived: !badge.isActive,
        condition: conditionText(conditionOf.get(badge.id) ?? null),
        count: rows.length,
        lastAt: new Date(sorted[0].unlockedAt).toISOString(),
        awards: sorted.map((award) => {
          const origin = originOf(award);
          const reward = rewardOf(award.unlockedAt, badge.name);
          return {
            at: new Date(award.unlockedAt).toISOString(),
            origin,
            // El motivo del profe (o de dónde vino); el texto del sistema se resume en el cliente.
            reason: award.awardReason?.trim() || null,
            xp: reward.xp,
            gp: reward.gp,
          };
        }),
      };
    }).sort((a, b) => b.lastAt.localeCompare(a.lastAt));

    // ── Por ganar ──
    const notEarned = catalog.filter((badge) => !earnedById.has(badge.id));
    type Kind = 'AUTO' | 'TEACHER' | 'BOTH';
    const kindOf = (badge: Badge): Kind | null => {
      const condition = conditionOf.get(badge.id) ?? null;
      const usable = isCompleteCondition(condition) && !isNegativeCondition(condition, isNegativeBehavior);
      if (badge.assignmentMode === 'MANUAL') return 'TEACHER';
      if (badge.assignmentMode === 'BOTH') return usable ? 'BOTH' : 'TEACHER';
      return usable ? 'AUTO' : null; // automática imposible: no se promete
    };

    // Progreso en lote: comportamientos positivos desde la insignia más antigua que los cuenta.
    const behaviorBadges = notEarned.filter((badge) => {
      const type = conditionOf.get(badge.id)?.type;
      return !badge.isSecret && (type === 'BEHAVIOR_COUNT' || type === 'BEHAVIOR_CATEGORY' || type === 'ANY_BEHAVIOR');
    });
    const since = behaviorBadges.length
      ? new Date(Math.min(...behaviorBadges.map((badge) => new Date(badge.createdAt).getTime())))
      : null;
    const [behaviorLogs, purchaseCount] = await Promise.all([
      since
        ? db.select({ behaviorId: pointLogs.behaviorId, createdAt: pointLogs.createdAt })
          .from(pointLogs)
          .innerJoin(behaviors, eq(behaviors.id, pointLogs.behaviorId))
          .where(and(eq(pointLogs.studentId, profileId), eq(pointLogs.isReverted, false), eq(behaviors.isPositive, true), gte(pointLogs.createdAt, since)))
        : Promise.resolve([]),
      notEarned.some((badge) => conditionOf.get(badge.id)?.type === 'PURCHASES')
        ? db.select({ total: sql<string>`COUNT(*)` }).from(purchases)
          .where(and(eq(purchases.buyerId, profileId), eq(purchases.status, 'APPROVED')))
          .then(([row]) => Number(row?.total ?? 0))
        : Promise.resolve(0),
    ]);
    const countSince = (from: Date, behaviorId?: string) => new Set(
      behaviorLogs
        .filter((log) => new Date(log.createdAt) >= from && (!behaviorId || log.behaviorId === behaviorId))
        .map((log) => `${log.behaviorId}-${secondKey(log.createdAt)}`),
    ).size;
    const levelStartXp = (level: number) => (xpPerLevel * level * (level - 1)) / 2;

    const progressOf = (badge: Badge): { current: number; target: number; unit: Unit; since: string | null; level?: number } | null => {
      const condition = conditionOf.get(badge.id);
      if (!condition) return null;
      const created = new Date(badge.createdAt);
      switch (condition.type) {
        case 'BEHAVIOR_COUNT':
          return { current: countSince(created, condition.behaviorId), target: condition.count ?? 0, unit: 'times', since: created.toISOString() };
        case 'BEHAVIOR_CATEGORY':
        case 'ANY_BEHAVIOR':
          return { current: countSince(created), target: condition.count ?? 0, unit: 'times', since: created.toISOString() };
        case 'XP_TOTAL':
          return { current: profile.xp, target: condition.value ?? 0, unit: 'xp', since: null };
        case 'LEVEL': {
          // El nivel se mide en XP: «nivel 5 de 10» no está a la mitad.
          const level = condition.value ?? 0;
          return { current: profile.xp, target: levelStartXp(level), unit: 'level', since: null, level };
        }
        case 'PURCHASES':
          return { current: purchaseCount, target: condition.value ?? 0, unit: 'purchases', since: null };
        default:
          return null; // COMPOUND: sin barra
      }
    };

    const toEarn = notEarned
      .filter((badge) => !badge.isSecret)
      .map((badge) => ({ badge, kind: kindOf(badge) }))
      .filter((entry): entry is { badge: Badge; kind: Kind } => entry.kind !== null)
      .map(({ badge, kind }) => {
        const progress = kind === 'TEACHER' ? null : progressOf(badge);
        const valid = progress && progress.target > 0 ? progress : null;
        return {
          ...baseOf(badge),
          kind,
          condition: kind === 'TEACHER' ? null : conditionText(conditionOf.get(badge.id) ?? null),
          progress: valid,
          // Hacia abajo y nunca 100 % sin ganarla.
          percent: valid ? Math.min(99, Math.floor((Math.min(valid.current, valid.target) / valid.target) * 100)) : null,
          reward: { xp: badge.rewardXp, gp: badge.rewardGp },
        };
      });

    const secrets = notEarned.filter((badge) => badge.isSecret && kindOf(badge) !== null).length;
    const near = toEarn
      .filter((badge) => badge.percent !== null && badge.percent >= 50)
      .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0] ?? null;

    return {
      classroomName: profile.classroomName,
      gradeLevel: profile.gradeLevel,
      xpPerLevel,
      earned,
      toEarn,
      secrets,
      near: near ? { id: near.id, name: near.name, percent: near.percent!, progress: near.progress! } : null,
    };
  }

  /**
   * Resumen para el menú y el inicio, para varios perfiles del usuario: cuántas insignias puede ver
   * su clase (ganables o secretas) y cuántas distintas tiene. Sin progreso (eso es de la página).
   */
  async getSummaries(profiles: { id: string; classroomId: string }[]): Promise<Map<string, { available: number; owned: number }>> {
    const result = new Map<string, { available: number; owned: number }>();
    if (profiles.length === 0) return result;
    const classroomIds = [...new Set(profiles.map((profile) => profile.classroomId))];
    const [catalog, owned] = await Promise.all([
      db.select({ classroomId: badges.classroomId, scope: badges.scope, mode: badges.assignmentMode, condition: badges.unlockCondition })
        .from(badges)
        .where(and(eq(badges.isActive, true), or(eq(badges.scope, 'SYSTEM'), inArray(badges.classroomId, classroomIds)))),
      db.select({ studentProfileId: studentBadges.studentProfileId, total: sql<string>`COUNT(DISTINCT ${studentBadges.badgeId})` })
        .from(studentBadges)
        .innerJoin(badges, eq(badges.id, studentBadges.badgeId))
        .where(inArray(studentBadges.studentProfileId, profiles.map((profile) => profile.id)))
        .groupBy(studentBadges.studentProfileId),
    ]);
    const ownedBy = new Map(owned.map((row) => [row.studentProfileId, Number(row.total)]));
    for (const profile of profiles) {
      // Una automática sin condición (o por «negativos») nunca se gana: no cuenta.
      const available = catalog.filter((badge) => {
        if (badge.scope !== 'SYSTEM' && badge.classroomId !== profile.classroomId) return false;
        if (badge.mode !== 'AUTOMATIC') return true;
        const condition = parseBadgeCondition(badge.condition);
        return isCompleteCondition(condition) && !isNegativeCondition(condition);
      }).length;
      result.set(profile.id, { available, owned: ownedBy.get(profile.id) ?? 0 });
    }
    return result;
  }
}

export const studentBadgesService = new StudentBadgesService();
