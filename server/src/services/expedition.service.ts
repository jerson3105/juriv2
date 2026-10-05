import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  badges,
  clanLogs,
  classroomCompetencies,
  classrooms,
  curriculumCompetencies,
  expeditionAnswers,
  expeditionClanFinishes,
  expeditionEvidence,
  expeditionFinishes,
  expeditionMaps,
  expeditionStopProgress,
  expeditionStops,
  expeditions,
  notifications,
  pointLogs,
  questions,
  studentProfiles,
  teams,
  users,
  type Expedition,
  type ExpeditionResource,
  type ExpeditionStop,
  type ExpeditionStopKind,
  type ExpeditionStopProgress,
} from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError, isDuplicateEntry } from '../utils/errors.js';
import { affectedRows, applyPointDeltas } from '../utils/points.js';
import { parseScaleConfig, scaleOptions, scaleValueToScore } from '../utils/gradeScale.js';
import { getIO, prepareForTx } from '../utils/notificationEmitter.js';
import {
  checkAnswer,
  correctAnswerFor,
  isPlayable,
  isWellFormedAnswer,
  parseJsonArray,
  toStudentQuestion,
  type BankQuestionRow,
} from '../utils/questionCheck.js';
import { clanService } from './clan.service.js';
import { storyService } from './story.service.js';
import { badgeService } from './badge.service.js';

/**
 * Expedición unificada (2026-10-03): la clásica y la de Jiro en una sola, con paradas en lista.
 * - El avance de cada alumno nace al tocar la parada: siempre hay una parada abierta, y quien entra tarde
 *   o una parada agregada después funcionan sin «publicar de nuevo».
 * - Cada recompensa se paga una sola vez por fila (rewarded_at con UPDATE condicional), en la misma
 *   transacción que el cambio de estado. Antes se comparaba el texto del motivo.
 * - El reto se corrige en el servidor y al alumno nunca le llega la respuesta antes de contestar.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type StopKind = ExpeditionStopKind;
export type StopState = 'LOCKED' | 'AVAILABLE' | 'STARTED' | 'WAITING' | 'NEEDS_WORK' | 'DONE';

export const MAX_STOPS = 10;
export const MAX_REWARD = 500;
export const MAX_QUESTIONS = 20;

// Estrellas de cada constelación (client/src/components/observatorio/descanso/constellations.ts).
const CONSTELLATION_STARS: Record<string, number> = {
  'cruz-del-sur': 5, casiopea: 5, lira: 5, cisne: 6, 'osa-mayor': 7, orion: 8, leo: 9, escorpio: 10,
};
const SMALL_CONSTELLATIONS = ['cruz-del-sur', 'casiopea', 'lira'];
const BY_SIZE = Object.entries(CONSTELLATION_STARS).sort((a, b) => a[1] - b[1]);
export const isConstellationId = (id: unknown): id is string => typeof id === 'string' && id in CONSTELLATION_STARS;
const starsOf = (id: string | null | undefined) => (id ? CONSTELLATION_STARS[id] ?? 0 : 0);
/** La que ya tiene si alcanza; si no, la más chica en la que caben las paradas. */
const fittingConstellation = (count: number, current?: string | null) =>
  (current && starsOf(current) >= count ? current : BY_SIZE.find(([, stars]) => stars >= count)?.[0]) ?? 'escorpio';
const initialConstellation = (seed: string) =>
  SMALL_CONSTELLATIONS[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % SMALL_CONSTELLATIONS.length];

// Recompensas sugeridas por tipo, en % del XP por nivel de la clase (decisión del dueño, 2026-10-03).
const SUGGESTED: Record<StopKind, { xpPercent: number; gold: number }> = {
  STORY: { xpPercent: 0, gold: 0 },
  CHALLENGE: { xpPercent: 10, gold: 0 },
  EVIDENCE: { xpPercent: 15, gold: 5 },
  CLASS: { xpPercent: 10, gold: 0 },
};
const percentOf = (xpPerLevel: number, percent: number) => Math.min(MAX_REWARD, Math.round((xpPerLevel * percent) / 100));
export const suggestedReward = (kind: StopKind, xpPerLevel: number) => ({ xp: percentOf(xpPerLevel, SUGGESTED[kind].xpPercent), gold: SUGGESTED[kind].gold });
export const suggestedFinish = (xpPerLevel: number) => ({ xp: percentOf(xpPerLevel, 20), gold: 10 });
/** Premio del clan al llegar a la meta (suma al XP del clan) y de la meta de clase, en % del XP por nivel. */
export const suggestedClanXp = (xpPerLevel: number) => percentOf(xpPerLevel, 30);

const DEFAULT_TITLE: Record<StopKind, string> = { STORY: 'Relato', CHALLENGE: 'Reto', EVIDENCE: 'Evidencia', CLASS: 'En clase' };
const GOLD_STAR_SCORE = 80;
/** Solo el reto (su % del primer intento) y la evidencia (el nivel al aprobar) dan nota. */
export const GRADED_KINDS: StopKind[] = ['CHALLENGE', 'EVIDENCE'];
export const MAX_GRADE_WEIGHT = 30;
/** Actividades del Observatorio con las que se puede jugar una parada «en clase». */
export const CLASS_ACTIVITIES = ['ESTRELLAS', 'CONQUISTA', 'ERROR'] as const;
export type ClassActivity = typeof CLASS_ACTIVITIES[number];
export const REFLECTIONS = ['GREEN', 'YELLOW', 'RED'] as const;
export type Reflection = typeof REFLECTIONS[number];

// ── Serialización ──

const toResources = (value: unknown): ExpeditionResource[] =>
  parseJsonArray<Partial<ExpeditionResource>>(value)
    .filter((r): r is ExpeditionResource => !!r && typeof r.url === 'string' && (r.kind === 'FILE' || r.kind === 'LINK'))
    .map((r) => ({ kind: r.kind, url: r.url, name: typeof r.name === 'string' ? r.name : null }));
const toIds = (value: unknown) => parseJsonArray(value).filter((id): id is string => typeof id === 'string');
const toFiles = (value: unknown) => parseJsonArray(value).filter((file): file is string => typeof file === 'string');
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const count = (value: unknown) => Number(value ?? 0);
const studentName = (row: { firstName: string | null; lastName: string | null; displayName: string | null; characterName: string | null }) =>
  [row.firstName, row.lastName].filter(Boolean).join(' ') || row.displayName || row.characterName || 'Alumno';
const questionSeed = (stopId: string, studentProfileId: string, questionId: string) => `${stopId}:${studentProfileId}:${questionId}`;

const expeditionDto = (e: Expedition) => ({
  id: e.id,
  classroomId: e.classroomId,
  name: e.name,
  description: e.description,
  scenario: e.scenario,
  constellationId: e.constellationId,
  mapImageUrl: e.mapImageUrl,
  groupMode: e.groupMode,
  closingText: e.closingText,
  finishXp: e.finishXp,
  finishGold: e.finishGold,
  finishBadgeId: e.finishBadgeId,
  perseveranceBadgeId: e.perseveranceBadgeId,
  clanXp: e.clanXp,
  goalPercent: e.goalPercent,
  goalDueAt: e.goalDueAt,
  goalXp: e.goalXp,
  goalReachedAt: e.goalReachedAt,
  status: e.status,
  publishedAt: e.publishedAt,
  createdAt: e.createdAt,
  updatedAt: e.updatedAt,
});

interface StopStats { started: number; waiting: number; pending: number; needsWork: number; done: number }
const emptyStats = (): StopStats => ({ started: 0, waiting: 0, pending: 0, needsWork: 0, done: 0 });

const teacherStop = (stop: ExpeditionStop, stats: StopStats = emptyStats()) => ({
  id: stop.id,
  sortOrder: stop.sortOrder,
  kind: stop.kind,
  title: stop.title,
  story: stop.story,
  goal: stop.goal,
  successCriteria: stop.successCriteria,
  mission: stop.mission,
  resources: toResources(stop.resources),
  bankId: stop.bankId,
  questionIds: toIds(stop.questionIds),
  passPercent: stop.passPercent,
  reviewMode: stop.reviewMode,
  dueAt: stop.dueAt,
  rewardXp: stop.rewardXp,
  rewardGold: stop.rewardGold,
  competencyId: stop.competencyId,
  gradeWeight: stop.gradeWeight,
  classActivity: stop.classActivity as ClassActivity | null,
  mapX: num(stop.mapX),
  mapY: num(stop.mapY),
  stats,
});

/**
 * Estado de cada parada para un alumno. Lograda (DONE) nunca bloquea; la primera que no está lograda es
 * la frontera (disponible, en curso o esperando) y las siguientes quedan bloqueadas. Una evidencia con
 * «avanza ya» queda lograda aunque el docente pida mejorarla: el alumno sigue avanzando.
 */
export const computeStates = (stops: ExpeditionStop[], progress: Map<string, ExpeditionStopProgress>) => {
  let blocked = false;
  return stops.map((stop) => {
    const row = progress.get(stop.id) ?? null;
    let state: StopState;
    if (row?.status === 'DONE') {
      state = row.review === 'NEEDS_WORK' ? 'NEEDS_WORK' : 'DONE';
    } else if (blocked) {
      state = 'LOCKED';
    } else {
      blocked = true;
      if (!row) state = 'AVAILABLE';
      else if (row.status === 'STARTED') state = 'STARTED';
      else state = row.review === 'NEEDS_WORK' ? 'NEEDS_WORK' : 'WAITING';
    }
    return { stop, row, state };
  });
};

const isFinished = (states: ReturnType<typeof computeStates>) => states.length > 0 && states.every((s) => s.row?.status === 'DONE');
const frontierOf = (states: ReturnType<typeof computeStates>) => states.find((s) => s.row?.status !== 'DONE') ?? null;
/** ¿Hay algo que el alumno pueda hacer ahora? (las paradas en clase y un reto sin preguntas dependen del docente). */
const hasActionable = (states: ReturnType<typeof computeStates>) => states.some((s) =>
  (s.state === 'NEEDS_WORK') || ((s.state === 'AVAILABLE' || s.state === 'STARTED') && s.stop.kind !== 'CLASS'
    && !(s.stop.kind === 'CHALLENGE' && toIds(s.stop.questionIds).length === 0)));

type AnswerMark = { questionId: string; attempt: number; isCorrect: boolean };
/** Vuelta actual del reto con las preguntas que siguen en él: la primera, todas; el reintento, las falladas en la primera. */
const roundOf = (attempt: number, list: { id: string }[], answers: AnswerMark[]) => {
  if (attempt === 1) return list.map((q) => q.id);
  const failed = new Set(answers.filter((a) => a.attempt === 1 && !a.isCorrect).map((a) => a.questionId));
  return list.filter((q) => failed.has(q.id)).map((q) => q.id);
};

// ── Recompensas ──

interface Grant {
  studentProfileId: string;
  xp: number;
  gold: number;
  reason: string; // registro de puntos (historial)
  title: string; // aviso al alumno («Lo nuevo»)
  what: string; // «por …» en el aviso
  givenBy: string | null;
  /** Insignia elegida por el docente (de la meta o de perseverancia): se otorga después del commit. */
  badge?: { id: string; reason: string } | null;
  /** Algo más que se hace después del commit, una sola vez por clave (revisar clanes y meta de la clase). */
  followUp?: { key: string; run: () => Promise<void> };
}
const noPoints = { xp: 0, gold: 0, reason: '', title: '', what: '', givenBy: null };

const rewardText = (xp: number, gold: number) => [xp > 0 ? `+${xp} XP` : '', gold > 0 ? `+${gold} de oro` : ''].filter(Boolean).join(' · ');

/** Cerrada = solo lectura también para el docente: solo aprueba lo que quedó por revisar (para cambiarla, la abre de nuevo). */
const assertOpen = (expedition: Expedition) => {
  if (expedition.status === 'ARCHIVED') throw new ConflictError('La expedición está cerrada: ábrela de nuevo para cambiarla');
};

const isDeadlock = (error: unknown) => [error, (error as { cause?: unknown } | null)?.cause].some((e) => {
  if (!e || typeof e !== 'object') return false;
  const dbError = e as { code?: string; errno?: number };
  return dbError.code === 'ER_LOCK_DEADLOCK' || dbError.errno === 1213;
});

/**
 * Transacción que se reintenta ante un interbloqueo (hasta 3 veces). El trabajo devuelve lo que se hace
 * después del commit (avisos, clan, Historia, insignias): así un intento fallido no deja efectos colgados.
 */
const transaction = async <T>(work: (tx: Tx) => Promise<{ value: T; after: (() => Promise<void>)[] }>): Promise<T> => {
  let outcome: { value: T; after: (() => Promise<void>)[] };
  for (let attempt = 1; ; attempt++) {
    try {
      outcome = await db.transaction(work);
      break;
    } catch (error) {
      if (attempt >= 3 || !isDeadlock(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt + Math.random() * 40));
    }
  }
  // Ya hubo commit: los efectos van fuera del reintento (repetir la transacción pagaría dos veces) y un
  // fallo aquí no convierte en error una acción que sí se guardó.
  for (const run of outcome.after) {
    try {
      await run();
    } catch (error) {
      console.error('Efecto posterior de la expedición', error);
    }
  }
  return outcome.value;
};

/**
 * Bloquea los perfiles de los alumnos (filas que existen) antes de tocar su avance. Todas las acciones toman
 * los candados en el mismo orden (perfiles por id → avance), así dos pedidos simultáneos se ponen en fila en
 * vez de interbloquearse (antes: SELECT … FOR UPDATE sobre una fila inexistente + INSERT).
 */
const lockStudents = async (tx: Tx, studentProfileIds: string[]) => {
  const ids = [...new Set(studentProfileIds)].sort();
  if (ids.length) await tx.select({ id: studentProfiles.id }).from(studentProfiles).where(inArray(studentProfiles.id, ids)).orderBy(asc(studentProfiles.id)).for('update');
};

/** Avisa por socket a cada usuario (sala user:<id>) que una expedición cambió. */
const emitToUsers = (userIds: (string | null | undefined)[], event: string, payload: Record<string, unknown>) => {
  const io = getIO();
  if (!io) return;
  for (const userId of new Set(userIds.filter((id): id is string => !!id))) io.to(`user:${userId}`).emit(event, payload);
};

class ExpeditionService {
  // ==================== Contexto y acceso ====================

  async getClassroomIdOf(expeditionId: string): Promise<string | null> {
    const [row] = await db.select({ classroomId: expeditions.classroomId }).from(expeditions).where(eq(expeditions.id, expeditionId));
    return row?.classroomId ?? null;
  }

  async getStopContext(stopId: string) {
    const [row] = await db
      .select({ stop: expeditionStops, expedition: expeditions })
      .from(expeditionStops)
      .innerJoin(expeditions, eq(expeditionStops.expeditionId, expeditions.id))
      .where(eq(expeditionStops.id, stopId));
    return row ?? null;
  }

  /** Perfil activo del alumno (usuario de la sesión) en esa clase. */
  async studentProfileFor(userId: string, classroomId: string): Promise<string | null> {
    const [row] = await db
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(and(eq(studentProfiles.userId, userId), eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true), eq(classrooms.isActive, true)));
    return row?.id ?? null;
  }

  private async requireExpedition(expeditionId: string, exec: Tx | typeof db = db, lock = false) {
    const query = exec.select().from(expeditions).where(eq(expeditions.id, expeditionId));
    const [row] = lock ? await query.for('update') : await query;
    if (!row) throw new NotFoundError('Expedición no encontrada');
    return row;
  }

  private stopsOf(expeditionId: string, exec: Tx | typeof db = db) {
    return exec.select().from(expeditionStops).where(eq(expeditionStops.expeditionId, expeditionId)).orderBy(asc(expeditionStops.sortOrder), asc(expeditionStops.createdAt));
  }

  private async progressMap(expeditionId: string, studentProfileId: string, exec: Tx | typeof db = db) {
    const rows = await exec.select().from(expeditionStopProgress)
      .where(and(eq(expeditionStopProgress.expeditionId, expeditionId), eq(expeditionStopProgress.studentProfileId, studentProfileId)));
    return new Map(rows.map((row) => [row.stopId, row]));
  }

  private async assertLibraryMap(url: string) {
    const [map] = await db.select({ id: expeditionMaps.id }).from(expeditionMaps)
      .where(and(eq(expeditionMaps.imageUrl, url), eq(expeditionMaps.isActive, true)));
    if (!map) throw new ValidationError('Elige un mapa de la biblioteca');
  }

  // ==================== Docente: expediciones ====================

  async listForTeacher(classroomId: string) {
    const rows = await db.select().from(expeditions).where(eq(expeditions.classroomId, classroomId)).orderBy(desc(expeditions.updatedAt));
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const active = and(inArray(expeditionStopProgress.expeditionId, ids), eq(studentProfiles.isActive, true));
    const [stopRows, startedRows, pendingRows, finishedRows, [students]] = await Promise.all([
      db.select({ id: expeditionStops.expeditionId, n: sql<number>`COUNT(*)` }).from(expeditionStops)
        .where(inArray(expeditionStops.expeditionId, ids)).groupBy(expeditionStops.expeditionId),
      db.select({ id: expeditionStopProgress.expeditionId, n: sql<number>`COUNT(DISTINCT ${expeditionStopProgress.studentProfileId})` })
        .from(expeditionStopProgress).innerJoin(studentProfiles, eq(expeditionStopProgress.studentProfileId, studentProfiles.id))
        .where(active).groupBy(expeditionStopProgress.expeditionId),
      db.select({ id: expeditionStopProgress.expeditionId, n: sql<number>`COUNT(*)` })
        .from(expeditionStopProgress).innerJoin(studentProfiles, eq(expeditionStopProgress.studentProfileId, studentProfiles.id))
        .where(and(active, eq(expeditionStopProgress.review, 'PENDING'))).groupBy(expeditionStopProgress.expeditionId),
      db.select({ id: expeditionFinishes.expeditionId, n: sql<number>`COUNT(*)` })
        .from(expeditionFinishes).innerJoin(studentProfiles, eq(expeditionFinishes.studentProfileId, studentProfiles.id))
        .where(and(inArray(expeditionFinishes.expeditionId, ids), eq(studentProfiles.isActive, true))).groupBy(expeditionFinishes.expeditionId),
      db.select({ n: sql<number>`COUNT(*)` }).from(studentProfiles)
        .where(and(eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true))),
    ]);
    const by = (list: { id: string; n: number }[]) => new Map(list.map((row) => [row.id, count(row.n)]));
    const stops = by(stopRows);
    const started = by(startedRows);
    const pending = by(pendingRows);
    const finished = by(finishedRows);
    const order = { PUBLISHED: 0, DRAFT: 1, ARCHIVED: 2 } as const;
    return rows
      .map((row) => ({
        ...expeditionDto(row),
        stopsCount: stops.get(row.id) ?? 0,
        studentsCount: count(students?.n),
        startedCount: started.get(row.id) ?? 0,
        finishedCount: finished.get(row.id) ?? 0,
        pendingReviews: pending.get(row.id) ?? 0,
      }))
      .sort((a, b) => order[a.status] - order[b.status]);
  }

  async create(classroomId: string, input: { name: string; description?: string | null; scenario?: 'CONSTELLATION' | 'MAP'; constellationId?: string | null; mapImageUrl?: string | null }) {
    const [classroom] = await db.select({ xpPerLevel: classrooms.xpPerLevel }).from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new NotFoundError('Clase no encontrada');
    const scenario = input.scenario ?? 'CONSTELLATION';
    if (scenario === 'MAP') {
      if (!input.mapImageUrl) throw new ValidationError('Elige un mapa de la biblioteca');
      await this.assertLibraryMap(input.mapImageUrl);
    }
    const id = uuidv4();
    const now = new Date();
    const finish = suggestedFinish(classroom.xpPerLevel || 100);
    await db.insert(expeditions).values({
      id,
      classroomId,
      name: input.name,
      description: input.description || null,
      scenario,
      constellationId: isConstellationId(input.constellationId) ? input.constellationId : initialConstellation(id),
      mapImageUrl: scenario === 'MAP' ? input.mapImageUrl ?? null : null,
      groupMode: 'INDIVIDUAL',
      finishXp: finish.xp,
      finishGold: finish.gold,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    });
    return this.getForTeacher(id);
  }

  async getForTeacher(expeditionId: string) {
    const expedition = await this.requireExpedition(expeditionId);
    const [stops, statRows] = await Promise.all([
      this.stopsOf(expeditionId),
      db.select({ stopId: expeditionStopProgress.stopId, status: expeditionStopProgress.status, review: expeditionStopProgress.review, n: sql<number>`COUNT(*)` })
        .from(expeditionStopProgress)
        .innerJoin(studentProfiles, eq(expeditionStopProgress.studentProfileId, studentProfiles.id))
        .where(and(eq(expeditionStopProgress.expeditionId, expeditionId), eq(studentProfiles.isActive, true)))
        .groupBy(expeditionStopProgress.stopId, expeditionStopProgress.status, expeditionStopProgress.review),
    ]);
    const stats = new Map<string, StopStats>();
    for (const row of statRows) {
      const entry = stats.get(row.stopId) ?? emptyStats();
      const n = count(row.n);
      if (row.status === 'STARTED') entry.started += n;
      if (row.status === 'WAITING') entry.waiting += n;
      if (row.status === 'DONE') entry.done += n;
      if (row.review === 'PENDING') entry.pending += n;
      if (row.review === 'NEEDS_WORK') entry.needsWork += n;
      stats.set(row.stopId, entry);
    }
    return { ...expeditionDto(expedition), stops: stops.map((stop) => teacherStop(stop, stats.get(stop.id))) };
  }

  /** Insignia activa de la clase (la que elige el docente para la meta o la perseverancia). */
  private async assertClassroomBadge(classroomId: string, badgeId: string) {
    const [badge] = await db.select({ id: badges.id }).from(badges)
      .where(and(eq(badges.id, badgeId), eq(badges.classroomId, classroomId), eq(badges.isActive, true)));
    if (!badge) throw new ValidationError('Elige una insignia activa de esta clase');
  }

  async update(expeditionId: string, patch: {
    name?: string; description?: string | null; closingText?: string | null; finishXp?: number; finishGold?: number;
    scenario?: 'CONSTELLATION' | 'MAP'; constellationId?: string; mapImageUrl?: string | null;
    finishBadgeId?: string | null; perseveranceBadgeId?: string | null;
    groupMode?: 'INDIVIDUAL' | 'CLAN'; clanXp?: number; goalPercent?: number | null; goalDueAt?: Date | null; goalXp?: number;
  }) {
    const expedition = await this.requireExpedition(expeditionId);
    assertOpen(expedition);
    const stops = await this.stopsOf(expeditionId);
    const set: Partial<typeof expeditions.$inferInsert> = { updatedAt: new Date() };
    // Por clanes: solo si la clase tiene clanes. Al activarlo, el premio del clan arranca con el sugerido.
    if (patch.groupMode !== undefined && patch.groupMode !== expedition.groupMode) {
      const [classroom] = await db.select({ clansEnabled: classrooms.clansEnabled, xpPerLevel: classrooms.xpPerLevel }).from(classrooms).where(eq(classrooms.id, expedition.classroomId));
      if (patch.groupMode === 'CLAN' && !classroom?.clansEnabled) throw new ValidationError('Activa los clanes de la clase para usar este modo');
      set.groupMode = patch.groupMode;
      if (patch.groupMode === 'CLAN' && patch.clanXp === undefined && expedition.clanXp === 0) set.clanXp = suggestedClanXp(classroom?.xpPerLevel || 100);
    }
    if (patch.clanXp !== undefined) set.clanXp = patch.clanXp;
    // Meta de clase: sin porcentaje no hay meta (y se borra el «lograda», por si después se pone otra).
    const goalChanged = patch.goalPercent !== undefined || patch.goalDueAt !== undefined || patch.goalXp !== undefined;
    if (patch.goalPercent !== undefined) {
      set.goalPercent = patch.goalPercent;
      if (patch.goalPercent === null) set.goalReachedAt = null;
    }
    if (patch.goalDueAt !== undefined) set.goalDueAt = patch.goalDueAt;
    if (patch.goalXp !== undefined) set.goalXp = patch.goalXp;
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.description !== undefined) set.description = patch.description || null;
    if (patch.closingText !== undefined) set.closingText = patch.closingText || null;
    if (patch.finishXp !== undefined) set.finishXp = patch.finishXp;
    if (patch.finishGold !== undefined) set.finishGold = patch.finishGold;
    for (const key of ['finishBadgeId', 'perseveranceBadgeId'] as const) {
      const badgeId = patch[key];
      if (badgeId === undefined) continue;
      if (badgeId) await this.assertClassroomBadge(expedition.classroomId, badgeId);
      set[key] = badgeId || null;
    }
    if (patch.mapImageUrl !== undefined && patch.mapImageUrl !== expedition.mapImageUrl) {
      if (patch.mapImageUrl) await this.assertLibraryMap(patch.mapImageUrl);
      set.mapImageUrl = patch.mapImageUrl || null;
    }
    const scenario = patch.scenario ?? expedition.scenario;
    set.scenario = scenario;
    const finalMap = patch.mapImageUrl !== undefined ? patch.mapImageUrl : expedition.mapImageUrl;
    if (scenario === 'MAP' && !finalMap) throw new ValidationError('Elige un mapa de la biblioteca');
    if (patch.constellationId !== undefined) {
      if (!isConstellationId(patch.constellationId)) throw new ValidationError('Constelación no válida');
      if (starsOf(patch.constellationId) < stops.length) {
        throw new ValidationError(`Esa constelación tiene ${starsOf(patch.constellationId)} estrellas y la expedición tiene ${stops.length} paradas`);
      }
      set.constellationId = patch.constellationId;
    } else if (scenario === 'CONSTELLATION') {
      set.constellationId = fittingConstellation(stops.length, expedition.constellationId);
    }
    await db.update(expeditions).set(set).where(eq(expeditions.id, expeditionId));
    // Si con la meta nueva la clase ya la cumple (p. ej. bajó el porcentaje), se logra ahora y se paga; al pasar
    // a clanes, los que ya completaron todas las paradas llegan a la meta.
    if (goalChanged || set.groupMode === 'CLAN') await this.checkTogether(expeditionId);
    return this.getForTeacher(expeditionId);
  }

  /** Primer problema que impide publicar (null = lista). El cliente muestra la misma lista antes de publicar. */
  private async publishIssue(expedition: Expedition, stops: ExpeditionStop[]): Promise<string | null> {
    if (stops.length === 0) return 'Agrega al menos una parada';
    if (stops.length > MAX_STOPS) return `Una expedición tiene hasta ${MAX_STOPS} paradas`;
    if (expedition.scenario === 'MAP' && !expedition.mapImageUrl) return 'Elige un mapa de la biblioteca';
    for (const [index, stop] of stops.entries()) {
      const label = `La parada ${index + 1}`;
      if (!stop.title.trim()) return `${label} no tiene título`;
      if (stop.kind === 'STORY' && !stop.story?.trim() && toResources(stop.resources).length === 0) return `${label} («${stop.title}») no tiene relato`;
      if (stop.kind === 'EVIDENCE' && !stop.mission?.trim()) return `${label} («${stop.title}») no dice qué deben entregar`;
      if (stop.kind === 'CLASS' && !stop.mission?.trim()) return `${label} («${stop.title}») no dice qué harán en clase`;
      if (stop.kind === 'CHALLENGE') {
        const ids = toIds(stop.questionIds);
        if (!stop.bankId || ids.length === 0) return `El reto de la parada ${index + 1} («${stop.title}») no tiene preguntas`;
        const playable = await this.playableQuestions(stop.bankId, ids);
        if (playable.length !== ids.length) return `El reto de la parada ${index + 1} («${stop.title}») tiene preguntas que ya no están en el banco`;
      }
    }
    return null;
  }

  async publish(expeditionId: string) {
    const expedition = await this.requireExpedition(expeditionId);
    if (expedition.status === 'ARCHIVED') throw new ConflictError('Esta expedición está cerrada: ábrela de nuevo');
    if (expedition.status === 'PUBLISHED') return this.getForTeacher(expeditionId);
    const stops = await this.stopsOf(expeditionId);
    const issue = await this.publishIssue(expedition, stops);
    if (issue) throw new ValidationError(issue);
    const now = new Date();
    await db.update(expeditions).set({
      status: 'PUBLISHED',
      publishedAt: expedition.publishedAt ?? now,
      constellationId: fittingConstellation(stops.length, expedition.constellationId),
      updatedAt: now,
    }).where(eq(expeditions.id, expeditionId));
    getIO()?.to(`classroom:${expedition.classroomId}`).emit('expedition:changed', { expeditionId });
    return this.getForTeacher(expeditionId);
  }

  async setClosed(expeditionId: string, closed: boolean) {
    const expedition = await this.requireExpedition(expeditionId);
    if (closed && expedition.status !== 'PUBLISHED') throw new ConflictError('Solo se cierra una expedición publicada');
    if (!closed && expedition.status !== 'ARCHIVED') throw new ConflictError('Esta expedición no está cerrada');
    await db.update(expeditions).set({ status: closed ? 'ARCHIVED' : 'PUBLISHED', updatedAt: new Date() }).where(eq(expeditions.id, expeditionId));
    getIO()?.to(`classroom:${expedition.classroomId}`).emit('expedition:changed', { expeditionId });
    return this.getForTeacher(expeditionId);
  }

  async remove(expeditionId: string) {
    const expedition = await this.requireExpedition(expeditionId);
    if (expedition.status !== 'DRAFT') throw new ConflictError('Solo se borran los borradores: ciérrala para que deje de estar activa');
    await transaction(async (tx) => {
      const stopIds = (await tx.select({ id: expeditionStops.id }).from(expeditionStops).where(eq(expeditionStops.expeditionId, expeditionId))).map((s) => s.id);
      if (stopIds.length) await tx.delete(expeditionAnswers).where(inArray(expeditionAnswers.stopId, stopIds));
      await tx.delete(expeditionEvidence).where(eq(expeditionEvidence.expeditionId, expeditionId));
      await tx.delete(expeditionStopProgress).where(eq(expeditionStopProgress.expeditionId, expeditionId));
      await tx.delete(expeditionFinishes).where(eq(expeditionFinishes.expeditionId, expeditionId));
      await tx.delete(expeditionClanFinishes).where(eq(expeditionClanFinishes.expeditionId, expeditionId));
      await tx.delete(expeditionStops).where(eq(expeditionStops.expeditionId, expeditionId));
      await tx.delete(expeditions).where(eq(expeditions.id, expeditionId));
      return { value: null, after: [] };
    });
  }

  // ==================== Docente: paradas ====================

  async addStop(expeditionId: string, kind: StopKind) {
    const id = uuidv4();
    await transaction(async (tx) => {
      // Bloquea la expedición: dos «Agregar» seguidos no reciben el mismo orden.
      const expedition = await this.requireExpedition(expeditionId, tx, true);
      assertOpen(expedition);
      const stops = await this.stopsOf(expeditionId, tx);
      if (stops.length >= MAX_STOPS) throw new ValidationError(`Una expedición tiene hasta ${MAX_STOPS} paradas`);
      const [classroom] = await tx.select({ xpPerLevel: classrooms.xpPerLevel }).from(classrooms).where(eq(classrooms.id, expedition.classroomId));
      const reward = suggestedReward(kind, classroom?.xpPerLevel || 100);
      const n = stops.length;
      const now = new Date();
      await tx.insert(expeditionStops).values({
        id,
        expeditionId,
        sortOrder: n === 0 ? 0 : Math.max(...stops.map((s) => s.sortOrder)) + 1,
        kind,
        title: DEFAULT_TITLE[kind],
        rewardXp: reward.xp,
        rewardGold: reward.gold,
        // En un mapa, una posición inicial en zigzag que el docente después mueve.
        mapX: String(12 + (n % 5) * 19),
        mapY: String(n % 2 === 0 ? 70 - Math.floor(n / 5) * 30 : 50 - Math.floor(n / 5) * 30),
        createdAt: now,
        updatedAt: now,
      });
      const set: Partial<typeof expeditions.$inferInsert> = { updatedAt: now };
      if (expedition.scenario === 'CONSTELLATION') set.constellationId = fittingConstellation(n + 1, expedition.constellationId);
      await tx.update(expeditions).set(set).where(eq(expeditions.id, expeditionId));
      return { value: null, after: [] };
    });
    const [stop] = await db.select().from(expeditionStops).where(eq(expeditionStops.id, id));
    return teacherStop(stop);
  }

  /** Preguntas del banco que se pueden usar en un reto, en el orden pedido (activas, revisadas si son de IA, corregibles). */
  private async playableQuestions(bankId: string, ids: string[]): Promise<BankQuestionRow[]> {
    if (ids.length === 0) return [];
    const rows = await db.select().from(questions).where(and(eq(questions.bankId, bankId), inArray(questions.id, ids)));
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is typeof rows[number] => !!row && row.isActive && (!row.aiGenerated || !!row.reviewedAt))
      .map((row) => row as unknown as BankQuestionRow)
      .filter(isPlayable);
  }

  async updateStop(stopId: string, patch: {
    kind?: StopKind; title?: string; story?: string | null; goal?: string | null; successCriteria?: string | null;
    mission?: string | null; resources?: ExpeditionResource[]; bankId?: string | null; questionIds?: string[];
    passPercent?: number; reviewMode?: 'ADVANCE' | 'WAIT'; dueAt?: Date | null; rewardXp?: number; rewardGold?: number;
    mapX?: number; mapY?: number; competencyId?: string | null; gradeWeight?: number; classActivity?: ClassActivity | null;
  }) {
    const context = await this.getStopContext(stopId);
    if (!context) throw new NotFoundError('Parada no encontrada');
    const { stop, expedition } = context;
    assertOpen(expedition);
    const set: Partial<typeof expeditionStops.$inferInsert> = { updatedAt: new Date() };
    const kindChanges = patch.kind !== undefined && patch.kind !== stop.kind;
    const bankChanges = patch.bankId !== undefined && patch.bankId !== stop.bankId;
    if (kindChanges) {
      const [started] = await db.select({ id: expeditionStopProgress.id }).from(expeditionStopProgress).where(eq(expeditionStopProgress.stopId, stopId)).limit(1);
      if (started) throw new ConflictError('Esta parada ya tiene avances: no se puede cambiar su tipo');
      set.kind = patch.kind;
    }
    if (bankChanges && stop.kind === 'CHALLENGE') {
      // Con respuestas guardadas del banco anterior, el % del reto dejaría de ser comparable. (Abrirlo sin responder
      // no traba el banco: un reto agregado sin preguntas tiene que poder recibirlas.)
      const [answered] = await db.select({ id: expeditionAnswers.id }).from(expeditionAnswers).where(eq(expeditionAnswers.stopId, stopId)).limit(1);
      if (answered) throw new ConflictError('Este reto ya tiene respuestas: no se puede cambiar el banco (sí sus preguntas)');
    }
    for (const key of ['title', 'story', 'goal', 'successCriteria', 'mission', 'passPercent', 'reviewMode', 'dueAt', 'rewardXp', 'rewardGold'] as const) {
      if (patch[key] !== undefined) (set as Record<string, unknown>)[key] = patch[key] === '' ? null : patch[key];
    }
    if (patch.resources !== undefined) set.resources = patch.resources;
    if (patch.mapX !== undefined) set.mapX = String(patch.mapX);
    if (patch.mapY !== undefined) set.mapY = String(patch.mapY);
    const bankId = patch.bankId !== undefined ? patch.bankId : stop.bankId;
    if (patch.bankId !== undefined && patch.bankId !== stop.bankId) {
      set.bankId = patch.bankId;
      // Las preguntas elegidas eran del banco anterior.
      if (patch.questionIds === undefined) set.questionIds = [];
    }
    if (patch.questionIds !== undefined) {
      const ids = [...new Set(patch.questionIds)];
      if (ids.length > 0) {
        if (!bankId) throw new ValidationError('Elige primero un banco de preguntas');
        if (ids.length > MAX_QUESTIONS) throw new ValidationError(`Un reto tiene hasta ${MAX_QUESTIONS} preguntas`);
        const playable = await this.playableQuestions(bankId, ids);
        if (playable.length !== ids.length) throw new ValidationError('Hay preguntas que no se pueden usar en un reto (las de IA deben estar revisadas)');
      }
      set.questionIds = ids;
    }
    // Nota: competencia de la clase y peso (solo reto y evidencia; al pasar a otro tipo se quita).
    const finalKind = set.kind ?? stop.kind;
    if (patch.gradeWeight !== undefined) set.gradeWeight = Math.max(1, Math.min(MAX_GRADE_WEIGHT, Math.round(patch.gradeWeight)));
    if (patch.competencyId !== undefined) {
      if (patch.competencyId && !GRADED_KINDS.includes(finalKind)) throw new ValidationError('Solo los retos y las evidencias cuentan para la nota');
      if (patch.competencyId) {
        const [linked] = await db.select({ id: classroomCompetencies.id }).from(classroomCompetencies)
          .where(and(eq(classroomCompetencies.classroomId, expedition.classroomId), eq(classroomCompetencies.competencyId, patch.competencyId)));
        if (!linked) throw new ValidationError('Elige una competencia de esta clase');
      }
      set.competencyId = patch.competencyId || null;
    } else if (kindChanges && !GRADED_KINDS.includes(finalKind)) {
      set.competencyId = null;
    }
    // «En clase»: la actividad del Observatorio con la que se juega (con el banco de la parada).
    if (patch.classActivity !== undefined) {
      if (patch.classActivity && finalKind !== 'CLASS') throw new ValidationError('Solo una parada «en clase» se juega con el Observatorio');
      set.classActivity = patch.classActivity || null;
    } else if (kindChanges && finalKind !== 'CLASS') {
      set.classActivity = null;
    }
    // Publicada, un reto sin preguntas deja a los alumnos esperando: se guarda junto con sus preguntas.
    const finalQuestions = set.questionIds !== undefined ? toIds(set.questionIds) : toIds(stop.questionIds);
    if (expedition.status !== 'DRAFT' && finalKind === 'CHALLENGE' && (kindChanges || patch.bankId !== undefined || patch.questionIds !== undefined)
      && finalQuestions.length === 0) {
      throw new ValidationError('Un reto publicado necesita al menos una pregunta');
    }
    await db.update(expeditionStops).set(set).where(eq(expeditionStops.id, stopId));
    await db.update(expeditions).set({ updatedAt: new Date() }).where(eq(expeditions.id, stop.expeditionId));
    const [updated] = await db.select().from(expeditionStops).where(eq(expeditionStops.id, stopId));
    return teacherStop(updated);
  }

  async deleteStop(stopId: string) {
    const context = await this.getStopContext(stopId);
    if (!context) throw new NotFoundError('Parada no encontrada');
    const { stop, expedition } = context;
    await transaction(async (tx) => {
      // Mismo orden de candados que las acciones del alumno: perfiles → expedición → avance.
      const students = await tx.selectDistinct({ id: expeditionStopProgress.studentProfileId }).from(expeditionStopProgress)
        .where(eq(expeditionStopProgress.expeditionId, expedition.id));
      await lockStudents(tx, students.map((s) => s.id));
      // Cerrada: borrar una parada ya no da la meta (ni su XP) a quien tenía las demás.
      assertOpen(await this.requireExpedition(expedition.id, tx, true));
      await tx.delete(expeditionAnswers).where(eq(expeditionAnswers.stopId, stopId));
      await tx.delete(expeditionEvidence).where(eq(expeditionEvidence.stopId, stopId));
      await tx.delete(expeditionStopProgress).where(eq(expeditionStopProgress.stopId, stopId));
      await tx.delete(expeditionStops).where(eq(expeditionStops.id, stopId));
      const rest = await this.stopsOf(expedition.id, tx);
      for (const [index, other] of rest.entries()) {
        if (other.sortOrder !== index) await tx.update(expeditionStops).set({ sortOrder: index }).where(eq(expeditionStops.id, other.id));
      }
      await tx.update(expeditions).set({ updatedAt: new Date() }).where(eq(expeditions.id, expedition.id));
      // Quien tenía todo lo demás logrado llega ahora a la meta.
      if (expedition.status === 'DRAFT' || rest.length === 0) return { value: null, after: [] };
      const grants: Grant[] = [];
      for (const student of students) await this.checkFinishInTx(tx, expedition, student.id, grants, null);
      return { value: null, after: [await this.grantInTx(tx, expedition.classroomId, grants)] };
    });
    return { deleted: stop.id };
  }

  async reorderStops(expeditionId: string, stopIds: string[]) {
    await transaction(async (tx) => {
      assertOpen(await this.requireExpedition(expeditionId, tx, true));
      const current = await this.stopsOf(expeditionId, tx);
      const known = new Set(current.map((s) => s.id));
      if (stopIds.length !== current.length || new Set(stopIds).size !== stopIds.length || stopIds.some((id) => !known.has(id))) {
        throw new ValidationError('El orden no coincide con las paradas de la expedición');
      }
      for (const [index, id] of stopIds.entries()) {
        await tx.update(expeditionStops).set({ sortOrder: index }).where(eq(expeditionStops.id, id));
      }
      await tx.update(expeditions).set({ updatedAt: new Date() }).where(eq(expeditions.id, expeditionId));
      return { value: null, after: [] };
    });
    return this.getForTeacher(expeditionId);
  }

  // ==================== Docente: progreso, revisión y «en clase» ====================

  private async activeStudents(classroomId: string) {
    const rows = await db
      .select({
        id: studentProfiles.id, userId: studentProfiles.userId, displayName: studentProfiles.displayName,
        characterName: studentProfiles.characterName, firstName: users.firstName, lastName: users.lastName,
      })
      .from(studentProfiles)
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(and(eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true)));
    return rows
      .map((row) => ({ id: row.id, userId: row.userId, name: studentName(row), characterName: row.characterName }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async board(expeditionId: string) {
    const expedition = await this.requireExpedition(expeditionId);
    const [stops, students, progress, finishes] = await Promise.all([
      this.stopsOf(expeditionId),
      this.activeStudents(expedition.classroomId),
      db.select().from(expeditionStopProgress).where(eq(expeditionStopProgress.expeditionId, expeditionId)),
      db.select().from(expeditionFinishes).where(eq(expeditionFinishes.expeditionId, expeditionId)),
    ]);
    const byStudent = new Map<string, Map<string, ExpeditionStopProgress>>();
    for (const row of progress) {
      const map = byStudent.get(row.studentProfileId) ?? new Map();
      map.set(row.stopId, row);
      byStudent.set(row.studentProfileId, map);
    }
    const finishOf = new Map(finishes.map((f) => [f.studentProfileId, f]));
    const here = new Map<string, number>();
    const done = new Map<string, number>();
    const rows = students.map((student) => {
      const states = computeStates(stops, byStudent.get(student.id) ?? new Map());
      const frontier = frontierOf(states);
      if (frontier) here.set(frontier.stop.id, (here.get(frontier.stop.id) ?? 0) + 1);
      for (const s of states) if (s.row?.status === 'DONE') done.set(s.stop.id, (done.get(s.stop.id) ?? 0) + 1);
      const finish = finishOf.get(student.id);
      return {
        id: student.id,
        name: student.name,
        characterName: student.characterName,
        hasAccount: !!student.userId,
        doneCount: states.filter((s) => s.row?.status === 'DONE').length,
        finished: !!finish || isFinished(states),
        current: frontier ? { stopId: frontier.stop.id, state: frontier.state } : null,
        reflection: finish?.reflection ? { value: finish.reflection as Reflection, note: finish.reflectionNote } : null,
        states: states.map((s) => ({
          stopId: s.stop.id, state: s.state, review: s.row?.review ?? null, firstScore: s.row?.firstScore ?? null, goldStar: !!s.row?.goldStar,
          inClass: !!s.row?.doneInClass, gradeLabel: s.row?.gradeLabel ?? null,
        })),
      };
    });
    const clans = expedition.groupMode === 'CLAN' ? await this.clanProgress(db, expedition) : [];
    return {
      stops: stops.map((stop) => ({ id: stop.id, sortOrder: stop.sortOrder, kind: stop.kind, title: stop.title, here: here.get(stop.id) ?? 0, done: done.get(stop.id) ?? 0 })),
      students: rows,
      groupMode: expedition.groupMode,
      clans: clans.map((clan) => ({
        id: clan.id, name: clan.name, color: clan.color, emblem: clan.emblem, members: clan.members, countedStopIds: clan.countedStopIds, finished: clan.finished,
      })),
      goal: this.goalDto(expedition, rows.filter((row) => finishOf.has(row.id)).length, rows.length),
    };
  }

  /** Meta de clase para mostrar (null = sin meta). */
  private goalDto(expedition: Expedition, finished: number, total: number) {
    if (!expedition.goalPercent) return null;
    return { percent: expedition.goalPercent, dueAt: expedition.goalDueAt, xp: expedition.goalXp, reachedAt: expedition.goalReachedAt, finished, total };
  }

  async reviewQueue(expeditionId: string) {
    const expedition = await this.requireExpedition(expeditionId);
    const rows = await db
      .select({
        progress: expeditionStopProgress,
        stopTitle: expeditionStops.title,
        stopOrder: expeditionStops.sortOrder,
        reviewMode: expeditionStops.reviewMode,
        rewardXp: expeditionStops.rewardXp,
        rewardGold: expeditionStops.rewardGold,
        competencyId: expeditionStops.competencyId,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: studentProfiles.displayName,
        characterName: studentProfiles.characterName,
      })
      .from(expeditionStopProgress)
      .innerJoin(expeditionStops, eq(expeditionStopProgress.stopId, expeditionStops.id))
      .innerJoin(studentProfiles, eq(expeditionStopProgress.studentProfileId, studentProfiles.id))
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(and(
        eq(expeditionStopProgress.expeditionId, expeditionId),
        eq(studentProfiles.isActive, true),
        inArray(expeditionStopProgress.review, ['PENDING', 'NEEDS_WORK']),
      ));
    const evidence = rows.length
      ? await db.select().from(expeditionEvidence)
        .where(and(eq(expeditionEvidence.expeditionId, expeditionId), inArray(expeditionEvidence.studentProfileId, [...new Set(rows.map((r) => r.progress.studentProfileId))])))
        .orderBy(desc(expeditionEvidence.submittedAt), desc(expeditionEvidence.id))
      : [];
    const latest = new Map<string, typeof evidence[number]>();
    for (const item of evidence) {
      const key = `${item.stopId}:${item.studentProfileId}`;
      if (!latest.has(key)) latest.set(key, item);
    }
    const stopCount = (await this.stopsOf(expeditionId)).length;
    // Paradas que cuentan para la nota: al aprobar se puede elegir el nivel en la escala de la clase.
    const competencyIds = [...new Set(rows.map((r) => r.competencyId).filter((id): id is string => !!id))];
    const competencyNames = new Map(competencyIds.length
      ? (await db.select({ id: curriculumCompetencies.id, name: curriculumCompetencies.name, shortName: curriculumCompetencies.shortName })
        .from(curriculumCompetencies).where(inArray(curriculumCompetencies.id, competencyIds))).map((c) => [c.id, c.shortName || c.name])
      : []);
    const scale = await this.classroomScale(expedition.classroomId);
    const items = rows.map((row) => {
      const item = latest.get(`${row.progress.stopId}:${row.progress.studentProfileId}`);
      return {
        progressId: row.progress.id,
        stopId: row.progress.stopId,
        stopTitle: row.stopTitle,
        stopNumber: row.stopOrder + 1,
        reviewMode: row.reviewMode,
        rewardXp: row.rewardXp,
        rewardGold: row.rewardGold,
        competency: row.competencyId ? { id: row.competencyId, name: competencyNames.get(row.competencyId) ?? 'Competencia' } : null,
        review: row.progress.review,
        feedback: row.progress.feedback,
        reviewedAt: row.progress.reviewedAt,
        student: { id: row.progress.studentProfileId, name: studentName(row), characterName: row.characterName },
        evidence: item ? { id: item.id, files: toFiles(item.files), note: item.note, submittedAt: item.submittedAt } : null,
      };
    });
    const bySubmitted = (a: typeof items[number], b: typeof items[number]) =>
      new Date(a.evidence?.submittedAt ?? 0).getTime() - new Date(b.evidence?.submittedAt ?? 0).getTime();
    return {
      expeditionId: expedition.id,
      stopCount,
      scale: scaleOptions(scale.type, scale.config),
      scaleType: scale.type,
      pending: items.filter((item) => item.review === 'PENDING').sort(bySubmitted),
      needsWork: items.filter((item) => item.review === 'NEEDS_WORK').sort(bySubmitted),
    };
  }

  /** Escala de notas de la clase (AD/A/B/C, 0–20, 0–100 o la propia). */
  private async classroomScale(classroomId: string) {
    const [row] = await db.select({ type: classrooms.gradeScaleType, config: classrooms.gradeScaleConfig }).from(classrooms).where(eq(classrooms.id, classroomId));
    return { type: row?.type ?? null, config: parseScaleConfig(row?.config) };
  }

  async review(expeditionId: string, teacherId: string, decisions: {
    progressId: string; decision: 'APPROVE' | 'NEEDS_WORK'; feedback?: string | null; evidenceId?: string | null; level?: string | null;
  }[]) {
    const expedition = await this.requireExpedition(expeditionId);
    // Cerrada: se aprueba lo que entregaron antes de cerrar (y paga como siempre); pedir mejora no sirve, ya no pueden reenviar.
    if (expedition.status === 'ARCHIVED' && decisions.some((d) => d.decision === 'NEEDS_WORK')) {
      throw new ConflictError('La expedición está cerrada: solo puedes aprobar. Para pedir mejoras, ábrela de nuevo');
    }
    const stops = new Map((await this.stopsOf(expeditionId)).map((stop) => [stop.id, stop]));
    const progressIds = [...new Set(decisions.map((d) => d.progressId))];
    // Nivel elegido al aprobar, en la escala de la clase (AD/A/B/C, 0–20…): se valida antes de tocar nada.
    const scale = decisions.some((d) => d.level) ? await this.classroomScale(expedition.classroomId) : null;
    const levels = new Map<string, { score: number; label: string }>();
    for (const decision of decisions) {
      if (!decision.level || decision.decision !== 'APPROVE' || !scale) continue;
      try {
        levels.set(decision.progressId, scaleValueToScore(decision.level, scale.type, scale.config));
      } catch (error) {
        throw new ValidationError(error instanceof Error ? error.message : 'Nivel no válido');
      }
    }
    // Solo alumnos activos (un pedido armado a mano no paga a un perfil dado de baja).
    const owners = await db.select({ studentProfileId: expeditionStopProgress.studentProfileId }).from(expeditionStopProgress)
      .innerJoin(studentProfiles, eq(expeditionStopProgress.studentProfileId, studentProfiles.id))
      .where(and(inArray(expeditionStopProgress.id, progressIds), eq(expeditionStopProgress.expeditionId, expeditionId), eq(studentProfiles.isActive, true)));
    const active = new Set(owners.map((o) => o.studentProfileId));
    const { result, touched } = await transaction(async (tx) => {
      // Mismo orden de candados que el alumno: perfiles → avance.
      await lockStudents(tx, [...active]);
      const result = { approved: 0, needsWork: 0, skipped: 0, changed: 0 };
      const touched: string[] = [];
      const grants: Grant[] = [];
      const notices: { studentProfileId: string; stopId: string; stopTitle: string; feedback: string | null }[] = [];
      const now = new Date();
      for (const decision of decisions) {
        const [row] = await tx.select().from(expeditionStopProgress)
          .where(and(eq(expeditionStopProgress.id, decision.progressId), eq(expeditionStopProgress.expeditionId, expeditionId)))
          .for('update');
        const stop = row ? stops.get(row.stopId) : undefined;
        if (!row || !stop || stop.kind !== 'EVIDENCE' || row.review === 'APPROVED' || !row.review || !active.has(row.studentProfileId)) {
          result.skipped++;
          continue;
        }
        if (decision.evidenceId !== undefined) {
          // El alumno pudo cambiar su entrega mientras el docente miraba la anterior: no se decide sobre lo que nadie vio.
          const [latest] = await tx.select({ id: expeditionEvidence.id }).from(expeditionEvidence)
            .where(and(eq(expeditionEvidence.stopId, row.stopId), eq(expeditionEvidence.studentProfileId, row.studentProfileId)))
            .orderBy(desc(expeditionEvidence.submittedAt), desc(expeditionEvidence.id))
            .limit(1);
          if ((latest?.id ?? null) !== decision.evidenceId) {
            result.changed++;
            continue;
          }
        }
        touched.push(row.studentProfileId);
        if (decision.decision === 'APPROVE') {
          const becomesDone = row.status !== 'DONE';
          // El nivel solo cuenta si la parada está ligada a una competencia.
          const level = stop.competencyId ? levels.get(row.id) ?? null : null;
          await tx.update(expeditionStopProgress).set({
            review: 'APPROVED',
            // El comentario de «pedir mejora» ya no aplica: al aprobar queda solo el de ahora (o ninguno).
            feedback: decision.feedback ?? null,
            gradeScore: level ? String(level.score) : null,
            gradeLabel: level?.label ?? null,
            reviewedAt: now,
            reviewedBy: teacherId,
            status: 'DONE',
            doneAt: row.doneAt ?? now,
            updatedAt: now,
          }).where(eq(expeditionStopProgress.id, row.id));
          // Perseverancia: la aprobó después de que se le pidiera mejorarla.
          const perseverance = row.needsWorkCount > 0 && expedition.perseveranceBadgeId
            ? { id: expedition.perseveranceBadgeId, reason: `Mejoró su evidencia en «${stop.title}» (${expedition.name})` }
            : null;
          const paid = await tx.update(expeditionStopProgress).set({ rewardedAt: now })
            .where(and(eq(expeditionStopProgress.id, row.id), isNull(expeditionStopProgress.rewardedAt)));
          if (affectedRows(paid) === 1) {
            grants.push({
              studentProfileId: row.studentProfileId, xp: stop.rewardXp, gold: stop.rewardGold,
              reason: `Expedición «${expedition.name}»: evidencia aprobada en «${stop.title}»`,
              title: '✅ Evidencia aprobada', what: `«${stop.title}»`, givenBy: teacherId, badge: perseverance,
            });
          } else if (perseverance) {
            grants.push({ studentProfileId: row.studentProfileId, xp: 0, gold: 0, reason: '', title: '', what: '', givenBy: teacherId, badge: perseverance });
          }
          if (becomesDone) await this.checkFinishInTx(tx, expedition, row.studentProfileId, grants, teacherId);
          result.approved++;
        } else {
          await tx.update(expeditionStopProgress).set({
            review: 'NEEDS_WORK',
            feedback: decision.feedback ?? null,
            needsWorkCount: sql`LEAST(${expeditionStopProgress.needsWorkCount} + 1, 255)`,
            reviewedAt: now,
            reviewedBy: teacherId,
            updatedAt: now,
          }).where(eq(expeditionStopProgress.id, row.id));
          notices.push({ studentProfileId: row.studentProfileId, stopId: stop.id, stopTitle: stop.title, feedback: decision.feedback ?? null });
          result.needsWork++;
        }
      }
      const after = [await this.grantInTx(tx, expedition.classroomId, grants)];
      // «Pedir mejora» va a la campana del alumno (si tiene cuenta): es importante.
      if (notices.length) {
        const accounts = new Map((await tx.select({ id: studentProfiles.id, userId: studentProfiles.userId }).from(studentProfiles)
          .where(inArray(studentProfiles.id, [...new Set(notices.map((n) => n.studentProfileId))]))).map((s) => [s.id, s.userId]));
        const notifTx = prepareForTx(notices.flatMap((notice) => {
          const userId = accounts.get(notice.studentProfileId);
          return userId ? [{
            userId, classroomId: expedition.classroomId, type: 'ANNOUNCEMENT' as const,
            title: '✏️ Tu profe te pide mejorar',
            message: `En «${notice.stopTitle}»: ${notice.feedback ?? 'revisa tu evidencia y vuelve a entregarla'}`,
            data: { expeditionId, stopId: notice.stopId },
            createdAt: now,
          }] : [];
        }));
        if (notifTx.entries.length) await tx.insert(notifications).values(notifTx.entries);
        after.unshift(notifTx.emitAfterCommit);
      }
      return { value: { result, touched }, after };
    });
    await this.emitToStudents(touched, expeditionId);
    return result;
  }

  /**
   * Marca a los presentes en una parada hecha en clase: «en clase» desde el editor, cualquier parada desde la
   * proyección (así avanzan también los que no tienen cuenta) o la partida del Observatorio jugada desde la parada.
   * - Relato y en clase quedan logradas. El reto, logrado sin nota individual (se jugó con toda la clase).
   * - La evidencia queda aprobada en clase; se salta a quien ya entregó desde su cuenta (eso va en «Por revisar»).
   * - Con `paid: false` (la Bitácora del Observatorio ya pagó) se marca sin volver a pagar la parada.
   */
  async markPresent(stopId: string, teacherId: string, studentIds: string[], options: { paid?: boolean; onlyKind?: StopKind } = {}) {
    const payStop = options.paid !== false;
    const context = await this.getStopContext(stopId);
    if (!context) throw new NotFoundError('Parada no encontrada');
    const { stop, expedition } = context;
    if (expedition.status !== 'PUBLISHED') throw new ConflictError('La expedición no está publicada');
    // La partida del Observatorio se enlazó a una parada «en clase»: si después cambió de tipo, no se marca.
    if (options.onlyKind && stop.kind !== options.onlyKind) throw new ConflictError('La parada ya no es «en clase»');
    // Solo alumnos activos de la clase (un perfil dado de baja no recibe la parada ni su recompensa).
    const ids = studentIds.length === 0 ? [] : (await db.select({ id: studentProfiles.id }).from(studentProfiles)
      .where(and(inArray(studentProfiles.id, [...new Set(studentIds)]), eq(studentProfiles.classroomId, expedition.classroomId), eq(studentProfiles.isActive, true))))
      .map((s) => s.id);
    const marked = await transaction(async (tx) => {
      await lockStudents(tx, ids);
      const marked: string[] = [];
      const grants: Grant[] = [];
      const now = new Date();
      for (const studentId of ids) {
        await tx.insert(expeditionStopProgress).ignore().values({
          id: uuidv4(), expeditionId: expedition.id, stopId, studentProfileId: studentId, status: 'STARTED', createdAt: now, updatedAt: now,
        });
        const [row] = await tx.select().from(expeditionStopProgress)
          .where(and(eq(expeditionStopProgress.stopId, stopId), eq(expeditionStopProgress.studentProfileId, studentId)))
          .for('update');
        if (!row || row.status === 'DONE') continue;
        if (stop.kind === 'EVIDENCE' && row.review) continue;
        await tx.update(expeditionStopProgress).set({
          status: 'DONE', doneAt: now, doneInClass: true, reviewedBy: teacherId, reviewedAt: now, updatedAt: now,
          ...(stop.kind === 'EVIDENCE' ? { review: 'APPROVED' as const } : {}),
        }).where(eq(expeditionStopProgress.id, row.id));
        marked.push(studentId);
        const paid = await tx.update(expeditionStopProgress).set({ rewardedAt: now })
          .where(and(eq(expeditionStopProgress.id, row.id), isNull(expeditionStopProgress.rewardedAt)));
        if (affectedRows(paid) === 1 && payStop) {
          grants.push({
            studentProfileId: studentId, xp: stop.rewardXp, gold: stop.rewardGold,
            reason: `Expedición «${expedition.name}»: «${stop.title}» en clase`,
            title: '🏫 Parada lograda en clase', what: `«${stop.title}»`, givenBy: teacherId,
          });
        }
        await this.checkFinishInTx(tx, expedition, studentId, grants, teacherId);
      }
      return { value: marked, after: [await this.grantInTx(tx, expedition.classroomId, grants)] };
    });
    await this.emitToStudents(marked, expedition.id);
    return { marked: marked.length, skipped: new Set(studentIds).size - marked.length, stopTitle: stop.title };
  }

  /** Parada «en clase» publicada de esa clase (para enlazarla a una partida del Observatorio). */
  async classStopFor(stopId: string, classroomId: string) {
    const context = await this.getStopContext(stopId);
    if (!context || context.expedition.classroomId !== classroomId || context.stop.kind !== 'CLASS') throw new NotFoundError('Parada no encontrada');
    if (context.expedition.status !== 'PUBLISHED') throw new ConflictError('La expedición no está publicada');
    return context;
  }

  // ==================== Alumno ====================

  private studentStop(stop: ExpeditionStop, state: StopState, row: ExpeditionStopProgress | null, evidence: { files: string[]; note: string | null; submittedAt: Date } | null) {
    // Las paradas bloqueadas muestran número, tipo y título; el contenido se ve al llegar.
    const visible = state !== 'LOCKED';
    return {
      id: stop.id,
      sortOrder: stop.sortOrder,
      kind: stop.kind,
      title: stop.title,
      story: visible ? stop.story : null,
      goal: visible ? stop.goal : null,
      successCriteria: visible ? stop.successCriteria : null,
      mission: visible ? stop.mission : null,
      resources: visible ? toResources(stop.resources) : [],
      dueAt: stop.dueAt,
      rewardXp: stop.rewardXp,
      rewardGold: stop.rewardGold,
      passPercent: stop.passPercent,
      reviewMode: stop.reviewMode,
      questionCount: toIds(stop.questionIds).length,
      mapX: num(stop.mapX),
      mapY: num(stop.mapY),
      state,
      review: row?.review ?? null,
      feedback: row?.review === 'NEEDS_WORK' || row?.review === 'APPROVED' ? row.feedback : null,
      firstScore: row?.firstScore ?? null,
      finalScore: row?.finalScore ?? null,
      goldStar: !!row?.goldStar,
      doneInClass: !!row?.doneInClass,
      evidence,
    };
  }

  async listForStudent(classroomId: string, studentProfileId: string) {
    const rows = await db.select().from(expeditions)
      .where(and(eq(expeditions.classroomId, classroomId), inArray(expeditions.status, ['PUBLISHED', 'ARCHIVED'])))
      .orderBy(desc(expeditions.publishedAt));
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [stops, progress, finishes] = await Promise.all([
      db.select().from(expeditionStops).where(inArray(expeditionStops.expeditionId, ids)).orderBy(asc(expeditionStops.sortOrder), asc(expeditionStops.createdAt)),
      db.select().from(expeditionStopProgress).where(and(inArray(expeditionStopProgress.expeditionId, ids), eq(expeditionStopProgress.studentProfileId, studentProfileId))),
      db.select().from(expeditionFinishes).where(and(inArray(expeditionFinishes.expeditionId, ids), eq(expeditionFinishes.studentProfileId, studentProfileId))),
    ]);
    const progressMap = new Map(progress.map((row) => [row.stopId, row]));
    const finished = new Set(finishes.map((f) => f.expeditionId));
    return rows
      .map((expedition) => {
        const own = stops.filter((stop) => stop.expeditionId === expedition.id);
        const states = computeStates(own, progressMap);
        const frontier = frontierOf(states);
        const done = isFinished(states);
        const needsWork = states.find((s) => s.state === 'NEEDS_WORK');
        return {
          id: expedition.id,
          name: expedition.name,
          description: expedition.description,
          scenario: expedition.scenario,
          constellationId: expedition.constellationId,
          mapImageUrl: expedition.mapImageUrl,
          status: expedition.status,
          publishedAt: expedition.publishedAt,
          stopsCount: own.length,
          doneCount: states.filter((s) => s.row?.status === 'DONE').length,
          finished: finished.has(expedition.id) || done,
          current: frontier ? { id: frontier.stop.id, title: frontier.stop.title, kind: frontier.stop.kind, state: frontier.state, dueAt: frontier.stop.dueAt } : null,
          needsWork: expedition.status === 'PUBLISHED' && needsWork ? { id: needsWork.stop.id, title: needsWork.stop.title } : null,
          actionable: expedition.status === 'PUBLISHED' && hasActionable(states),
        };
      })
      .filter((expedition) => expedition.stopsCount > 0);
  }

  async getForStudent(expeditionId: string, studentProfileId: string) {
    const expedition = await this.requireExpedition(expeditionId);
    if (expedition.status === 'DRAFT') throw new NotFoundError('Expedición no encontrada');
    const [stops, progress, evidence, [finish]] = await Promise.all([
      this.stopsOf(expeditionId),
      this.progressMap(expeditionId, studentProfileId),
      db.select().from(expeditionEvidence)
        .where(and(eq(expeditionEvidence.expeditionId, expeditionId), eq(expeditionEvidence.studentProfileId, studentProfileId)))
        .orderBy(desc(expeditionEvidence.submittedAt)),
      db.select().from(expeditionFinishes).where(and(eq(expeditionFinishes.expeditionId, expeditionId), eq(expeditionFinishes.studentProfileId, studentProfileId))),
    ]);
    const latest = new Map<string, { files: string[]; note: string | null; submittedAt: Date }>();
    for (const item of evidence) if (!latest.has(item.stopId)) latest.set(item.stopId, { files: toFiles(item.files), note: item.note, submittedAt: item.submittedAt });
    const states = computeStates(stops, progress);
    const finished = !!finish || isFinished(states);
    const frontier = frontierOf(states);
    // Su clan (modo por clanes) y la meta de la clase: lo cooperativo que ve el alumno.
    let clan: { name: string; color: string; emblem: string; members: number; countedStopIds: string[]; finished: boolean } | null = null;
    if (expedition.groupMode === 'CLAN') {
      const [own] = await db.select({ teamId: studentProfiles.teamId }).from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
      const [progressOfClan] = own?.teamId ? await this.clanProgress(db, expedition, [own.teamId]) : [];
      if (progressOfClan) {
        clan = {
          name: progressOfClan.name, color: progressOfClan.color, emblem: progressOfClan.emblem,
          members: progressOfClan.members, countedStopIds: progressOfClan.countedStopIds, finished: progressOfClan.finished,
        };
      }
    }
    const goalCounts = expedition.goalPercent ? await this.classFinishCounts(db, expedition) : null;
    const goal = goalCounts ? { ...this.goalDto(expedition, goalCounts.finished, goalCounts.total)!, rewarded: !!finish?.goalRewardedAt } : null;
    return {
      id: expedition.id,
      classroomId: expedition.classroomId,
      name: expedition.name,
      description: expedition.description,
      scenario: expedition.scenario,
      constellationId: expedition.constellationId,
      mapImageUrl: expedition.mapImageUrl,
      status: expedition.status,
      finishXp: expedition.finishXp,
      finishGold: expedition.finishGold,
      closingText: finished ? expedition.closingText : null,
      finishedAt: finish?.finishedAt ?? null,
      finished,
      // «¿Cómo me fue?»: se responde al llegar a la meta (y se puede cambiar).
      reflection: finish?.reflection ? { value: finish.reflection as Reflection, note: finish.reflectionNote } : null,
      groupMode: expedition.groupMode,
      clan,
      goal,
      currentStopId: frontier?.stop.id ?? null,
      stops: states.map((s) => this.studentStop(s.stop, s.state, s.row, s.stop.kind === 'EVIDENCE' ? latest.get(s.stop.id) ?? null : null)),
    };
  }

  /** «¿Cómo me fue?» del alumno que llegó a la meta. No paga nada: es reflexión, sin presión. */
  async reflect(expeditionId: string, studentProfileId: string, value: Reflection, note: string | null) {
    const expedition = await this.requireExpedition(expeditionId);
    if (expedition.status === 'DRAFT') throw new NotFoundError('Expedición no encontrada');
    const result = await db.update(expeditionFinishes)
      .set({ reflection: value, reflectionNote: note, reflectedAt: new Date() })
      .where(and(eq(expeditionFinishes.expeditionId, expeditionId), eq(expeditionFinishes.studentProfileId, studentProfileId)));
    if (affectedRows(result) !== 1) {
      // MySQL cuenta 0 filas si no cambió nada: se distingue «no llegó a la meta» de «misma respuesta».
      const [finish] = await db.select({ id: expeditionFinishes.expeditionId }).from(expeditionFinishes)
        .where(and(eq(expeditionFinishes.expeditionId, expeditionId), eq(expeditionFinishes.studentProfileId, studentProfileId)));
      if (!finish) throw new ConflictError('Primero llega a la meta');
    }
    return this.getForStudent(expeditionId, studentProfileId);
  }

  /** Contexto de una acción del alumno: parada, expedición publicada y su estado actual (con la fila bloqueada). */
  private async actionContext(tx: Tx, stopId: string, studentProfileId: string, kind: StopKind) {
    // Primero el perfil del alumno: dos pestañas (o dos toques) del mismo alumno se ponen en fila.
    await lockStudents(tx, [studentProfileId]);
    const [context] = await tx.select({ stop: expeditionStops, expedition: expeditions })
      .from(expeditionStops).innerJoin(expeditions, eq(expeditionStops.expeditionId, expeditions.id))
      .where(eq(expeditionStops.id, stopId));
    if (!context || context.expedition.status === 'DRAFT') throw new NotFoundError('Parada no encontrada');
    if (context.stop.kind !== kind) throw new ValidationError('Esta acción no corresponde a la parada');
    if (context.expedition.status === 'ARCHIVED') throw new ConflictError('Esta expedición ya terminó');
    const stops = await this.stopsOf(context.expedition.id, tx);
    const progress = await this.progressMap(context.expedition.id, studentProfileId, tx);
    const target = computeStates(stops, progress).find((s) => s.stop.id === stopId);
    if (!target) throw new NotFoundError('Parada no encontrada');
    return { ...context, state: target.state, row: target.row };
  }

  async continueStory(stopId: string, studentProfileId: string) {
    const expeditionId = await transaction(async (tx) => {
      const { stop, expedition, state } = await this.actionContext(tx, stopId, studentProfileId, 'STORY');
      if (state === 'DONE') return { value: expedition.id, after: [] };
      if (state === 'LOCKED') throw new ConflictError('Esta parada todavía está bloqueada');
      const now = new Date();
      const grants: Grant[] = [];
      await tx.insert(expeditionStopProgress).ignore().values({
        id: uuidv4(), expeditionId: expedition.id, stopId, studentProfileId, status: 'DONE', doneAt: now, createdAt: now, updatedAt: now,
      });
      await tx.update(expeditionStopProgress).set({ status: 'DONE', doneAt: now, updatedAt: now })
        .where(and(eq(expeditionStopProgress.stopId, stopId), eq(expeditionStopProgress.studentProfileId, studentProfileId), sql`${expeditionStopProgress.status} <> 'DONE'`));
      await this.payStopOnce(tx, expedition, stop, studentProfileId, grants, '📖 Relato leído');
      await this.checkFinishInTx(tx, expedition, studentProfileId, grants, null);
      return { value: expedition.id, after: [await this.grantInTx(tx, expedition.classroomId, grants)] };
    });
    return this.getForStudent(expeditionId, studentProfileId);
  }

  private async payStopOnce(tx: Tx, expedition: Expedition, stop: ExpeditionStop, studentProfileId: string, grants: Grant[], title: string) {
    const paid = await tx.update(expeditionStopProgress).set({ rewardedAt: new Date() })
      .where(and(eq(expeditionStopProgress.stopId, stop.id), eq(expeditionStopProgress.studentProfileId, studentProfileId), isNull(expeditionStopProgress.rewardedAt)));
    if (affectedRows(paid) !== 1) return;
    grants.push({
      studentProfileId, xp: stop.rewardXp, gold: stop.rewardGold,
      reason: `Expedición «${expedition.name}»: «${stop.title}»`, title, what: `«${stop.title}»`, givenBy: null,
    });
  }

  /** Preguntas del reto que siguen en el banco y se pueden corregir (en el orden del docente). */
  private async challengeQuestions(stop: ExpeditionStop) {
    if (!stop.bankId) return [];
    return this.playableQuestions(stop.bankId, toIds(stop.questionIds));
  }

  async getChallenge(stopId: string, studentProfileId: string) {
    const context = await this.getStopContext(stopId);
    if (!context || context.expedition.status === 'DRAFT') throw new NotFoundError('Parada no encontrada');
    const { stop, expedition } = context;
    if (stop.kind !== 'CHALLENGE') throw new ValidationError('Esta parada no es un reto');
    const states = computeStates(await this.stopsOf(expedition.id), await this.progressMap(expedition.id, studentProfileId));
    const target = states.find((s) => s.stop.id === stopId);
    if (!target || target.state === 'LOCKED') throw new ConflictError('Esta parada todavía está bloqueada');
    const list = await this.challengeQuestions(stop);
    const answersOf = (exec: Tx | typeof db) => exec.select().from(expeditionAnswers)
      .where(and(eq(expeditionAnswers.stopId, stopId), eq(expeditionAnswers.studentProfileId, studentProfileId)));
    if (expedition.status === 'PUBLISHED' && target.row?.status !== 'DONE') {
      // La fila nace al abrir el reto. Y si el docente quitó preguntas a mitad de vuelta (o las borró del banco),
      // la vuelta ya respondida se cierra aquí: antes solo se cerraba al responder y el reto quedaba trabado.
      const current = target.row;
      const answered = current ? await answersOf(db) : [];
      const stale = !!current && list.length > 0
        && roundOf(current.attempt, list, answered).every((id) => answered.some((a) => a.attempt === current.attempt && a.questionId === id));
      if (!current || stale) {
        await transaction(async (tx) => {
          await lockStudents(tx, [studentProfileId]);
          const now = new Date();
          await tx.insert(expeditionStopProgress).ignore().values({
            id: uuidv4(), expeditionId: expedition.id, stopId, studentProfileId, status: 'STARTED', createdAt: now, updatedAt: now,
          });
          const [row] = await tx.select().from(expeditionStopProgress)
            .where(and(eq(expeditionStopProgress.stopId, stopId), eq(expeditionStopProgress.studentProfileId, studentProfileId)))
            .for('update');
          if (!row || row.status === 'DONE') return { value: null, after: [] };
          const settled = await this.settleRound(tx, expedition, stop, row, list, await answersOf(tx), now);
          return { value: null, after: settled.after };
        });
      }
    }
    const [row] = await db.select().from(expeditionStopProgress)
      .where(and(eq(expeditionStopProgress.stopId, stopId), eq(expeditionStopProgress.studentProfileId, studentProfileId)));
    const answers = await answersOf(db);
    const attempt = row?.attempt ?? 1;
    const byId = new Map(list.map((q) => [q.id, q]));
    return {
      status: row?.status ?? 'STARTED',
      attempt,
      passPercent: stop.passPercent,
      firstScore: row?.firstScore ?? null,
      finalScore: row?.finalScore ?? null,
      goldStar: !!row?.goldStar,
      // Lo jugaron juntos en clase (proyectado): logrado, sin % propio.
      doneInClass: !!row?.doneInClass,
      // Sin preguntas (el docente las está eligiendo): el alumno espera, no queda trabado.
      preparing: list.length === 0 && row?.status !== 'DONE',
      questions: list.map((q) => toStudentQuestion(q, questionSeed(stopId, studentProfileId, q.id))),
      round: roundOf(attempt, list, answers),
      answers: answers.map((a) => {
        const question = byId.get(a.questionId);
        const reveal = !a.isCorrect && (a.attempt === 2 || row?.status === 'DONE');
        return {
          questionId: a.questionId,
          attempt: a.attempt,
          isCorrect: a.isCorrect,
          explanation: question?.explanation ?? null,
          correctAnswer: reveal && question ? correctAnswerFor(question, questionSeed(stopId, studentProfileId, question.id)) : null,
        };
      }),
    };
  }

  /**
   * Cierra la vuelta del reto si ya están respondidas todas sus preguntas actuales. La usan responder y abrir el
   * reto, así un cambio del docente a mitad de vuelta no lo traba. Un reto sin preguntas no se cierra solo: espera
   * a que el docente las elija.
   */
  private async settleRound(tx: Tx, expedition: Expedition, stop: ExpeditionStop, row: ExpeditionStopProgress, list: BankQuestionRow[], answers: AnswerMark[], now: Date) {
    const attempt = row.attempt;
    const roundIds = roundOf(attempt, list, answers);
    const round = answers.filter((a) => a.attempt === attempt && roundIds.includes(a.questionId));
    const outcome = {
      complete: list.length > 0 && row.status !== 'DONE' && roundIds.every((id) => round.some((a) => a.questionId === id)),
      score: null as number | null,
      passed: false,
      done: false,
      goldStar: false,
      retry: [] as string[],
      after: [] as (() => Promise<void>)[],
    };
    if (!outcome.complete) return outcome;
    const grants: Grant[] = [];
    if (attempt === 1) {
      outcome.score = Math.round((round.filter((a) => a.isCorrect).length * 100) / roundIds.length);
      outcome.passed = outcome.score >= stop.passPercent;
      outcome.goldStar = outcome.score >= GOLD_STAR_SCORE;
      outcome.retry = round.filter((a) => !a.isCorrect).map((a) => a.questionId);
      outcome.done = outcome.passed || outcome.retry.length === 0;
      await tx.update(expeditionStopProgress).set({
        firstScore: outcome.score,
        // La estrella es por el primer intento, aunque el mínimo para superar pase de 80 %.
        goldStar: outcome.goldStar,
        ...(outcome.done ? { status: 'DONE' as const, finalScore: outcome.score, doneAt: now } : { attempt: 2 }),
        updatedAt: now,
      }).where(eq(expeditionStopProgress.id, row.id));
    } else {
      // Reintento: el reto queda superado igual; la nota usa el primer intento y aquí se mide la mejora.
      const inList = new Set(list.map((q) => q.id));
      const correctFirst = answers.filter((a) => a.attempt === 1 && a.isCorrect && inList.has(a.questionId)).length;
      outcome.score = Math.round(((correctFirst + round.filter((a) => a.isCorrect).length) * 100) / list.length);
      outcome.passed = true;
      outcome.done = true;
      outcome.goldStar = !!row.goldStar;
      await tx.update(expeditionStopProgress).set({ status: 'DONE', finalScore: outcome.score, doneAt: now, updatedAt: now })
        .where(eq(expeditionStopProgress.id, row.id));
    }
    if (outcome.done) {
      await this.payStopOnce(tx, expedition, stop, row.studentProfileId, grants, outcome.goldStar ? '⭐ ¡Reto superado con estrella!' : '❓ Reto superado');
      await this.checkFinishInTx(tx, expedition, row.studentProfileId, grants, null);
    }
    outcome.after.push(await this.grantInTx(tx, expedition.classroomId, grants));
    return outcome;
  }

  async answer(stopId: string, studentProfileId: string, questionId: string, answer: unknown) {
    return transaction(async (tx) => {
      const { stop, expedition, state } = await this.actionContext(tx, stopId, studentProfileId, 'CHALLENGE');
      if (state === 'LOCKED') throw new ConflictError('Esta parada todavía está bloqueada');
      if (state === 'DONE' || state === 'NEEDS_WORK') throw new ConflictError('Ya terminaste este reto');
      const now = new Date();
      await tx.insert(expeditionStopProgress).ignore().values({
        id: uuidv4(), expeditionId: expedition.id, stopId, studentProfileId, status: 'STARTED', createdAt: now, updatedAt: now,
      });
      const [row] = await tx.select().from(expeditionStopProgress)
        .where(and(eq(expeditionStopProgress.stopId, stopId), eq(expeditionStopProgress.studentProfileId, studentProfileId)))
        .for('update');
      if (!row || row.status === 'DONE') throw new ConflictError('Ya terminaste este reto');

      const list = await this.challengeQuestions(stop);
      const question = list.find((q) => q.id === questionId);
      if (!question) throw new ValidationError('Esa pregunta no es de este reto');
      const previous = await tx.select().from(expeditionAnswers)
        .where(and(eq(expeditionAnswers.stopId, stopId), eq(expeditionAnswers.studentProfileId, studentProfileId)));
      const attempt = row.attempt;
      if (!roundOf(attempt, list, previous).includes(questionId)) throw new ValidationError('Esa pregunta no está en esta vuelta');
      if (previous.some((a) => a.attempt === attempt && a.questionId === questionId)) throw new ConflictError('Ya respondiste esta pregunta');
      if (!isWellFormedAnswer(question.type, answer)) throw new ValidationError('Respuesta no válida');

      const seed = questionSeed(stopId, studentProfileId, questionId);
      const isCorrect = checkAnswer(question, answer, seed);
      try {
        await tx.insert(expeditionAnswers).values({
          id: uuidv4(), stopId, studentProfileId, questionId, attempt, answer, isCorrect, answeredAt: now,
        });
      } catch (error) {
        if (isDuplicateEntry(error)) throw new ConflictError('Ya respondiste esta pregunta');
        throw error;
      }

      // Solo cuentan las preguntas que siguen en el reto (el docente pudo quitar alguna a mitad de vuelta).
      const settled = await this.settleRound(tx, expedition, stop, row, list, [...previous, { questionId, attempt, isCorrect }], now);
      const value = {
        isCorrect,
        explanation: question.explanation ?? null,
        // La respuesta correcta se muestra recién en el reintento (en la primera vuelta, solo la explicación).
        correctAnswer: !isCorrect && attempt === 2 ? correctAnswerFor(question, seed) : null,
        roundComplete: settled.complete,
        attempt: settled.complete && !settled.done ? 2 : attempt,
        score: settled.score,
        passed: settled.passed,
        done: settled.done,
        goldStar: settled.goldStar,
        retry: settled.retry,
      };
      return { value, after: settled.after };
    });
  }

  async submitEvidence(stopId: string, studentProfileId: string, input: { files: string[]; note: string | null }) {
    const { expedition, stopTitle } = await transaction(async (tx) => {
      const { stop, state, row, expedition } = await this.actionContext(tx, stopId, studentProfileId, 'EVIDENCE');
      if (state === 'LOCKED') throw new ConflictError('Esta parada todavía está bloqueada');
      if (row?.review === 'APPROVED') throw new ConflictError('Tu profe ya aprobó esta evidencia');
      const now = new Date();
      const grants: Grant[] = [];
      await tx.insert(expeditionEvidence).values({
        id: uuidv4(), expeditionId: expedition.id, stopId, studentProfileId, files: input.files, note: input.note, submittedAt: now,
      });
      const advance = stop.reviewMode === 'ADVANCE';
      if (!row) {
        await tx.insert(expeditionStopProgress).values({
          id: uuidv4(), expeditionId: expedition.id, stopId, studentProfileId,
          status: advance ? 'DONE' : 'WAITING', review: 'PENDING', doneAt: advance ? now : null, createdAt: now, updatedAt: now,
        });
      } else {
        await tx.update(expeditionStopProgress).set({
          review: 'PENDING',
          ...(row.status !== 'DONE' ? { status: advance ? 'DONE' as const : 'WAITING' as const, doneAt: advance ? now : null } : {}),
          updatedAt: now,
        }).where(eq(expeditionStopProgress.id, row.id));
      }
      if (advance && row?.status !== 'DONE') await this.checkFinishInTx(tx, expedition, studentProfileId, grants, null);
      return { value: { expedition, stopTitle: stop.title }, after: [await this.grantInTx(tx, expedition.classroomId, grants)] };
    });
    await this.notifyTeacherOfEvidence(expedition, stopTitle);
    return this.getForStudent(expedition.id, studentProfileId);
  }

  /** Un solo aviso al día por expedición (no uno por entrega) y el contador del docente al instante. */
  private async notifyTeacherOfEvidence(expedition: Expedition, stopTitle: string) {
    try {
      const [classroom] = await db.select({ teacherId: classrooms.teacherId }).from(classrooms).where(eq(classrooms.id, expedition.classroomId));
      if (!classroom) return;
      emitToUsers([classroom.teacherId], 'expedition:review', { expeditionId: expedition.id });
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [already] = await db.select({ id: notifications.id }).from(notifications)
        .where(and(
          eq(notifications.userId, classroom.teacherId),
          eq(notifications.isRead, false),
          sql`${notifications.createdAt} >= ${startOfDay}`,
          sql`JSON_UNQUOTE(JSON_EXTRACT(${notifications.data}, '$.expeditionReview')) = ${expedition.id}`,
        ))
        .limit(1);
      if (already) return;
      const { entries, emitAfterCommit } = prepareForTx({
        userId: classroom.teacherId,
        classroomId: expedition.classroomId,
        type: 'ANNOUNCEMENT',
        title: '📤 Evidencias por revisar',
        message: `Llegaron evidencias en «${expedition.name}» (la última, en «${stopTitle}»). Revísalas en Expediciones.`,
        data: { expeditionReview: expedition.id },
      });
      await db.insert(notifications).values(entries);
      await emitAfterCommit();
    } catch (error) {
      console.error('Aviso de evidencia al docente', error);
    }
  }

  // ==================== Meta y pagos ====================

  /**
   * Después de que una parada queda lograda: la meta del alumno (paga la recompensa final una vez) y, después
   * del commit, lo cooperativo (clanes y meta de la clase).
   */
  private async checkFinishInTx(tx: Tx, expedition: Expedition, studentProfileId: string, grants: Grant[], givenBy: string | null) {
    // Clanes y meta de clase cuentan el avance de varios alumnos: dentro de esta transacción no se ve lo que otros
    // guardan a la vez (dos que logran la última parada al mismo tiempo no se contarían entre sí), así que se
    // revisan después del commit, con datos frescos y una sola vez aunque se marquen muchos alumnos.
    if (expedition.groupMode === 'CLAN' || expedition.goalPercent) {
      grants.push({ ...noPoints, studentProfileId, followUp: { key: `together:${expedition.id}`, run: () => this.checkTogether(expedition.id) } });
    }
    const [{ total }] = await tx.select({ total: sql<number>`COUNT(*)` }).from(expeditionStops).where(eq(expeditionStops.expeditionId, expedition.id));
    const [{ done }] = await tx.select({ done: sql<number>`COUNT(*)` }).from(expeditionStopProgress)
      .innerJoin(expeditionStops, eq(expeditionStopProgress.stopId, expeditionStops.id))
      .where(and(eq(expeditionStopProgress.expeditionId, expedition.id), eq(expeditionStopProgress.studentProfileId, studentProfileId), eq(expeditionStopProgress.status, 'DONE')));
    if (count(total) === 0 || count(done) < count(total)) return;
    const now = new Date();
    await tx.insert(expeditionFinishes).ignore().values({ expeditionId: expedition.id, studentProfileId, finishedAt: now });
    const paid = await tx.update(expeditionFinishes).set({ rewardedAt: now })
      .where(and(eq(expeditionFinishes.expeditionId, expedition.id), eq(expeditionFinishes.studentProfileId, studentProfileId), isNull(expeditionFinishes.rewardedAt)));
    if (affectedRows(paid) === 1) {
      grants.push({
        studentProfileId, xp: expedition.finishXp, gold: expedition.finishGold,
        reason: `Expedición «${expedition.name}»: llegó a la meta`, title: '🏁 ¡Llegaste a la meta!', what: `terminar «${expedition.name}»`, givenBy,
        badge: expedition.finishBadgeId ? { id: expedition.finishBadgeId, reason: `Llegó a la meta de «${expedition.name}»` } : null,
      });
    }
  }

  // ==================== Clanes y meta de clase ====================

  /**
   * Capa de clanes: una parada cuenta para un clan cuando la logra más de la mitad de sus miembros activos; con
   * todas contadas, el clan llegó a la meta. Cada alumno sigue a su ritmo: el clan no frena a nadie.
   */
  private async clanProgress(exec: Tx | typeof db, expedition: Expedition, onlyTeamIds?: string[]) {
    const clans = await exec.select({ id: teams.id, name: teams.name, color: teams.color, emblem: teams.emblem }).from(teams)
      .where(and(eq(teams.classroomId, expedition.classroomId), eq(teams.isActive, true), onlyTeamIds ? inArray(teams.id, onlyTeamIds) : undefined));
    if (clans.length === 0) return [];
    const [members, stops, recorded] = await Promise.all([
      exec.select({ id: studentProfiles.id, teamId: studentProfiles.teamId }).from(studentProfiles)
        .where(and(eq(studentProfiles.classroomId, expedition.classroomId), eq(studentProfiles.isActive, true), inArray(studentProfiles.teamId, clans.map((c) => c.id)))),
      this.stopsOf(expedition.id, exec),
      exec.select({ teamId: expeditionClanFinishes.teamId }).from(expeditionClanFinishes)
        .where(and(eq(expeditionClanFinishes.expeditionId, expedition.id), inArray(expeditionClanFinishes.teamId, clans.map((c) => c.id)))),
    ]);
    const done = members.length && stops.length
      ? await exec.select({ stopId: expeditionStopProgress.stopId, studentProfileId: expeditionStopProgress.studentProfileId }).from(expeditionStopProgress)
        .where(and(eq(expeditionStopProgress.expeditionId, expedition.id), eq(expeditionStopProgress.status, 'DONE'), inArray(expeditionStopProgress.studentProfileId, members.map((m) => m.id))))
      : [];
    const teamOf = new Map(members.map((m) => [m.id, m.teamId]));
    const doneBy = new Map<string, number>();
    for (const row of done) {
      const key = `${teamOf.get(row.studentProfileId)}:${row.stopId}`;
      doneBy.set(key, (doneBy.get(key) ?? 0) + 1);
    }
    const arrived = new Set(recorded.map((r) => r.teamId));
    return clans.map((clan) => {
      const size = members.filter((m) => m.teamId === clan.id).length;
      const countedStopIds = stops.filter((stop) => size > 0 && (doneBy.get(`${clan.id}:${stop.id}`) ?? 0) * 2 > size).map((stop) => stop.id);
      const complete = stops.length > 0 && countedStopIds.length === stops.length;
      // Una vez en la meta, el clan queda en la meta (aunque después cambie quién está en él).
      return { ...clan, members: size, countedStopIds, complete, arrived: arrived.has(clan.id), finished: complete || arrived.has(clan.id) };
    });
  }

  /**
   * Lo cooperativo, después del commit y con datos frescos: los clanes que ya completaron todas las paradas llegan
   * a la meta (cada uno cobra una vez) y se revisa la meta de la clase. Como revisa todo, también repara lo que un
   * corte haya dejado a medias en una revisión anterior.
   */
  private async checkTogether(expeditionId: string) {
    const expedition = await this.requireExpedition(expeditionId);
    // También cerrada: aprobar lo que quedó por revisar paga como siempre, con clan y meta de clase.
    if (expedition.status === 'DRAFT') return;
    if (expedition.groupMode === 'CLAN') {
      for (const clan of await this.clanProgress(db, expedition)) {
        if (clan.complete && !clan.arrived) await this.rewardClan(expedition, clan);
      }
    }
    if (expedition.goalPercent) await this.refreshClassGoal(expeditionId);
  }

  /** Un clan completó todas las paradas: llega a la meta una vez, su premio suma al XP del clan y se avisa a sus miembros. */
  private async rewardClan(expedition: Expedition, clan: { id: string; name: string }) {
    const members = await transaction(async (tx) => {
      const now = new Date();
      await tx.insert(expeditionClanFinishes).ignore().values({ expeditionId: expedition.id, teamId: clan.id, finishedAt: now });
      const paid = await tx.update(expeditionClanFinishes).set({ rewardedAt: now })
        .where(and(eq(expeditionClanFinishes.expeditionId, expedition.id), eq(expeditionClanFinishes.teamId, clan.id), isNull(expeditionClanFinishes.rewardedAt)));
      if (affectedRows(paid) !== 1) return { value: [] as string[], after: [] };
      const clanXp = Math.max(0, expedition.clanXp);
      if (clanXp > 0) await tx.update(teams).set({ totalXp: sql`${teams.totalXp} + ${clanXp}`, updatedAt: now }).where(eq(teams.id, clan.id));
      await tx.insert(clanLogs).values({
        id: uuidv4(), clanId: clan.id, studentId: null, action: 'EXPEDITION_GOAL', xpAmount: clanXp, gpAmount: 0,
        reason: `Llegó a la meta de «${expedition.name}»`, createdAt: now,
      });
      // Aviso a los miembros con cuenta (campana): es un logro de todos.
      const accounts = await tx.select({ id: studentProfiles.id, userId: studentProfiles.userId }).from(studentProfiles)
        .where(and(eq(studentProfiles.teamId, clan.id), eq(studentProfiles.isActive, true)));
      const notifTx = prepareForTx(accounts.flatMap((a) => (a.userId ? [{
        userId: a.userId, classroomId: expedition.classroomId, type: 'ANNOUNCEMENT' as const,
        title: '🏁 ¡Tu clan llegó a la meta!',
        message: `«${clan.name}» completó «${expedition.name}»${clanXp > 0 ? `: +${clanXp} XP para el clan` : ''}.`,
        data: { expeditionId: expedition.id },
        createdAt: now,
      }] : [])));
      if (notifTx.entries.length) await tx.insert(notifications).values(notifTx.entries);
      return { value: accounts.map((a) => a.id), after: [notifTx.emitAfterCommit] };
    });
    // Sus miembros ven al instante a su clan en la meta.
    await this.emitToStudents(members, expedition.id);
  }

  /** Alumnos activos de la clase y cuántos llegaron a la meta. */
  private async classFinishCounts(exec: Tx | typeof db, expedition: Expedition) {
    const [[{ total }], [{ finished }]] = await Promise.all([
      exec.select({ total: sql<number>`COUNT(*)` }).from(studentProfiles)
        .where(and(eq(studentProfiles.classroomId, expedition.classroomId), eq(studentProfiles.isActive, true))),
      exec.select({ finished: sql<number>`COUNT(*)` }).from(expeditionFinishes)
        .innerJoin(studentProfiles, eq(expeditionFinishes.studentProfileId, studentProfiles.id))
        .where(and(eq(expeditionFinishes.expeditionId, expedition.id), eq(studentProfiles.isActive, true))),
    ]);
    return { total: count(total), finished: count(finished) };
  }

  private async payGoalToStudentInTx(tx: Tx, expedition: Expedition, xp: number, studentProfileId: string, grants: Grant[]) {
    const paid = await tx.update(expeditionFinishes).set({ goalRewardedAt: new Date() })
      .where(and(eq(expeditionFinishes.expeditionId, expedition.id), eq(expeditionFinishes.studentProfileId, studentProfileId), isNull(expeditionFinishes.goalRewardedAt)));
    if (affectedRows(paid) !== 1 || xp <= 0) return;
    grants.push({
      studentProfileId, xp, gold: 0, reason: `Expedición «${expedition.name}»: la clase logró su meta`,
      title: '🎯 ¡La clase logró su meta!', what: `la meta de la clase en «${expedition.name}»`, givenBy: null,
    });
  }

  /**
   * Paga la meta de clase a quienes llegaron a tiempo (con fecha, hasta esa fecha) y aún no la cobraron, cada uno
   * una sola vez. `announce`: la meta se acaba de lograr y toda la clase lo ve al instante.
   */
  private async payClassGoal(expeditionId: string, announce: boolean) {
    const expedition = await this.requireExpedition(expeditionId);
    if (!expedition.goalPercent || !expedition.goalReachedAt) return;
    if (expedition.goalDueAt && expedition.goalReachedAt.getTime() > expedition.goalDueAt.getTime()) return;
    const pending = await db.select({ id: expeditionFinishes.studentProfileId }).from(expeditionFinishes)
      .innerJoin(studentProfiles, eq(expeditionFinishes.studentProfileId, studentProfiles.id))
      .where(and(
        eq(expeditionFinishes.expeditionId, expeditionId), isNull(expeditionFinishes.goalRewardedAt), eq(studentProfiles.isActive, true),
        expedition.goalDueAt ? lte(expeditionFinishes.finishedAt, expedition.goalDueAt) : undefined,
      ));
    const ids = pending.map((p) => p.id);
    if (ids.length) {
      await transaction(async (tx) => {
        await lockStudents(tx, ids);
        const grants: Grant[] = [];
        for (const id of ids) await this.payGoalToStudentInTx(tx, expedition, expedition.goalXp, id, grants);
        return { value: null, after: [await this.grantInTx(tx, expedition.classroomId, grants)] };
      });
      await this.emitToStudents(ids, expeditionId);
    }
    if (announce) getIO()?.to(`classroom:${expedition.classroomId}`).emit('expedition:changed', { expeditionId });
  }

  /**
   * Meta de clase: cuando el porcentaje de la clase llega a la meta antes de la fecha se marca una sola vez (el
   * candado del registro pone en fila las revisiones) y se paga a quienes llegaron; también a quien llega después.
   */
  private async refreshClassGoal(expeditionId: string) {
    const state = await transaction<'none' | 'reached' | 'new'>(async (tx) => {
      const [row] = await tx.select().from(expeditions).where(eq(expeditions.id, expeditionId)).for('update');
      if (!row?.goalPercent || row.status === 'DRAFT') return { value: 'none', after: [] };
      if (row.goalReachedAt) return { value: 'reached', after: [] };
      if (row.goalDueAt && Date.now() > row.goalDueAt.getTime()) return { value: 'none', after: [] };
      const { finished, total } = await this.classFinishCounts(tx, row);
      if (total === 0 || finished * 100 < row.goalPercent * total) return { value: 'none', after: [] };
      const marked = await tx.update(expeditions).set({ goalReachedAt: new Date() }).where(and(eq(expeditions.id, expeditionId), isNull(expeditions.goalReachedAt)));
      return { value: affectedRows(marked) === 1 ? 'new' : 'reached', after: [] };
    });
    if (state !== 'none') await this.payClassGoal(expeditionId, state === 'new');
  }

  /** Insignias elegidas por el docente, después del commit. Si ya la tiene (tope) o la archivó, se salta. */
  private async awardBadges(awards: { studentProfileId: string; id: string; reason: string }[]) {
    for (const award of awards) {
      try {
        const badge = await badgeService.getBadgeById(award.id);
        if (!badge?.isActive) continue;
        await badgeService.awardBadgeAutomatic(award.studentProfileId, award.id, award.reason);
      } catch {
        // Tope de la insignia alcanzado: no rompe la expedición.
      }
    }
  }

  /**
   * Paga XP/oro dentro de la transacción (con sus registros y avisos) y devuelve lo que se hace después del
   * commit: el contador de la campana, el aporte al clan, Historia y las insignias de XP.
   */
  private async grantInTx(tx: Tx, classroomId: string, grants: Grant[]): Promise<() => Promise<void>> {
    const badgeAwards = grants.flatMap((g) => (g.badge ? [{ studentProfileId: g.studentProfileId, ...g.badge }] : []));
    // Uno por clave: marcar a 30 alumnos revisa clanes y meta una sola vez.
    const followUps = new Map(grants.flatMap((g) => (g.followUp ? [[g.followUp.key, g.followUp.run] as const] : [])));
    const afterBadges = async () => {
      if (badgeAwards.length) await this.awardBadges(badgeAwards);
      for (const run of followUps.values()) {
        try {
          await run();
        } catch (error) {
          console.error('Seguimiento de la expedición', error);
        }
      }
    };
    const paid = grants.filter((g) => g.xp > 0 || g.gold > 0);
    if (paid.length === 0) return afterBadges;
    const [classroom] = await tx.select({
      xpPerLevel: classrooms.xpPerLevel, notifyOnPoints: classrooms.notifyOnPoints, clansEnabled: classrooms.clansEnabled, teacherId: classrooms.teacherId,
    }).from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) return afterBadges;
    const ids = [...new Set(paid.map((g) => g.studentProfileId))];
    const students = new Map((await tx.select({ id: studentProfiles.id, userId: studentProfiles.userId, characterName: studentProfiles.characterName, teamId: studentProfiles.teamId })
      .from(studentProfiles).where(inArray(studentProfiles.id, ids))).map((s) => [s.id, s]));
    const [teacher] = await tx.select({ notifyLevelUp: users.notifyLevelUp }).from(users).where(eq(users.id, classroom.teacherId));
    const now = new Date();
    const logs: typeof pointLogs.$inferInsert[] = [];
    const notices: typeof notifications.$inferInsert[] = [];
    const xpByStudent = new Map<string, number>();
    for (const grant of paid) {
      const student = students.get(grant.studentProfileId);
      if (!student) continue;
      const result = await applyPointDeltas(tx, grant.studentProfileId, { xp: grant.xp, gp: grant.gold }, { xpPerLevel: classroom.xpPerLevel || 100, source: 'EXPEDITION' });
      if (!result) continue;
      for (const [pointType, amount] of [['XP', grant.xp], ['GP', grant.gold]] as const) {
        if (amount > 0) logs.push({ id: uuidv4(), studentId: grant.studentProfileId, pointType, action: 'ADD', amount, reason: grant.reason, givenBy: grant.givenBy, createdAt: now });
      }
      if (grant.xp > 0) xpByStudent.set(grant.studentProfileId, (xpByStudent.get(grant.studentProfileId) ?? 0) + grant.xp);
      if (classroom.notifyOnPoints && student.userId) {
        notices.push({
          id: uuidv4(), userId: student.userId, classroomId, type: 'POINTS', title: grant.title,
          message: `${rewardText(grant.xp, grant.gold)} por ${grant.what}`, isRead: false, createdAt: now,
        });
      }
      if (result.level > result.previousLevel) {
        const levelData = { studentProfileId: grant.studentProfileId, fromLevel: result.previousLevel, toLevel: result.level };
        if (classroom.notifyOnPoints && student.userId) {
          notices.push({ id: uuidv4(), userId: student.userId, classroomId, type: 'LEVEL_UP', title: '🎉 ¡Subiste de nivel!', message: `¡Felicidades! Has alcanzado el nivel ${result.level}`, data: levelData, isRead: false, createdAt: now });
        }
        if (teacher?.notifyLevelUp !== false) {
          notices.push({ id: uuidv4(), userId: classroom.teacherId, classroomId, type: 'LEVEL_UP', title: '🎉 ¡Estudiante subió de nivel!', message: `${student.characterName || 'Un alumno'} ha alcanzado el nivel ${result.level}`, data: levelData, isRead: false, createdAt: now });
        }
      }
    }
    if (logs.length) await tx.insert(pointLogs).values(logs);
    const notifTx = prepareForTx(notices.map((n) => ({ ...n, userId: n.userId as string })));
    if (notifTx.entries.length) await tx.insert(notifications).values(notifTx.entries);

    return async () => {
      await notifTx.emitAfterCommit();
      const withXp = [...xpByStudent.entries()];
      if (withXp.length > 0) {
        for (const [studentId, xp] of withXp) {
          if (!classroom.clansEnabled || !students.get(studentId)?.teamId) continue;
          try {
            await clanService.contributeXpToClan(studentId, xp, 'Expedición');
          } catch {
            // No rompe la recompensa.
          }
        }
        try {
          await storyService.onXpAwardedBatch(classroomId, withXp.map(([studentProfileId, xpAmount]) => ({ studentProfileId, xpAmount })));
        } catch {
          // No rompe la recompensa.
        }
        await badgeService.checkXpBadges(withXp.map(([studentId]) => studentId));
      }
      await afterBadges();
    };
  }

  private async emitToStudents(studentProfileIds: string[], expeditionId: string) {
    if (studentProfileIds.length === 0) return;
    const rows = await db.select({ userId: studentProfiles.userId }).from(studentProfiles).where(inArray(studentProfiles.id, [...new Set(studentProfileIds)]));
    emitToUsers(rows.map((r) => r.userId), 'expedition:changed', { expeditionId });
  }
}

export const expeditionService = new ExpeditionService();
