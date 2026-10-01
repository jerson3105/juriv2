import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  activitySessions, behaviors, classrooms, notifications, pointLogs, stories, storyChapters, studentBadges, studentProfiles, users,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { affectedRows, applyPointDeltasBulk, type PointResult } from '../utils/points.js';
import { prepareForTx } from '../utils/notificationEmitter.js';
import { badgeService } from './badge.service.js';
import { behaviorService } from './behavior.service.js';
import { clanService } from './clan.service.js';
import { historyService } from './history.service.js';
import { storyService } from './story.service.js';

export const ACTIVITY_TYPES = ['DESCANSO', 'ESTRELLAS', 'CONQUISTA', 'CORREO', 'ERROR'] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];
export const SELF_ASSESSMENTS = ['GREEN', 'YELLOW', 'RED'] as const;
export type SelfAssessment = typeof SELF_ASSESSMENTS[number];

type SessionRow = typeof activitySessions.$inferSelect;
type StoredReward = {
  behaviorId: string | null;
  behaviorName: string | null;
  xp: number;
  gp: number;
  studentIds: string[];
  pointLogIds: string[];
  /** Insignias automáticas que provocó la recompensa (se revierten al deshacer). */
  badges?: { studentId: string; badgeId: string }[];
};
type LevelUp = { studentId: string; studentName: string; fromLevel: number; newLevel: number };
type AwardedBadges = { studentId: string; badges: { id: string; name: string; icon: string; customImage: string | null; rarity: string }[] }[];

const ACTIVITY_NAMES: Record<ActivityType, string> = {
  DESCANSO: 'Descanso de Jiro',
  ESTRELLAS: 'Estrellas en Movimiento',
  CONQUISTA: 'Conquista del Cielo',
  CORREO: 'Correo Estelar',
  ERROR: 'El Error de Jiro',
};

// MariaDB devuelve las columnas JSON como texto.
const parseJson = <T>(raw: unknown): T | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

// Un MAX() en SQL llega como texto 'YYYY-MM-DD HH:MM:SS' (hora UTC guardada).
const utcIso = (raw: string | Date | null) => {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString();
  const date = new Date(`${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const publicReward = (raw: unknown) => {
  const reward = parseJson<StoredReward>(raw);
  if (!reward || !Array.isArray(reward.studentIds)) return null;
  return {
    behaviorId: reward.behaviorId,
    behaviorName: reward.behaviorName,
    xp: reward.xp,
    gp: reward.gp,
    studentIds: reward.studentIds,
  };
};

const serialize = (row: SessionRow, withState = false) => ({
  id: row.id,
  classroomId: row.classroomId,
  activityType: row.activityType as ActivityType,
  status: row.status,
  title: row.title,
  result: parseJson<Record<string, unknown>>(row.result),
  selfAssessment: row.selfAssessment as SelfAssessment | null,
  reward: publicReward(row.reward),
  rewardedAt: row.rewardedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  finishedAt: row.finishedAt,
  ...(withState ? { state: parseJson<Record<string, unknown>>(row.state) } : {}),
});

/**
 * Observatorio de Jiro: partidas de las actividades de clase. Guardan el estado para reanudar,
 * el resumen de la Bitácora y la recompensa, que se entrega una sola vez por partida (claim
 * condicional sobre rewarded_at) y se puede deshacer.
 */
class ActivityService {
  /** Partida de una clase del profesor (404 si no es suya). */
  private async ownedSession(sessionId: string, teacherId: string) {
    const [row] = await db.select({ session: activitySessions, teacherId: classrooms.teacherId })
      .from(activitySessions)
      .innerJoin(classrooms, eq(classrooms.id, activitySessions.classroomId))
      .where(eq(activitySessions.id, sessionId));
    if (!row || row.teacherId !== teacherId) throw new NotFoundError('Partida no encontrada');
    return row.session;
  }

  /** Portada: última partida por actividad y partidas que se pueden continuar. */
  async overview(classroomId: string) {
    const lastByType = await db.select({
      activityType: activitySessions.activityType,
      lastPlayedAt: sql<string | Date | null>`MAX(${activitySessions.finishedAt})`,
      plays: sql<number>`COUNT(*)`,
    })
      .from(activitySessions)
      .where(and(eq(activitySessions.classroomId, classroomId), eq(activitySessions.status, 'FINISHED')))
      .groupBy(activitySessions.activityType);

    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const active = await db.select().from(activitySessions)
      .where(and(
        eq(activitySessions.classroomId, classroomId),
        eq(activitySessions.status, 'ACTIVE'),
        gte(activitySessions.updatedAt, since),
      ))
      .orderBy(desc(activitySessions.updatedAt))
      .limit(5);

    // Última partida terminada sin recompensa (p. ej. se recargó en la Bitácora): se ofrece retomarla.
    const [unrewarded] = await db.select().from(activitySessions)
      .where(and(
        eq(activitySessions.classroomId, classroomId),
        eq(activitySessions.status, 'FINISHED'),
        isNull(activitySessions.rewardedAt),
        gte(activitySessions.finishedAt, new Date(Date.now() - 12 * 60 * 60 * 1000)),
      ))
      .orderBy(desc(activitySessions.finishedAt))
      .limit(1);

    return {
      unrewarded: unrewarded ? serialize(unrewarded) : null,
      lastByType: lastByType.map((r) => ({ activityType: r.activityType as ActivityType, lastPlayedAt: utcIso(r.lastPlayedAt), plays: Number(r.plays) })),
      active: active.map((r) => serialize(r)),
    };
  }

  /** Nueva partida. La anterior sin terminar de la misma actividad queda abandonada. */
  async create(classroomId: string, teacherId: string, activityType: ActivityType, title: string | null, state: unknown) {
    const now = new Date();
    const id = uuidv4();
    await db.transaction(async (tx) => {
      await tx.update(activitySessions)
        .set({ status: 'ABANDONED', updatedAt: now })
        .where(and(
          eq(activitySessions.classroomId, classroomId),
          eq(activitySessions.activityType, activityType),
          eq(activitySessions.status, 'ACTIVE'),
        ));
      await tx.insert(activitySessions).values({
        id, classroomId, activityType, status: 'ACTIVE', title, state: state ?? null,
        createdBy: teacherId, createdAt: now, updatedAt: now,
      });
    });
    const [row] = await db.select().from(activitySessions).where(eq(activitySessions.id, id));
    return serialize(row, true);
  }

  async get(sessionId: string, teacherId: string) {
    return serialize(await this.ownedSession(sessionId, teacherId), true);
  }

  /** Autoguardado del estado (solo partidas en curso). */
  async saveState(sessionId: string, teacherId: string, state: unknown) {
    const session = await this.ownedSession(sessionId, teacherId);
    if (session.status !== 'ACTIVE') throw new ConflictError('Esta partida ya terminó');
    await db.update(activitySessions)
      .set({ state, updatedAt: new Date() })
      .where(and(eq(activitySessions.id, sessionId), eq(activitySessions.status, 'ACTIVE')));
    return { id: sessionId };
  }

  /** Termina la partida con su resumen. Repetirlo (doble clic) devuelve la partida tal cual. */
  async finish(sessionId: string, teacherId: string, result: unknown, state: unknown) {
    const session = await this.ownedSession(sessionId, teacherId);
    if (session.status === 'ABANDONED') throw new ConflictError('Esta partida se descartó');
    if (session.status === 'ACTIVE') {
      const now = new Date();
      await db.update(activitySessions)
        .set({ status: 'FINISHED', result: result ?? null, ...(state !== undefined ? { state } : {}), finishedAt: now, updatedAt: now })
        .where(and(eq(activitySessions.id, sessionId), eq(activitySessions.status, 'ACTIVE')));
    }
    return this.get(sessionId, teacherId);
  }

  async abandon(sessionId: string, teacherId: string) {
    const session = await this.ownedSession(sessionId, teacherId);
    if (session.status !== 'ACTIVE') return { id: sessionId };
    await db.update(activitySessions)
      .set({ status: 'ABANDONED', updatedAt: new Date() })
      .where(and(eq(activitySessions.id, sessionId), eq(activitySessions.status, 'ACTIVE')));
    return { id: sessionId };
  }

  async setSelfAssessment(sessionId: string, teacherId: string, value: SelfAssessment | null) {
    await this.ownedSession(sessionId, teacherId);
    await db.update(activitySessions)
      .set({ selfAssessment: value, updatedAt: new Date() })
      .where(eq(activitySessions.id, sessionId));
    return this.get(sessionId, teacherId);
  }

  /** Cielo de Jiro: constelaciones que la clase completó en el Descanso (con el nombre que eligió). */
  async album(classroomId: string) {
    const rows = await db.select().from(activitySessions)
      .where(and(eq(activitySessions.classroomId, classroomId), eq(activitySessions.activityType, 'DESCANSO'), eq(activitySessions.status, 'FINISHED')))
      .orderBy(desc(activitySessions.finishedAt))
      .limit(100);
    return rows
      .map((row) => ({ row, result: parseJson<{ constellationId?: string; customName?: string | null; completed?: boolean }>(row.result) }))
      .filter(({ result }) => result?.completed && result.constellationId)
      .map(({ row, result }) => ({
        sessionId: row.id,
        constellationId: result!.constellationId as string,
        customName: result!.customName ?? null,
        finishedAt: row.finishedAt,
      }));
  }

  /** La clase le pone nombre a una constelación completada. */
  async renameConstellation(sessionId: string, teacherId: string, name: string | null) {
    const session = await this.ownedSession(sessionId, teacherId);
    if (session.activityType !== 'DESCANSO' || session.status !== 'FINISHED') throw new ConflictError('Solo se nombran constelaciones completadas');
    const result = parseJson<Record<string, unknown>>(session.result) ?? {};
    await db.update(activitySessions)
      .set({ result: { ...result, customName: name }, updatedAt: new Date() })
      .where(eq(activitySessions.id, sessionId));
    return this.get(sessionId, teacherId);
  }

  /** Avance del capítulo en curso (meta de XP o donaciones) para el "antes → después". */
  private async chapterSnapshot(classroomId: string) {
    const [row] = await db.select({
      id: storyChapters.id,
      title: storyChapters.title,
      completionType: storyChapters.completionType,
      completionConfig: storyChapters.completionConfig,
      currentProgress: storyChapters.currentProgress,
    })
      .from(storyChapters)
      .innerJoin(stories, eq(stories.id, storyChapters.storyId))
      .where(and(eq(stories.classroomId, classroomId), eq(stories.isActive, true), eq(storyChapters.status, 'ACTIVE')))
      .limit(1);
    if (!row || row.completionType === 'BIMESTER') return null;
    return {
      chapterId: row.id,
      title: row.title,
      completionType: row.completionType as 'XP_GOAL' | 'DONATION',
      target: parseJson<{ targetXp?: number }>(row.completionConfig)?.targetXp || 0,
      progress: parseFloat(row.currentProgress ?? '0') || 0,
    };
  }

  /**
   * Recompensa a los presentes, una vez por partida. Con `behaviorId` (positivo, de la clase) cuenta
   * para la competencia vinculada; sin él son XP/oro libres. Quien descansa no recibe HP.
   */
  async reward(
    sessionId: string,
    teacherId: string,
    input: { studentIds: string[]; behaviorId?: string | null; xp?: number; gp?: number },
  ) {
    const session = await this.ownedSession(sessionId, teacherId);
    if (session.status === 'ABANDONED') throw new ConflictError('Esta partida se descartó');
    const classroomId = session.classroomId;

    const students = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(eq(studentProfiles.classroomId, classroomId), inArray(studentProfiles.id, [...new Set(input.studentIds)])));
    if (students.length === 0) throw new ValidationError('Elige al menos un alumno presente');
    const studentIds = students.map((s) => s.id);

    let behavior: { id: string; name: string } | null = null;
    if (input.behaviorId) {
      const [row] = await db.select({ id: behaviors.id, name: behaviors.name, isPositive: behaviors.isPositive, isActive: behaviors.isActive })
        .from(behaviors)
        .where(and(eq(behaviors.id, input.behaviorId), eq(behaviors.classroomId, classroomId)));
      if (!row || !row.isActive) throw new NotFoundError('Comportamiento no encontrado');
      if (!row.isPositive) throw new ValidationError('Elige un comportamiento positivo');
      behavior = { id: row.id, name: row.name };
    }
    const xp = behavior ? 0 : Math.trunc(input.xp ?? 0);
    const gp = behavior ? 0 : Math.trunc(input.gp ?? 0);
    if (!behavior && xp <= 0 && gp <= 0) throw new ValidationError('Indica XP u oro');

    // Solo una entrega gana (doble clic, dos pestañas).
    const claimedAt = new Date();
    const claim = await db.update(activitySessions)
      .set({ rewardedAt: claimedAt, updatedAt: claimedAt })
      .where(and(eq(activitySessions.id, sessionId), isNull(activitySessions.rewardedAt)));
    if (affectedRows(claim) !== 1) throw new ConflictError('La recompensa de esta partida ya se entregó');

    const before = await this.chapterSnapshot(classroomId);
    const reason = `${ACTIVITY_NAMES[session.activityType as ActivityType] ?? 'Observatorio'}${session.title ? `: ${session.title}` : ''}`;
    let outcome: { levelUps: LevelUp[]; awardedBadges: AwardedBadges; restingSkipped: number; studentsAffected: number; pointLogIds: string[] };
    try {
      if (behavior) {
        const applied = await behaviorService.applyToStudents({ behaviorId: behavior.id, studentIds, teacherId, source: 'ACTIVITY' });
        outcome = {
          levelUps: applied.levelUps,
          awardedBadges: applied.awardedBadges,
          restingSkipped: applied.restingSkipped,
          studentsAffected: applied.studentsAffected,
          // Revertir un registro de comportamiento revierte también sus hermanos (XP/HP/oro del mismo instante).
          pointLogIds: applied.results.map((r) => r.pointLogEntryId).filter((id): id is string => !!id),
        };
      } else {
        outcome = await this.applyFree(classroomId, studentIds, xp, gp, reason, teacherId);
      }
    } catch (error) {
      await db.update(activitySessions)
        .set({ rewardedAt: null, updatedAt: new Date() })
        .where(and(eq(activitySessions.id, sessionId), eq(activitySessions.rewardedAt, claimedAt)));
      throw error;
    }

    const stored: StoredReward = {
      behaviorId: behavior?.id ?? null,
      behaviorName: behavior?.name ?? null,
      xp,
      gp,
      studentIds,
      pointLogIds: outcome.pointLogIds,
      badges: outcome.awardedBadges.flatMap((a) => a.badges.map((b) => ({ studentId: a.studentId, badgeId: b.id }))),
    };
    await db.update(activitySessions).set({ reward: stored }).where(eq(activitySessions.id, sessionId));
    const after = before ? await this.chapterSnapshot(classroomId) : null;

    return {
      session: await this.get(sessionId, teacherId),
      levelUps: outcome.levelUps,
      awardedBadges: outcome.awardedBadges,
      restingSkipped: outcome.restingSkipped,
      studentsAffected: outcome.studentsAffected,
      chapter: before && after && before.chapterId === after.chapterId
        ? { title: before.title, completionType: before.completionType, target: before.target, before: before.progress, after: after.progress }
        : null,
    };
  }

  /** Deshace la recompensa de la partida (revierte sus registros de puntos). */
  async undoReward(sessionId: string, teacherId: string) {
    const session = await this.ownedSession(sessionId, teacherId);
    const reward = parseJson<StoredReward>(session.reward);
    if (!session.rewardedAt || !reward) throw new ConflictError('Esta partida no tiene recompensa que deshacer');
    const release = await db.update(activitySessions)
      .set({ rewardedAt: null, reward: null, updatedAt: new Date() })
      .where(and(eq(activitySessions.id, sessionId), isNotNull(activitySessions.rewardedAt)));
    if (affectedRows(release) !== 1) throw new ConflictError('Esta recompensa ya se deshizo');
    const result = reward.pointLogIds.length
      ? await historyService.revertPointBatch(session.classroomId, reward.pointLogIds, teacherId)
      : { reverted: 0, skipped: 0, message: 'Nada que revertir' };

    // Insignias automáticas ganadas con esta recompensa (desde la entrega, sin entregador = automáticas).
    let badgesReverted = 0;
    for (const { studentId, badgeId } of reward.badges ?? []) {
      const [row] = await db.select({ id: studentBadges.id }).from(studentBadges)
        .where(and(
          eq(studentBadges.studentProfileId, studentId),
          eq(studentBadges.badgeId, badgeId),
          isNull(studentBadges.awardedBy),
          gte(studentBadges.unlockedAt, new Date(session.rewardedAt.getTime() - 2000)),
        ))
        .limit(1);
      if (!row) continue;
      try {
        await historyService.revertBadge(row.id, teacherId);
        badgesReverted += 1;
      } catch {
        // Ya revertida a mano: se omite.
      }
    }
    return { session: await this.get(sessionId, teacherId), ...result, badgesReverted };
  }

  /** XP/oro libres para varios alumnos: una sentencia atómica, registros y avisos en la misma transacción. */
  private async applyFree(classroomId: string, studentIds: string[], xp: number, gp: number, reason: string, teacherId: string) {
    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new NotFoundError('Clase no encontrada');
    const students = await db.select({
      id: studentProfiles.id, userId: studentProfiles.userId, characterName: studentProfiles.characterName, teamId: studentProfiles.teamId,
    }).from(studentProfiles).where(inArray(studentProfiles.id, studentIds));
    const [teacher] = await db.select({ notifyLevelUp: users.notifyLevelUp }).from(users).where(eq(users.id, teacherId));

    const now = new Date();
    const logs: typeof pointLogs.$inferInsert[] = [];
    const notificationsBatch: typeof notifications.$inferInsert[] = [];
    const parts = [xp > 0 ? `⚡${xp} XP` : null, gp > 0 ? `🪙${gp} Oro` : null].filter(Boolean).join(', ');
    for (const student of students) {
      for (const [pointType, amount] of [['XP', xp], ['GP', gp]] as const) {
        if (amount <= 0) continue;
        logs.push({
          id: uuidv4(), studentId: student.id, pointType, action: 'ADD', amount, reason, givenBy: teacherId, createdAt: now,
        });
      }
      if (classroom.notifyOnPoints && student.userId) {
        notificationsBatch.push({
          id: uuidv4(),
          userId: student.userId,
          type: 'POINTS',
          title: '¡Puntos recibidos!',
          message: classroom.showReasonToStudent ? `recibiste ${parts} por: ${reason}` : `recibiste ${parts}`,
          isRead: false,
          createdAt: now,
        });
      }
    }

    const levelUps: LevelUp[] = [];
    const byId = new Map(students.map((s) => [s.id, s]));
    let atomic = new Map<string, PointResult>();
    let notifTx = prepareForTx([]);
    await db.transaction(async (tx) => {
      atomic = await applyPointDeltasBulk(tx, studentIds, { xp, gp }, { xpPerLevel: classroom.xpPerLevel || 100, source: 'ACTIVITY' });
      for (const [studentId, result] of atomic) {
        if (result.level <= result.previousLevel) continue;
        const student = byId.get(studentId);
        const name = student?.characterName || 'Estudiante';
        levelUps.push({ studentId, studentName: name, fromLevel: result.previousLevel, newLevel: result.level });
        const levelData = { studentProfileId: studentId, fromLevel: result.previousLevel, toLevel: result.level };
        if (classroom.notifyOnPoints && student?.userId) {
          notificationsBatch.push({
            id: uuidv4(), userId: student.userId, classroomId, type: 'LEVEL_UP', title: '🎉 ¡Subiste de nivel!',
            message: `¡Felicidades! Has alcanzado el nivel ${result.level}`, data: levelData, isRead: false, createdAt: now,
          });
        }
        if (teacher?.notifyLevelUp !== false) {
          notificationsBatch.push({
            id: uuidv4(), userId: teacherId, classroomId, type: 'LEVEL_UP', title: '🎉 ¡Estudiante subió de nivel!',
            message: `${name} ha alcanzado el nivel ${result.level}`, data: levelData, isRead: false, createdAt: now,
          });
        }
      }
      notifTx = prepareForTx(notificationsBatch);
      if (logs.length) await tx.insert(pointLogs).values(logs);
      if (notifTx.entries.length) await tx.insert(notifications).values(notifTx.entries);
    });
    await notifTx.emitAfterCommit();

    // Efectos externos después del commit (igual que los comportamientos).
    if (xp > 0) {
      for (const student of students) {
        if (!classroom.clansEnabled || !student.teamId) continue;
        try {
          await clanService.contributeXpToClan(student.id, xp, reason);
        } catch {
          // No rompe la recompensa
        }
      }
      try {
        await storyService.onXpAwardedBatch(classroomId, students.map((s) => ({ studentProfileId: s.id, xpAmount: xp })));
      } catch {
        // No rompe la recompensa
      }
    }

    const awardedBadges: AwardedBadges = [];
    const classroomBadges = await badgeService.getClassroomBadges(classroomId);
    const hasAutomatic = classroomBadges.some((b) => (b.assignmentMode === 'AUTOMATIC' || b.assignmentMode === 'BOTH') && b.unlockCondition !== null);
    if (hasAutomatic && xp > 0) {
      const counts = await badgeService.getBadgeCountsForStudents(studentIds);
      for (const student of students) {
        try {
          const earned = await badgeService.checkAndAwardBadges(
            { type: 'POINTS_ADDED', data: { studentProfileId: student.id, classroomId, totalXp: xp } },
            classroomBadges,
            counts.get(student.id) ?? new Map(),
          );
          if (earned.length) {
            awardedBadges.push({
              studentId: student.id,
              badges: earned.map((b) => ({ id: b.id, name: b.name, icon: b.icon, customImage: b.customImage ?? null, rarity: b.rarity })),
            });
          }
        } catch (error) {
          console.error('Error checking badges for student:', student.id, error);
        }
      }
    }

    return {
      levelUps,
      awardedBadges,
      restingSkipped: 0,
      studentsAffected: atomic.size,
      pointLogIds: logs.map((l) => l.id as string),
    };
  }
}

export const activityService = new ActivityService();
