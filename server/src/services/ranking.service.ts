import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clanLogs, pointLogs, studentProfiles, teams } from '../db/schema.js';
import { STREAK_DAILY_CLAN_REASON, STREAK_MILESTONE_CLAN_PREFIX } from '../utils/pointReasons.js';

export interface RankingDeltas {
  since: string;
  students: { id: string; xp: number; gp: number }[];
  clans: { id: string; xp: number }[];
  // XP neto por alumno y minuto desde `since` (para la "carrera" de la ceremonia).
  timeline?: { id: string; m: number; xp: number }[];
}

// El pulso de la Lista de estudiantes (solo para el profe).
export interface StudentsPulse {
  // Alumnos con algún comportamiento positivo desde `today` (lo deshecho no cuenta).
  recognizedToday: string[];
  // Por clan: XP aportado desde `week`, sin las rachas de inicio de sesión, y quiénes ganaron XP desde
  // `today` (miembros actuales; lo deshecho no cuenta y la racha no deja registro de puntos).
  clans: { id: string; weekXp: number; contributorsToday: string[] }[];
}

// Tope de filas de la línea de tiempo: un día entero de una clase grande cabe de sobra.
const TIMELINE_LIMIT = 20000;

// Neto de un tipo de punto: ADD suma, REMOVE resta. Las reversiones se excluyen
// (el original y su inverso quedan con is_reverted = 1).
const netOf = (type: 'XP' | 'GP') =>
  sql<string>`COALESCE(SUM(CASE WHEN ${pointLogs.pointType} = ${type} THEN IF(${pointLogs.action} = 'ADD', ${pointLogs.amount}, -${pointLogs.amount}) ELSE 0 END), 0)`;

class RankingService {
  // Lo ganado por cada alumno y clan de la clase desde `since`.
  async getDeltas(classroomId: string, since: Date, withTimeline: boolean): Promise<RankingDeltas> {
    const inPeriod = and(
      eq(studentProfiles.classroomId, classroomId),
      gte(pointLogs.createdAt, since),
      eq(pointLogs.isReverted, false),
    );

    const studentRows = await db
      .select({ id: pointLogs.studentId, xp: netOf('XP'), gp: netOf('GP') })
      .from(pointLogs)
      .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
      .where(inPeriod)
      .groupBy(pointLogs.studentId);

    const clanRows = await db
      .select({ id: clanLogs.clanId, xp: sql<string>`COALESCE(SUM(${clanLogs.xpAmount}), 0)` })
      .from(clanLogs)
      .innerJoin(teams, eq(clanLogs.clanId, teams.id))
      .where(and(eq(teams.classroomId, classroomId), eq(clanLogs.action, 'XP_CONTRIBUTED'), gte(clanLogs.createdAt, since)))
      .groupBy(clanLogs.clanId);

    const result: RankingDeltas = {
      since: since.toISOString(),
      students: studentRows
        .map((r) => ({ id: r.id, xp: Number(r.xp), gp: Number(r.gp) }))
        .filter((r) => r.xp !== 0 || r.gp !== 0),
      clans: clanRows.map((r) => ({ id: r.id, xp: Number(r.xp) })).filter((r) => r.xp !== 0),
    };

    if (withTimeline) {
      // Minutos desde `since`: se calcula en la BD con el mismo reloj con el que se guardó created_at.
      const minute = sql<string>`FLOOR(TIMESTAMPDIFF(SECOND, ${since}, ${pointLogs.createdAt}) / 60)`;
      const rows = await db
        .select({ id: pointLogs.studentId, m: minute, xp: netOf('XP') })
        .from(pointLogs)
        .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
        .where(and(inPeriod, eq(pointLogs.pointType, 'XP')))
        .groupBy(pointLogs.studentId, minute)
        .orderBy(minute)
        .limit(TIMELINE_LIMIT);
      result.timeline = rows
        .map((r) => ({ id: r.id, m: Number(r.m), xp: Number(r.xp) }))
        .filter((r) => r.xp !== 0);
    }

    return result;
  }

  async getPulse(classroomId: string, today: Date, week: Date): Promise<StudentsPulse> {
    const recognizedRows = await db
      .selectDistinct({ id: pointLogs.studentId })
      .from(pointLogs)
      .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        gte(pointLogs.createdAt, today),
        eq(pointLogs.isReverted, false),
        eq(pointLogs.action, 'ADD'),
        isNotNull(pointLogs.behaviorId),
      ));

    const notStreak = sql`(${clanLogs.reason} IS NULL OR (${clanLogs.reason} <> ${STREAK_DAILY_CLAN_REASON} AND ${clanLogs.reason} NOT LIKE ${`${STREAK_MILESTONE_CLAN_PREFIX}%`}))`;
    const weekRows = await db
      .select({ id: clanLogs.clanId, xp: sql<string>`COALESCE(SUM(${clanLogs.xpAmount}), 0)` })
      .from(clanLogs)
      .innerJoin(teams, eq(clanLogs.clanId, teams.id))
      .where(and(eq(teams.classroomId, classroomId), eq(clanLogs.action, 'XP_CONTRIBUTED'), gte(clanLogs.createdAt, week), notStreak))
      .groupBy(clanLogs.clanId);

    const contributorRows = await db
      .selectDistinct({ clanId: studentProfiles.teamId, studentId: pointLogs.studentId })
      .from(pointLogs)
      .innerJoin(studentProfiles, eq(pointLogs.studentId, studentProfiles.id))
      .where(and(
        eq(studentProfiles.classroomId, classroomId),
        isNotNull(studentProfiles.teamId),
        gte(pointLogs.createdAt, today),
        eq(pointLogs.isReverted, false),
        eq(pointLogs.action, 'ADD'),
        eq(pointLogs.pointType, 'XP'),
      ));

    const clans = new Map<string, { id: string; weekXp: number; contributorsToday: string[] }>();
    const clanOf = (id: string) => {
      let clan = clans.get(id);
      if (!clan) {
        clan = { id, weekXp: 0, contributorsToday: [] };
        clans.set(id, clan);
      }
      return clan;
    };
    for (const row of weekRows) clanOf(row.id).weekXp = Number(row.xp);
    for (const row of contributorRows) if (row.clanId) clanOf(row.clanId).contributorsToday.push(row.studentId);

    return { recognizedToday: recognizedRows.map((row) => row.id), clans: [...clans.values()] };
  }
}

export const rankingService = new RankingService();
