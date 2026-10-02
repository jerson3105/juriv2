import { and, countDistinct, desc, eq, gte, lt, lte, min, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { badges, behaviors, classrooms, pointLogs, studentBadges, studentProfiles } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { BADGE_REWARD_PREFIX, SELF_SPEND_PREFIXES, isBadgeReward, isSelfSpend, selfSpendText } from '../utils/pointReasons.js';
import { gradeService } from './grade.service.js';

export type ProgressPeriod = 'bimester' | 'all';
export type ProgressHistoryType = 'ALL' | 'XP' | 'GP' | 'HP';
export interface ProgressCursor { at: Date; id: string }

type PointType = 'XP' | 'HP' | 'GP';

const HISTORY_PAGE = 20;
// Un bimestre tiene ~10 semanas; si el periodo es más largo, el gráfico muestra las últimas.
const MAX_WEEKS = 12;
const MAX_MONTHS = 24;
const STRENGTHS = 5;
const TO_IMPROVE = 3;
const DAY_MS = 86_400_000;

// Suma de una clase de puntos por acción; `extra` filtra además por motivo.
const sumOf = (type: PointType, action: 'ADD' | 'REMOVE', extra?: SQL) =>
  sql<string>`COALESCE(SUM(CASE WHEN ${pointLogs.pointType} = ${type} AND ${pointLogs.action} = ${action}${extra ? sql` AND ${extra}` : sql``} THEN ${pointLogs.amount} ELSE 0 END), 0)`;

// Neto con signo (lo que se quita resta): una línea del historial junta el XP, el oro y la energía de un mismo evento.
const netOf = (type: PointType) =>
  sql<string>`COALESCE(SUM(CASE WHEN ${pointLogs.pointType} = ${type} THEN IF(${pointLogs.action} = 'ADD', ${pointLogs.amount}, -${pointLogs.amount}) ELSE 0 END), 0)`;

const selfSpend = sql`(${sql.join(SELF_SPEND_PREFIXES.map((prefix) => sql`${pointLogs.reason} LIKE ${`${prefix}%`}`), sql` OR `)})`;

// Fechas locales del alumno: `tz` es su getTimezoneOffset() (Perú = 300); los datetime se guardan en UTC.
const localOf = (tz: number) => sql`DATE_SUB(${pointLogs.createdAt}, INTERVAL ${tz} MINUTE)`;
const localKey = (date: Date, tz: number) => new Date(date.getTime() - tz * 60_000).toISOString().slice(0, 10);
const addDays = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const mondayOf = (key: string) => addDays(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7));
const monthOf = (key: string) => `${key.slice(0, 7)}-01`;
const nextMonth = (key: string) => {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
};

export const encodeProgressCursor = (at: string, id: string) => Buffer.from(`${at}|${id}`).toString('base64url');

/**
 * «Mi progreso» del alumno: cómo va creciendo en su clase. Solo registros válidos (sin reversiones ni sus
 * líneas inversas), cada evento contado una vez y los nombres de comportamientos y motivos solo si la clase
 * los muestra al alumno. El nivel y el XP los toma el cliente del perfil (los mismos de la cabecera).
 */
class StudentProgressService {
  private async ownProfile(profileId: string, userId: string) {
    const [row] = await db
      .select({
        userId: studentProfiles.userId,
        classroomId: studentProfiles.classroomId,
        classCreatedAt: classrooms.createdAt,
        currentBimester: classrooms.currentBimester,
        showReason: classrooms.showReasonToStudent,
      })
      .from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(eq(studentProfiles.id, profileId));
    if (!row || row.userId !== userId) throw new NotFoundError('Perfil no encontrado');
    return row;
  }

  /**
   * Inicio del bimestre en curso solo si hay un corte real (fechas del docente o cierre del anterior): sin él,
   * getBimesterDateRange cae en la creación de la clase y «este bimestre» sería todo el curso.
   */
  private async bimesterStart(classroomId: string, classCreatedAt: Date) {
    try {
      const { startDate } = await gradeService.getBimesterDateRange(classroomId, 'CURRENT');
      return startDate.getTime() !== new Date(classCreatedAt).getTime() ? startDate : null;
    } catch {
      return null;
    }
  }

  async getProgress(profileId: string, userId: string, requested: ProgressPeriod, tz: number) {
    const profile = await this.ownProfile(profileId, userId);
    const start = await this.bimesterStart(profile.classroomId, profile.classCreatedAt);
    const kind: ProgressPeriod = requested === 'bimester' && start ? 'bimester' : 'all';
    const from = kind === 'bimester' ? start : null;
    const bimester = Number(/-B([1-4])$/.exec(profile.currentBimester ?? '')?.[1]) || null;

    const valid = and(eq(pointLogs.studentId, profileId), eq(pointLogs.isReverted, false));
    const inPeriod = from ? and(valid, gte(pointLogs.createdAt, from)) : valid;
    const bucket: 'week' | 'month' = kind === 'bimester' ? 'week' : 'month';
    const local = localOf(tz);
    const bucketExpr = bucket === 'week'
      ? sql<string>`DATE_FORMAT(DATE_SUB(${local}, INTERVAL WEEKDAY(${local}) DAY), '%Y-%m-%d')`
      : sql<string>`DATE_FORMAT(${local}, '%Y-%m-01')`;
    const applications = sql<string>`COUNT(DISTINCT ${pointLogs.createdAt})`;

    const [[first], [totals], behaviorRows, seriesRows, [badgeTotal], [latestBadge]] = await Promise.all([
      db.select({ at: min(pointLogs.createdAt) }).from(pointLogs).where(valid),
      db.select({
        xpGained: sumOf('XP', 'ADD'),
        gpGained: sumOf('GP', 'ADD'),
        gpSpent: sumOf('GP', 'REMOVE', selfSpend),
        hpLost: sumOf('HP', 'REMOVE'),
        hpRecovered: sumOf('HP', 'ADD'),
      }).from(pointLogs).where(inPeriod),
      // Una aplicación de un comportamiento escribe una fila por clase de punto en el mismo instante.
      db.select({ name: behaviors.name, positive: behaviors.isPositive, times: applications })
        .from(pointLogs)
        .innerJoin(behaviors, eq(behaviors.id, pointLogs.behaviorId))
        .where(inPeriod)
        .groupBy(behaviors.id, behaviors.name, behaviors.isPositive)
        .orderBy(desc(applications), behaviors.name),
      db.select({ start: bucketExpr, xp: sumOf('XP', 'ADD') })
        .from(pointLogs)
        .where(inPeriod)
        .groupBy(bucketExpr)
        .orderBy(bucketExpr),
      // Insignias distintas (las repetidas se ven como «×N» en «Mis insignias»): el mismo número en todas partes.
      db.select({ total: countDistinct(studentBadges.badgeId) })
        .from(studentBadges)
        .innerJoin(badges, eq(badges.id, studentBadges.badgeId))
        .where(eq(studentBadges.studentProfileId, profileId)),
      db.select({ name: badges.name, at: studentBadges.unlockedAt })
        .from(studentBadges)
        .innerJoin(badges, eq(badges.id, studentBadges.badgeId))
        .where(eq(studentBadges.studentProfileId, profileId))
        .orderBy(desc(studentBadges.unlockedAt))
        .limit(1),
    ]);

    // Serie continua (semanas o meses sin XP en 0) hasta hoy, desde lo último entre el inicio del periodo y el
    // primer registro del alumno (antes de empezar no hay nada que mostrar).
    const firstAt = first?.at ?? null;
    const points: { start: string; xp: number }[] = [];
    const startDate = firstAt && from && from > firstAt ? from : firstAt;
    if (firstAt && startDate) {
      const xpByStart = new Map(seriesRows.map((row) => [row.start, Number(row.xp)]));
      const today = localKey(new Date(), tz);
      const last = bucket === 'week' ? mondayOf(today) : monthOf(today);
      let key = bucket === 'week' ? mondayOf(localKey(startDate, tz)) : monthOf(localKey(startDate, tz));
      while (key <= last) {
        points.push({ start: key, xp: xpByStart.get(key) ?? 0 });
        key = bucket === 'week' ? addDays(key, 7) : nextMonth(key);
      }
    }
    const maxBuckets = bucket === 'week' ? MAX_WEEKS : MAX_MONTHS;

    const named = (rows: typeof behaviorRows) => rows.map((row) => ({ name: row.name, times: Number(row.times) }));
    const positives = behaviorRows.filter((row) => row.positive);
    const negatives = behaviorRows.filter((row) => !row.positive);
    const timesOf = (rows: typeof behaviorRows) => rows.reduce((sum, row) => sum + Number(row.times), 0);

    return {
      period: { kind, canSplit: !!start, bimester, from: from ? from.toISOString() : null },
      hasAny: !!firstAt,
      totals: {
        xpGained: Number(totals?.xpGained ?? 0),
        gpGained: Number(totals?.gpGained ?? 0),
        gpSpent: Number(totals?.gpSpent ?? 0),
        hpLost: Number(totals?.hpLost ?? 0),
        hpRecovered: Number(totals?.hpRecovered ?? 0),
      },
      behaviors: {
        namesVisible: profile.showReason,
        positiveTimes: timesOf(positives),
        negativeTimes: timesOf(negatives),
        strengths: profile.showReason ? named(positives.slice(0, STRENGTHS)) : [],
        toImprove: profile.showReason ? named(negatives.slice(0, TO_IMPROVE)) : [],
      },
      series: { bucket, points: points.slice(-maxBuckets), truncated: points.length > maxBuckets },
      badges: {
        count: Number(badgeTotal?.total ?? 0),
        latest: latestBadge ? { name: latestBadge.name, at: latestBadge.at.toISOString() } : null,
      },
    };
  }

  /**
   * Historial: una línea por evento (un comportamiento con XP, oro y energía es una sola línea), del más
   * nuevo al más viejo, de 20 en 20. El cursor es el instante y el id de la última línea entregada.
   */
  async getHistory(profileId: string, userId: string, options: { period: ProgressPeriod; type: ProgressHistoryType; cursor: ProgressCursor | null }) {
    const profile = await this.ownProfile(profileId, userId);
    const start = options.period === 'bimester' ? await this.bimesterStart(profile.classroomId, profile.classCreatedAt) : null;
    const { cursor, type } = options;

    const firstId = sql<string>`MIN(${pointLogs.id})`;
    const nets = { XP: netOf('XP'), GP: netOf('GP'), HP: netOf('HP') };
    const having = and(
      type === 'ALL' ? undefined : sql`${nets[type]} <> 0`,
      cursor ? or(lt(pointLogs.createdAt, cursor.at), and(eq(pointLogs.createdAt, cursor.at), sql`${firstId} < ${cursor.id}`)) : undefined,
    );

    const rows = await db
      .select({
        id: firstId,
        at: pointLogs.createdAt,
        behaviorId: pointLogs.behaviorId,
        reason: pointLogs.reason,
        behaviorName: behaviors.name,
        positive: behaviors.isPositive,
        xp: nets.XP,
        gp: nets.GP,
        hp: nets.HP,
      })
      .from(pointLogs)
      .leftJoin(behaviors, eq(behaviors.id, pointLogs.behaviorId))
      .where(and(
        eq(pointLogs.studentId, profileId),
        eq(pointLogs.isReverted, false),
        start ? gte(pointLogs.createdAt, start) : undefined,
        cursor ? lte(pointLogs.createdAt, cursor.at) : undefined,
      ))
      .groupBy(pointLogs.createdAt, pointLogs.behaviorId, pointLogs.reason, behaviors.name, behaviors.isPositive)
      .having(having)
      .orderBy(desc(pointLogs.createdAt), desc(firstId))
      .limit(HISTORY_PAGE + 1);

    const items = rows.slice(0, HISTORY_PAGE).map((row) => {
      const reason = row.reason?.trim() || null;
      const kind = row.behaviorId ? 'behavior' : isBadgeReward(reason) ? 'badge' : isSelfSpend(reason) ? 'shop' : 'other';
      // Insignias y compras propias se ven siempre; los motivos del docente, solo si la clase los muestra.
      const label = kind === 'badge'
        ? reason!.slice(BADGE_REWARD_PREFIX.length)
        : kind === 'shop'
          ? selfSpendText(reason!)
          : profile.showReason ? (kind === 'behavior' ? row.behaviorName ?? reason : reason) : null;
      return {
        id: row.id,
        at: row.at.toISOString(),
        kind,
        positive: kind === 'behavior' ? !!row.positive : null,
        label,
        xp: Number(row.xp),
        gp: Number(row.gp),
        hp: Number(row.hp),
      };
    });

    const last = items[items.length - 1];
    return {
      items,
      nextCursor: rows.length > HISTORY_PAGE && last ? encodeProgressCursor(last.at, last.id) : null,
    };
  }
}

export const studentProgressService = new StudentProgressService();
