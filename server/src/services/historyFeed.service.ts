import { and, count, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  attendanceRecords,
  badges,
  behaviors,
  itemUsages,
  levelUpLogs,
  pointLogs,
  purchases,
  shopItems,
  studentBadges,
  studentProfiles,
  users,
} from '../db/schema.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import type { ActivityLogEntry } from './history.service.js';

export type FeedType = 'ALL' | 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'BADGE' | 'ATTENDANCE' | 'LEVEL_UP';

/** Entrada del registro con clave estable (orden y cursor), lote y autor. */
export interface FeedEntry extends Omit<ActivityLogEntry, 'timestamp'> {
  timestamp: Date;
  key: string;
  /** Misma acción aplicada a varios alumnos en el mismo instante (solo puntos). */
  batchKey?: string;
  behaviorIcon?: string | null;
  /** Quién lo hizo: null = automático; undefined = no aplica (compras, asistencia). */
  actor?: { id: string; name: string } | null;
}

export interface FeedOptions {
  type: FeedType;
  studentId?: string;
  from?: Date | null;
  to?: Date | null;
  cursor?: string | null;
  limit: number;
}

type Bounds = { gte?: Date; lt?: Date };
type Student = { id: string; characterName: string | null; characterClass: string };

const SECOND = 1000;
const secondOf = (value: Date | string) => Math.floor(new Date(value).getTime() / SECOND) * SECOND;
const maxDate = (a?: Date | null, b?: Date | null) => (a && b ? (a > b ? a : b) : a ?? b ?? undefined);
const minDate = (a?: Date | null, b?: Date | null) => (a && b ? (a < b ? a : b) : a ?? b ?? undefined);

export const encodeCursor = (sec: number, key: string) => Buffer.from(`${sec}|${key}`).toString('base64url');
const decodeCursor = (raw: string) => {
  const [sec, ...rest] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  const value = Number(sec);
  if (!Number.isFinite(value) || value <= 0 || value > Date.now() + 86_400_000) throw new ValidationError('Cursor inválido');
  return { sec: value, key: rest.join('|') };
};

// Una fuente del registro: cómo pedir filas en un rango y cómo convertirlas en entradas.
interface Source<R> {
  fetch: (bounds: Bounds, limit?: number) => Promise<R[]>;
  at: (row: R) => Date;
  toEntries: (rows: R[]) => FeedEntry[];
  /** Filas por entrada en el peor caso (puntos: XP + HP + GP). */
  rowsPerEntry: number;
}

/**
 * Pide una página de una fuente trabajando por SEGUNDOS COMPLETOS: el segundo del cursor entero
 * y, si el límite corta, el último segundo también entero. Así nunca se parte un grupo
 * (XP+HP+GP de un comportamiento) ni un lote (la misma acción a toda la clase).
 * horizon = segundo más antiguo garantizado completo (null si la fuente se agotó).
 */
const collect = async <R>(source: Source<R>, cursorSec: number | null, upper: Date | undefined, limit: number) => {
  const rows: R[] = [];
  if (cursorSec !== null) rows.push(...await source.fetch({ gte: new Date(cursorSec), lt: new Date(cursorSec + SECOND) }));

  const olderUpper = cursorSec !== null ? new Date(cursorSec) : upper;
  const fetchLimit = (limit + 1) * source.rowsPerEntry;
  const older = await source.fetch({ lt: olderUpper }, fetchLimit);
  let horizon: number | null = null;
  if (older.length >= fetchLimit) {
    horizon = secondOf(source.at(older[older.length - 1]));
    rows.push(...older.filter((row) => secondOf(source.at(row)) !== horizon));
    rows.push(...await source.fetch({ gte: new Date(horizon), lt: minDate(new Date(horizon + SECOND), olderUpper) }));
  } else {
    rows.push(...older);
  }
  return { entries: source.toEntries(rows), horizon };
};

// Orden del registro: más reciente primero; dentro del mismo segundo, por clave (los lotes quedan juntos).
const compareEntries = (a: FeedEntry, b: FeedEntry) => {
  const diff = secondOf(b.timestamp) - secondOf(a.timestamp);
  return diff !== 0 ? diff : a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
};

class HistoryFeedService {
  private async classStudents(classroomId: string, studentId?: string) {
    const students: Student[] = await db.select({
      id: studentProfiles.id,
      characterName: studentProfiles.characterName,
      characterClass: studentProfiles.characterClass,
    }).from(studentProfiles).where(eq(studentProfiles.classroomId, classroomId));
    if (studentId && !students.some((s) => s.id === studentId)) throw new NotFoundError('Estudiante no encontrado en esta clase');
    return students;
  }

  private async actorNames(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map<string, string>();
    const rows = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(inArray(users.id, unique));
    return new Map(rows.map((u) => [u.id, [u.firstName, u.lastName ? `${u.lastName.charAt(0)}.` : ''].filter(Boolean).join(' ') || 'Profesor']));
  }

  /**
   * Registro de actividad paginado por cursor (sin tope de profundidad y sin total falso).
   * Filtros: tipo, alumno y periodo [from, to).
   */
  async getFeed(classroomId: string, options: FeedOptions) {
    const { type, studentId, from, to, limit } = options;
    const students = await this.classStudents(classroomId, studentId);
    if (students.length === 0) return { entries: [], nextCursor: null, hasMore: false };

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const ids = studentId ? [studentId] : students.map((s) => s.id);
    const cursor = options.cursor ? decodeCursor(options.cursor) : null;
    const wants = (kind: FeedType) => type === 'ALL' || type === kind;
    const range = (column: Parameters<typeof gte>[0], bounds: Bounds) => {
      const lower = maxDate(from, bounds.gte);
      const upper = minDate(to, bounds.lt);
      return [lower ? gte(column, lower) : undefined, upper ? lt(column, upper) : undefined].filter(Boolean) as SQL[];
    };
    const base = (id: string) => {
      const s = studentMap.get(id);
      return { studentId: id, studentName: s?.characterName ?? null, studentClass: s?.characterClass ?? 'GUARDIAN' };
    };

    const sources: Source<any>[] = [];

    if (wants('POINTS')) {
      // Los registros inversos de una reversión (⟲) no se muestran: la original queda marcada.
      const notInverse = sql`(${pointLogs.reason} IS NULL OR ${pointLogs.reason} NOT LIKE '⟲%')`;
      const pointColumns = {
        id: pointLogs.id,
        studentId: pointLogs.studentId,
        behaviorId: pointLogs.behaviorId,
        pointType: pointLogs.pointType,
        action: pointLogs.action,
        amount: pointLogs.amount,
        multiplier: pointLogs.multiplier,
        reason: pointLogs.reason,
        givenBy: pointLogs.givenBy,
        createdAt: pointLogs.createdAt,
        isReverted: pointLogs.isReverted,
        behaviorName: behaviors.name,
        behaviorIcon: behaviors.icon,
      };
      const detailRows = (where: SQL | undefined) => db.select(pointColumns).from(pointLogs)
        .leftJoin(behaviors, eq(pointLogs.behaviorId, behaviors.id))
        .where(where)
        .orderBy(desc(pointLogs.createdAt), desc(pointLogs.id));

      sources.push({
        rowsPerEntry: 3,
        at: (r) => r.createdAt,
        fetch: async (bounds, max) => {
          if (!max) return detailRows(and(inArray(pointLogs.studentId, ids), notInverse, ...range(pointLogs.createdAt, bounds)));
          // Con límite: una subconsulta por alumno sobre (student_id, created_at) y se unen.
          // Un IN(...) con ORDER BY + LIMIT recorre el índice global de fecha o todo el rango de la clase.
          const parts = ids.map((id) => sql`(SELECT ${pointLogs.id} AS id, ${pointLogs.createdAt} AS created_at FROM ${pointLogs}
            WHERE ${and(eq(pointLogs.studentId, id), notInverse, ...range(pointLogs.createdAt, bounds))}
            ORDER BY ${pointLogs.createdAt} DESC, ${pointLogs.id} DESC LIMIT ${sql.raw(String(max))})`);
          const [picked] = await db.execute(sql`SELECT u.id FROM (${sql.join(parts, sql` UNION ALL `)}) u ORDER BY u.created_at DESC, u.id DESC LIMIT ${sql.raw(String(max))}`) as unknown as [{ id: string }[]];
          if (picked.length === 0) return [];
          return detailRows(inArray(pointLogs.id, picked.map((p) => p.id)));
        },
        toEntries: (rows) => {
          // Un comportamiento con XP+HP+GP son varias filas del mismo instante: una sola entrada.
          const groups = new Map<string, FeedEntry & { xp: number; hp: number; gp: number }>();
          for (const r of rows) {
            const sec = secondOf(r.createdAt);
            const what = r.behaviorId ? `b:${r.behaviorId}` : r.reason ? `r:${r.reason}` : `id:${r.id}`;
            const groupKey = `P|${what}|${r.action}|${r.studentId}|${sec}`;
            let g = groups.get(groupKey);
            if (!g) {
              g = {
                id: r.id,
                key: '',
                type: 'POINTS',
                timestamp: r.createdAt,
                ...base(r.studentId),
                isReverted: !!r.isReverted,
                behaviorIcon: r.behaviorIcon ?? null,
                actor: r.givenBy ? { id: r.givenBy, name: '' } : null,
                details: { action: r.action, reason: r.reason || r.behaviorName || undefined, multiplier: r.multiplier ?? 1000 },
                xp: 0, hp: 0, gp: 0,
              };
              groups.set(groupKey, g);
            }
            if (r.pointType === 'XP') g.xp += r.amount;
            else if (r.pointType === 'HP') g.hp += r.amount;
            else if (r.pointType === 'GP') g.gp += r.amount;
            g.isReverted = g.isReverted && !!r.isReverted;
          }
          return [...groups.values()].map(({ xp, hp, gp, ...entry }) => {
            const parts = [xp && 'XP', hp && 'HP', gp && 'GP'].filter(Boolean);
            const what = entry.details.reason ?? entry.id;
            return {
              ...entry,
              // Clave: primero la acción (los alumnos del mismo lote quedan contiguos), luego el alumno.
              key: `P|${what}|${entry.details.action}|${xp}|${hp}|${gp}|${entry.studentId}`,
              batchKey: `P|${secondOf(entry.timestamp)}|${what}|${entry.details.action}|${xp}|${hp}|${gp}|${entry.details.multiplier}`,
              details: {
                ...entry.details,
                pointType: parts.length === 1 ? parts[0] as string : 'MIXED',
                amount: parts.length === 1 ? xp || hp || gp : 0,
                xpAmount: xp || undefined,
                hpAmount: hp || undefined,
                gpAmount: gp || undefined,
              },
            };
          });
        },
      });
    }

    if (wants('PURCHASE')) {
      sources.push({
        rowsPerEntry: 1,
        at: (r) => r.purchasedAt,
        fetch: (bounds, max) => {
          const q = db.select({
            id: purchases.id, studentId: purchases.studentId, purchasedAt: purchases.purchasedAt,
            quantity: purchases.quantity, totalPrice: purchases.totalPrice, status: purchases.status,
            itemName: shopItems.name, itemIcon: shopItems.icon,
          }).from(purchases).innerJoin(shopItems, eq(purchases.itemId, shopItems.id))
            .where(and(inArray(purchases.studentId, ids), ...range(purchases.purchasedAt, bounds)))
            .orderBy(desc(purchases.purchasedAt), desc(purchases.id));
          return max ? q.limit(max) : q;
        },
        toEntries: (rows) => rows.map((r) => ({
          id: r.id, key: `S|${r.id}`, type: 'PURCHASE' as const, timestamp: r.purchasedAt, ...base(r.studentId),
          details: { itemName: r.itemName, itemIcon: r.itemIcon || undefined, amount: r.quantity, totalPrice: r.totalPrice, action: r.status },
        })),
      });
    }

    if (wants('ITEM_USED')) {
      sources.push({
        rowsPerEntry: 1,
        at: (r) => r.usedAt,
        fetch: (bounds, max) => {
          const q = db.select({
            id: itemUsages.id, studentId: itemUsages.studentId, usedAt: itemUsages.usedAt, status: itemUsages.status,
            itemName: shopItems.name, itemIcon: shopItems.icon,
          }).from(itemUsages).innerJoin(shopItems, eq(itemUsages.itemId, shopItems.id))
            .where(and(eq(itemUsages.classroomId, classroomId), studentId ? eq(itemUsages.studentId, studentId) : undefined, ...range(itemUsages.usedAt, bounds)))
            .orderBy(desc(itemUsages.usedAt), desc(itemUsages.id));
          return max ? q.limit(max) : q;
        },
        toEntries: (rows) => rows.map((r) => ({
          id: r.id, key: `U|${r.id}`, type: 'ITEM_USED' as const, timestamp: r.usedAt, ...base(r.studentId),
          details: { itemName: r.itemName, itemIcon: r.itemIcon || undefined, action: r.status },
        })),
      });
    }

    if (wants('BADGE')) {
      sources.push({
        rowsPerEntry: 1,
        at: (r) => r.unlockedAt,
        fetch: (bounds, max) => {
          const q = db.select({
            id: studentBadges.id, studentId: studentBadges.studentProfileId, unlockedAt: studentBadges.unlockedAt,
            awardedBy: studentBadges.awardedBy, badgeName: badges.name, badgeIcon: badges.icon,
          }).from(studentBadges).innerJoin(badges, eq(studentBadges.badgeId, badges.id))
            .where(and(inArray(studentBadges.studentProfileId, ids), ...range(studentBadges.unlockedAt, bounds)))
            .orderBy(desc(studentBadges.unlockedAt), desc(studentBadges.id));
          return max ? q.limit(max) : q;
        },
        toEntries: (rows) => rows.map((r) => ({
          id: r.id, key: `B|${r.badgeName}|${r.id}`, type: 'BADGE' as const, timestamp: r.unlockedAt, ...base(r.studentId),
          actor: r.awardedBy ? { id: r.awardedBy, name: '' } : null,
          details: { badgeName: r.badgeName, badgeIcon: r.badgeIcon || undefined },
        })),
      });
    }

    if (wants('ATTENDANCE')) {
      sources.push({
        rowsPerEntry: 1,
        at: (r) => r.createdAt,
        fetch: (bounds, max) => {
          const q = db.select({
            id: attendanceRecords.id, studentId: attendanceRecords.studentProfileId, date: attendanceRecords.date,
            status: attendanceRecords.status, xpAwarded: attendanceRecords.xpAwarded,
            createdAt: attendanceRecords.createdAt, isReverted: attendanceRecords.isReverted,
          }).from(attendanceRecords)
            .where(and(eq(attendanceRecords.classroomId, classroomId), studentId ? eq(attendanceRecords.studentProfileId, studentId) : undefined, ...range(attendanceRecords.createdAt, bounds)))
            .orderBy(desc(attendanceRecords.createdAt), desc(attendanceRecords.id));
          return max ? q.limit(max) : q;
        },
        toEntries: (rows) => rows.map((r) => ({
          id: r.id, key: `A|${r.id}`, type: 'ATTENDANCE' as const, timestamp: r.createdAt, ...base(r.studentId),
          isReverted: !!r.isReverted,
          details: { attendanceStatus: r.status, attendanceDate: new Date(r.date).toISOString().split('T')[0], amount: r.xpAwarded || 0 },
        })),
      });
    }

    if (wants('LEVEL_UP')) {
      sources.push({
        rowsPerEntry: 1,
        at: (r) => r.createdAt,
        fetch: (bounds, max) => {
          const q = db.select({
            id: levelUpLogs.id, studentId: levelUpLogs.studentProfileId, fromLevel: levelUpLogs.fromLevel,
            toLevel: levelUpLogs.toLevel, source: levelUpLogs.source, isReverted: levelUpLogs.isReverted, createdAt: levelUpLogs.createdAt,
          }).from(levelUpLogs)
            .where(and(eq(levelUpLogs.classroomId, classroomId), studentId ? eq(levelUpLogs.studentProfileId, studentId) : undefined, ...range(levelUpLogs.createdAt, bounds)))
            .orderBy(desc(levelUpLogs.createdAt), desc(levelUpLogs.id));
          return max ? q.limit(max) : q;
        },
        toEntries: (rows) => rows.map((r) => ({
          id: r.id, key: `L|${r.id}`, type: 'LEVEL_UP' as const, timestamp: r.createdAt, ...base(r.studentId),
          isReverted: !!r.isReverted,
          details: { newLevel: r.toLevel, fromLevel: r.fromLevel, levelSource: r.source },
        })),
      });
    }

    const pages = await Promise.all(sources.map((source) => collect(source, cursor?.sec ?? null, to ?? undefined, limit)));

    // Mezcla: solo es seguro mostrar hasta el horizonte más reciente de las fuentes que se cortaron.
    const horizons = pages.map((p) => p.horizon).filter((h): h is number => h !== null);
    const floor = horizons.length > 0 ? Math.max(...horizons) : null;
    const eligible = pages.flatMap((p) => p.entries)
      .filter((e) => {
        const sec = secondOf(e.timestamp);
        if (floor !== null && sec < floor) return false;
        return !cursor || sec < cursor.sec || (sec === cursor.sec && e.key < cursor.key);
      })
      .sort(compareEntries);

    const entries = eligible.slice(0, limit);
    const hasMore = eligible.length > limit || floor !== null;
    const last = entries[entries.length - 1];
    const nextCursor = !hasMore ? null : last ? encodeCursor(secondOf(last.timestamp), last.key) : floor !== null ? encodeCursor(floor, '') : null;

    const names = await this.actorNames(entries.map((e) => e.actor?.id));
    for (const e of entries) if (e.actor) e.actor = { id: e.actor.id, name: names.get(e.actor.id) ?? 'Profesor' };

    return { entries, nextCursor, hasMore };
  }

  /** Resumen del periodo filtrado (respeta alumno): puntos netos de reversiones. */
  async getSummary(classroomId: string, options: { studentId?: string; from?: Date | null; to?: Date | null }) {
    const { studentId, from, to } = options;
    const students = await this.classStudents(classroomId, studentId);
    const empty = { xpGiven: 0, xpRemoved: 0, purchases: 0, badges: 0, itemsUsed: 0 };
    if (students.length === 0) return empty;
    const ids = studentId ? [studentId] : students.map((s) => s.id);
    const range = (column: Parameters<typeof gte>[0]) =>
      [from ? gte(column, from) : undefined, to ? lt(column, to) : undefined].filter(Boolean) as SQL[];

    const [xp, [purchaseCount], [badgeCount], [usageCount]] = await Promise.all([
      db.select({ action: pointLogs.action, total: sql<string>`COALESCE(SUM(${pointLogs.amount}), 0)` })
        .from(pointLogs)
        .where(and(inArray(pointLogs.studentId, ids), eq(pointLogs.pointType, 'XP'), eq(pointLogs.isReverted, false), ...range(pointLogs.createdAt)))
        .groupBy(pointLogs.action),
      db.select({ total: count() }).from(purchases)
        .where(and(inArray(purchases.studentId, ids), sql`${purchases.status} <> 'REJECTED'`, ...range(purchases.purchasedAt))),
      db.select({ total: count() }).from(studentBadges)
        .where(and(inArray(studentBadges.studentProfileId, ids), ...range(studentBadges.unlockedAt))),
      db.select({ total: count() }).from(itemUsages)
        .where(and(eq(itemUsages.classroomId, classroomId), studentId ? eq(itemUsages.studentId, studentId) : undefined, ...range(itemUsages.usedAt))),
    ]);

    return {
      xpGiven: Number(xp.find((r) => r.action === 'ADD')?.total ?? 0),
      xpRemoved: Number(xp.find((r) => r.action === 'REMOVE')?.total ?? 0),
      purchases: Number(purchaseCount?.total ?? 0),
      badges: Number(badgeCount?.total ?? 0),
      itemsUsed: Number(usageCount?.total ?? 0),
    };
  }
}

export const historyFeedService = new HistoryFeedService();
