import { and, count, desc, eq, gte, inArray, isNotNull, lt, max, min, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  attendanceRecords,
  behaviors,
  classrooms,
  pointLogs,
  shopItems,
  studentBadges,
  studentGrades,
  studentProfiles,
  users,
} from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';
import { performanceBucket, type PerformanceBucket } from '../utils/gradeScale.js';
import { gradeService } from './grade.service.js';

export type StatsPeriod = 'week' | 'bimester' | 'month' | 'all';

// Mismos umbrales que las alertas del perfil del alumno.
const LOW_HP_RATIO = 0.3;
const INACTIVE_DAYS = 7;
const ABSENCE_STREAK = 3;
const NEGATIVE_EVENTS = 5;
const DAILY_MAX_DAYS = 70;
const DAY_MS = 86_400_000;

type AttentionKind = 'LOW_HP' | 'INACTIVE' | 'ABSENCES' | 'NEGATIVE' | 'GRADE_C';

const localDay = (column: SQL | typeof pointLogs.createdAt, tz: number) =>
  sql<string>`DATE_FORMAT(DATE_SUB(${column}, INTERVAL ${tz} MINUTE), '%Y-%m-%d')`;
// Un evento = un comportamiento (o motivo) aplicado a un alumno en un instante (XP+HP+GP cuentan una vez).
const eventKey = sql`CONCAT(${pointLogs.studentId}, '|', ${pointLogs.createdAt}, '|', COALESCE(${pointLogs.behaviorId}, ${pointLogs.reason}, ''))`;
const notInverse = sql`(${pointLogs.reason} IS NULL OR ${pointLogs.reason} NOT LIKE '⟲%')`;

const realName = (s: { firstName?: string | null; lastName?: string | null; displayName?: string | null; characterName?: string | null }) =>
  `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.displayName?.trim() || s.characterName || 'Estudiante';

/**
 * Estadísticas de la clase ("¿cómo va mi clase?"): quién necesita atención, clima (reconocimientos
 * frente a conductas a mejorar) con comparación al periodo anterior, comportamientos frecuentes,
 * notas por competencia y el detalle de gamificación. Solo alumnos activos y no demo.
 */
class ClassStatsService {
  private async resolveRange(classroomId: string, period: StatsPeriod, tz: number, createdAt: Date, studentIds: string[]) {
    const now = new Date();
    let from: Date;
    let label: string;
    if (period === 'bimester') {
      const range = await gradeService.getBimesterDateRange(classroomId, 'CURRENT');
      from = range.startDate;
      label = 'Bimestre actual';
    } else if (period === 'week') {
      // Lunes 00:00 en la zona del docente.
      const local = new Date(now.getTime() - tz * 60_000);
      const dow = (local.getUTCDay() + 6) % 7;
      from = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow) + tz * 60_000);
      label = 'Esta semana';
    } else if (period === 'month') {
      from = new Date(now.getTime() - 30 * DAY_MS);
      label = 'Últimos 30 días';
    } else {
      // Desde el primer registro (puede ser anterior a la creación si la clase se importó o clonó).
      const [first] = studentIds.length > 0
        ? await db.select({ at: min(pointLogs.createdAt) }).from(pointLogs).where(inArray(pointLogs.studentId, studentIds))
        : [];
      from = first?.at && new Date(first.at) < createdAt ? new Date(first.at) : createdAt;
      label = 'Todo el curso';
    }
    if (from > now) from = now;
    const span = Math.max(DAY_MS, now.getTime() - from.getTime());
    return { from, to: now, label, previous: period === 'all' ? null : { from: new Date(from.getTime() - span), to: from } };
  }

  async getOverview(classroomId: string, period: StatsPeriod, tz: number) {
    const [classroom] = await db.select({
      id: classrooms.id,
      maxHp: classrooms.maxHp,
      createdAt: classrooms.createdAt,
      useCompetencies: classrooms.useCompetencies,
      curriculumAreaId: classrooms.curriculumAreaId,
      gradeScaleType: classrooms.gradeScaleType,
    }).from(classrooms).where(eq(classrooms.id, classroomId));
    if (!classroom) throw new NotFoundError('Clase no encontrada');

    const students = await db.select({
      id: studentProfiles.id,
      hp: studentProfiles.hp,
      xp: studentProfiles.xp,
      gp: studentProfiles.gp,
      level: studentProfiles.level,
      characterClass: studentProfiles.characterClass,
      characterName: studentProfiles.characterName,
      displayName: studentProfiles.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
    })
      .from(studentProfiles)
      .leftJoin(users, eq(studentProfiles.userId, users.id))
      .where(and(eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false)));

    const ids = students.map((s) => s.id);
    const range = await this.resolveRange(classroomId, period, tz, classroom.createdAt, ids);
    const maxHp = Math.max(1, classroom.maxHp || 100);
    const emptyResult = {
      period: { kind: period, label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
      studentCount: 0,
      attention: [],
      climate: { bucket: 'day' as const, series: [], current: { positive: 0, negative: 0 }, previous: null, topPositive: [], topNegative: [] },
      badges: { studentsWithBadge: 0, awardedInPeriod: 0 },
      gamification: { levels: [], classes: [], gpTotal: 0, shopPrices: null, withoutRecognition: 0 },
      grades: null,
    };
    if (ids.length === 0) return emptyResult;

    const inPeriod = (column: typeof pointLogs.createdAt, from: Date, to: Date) => [gte(column, from), lt(column, to)];
    const pointBase = and(inArray(pointLogs.studentId, ids), eq(pointLogs.isReverted, false), notInverse);

    const spanDays = Math.ceil((range.to.getTime() - range.from.getTime()) / DAY_MS);
    const bucket: 'day' | 'week' = spanDays <= DAILY_MAX_DAYS ? 'day' : 'week';
    const day = localDay(pointLogs.createdAt, tz);
    const bucketExpr = bucket === 'day'
      ? day
      : sql<string>`DATE_FORMAT(DATE_SUB(DATE_SUB(${pointLogs.createdAt}, INTERVAL ${tz} MINUTE), INTERVAL WEEKDAY(DATE_SUB(${pointLogs.createdAt}, INTERVAL ${tz} MINUTE)) DAY), '%Y-%m-%d')`;
    const events = (action: 'ADD' | 'REMOVE') => sql<string>`COUNT(DISTINCT CASE WHEN ${pointLogs.action} = ${action} THEN ${eventKey} END)`;

    const totals = async (from: Date, to: Date) => {
      const [row] = await db.select({ positive: events('ADD'), negative: events('REMOVE') })
        .from(pointLogs).where(and(pointBase, ...inPeriod(pointLogs.createdAt, from, to)));
      return { positive: Number(row?.positive ?? 0), negative: Number(row?.negative ?? 0) };
    };

    const topBehaviors = (isPositive: boolean) => db.select({
      name: behaviors.name,
      icon: behaviors.icon,
      events: sql<string>`COUNT(DISTINCT ${eventKey})`,
    })
      .from(pointLogs)
      .innerJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id))
      .where(and(pointBase, eq(behaviors.isPositive, isPositive), ...inPeriod(pointLogs.createdAt, range.from, range.to)))
      .groupBy(behaviors.id, behaviors.name, behaviors.icon)
      .orderBy(desc(sql`COUNT(DISTINCT ${eventKey})`))
      .limit(5);

    const [series, current, previous, topPositive, topNegative, lastActivity, negativeByStudent, positiveByStudent, absenceRows, badgeOwners, [awarded], prices] = await Promise.all([
      db.select({ date: bucketExpr, positive: events('ADD'), negative: events('REMOVE') })
        .from(pointLogs)
        .where(and(pointBase, ...inPeriod(pointLogs.createdAt, range.from, range.to)))
        .groupBy(bucketExpr)
        .orderBy(bucketExpr),
      totals(range.from, range.to),
      range.previous ? totals(range.previous.from, range.previous.to) : Promise.resolve(null),
      topBehaviors(true),
      topBehaviors(false),
      db.select({ studentId: pointLogs.studentId, at: max(pointLogs.createdAt) })
        .from(pointLogs).where(pointBase).groupBy(pointLogs.studentId),
      db.select({ studentId: pointLogs.studentId, total: sql<string>`COUNT(DISTINCT ${eventKey})` })
        .from(pointLogs)
        .where(and(pointBase, eq(pointLogs.action, 'REMOVE'), isNotNull(pointLogs.behaviorId), ...inPeriod(pointLogs.createdAt, range.from, range.to)))
        .groupBy(pointLogs.studentId),
      db.select({ studentId: pointLogs.studentId, total: sql<string>`COUNT(DISTINCT ${eventKey})` })
        .from(pointLogs)
        .where(and(pointBase, eq(pointLogs.action, 'ADD'), ...inPeriod(pointLogs.createdAt, range.from, range.to)))
        .groupBy(pointLogs.studentId),
      // Últimas 5 asistencias de cada alumno (para las faltas seguidas).
      db.execute(sql`SELECT student_profile_id AS studentId, attendance_status AS status FROM (
          SELECT student_profile_id, attendance_status, ROW_NUMBER() OVER (PARTITION BY student_profile_id ORDER BY date DESC) AS rn
          FROM ${attendanceRecords}
          WHERE ${and(eq(attendanceRecords.classroomId, classroomId), eq(attendanceRecords.isReverted, false))}
        ) last5 WHERE rn <= 5 ORDER BY student_profile_id, rn`) as unknown as Promise<[Array<{ studentId: string; status: string }>]>,
      db.selectDistinct({ studentId: studentBadges.studentProfileId }).from(studentBadges).where(inArray(studentBadges.studentProfileId, ids)),
      db.select({ total: count() }).from(studentBadges)
        .where(and(inArray(studentBadges.studentProfileId, ids), gte(studentBadges.unlockedAt, range.from), lt(studentBadges.unlockedAt, range.to))),
      db.select({ price: shopItems.price }).from(shopItems).where(and(eq(shopItems.classroomId, classroomId), eq(shopItems.isActive, true))),
    ]);

    // Notas del bimestre en curso (último cálculo guardado) para "C en alguna competencia" y el resumen.
    let grades: null | {
      period: string;
      competencies: Array<{ id: string; code: string; title: string; counts: Record<PerformanceBucket, number>; missing: number }>;
      cByStudent: Map<string, string[]>;
    } = null;
    if (classroom.useCompetencies && classroom.curriculumAreaId) {
      const periodKey = await gradeService.resolvePeriod(classroomId, 'CURRENT');
      const [columns, rows] = await Promise.all([
        gradeService.getClassroomCompetencyColumns(classroomId),
        db.select({
          studentId: studentGrades.studentProfileId,
          competencyId: studentGrades.competencyId,
          score: studentGrades.score,
          label: studentGrades.gradeLabel,
          activities: studentGrades.activitiesCount,
          manual: studentGrades.isManualOverride,
        }).from(studentGrades).where(and(eq(studentGrades.classroomId, classroomId), eq(studentGrades.period, periodKey), inArray(studentGrades.studentProfileId, ids))),
      ]);
      const cByStudent = new Map<string, string[]>();
      const competencies = columns.map((column) => {
        const counts: Record<PerformanceBucket, number> = { AD: 0, A: 0, B: 0, C: 0 };
        let graded = 0;
        for (const row of rows) {
          if (row.competencyId !== column.id || (!row.activities && !row.manual)) continue;
          const bucketOf = performanceBucket(Number(row.score), classroom.gradeScaleType, row.label);
          counts[bucketOf] += 1;
          graded += 1;
          if (bucketOf === 'C') cByStudent.set(row.studentId, [...(cByStudent.get(row.studentId) ?? []), column.shortName || column.name || column.code]);
        }
        return { id: column.id, code: column.code, title: column.shortName || column.name || column.code, counts, missing: ids.length - graded };
      });
      grades = { period: periodKey, competencies, cByStudent };
    }

    // Necesitan atención: varias señales, cada una con su motivo legible.
    const lastById = new Map(lastActivity.map((r) => [r.studentId, r.at ? new Date(r.at) : null]));
    const negativeById = new Map(negativeByStudent.map((r) => [r.studentId, Number(r.total)]));
    const positiveById = new Map(positiveByStudent.map((r) => [r.studentId, Number(r.total)]));
    const absences = new Map<string, number>();
    const streakDone = new Set<string>();
    for (const row of absenceRows[0] ?? []) {
      if (streakDone.has(row.studentId)) continue;
      if (row.status === 'ABSENT') absences.set(row.studentId, (absences.get(row.studentId) ?? 0) + 1);
      else streakDone.add(row.studentId);
    }
    const now = Date.now();
    const attention = students
      .map((s) => {
        const reasons: Array<{ kind: AttentionKind; label: string }> = [];
        if (s.hp / maxHp < LOW_HP_RATIO) reasons.push({ kind: 'LOW_HP', label: s.hp <= 0 ? 'Descansando (sin energía)' : `Energía ${s.hp}/${maxHp}` });
        const last = lastById.get(s.id);
        const idle = last ? Math.floor((now - last.getTime()) / DAY_MS) : null;
        if (idle === null) reasons.push({ kind: 'INACTIVE', label: 'Sin puntos todavía' });
        else if (idle >= INACTIVE_DAYS) reasons.push({ kind: 'INACTIVE', label: `Sin puntos hace ${idle} días` });
        const streak = absences.get(s.id) ?? 0;
        if (streak >= ABSENCE_STREAK) reasons.push({ kind: 'ABSENCES', label: `${streak} faltas seguidas` });
        const negative = negativeById.get(s.id) ?? 0;
        if (negative >= NEGATIVE_EVENTS) reasons.push({ kind: 'NEGATIVE', label: `${negative} conductas a mejorar` });
        for (const competency of grades?.cByStudent.get(s.id) ?? []) reasons.push({ kind: 'GRADE_C', label: `En inicio en ${competency}` });
        return { studentProfileId: s.id, studentName: realName(s), characterName: s.characterName, reasons };
      })
      .filter((s) => s.reasons.length > 0)
      .sort((a, b) => b.reasons.length - a.reasons.length || a.studentName.localeCompare(b.studentName, 'es'));

    // Gamificación en detalle.
    const levels = new Map<number, number>();
    const classes = new Map<string, number>();
    for (const s of students) {
      levels.set(s.level, (levels.get(s.level) ?? 0) + 1);
      classes.set(s.characterClass, (classes.get(s.characterClass) ?? 0) + 1);
    }
    const sortedPrices = prices.map((p) => Number(p.price)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);

    return {
      period: { kind: period, label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
      studentCount: students.length,
      attention,
      climate: {
        bucket,
        series: series.map((r) => ({ date: r.date, positive: Number(r.positive), negative: Number(r.negative) })),
        current,
        previous,
        topPositive: topPositive.map((r) => ({ name: r.name, icon: r.icon, events: Number(r.events) })),
        topNegative: topNegative.map((r) => ({ name: r.name, icon: r.icon, events: Number(r.events) })),
      },
      badges: { studentsWithBadge: badgeOwners.length, awardedInPeriod: Number(awarded?.total ?? 0) },
      gamification: {
        levels: [...levels.entries()].sort((a, b) => a[0] - b[0]).map(([level, total]) => ({ level, total })),
        classes: [...classes.entries()].sort((a, b) => b[1] - a[1]).map(([key, total]) => ({ key, total })),
        gpTotal: students.reduce((sum, s) => sum + (s.gp || 0), 0),
        shopPrices: sortedPrices.length > 0
          ? { min: sortedPrices[0], median: sortedPrices[Math.floor(sortedPrices.length / 2)], max: sortedPrices[sortedPrices.length - 1], items: sortedPrices.length }
          : null,
        withoutRecognition: students.filter((s) => !positiveById.get(s.id)).length,
      },
      grades: grades ? { period: grades.period, competencies: grades.competencies } : null,
    };
  }
}

export const classStatsService = new ClassStatsService();
