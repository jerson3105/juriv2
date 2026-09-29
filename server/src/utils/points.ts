import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { studentProfiles } from '../db/schema.js';
import { calculateLevel } from './helpers.js';

/**
 * Operaciones atómicas sobre la economía del alumno (oro/XP).
 *
 * Evitan el patrón "leer saldo → comprobar → escribir saldo_leído ± delta", que con
 * peticiones simultáneas permite gastar el mismo oro varias veces o pisar otras
 * escrituras. Deben usarse dentro de la misma transacción que el resto de la operación.
 */

// Acepta `db` o un `tx` de Drizzle.
type Executor = { update: typeof import('../db/index.js').db.update; select: typeof import('../db/index.js').db.select };

/** Filas afectadas de un UPDATE/DELETE de Drizzle + mysql2. */
export const affectedRows = (result: unknown): number => {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
};

/**
 * Descuenta oro solo si alcanza: `gp = gp - amount WHERE gp >= amount`.
 * Devuelve `false` si no había saldo suficiente (no se descuenta nada).
 */
export const spendGp = async (exec: Executor, studentProfileId: string, amount: number): Promise<boolean> => {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Importe inválido');
  if (amount === 0) return true;
  const result = await exec
    .update(studentProfiles)
    .set({ gp: sql`${studentProfiles.gp} - ${amount}`, updatedAt: new Date() })
    .where(and(eq(studentProfiles.id, studentProfileId), gte(studentProfiles.gp, amount)));
  return affectedRows(result) === 1;
};

export interface PointRules {
  /** XP por nivel de la clase (para recalcular el nivel). */
  xpPerLevel?: number;
  /** Mínimo de PV al restar (0 si la clase no permite PV negativos; null = sin mínimo). */
  hpMin?: number | null;
  /** Máximo de PV al sumar (maxHp de la clase; null = sin máximo). */
  hpMax?: number | null;
  /** Mínimo de oro al restar (null = sin mínimo). */
  gpMin?: number | null;
}

export interface PointResult {
  xp: number;
  hp: number;
  gp: number;
  level: number;
  previousLevel: number;
}

const clampedDelta = (column: any, delta: number, min?: number | null, max?: number | null) => {
  if (delta > 0 && max !== undefined && max !== null) return sql`LEAST(${max}, ${column} + ${delta})`;
  if (delta < 0 && min !== undefined && min !== null) return sql`GREATEST(${min}, ${column} + ${delta})`;
  return sql`${column} + ${delta}`;
};

/**
 * Aplica deltas de XP/PV/oro en una sola sentencia atómica, con los límites de la clase
 * calculados en SQL (no a partir de un saldo leído antes). Después recalcula el nivel desde
 * el XP real; el nivel solo sube. Devuelve los valores finales, o null si el alumno no existe.
 */
export const applyPointDeltas = async (
  exec: Executor,
  studentProfileId: string,
  deltas: { xp?: number; hp?: number; gp?: number },
  rules: PointRules = {}
): Promise<PointResult | null> => {
  const xp = Math.trunc(deltas.xp ?? 0);
  const hp = Math.trunc(deltas.hp ?? 0);
  const gp = Math.trunc(deltas.gp ?? 0);

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (xp !== 0) set.xp = sql`${studentProfiles.xp} + ${xp}`;
  if (hp !== 0) set.hp = clampedDelta(studentProfiles.hp, hp, rules.hpMin, rules.hpMax);
  if (gp !== 0) set.gp = clampedDelta(studentProfiles.gp, gp, rules.gpMin, null);

  const result = await exec
    .update(studentProfiles)
    .set(set)
    .where(eq(studentProfiles.id, studentProfileId));
  if (affectedRows(result) !== 1) return null;

  // El UPDATE bloqueó la fila dentro de la transacción: esta lectura ya es consistente.
  const [row] = await exec
    .select({ xp: studentProfiles.xp, hp: studentProfiles.hp, gp: studentProfiles.gp, level: studentProfiles.level })
    .from(studentProfiles)
    .where(eq(studentProfiles.id, studentProfileId));
  if (!row) return null;

  const level = xp > 0 ? Math.max(row.level, calculateLevel(row.xp, rules.xpPerLevel || 100)) : row.level;
  if (level !== row.level) {
    await exec.update(studentProfiles).set({ level }).where(eq(studentProfiles.id, studentProfileId));
  }
  return { xp: row.xp, hp: row.hp, gp: row.gp, level, previousLevel: row.level };
};

/**
 * Igual que `applyPointDeltas`, pero con los mismos deltas para varios alumnos en una sola
 * sentencia (los límites se evalúan fila a fila en SQL). Una ida y vuelta en vez de dos o tres
 * por alumno. Devuelve el resultado por alumno (los que no existen no aparecen).
 */
export const applyPointDeltasBulk = async (
  exec: Executor,
  studentProfileIds: string[],
  deltas: { xp?: number; hp?: number; gp?: number },
  rules: PointRules = {}
): Promise<Map<string, PointResult>> => {
  const results = new Map<string, PointResult>();
  const ids = [...new Set(studentProfileIds)];
  if (ids.length === 0) return results;

  const xp = Math.trunc(deltas.xp ?? 0);
  const hp = Math.trunc(deltas.hp ?? 0);
  const gp = Math.trunc(deltas.gp ?? 0);

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (xp !== 0) set.xp = sql`${studentProfiles.xp} + ${xp}`;
  if (hp !== 0) set.hp = clampedDelta(studentProfiles.hp, hp, rules.hpMin, rules.hpMax);
  if (gp !== 0) set.gp = clampedDelta(studentProfiles.gp, gp, rules.gpMin, null);

  await exec.update(studentProfiles).set(set).where(inArray(studentProfiles.id, ids));

  // Filas bloqueadas por el UPDATE dentro de la transacción: lectura consistente.
  const rows = await exec
    .select({
      id: studentProfiles.id,
      xp: studentProfiles.xp,
      hp: studentProfiles.hp,
      gp: studentProfiles.gp,
      level: studentProfiles.level,
    })
    .from(studentProfiles)
    .where(inArray(studentProfiles.id, ids));

  for (const row of rows) {
    const level = xp > 0 ? Math.max(row.level, calculateLevel(row.xp, rules.xpPerLevel || 100)) : row.level;
    if (level !== row.level) {
      await exec.update(studentProfiles).set({ level }).where(eq(studentProfiles.id, row.id));
    }
    results.set(row.id, { xp: row.xp, hp: row.hp, gp: row.gp, level, previousLevel: row.level });
  }
  return results;
};

/** Atajo para recompensas de XP/oro sin límites. */
export const addXpGp = (
  exec: Executor,
  studentProfileId: string,
  deltas: { xp?: number; gp?: number },
  xpPerLevel = 100
) => applyPointDeltas(exec, studentProfileId, deltas, { xpPerLevel });
