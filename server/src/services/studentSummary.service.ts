import { and, count, desc, eq, gt, gte, inArray, max, min, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  attendanceRecords,
  behaviors,
  clanLogs,
  classrooms,
  collectibleAlbums,
  collectibleCards,
  pointLogs,
  purchases,
  studentBadges,
  studentCollectibles,
  studentProfiles,
  teams,
} from '../db/schema.js';
import { gradeService } from './grade.service.js';

export type SummaryPeriod = 'bimester' | 'all';

// Rango largo ("todo el curso"): el gráfico agrupa por semana para no dibujar cientos de puntos.
const DAILY_MAX_DAYS = 70;
const DAY_MS = 86_400_000;

const bimesterLabel = (period: string | null | undefined) => {
  const match = /^(\d{4})-B([1-4])$/.exec((period ?? '').trim().toUpperCase());
  return match ? `Bimestre ${match[2]} · ${match[1]}` : 'Bimestre actual';
};

// Fecha local (YYYY-MM-DD) de un datetime guardado en UTC, según el desfase del navegador del profesor.
const localDay = (column: SQL | typeof pointLogs.createdAt, tzOffsetMinutes: number) =>
  sql<string>`DATE_FORMAT(DATE_SUB(${column}, INTERVAL ${tzOffsetMinutes} MINUTE), '%Y-%m-%d')`;

class StudentSummaryService {
  /** El alumno pertenece a la clase (para el control de acceso del controlador). */
  async studentInClassroom(classroomId: string, studentId: string) {
    const [row] = await db.select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(and(eq(studentProfiles.id, studentId), eq(studentProfiles.classroomId, classroomId)))
      .limit(1);
    return !!row;
  }

  /**
   * Resumen del alumno en el periodo: puntos ganados y perdidos, comportamientos, asistencia,
   * insignias, compras, aporte al clan, puesto en la clase y serie para el gráfico.
   * Se calcula en la base de datos (antes eran los últimos 200 registros en el navegador).
   */
  async getSummary(classroomId: string, studentId: string, period: SummaryPeriod, tzOffsetMinutes: number) {
    const [classroom] = await db.select({
      currentBimester: classrooms.currentBimester,
      maxHp: classrooms.maxHp,
      createdAt: classrooms.createdAt,
    }).from(classrooms).where(eq(classrooms.id, classroomId));

    const [student] = await db.select({
      id: studentProfiles.id,
      xp: studentProfiles.xp,
      hp: studentProfiles.hp,
      teamId: studentProfiles.teamId,
    }).from(studentProfiles).where(eq(studentProfiles.id, studentId));

    const from = period === 'bimester'
      ? (await gradeService.getBimesterDateRange(classroomId, 'CURRENT')).startDate
      : null;
    const now = new Date();

    const inPeriod = (column: typeof pointLogs.createdAt) => (from ? [gte(column, from)] : []);
    const pointWhere = and(eq(pointLogs.studentId, studentId), eq(pointLogs.isReverted, false), ...inPeriod(pointLogs.createdAt));

    // Suma por tipo y acción. Un evento (comportamiento) puede escribir varias filas (XP, HP, GP):
    // se cuenta una vez por instante + acción + comportamiento.
    const sumOf = (type: 'XP' | 'HP' | 'GP', action: 'ADD' | 'REMOVE') =>
      sql<string>`COALESCE(SUM(CASE WHEN ${pointLogs.pointType} = ${type} AND ${pointLogs.action} = ${action} THEN ${pointLogs.amount} ELSE 0 END), 0)`;
    const eventKey = sql`CONCAT(${pointLogs.createdAt}, '|', COALESCE(${pointLogs.behaviorId}, ${pointLogs.reason}, ''))`;

    const [points] = await db.select({
      xpGained: sumOf('XP', 'ADD'),
      xpLost: sumOf('XP', 'REMOVE'),
      hpGained: sumOf('HP', 'ADD'),
      hpLost: sumOf('HP', 'REMOVE'),
      gpGained: sumOf('GP', 'ADD'),
      gpLost: sumOf('GP', 'REMOVE'),
      positive: sql<string>`COUNT(DISTINCT CASE WHEN ${pointLogs.action} = 'ADD' THEN ${eventKey} END)`,
      negative: sql<string>`COUNT(DISTINCT CASE WHEN ${pointLogs.action} = 'REMOVE' THEN ${eventKey} END)`,
    }).from(pointLogs).where(pointWhere);

    // Comportamientos más frecuentes del periodo.
    const behaviorName = behaviors.name;
    const topBehaviors = await db.select({
      name: behaviorName,
      action: pointLogs.action,
      times: sql<string>`COUNT(DISTINCT ${eventKey})`,
    })
      .from(pointLogs)
      .innerJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id)) // solo comportamientos (no recompensas de insignias, asistencia, etc.)
      .where(pointWhere)
      .groupBy(behaviorName, pointLogs.action)
      .orderBy(desc(sql`COUNT(DISTINCT ${eventKey})`))
      .limit(6);

    // Serie del gráfico: neto por día local (o por semana si el rango es largo).
    const [first] = await db.select({ first: min(pointLogs.createdAt) }).from(pointLogs)
      .where(and(eq(pointLogs.studentId, studentId), eq(pointLogs.isReverted, false)));
    const start = from ?? (first?.first ? new Date(first.first) : classroom?.createdAt ?? now);
    const spanDays = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / DAY_MS));
    const bucket: 'day' | 'week' = spanDays <= DAILY_MAX_DAYS ? 'day' : 'week';
    const day = localDay(pointLogs.createdAt, tzOffsetMinutes);
    const bucketExpr = bucket === 'day'
      ? day
      : sql<string>`DATE_FORMAT(DATE_SUB(DATE_SUB(${pointLogs.createdAt}, INTERVAL ${tzOffsetMinutes} MINUTE), INTERVAL WEEKDAY(DATE_SUB(${pointLogs.createdAt}, INTERVAL ${tzOffsetMinutes} MINUTE)) DAY), '%Y-%m-%d')`;
    const net = (type: 'XP' | 'HP' | 'GP') =>
      sql<string>`COALESCE(SUM(CASE WHEN ${pointLogs.pointType} = ${type} THEN IF(${pointLogs.action} = 'ADD', ${pointLogs.amount}, -${pointLogs.amount}) ELSE 0 END), 0)`;
    const series = await db.select({ date: bucketExpr, xp: net('XP'), hp: net('HP'), gp: net('GP') })
      .from(pointLogs)
      .where(pointWhere)
      .groupBy(bucketExpr)
      .orderBy(bucketExpr);

    // Asistencia del periodo y faltas seguidas recientes (de la última hacia atrás).
    const attendanceWhere = and(
      eq(attendanceRecords.studentProfileId, studentId),
      eq(attendanceRecords.classroomId, classroomId),
      eq(attendanceRecords.isReverted, false),
    );
    const attendanceRows = await db.select({ status: attendanceRecords.status, total: count() })
      .from(attendanceRecords)
      .where(and(attendanceWhere, ...(from ? [gte(attendanceRecords.date, from)] : [])))
      .groupBy(attendanceRecords.status);
    const attendance = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 } as Record<string, number>;
    for (const row of attendanceRows) attendance[row.status] = Number(row.total);
    const recent = await db.select({ status: attendanceRecords.status })
      .from(attendanceRecords)
      .where(attendanceWhere)
      .orderBy(desc(attendanceRecords.date))
      .limit(10);
    let consecutiveAbsences = 0;
    for (const row of recent) {
      if (row.status !== 'ABSENT') break;
      consecutiveAbsences++;
    }

    // Insignias, compras y última actividad.
    const [badgeCount] = await db.select({ total: count() }).from(studentBadges)
      .where(and(eq(studentBadges.studentProfileId, studentId), ...(from ? [gte(studentBadges.unlockedAt, from)] : [])));
    const [shopping] = await db.select({
      count: count(),
      spent: sql<string>`COALESCE(SUM(${purchases.totalPrice}), 0)`,
    }).from(purchases)
      .where(and(eq(purchases.studentId, studentId), eq(purchases.status, 'APPROVED'), ...(from ? [gte(purchases.purchasedAt, from)] : [])));
    const [last] = await db.select({ at: max(pointLogs.createdAt) }).from(pointLogs)
      .where(and(eq(pointLogs.studentId, studentId), eq(pointLogs.isReverted, false)));

    // Puesto por XP entre los alumnos activos (sin alumnos de demostración).
    const [ahead] = await db.select({ total: count() }).from(studentProfiles).where(and(
      eq(studentProfiles.classroomId, classroomId),
      eq(studentProfiles.isActive, true),
      eq(studentProfiles.isDemo, false),
      gt(studentProfiles.xp, student?.xp ?? 0),
    ));
    const [classSize] = await db.select({ total: count() }).from(studentProfiles).where(and(
      eq(studentProfiles.classroomId, classroomId),
      eq(studentProfiles.isActive, true),
      eq(studentProfiles.isDemo, false),
    ));

    // Clan y lo que el alumno aportó en el periodo.
    let clan: { id: string; name: string; emblem: string; contributedXp: number } | null = null;
    if (student?.teamId) {
      const [team] = await db.select({ id: teams.id, name: teams.name, emblem: teams.emblem }).from(teams).where(eq(teams.id, student.teamId));
      if (team) {
        const [contribution] = await db.select({ xp: sql<string>`COALESCE(SUM(${clanLogs.xpAmount}), 0)` }).from(clanLogs).where(and(
          eq(clanLogs.studentId, studentId),
          eq(clanLogs.clanId, team.id),
          eq(clanLogs.action, 'XP_CONTRIBUTED'),
          ...(from ? [gte(clanLogs.createdAt, from)] : []),
        ));
        clan = { ...team, contributedXp: Number(contribution?.xp ?? 0) };
      }
    }

    // Figuritas: distintas que tiene de los álbumes de la clase.
    const albumIds = (await db.select({ id: collectibleAlbums.id }).from(collectibleAlbums)
      .where(eq(collectibleAlbums.classroomId, classroomId))).map((a) => a.id);
    let collectibles = { owned: 0, total: 0 };
    if (albumIds.length > 0) {
      const [total] = await db.select({ total: count() }).from(collectibleCards).where(inArray(collectibleCards.albumId, albumIds));
      const [owned] = await db.select({ total: sql<string>`COUNT(DISTINCT ${studentCollectibles.cardId})` })
        .from(studentCollectibles)
        .innerJoin(collectibleCards, eq(studentCollectibles.cardId, collectibleCards.id))
        .where(and(eq(studentCollectibles.studentProfileId, studentId), inArray(collectibleCards.albumId, albumIds)));
      collectibles = { owned: Number(owned?.total ?? 0), total: Number(total?.total ?? 0) };
    }

    const toNumber = (value: string | number | null | undefined) => Number(value ?? 0);
    return {
      period: {
        kind: period,
        label: period === 'bimester' ? bimesterLabel(classroom?.currentBimester) : 'Todo el curso',
        from: from ? from.toISOString() : null,
      },
      points: {
        xpGained: toNumber(points?.xpGained),
        xpLost: toNumber(points?.xpLost),
        hpGained: toNumber(points?.hpGained),
        hpLost: toNumber(points?.hpLost),
        gpGained: toNumber(points?.gpGained),
        gpLost: toNumber(points?.gpLost),
      },
      events: { positive: toNumber(points?.positive), negative: toNumber(points?.negative) },
      topBehaviors: topBehaviors.map((b) => ({ name: b.name, positive: b.action === 'ADD', times: toNumber(b.times) })),
      timeline: {
        bucket,
        points: series.map((s) => ({ date: s.date, xp: toNumber(s.xp), hp: toNumber(s.hp), gp: toNumber(s.gp) })),
      },
      attendance: {
        present: attendance.PRESENT,
        late: attendance.LATE,
        absent: attendance.ABSENT,
        excused: attendance.EXCUSED,
        total: attendance.PRESENT + attendance.LATE + attendance.ABSENT + attendance.EXCUSED,
        consecutiveAbsences,
      },
      badges: toNumber(badgeCount?.total),
      purchases: { count: toNumber(shopping?.count), spent: toNumber(shopping?.spent) },
      rank: { position: toNumber(ahead?.total) + 1, total: toNumber(classSize?.total) },
      clan,
      collectibles,
      lastActivityAt: last?.at ? new Date(last.at).toISOString() : null,
      maxHp: classroom?.maxHp ?? 100,
    };
  }
}

export const studentSummaryService = new StudentSummaryService();
