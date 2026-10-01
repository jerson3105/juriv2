import { and, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { classrooms, levelUpLogs, studentProfiles } from '../db/schema.js';
import { calculateLevel } from './helpers.js';

/**
 * Operaciones atómicas sobre la economía del alumno (oro/XP).
 *
 * Evitan el patrón "leer saldo → comprobar → escribir saldo_leído ± delta", que con
 * peticiones simultáneas permite gastar el mismo oro varias veces o pisar otras
 * escrituras. Deben usarse dentro de la misma transacción que el resto de la operación.
 */

// Acepta `db` o un `tx` de Drizzle.
type Executor = {
  update: typeof import('../db/index.js').db.update;
  select: typeof import('../db/index.js').db.select;
  insert: typeof import('../db/index.js').db.insert;
};

/** De dónde vino una subida de nivel (registro "Niveles" y celebraciones). */
export type LevelUpSource =
  | 'BEHAVIOR' | 'POINTS' | 'ATTENDANCE' | 'BADGE' | 'STORY' | 'STREAK'
  | 'EXPEDITION' | 'TOURNAMENT' | 'EVENT' | 'ACTIVITY' | 'OTHER';

type LevelChange = { studentProfileId: string; classroomId: string; from: number; to: number };

/** Registra subidas de nivel en la misma transacción que el cambio de XP. */
const logLevelUps = async (exec: Executor, changes: LevelChange[], source: LevelUpSource = 'OTHER') => {
  const ups = changes.filter((c) => c.to > c.from);
  if (ups.length === 0) return;
  const now = new Date();
  await exec.insert(levelUpLogs).values(ups.map((c) => ({
    id: uuidv4(),
    classroomId: c.classroomId,
    studentProfileId: c.studentProfileId,
    fromLevel: c.from,
    toLevel: c.to,
    source,
    createdAt: now,
  })));
};

/**
 * Marca como revertidas las subidas por encima del nivel actual (una reversión bajó el XP).
 * Así "Hoy subieron" y las celebraciones del alumno no muestran niveles que ya no tiene.
 */
export const revertLevelUpsAbove = async (exec: Executor, studentProfileId: string, level: number) => {
  await exec.update(levelUpLogs)
    .set({ isReverted: true })
    .where(and(eq(levelUpLogs.studentProfileId, studentProfileId), gt(levelUpLogs.toLevel, level), eq(levelUpLogs.isReverted, false)));
};

/**
 * Para caminos que escriben el XP sin pasar por applyPointDeltas (eventos, actividades):
 * sube el nivel si el XP actual lo permite y lo registra. El nivel solo sube.
 */
export const syncLevelFromXp = async (exec: Executor, studentProfileId: string, source: LevelUpSource) => {
  const [row] = await exec
    .select({ xp: studentProfiles.xp, level: studentProfiles.level, classroomId: studentProfiles.classroomId, xpPerLevel: classrooms.xpPerLevel })
    .from(studentProfiles)
    .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
    .where(eq(studentProfiles.id, studentProfileId));
  if (!row) return null;
  const level = Math.max(row.level, calculateLevel(Math.max(0, row.xp), row.xpPerLevel || 100));
  if (level !== row.level) {
    await exec.update(studentProfiles).set({ level }).where(eq(studentProfiles.id, studentProfileId));
    await logLevelUps(exec, [{ studentProfileId, classroomId: row.classroomId, from: row.level, to: level }], source);
  }
  return { level, previousLevel: row.level };
};

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
  /** Mínimo de XP al restar (p. ej. 0 al corregir asistencia; null = sin mínimo). */
  xpMin?: number | null;
  /** Origen para el registro de subidas de nivel. */
  source?: LevelUpSource;
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
  if (xp !== 0) set.xp = clampedDelta(studentProfiles.xp, xp, rules.xpMin, null);
  if (hp !== 0) set.hp = clampedDelta(studentProfiles.hp, hp, rules.hpMin, rules.hpMax);
  if (gp !== 0) set.gp = clampedDelta(studentProfiles.gp, gp, rules.gpMin, null);

  const result = await exec
    .update(studentProfiles)
    .set(set)
    .where(eq(studentProfiles.id, studentProfileId));
  if (affectedRows(result) !== 1) return null;

  // El UPDATE bloqueó la fila dentro de la transacción: esta lectura ya es consistente.
  const [row] = await exec
    .select({ xp: studentProfiles.xp, hp: studentProfiles.hp, gp: studentProfiles.gp, level: studentProfiles.level, classroomId: studentProfiles.classroomId })
    .from(studentProfiles)
    .where(eq(studentProfiles.id, studentProfileId));
  if (!row) return null;

  const level = xp > 0 ? Math.max(row.level, calculateLevel(row.xp, rules.xpPerLevel || 100)) : row.level;
  if (level !== row.level) {
    await exec.update(studentProfiles).set({ level }).where(eq(studentProfiles.id, studentProfileId));
    await logLevelUps(exec, [{ studentProfileId, classroomId: row.classroomId, from: row.level, to: level }], rules.source);
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
  if (xp !== 0) set.xp = clampedDelta(studentProfiles.xp, xp, rules.xpMin, null);
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
      classroomId: studentProfiles.classroomId,
    })
    .from(studentProfiles)
    .where(inArray(studentProfiles.id, ids));

  const changes: LevelChange[] = [];
  for (const row of rows) {
    const level = xp > 0 ? Math.max(row.level, calculateLevel(row.xp, rules.xpPerLevel || 100)) : row.level;
    if (level !== row.level) {
      await exec.update(studentProfiles).set({ level }).where(eq(studentProfiles.id, row.id));
      changes.push({ studentProfileId: row.id, classroomId: row.classroomId, from: row.level, to: level });
    }
    results.set(row.id, { xp: row.xp, hp: row.hp, gp: row.gp, level, previousLevel: row.level });
  }
  await logLevelUps(exec, changes, rules.source);
  return results;
};

/** Atajo para recompensas de XP/oro sin límites. */
export const addXpGp = (
  exec: Executor,
  studentProfileId: string,
  deltas: { xp?: number; gp?: number },
  xpPerLevel = 100,
  source: LevelUpSource = 'OTHER'
) => applyPointDeltas(exec, studentProfileId, deltas, { xpPerLevel, source });
