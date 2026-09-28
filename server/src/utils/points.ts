import { and, eq, gte, sql } from 'drizzle-orm';
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

/**
 * Suma XP/oro de forma atómica y recalcula el nivel a partir del XP real resultante.
 * Devuelve los valores finales para notificaciones (subida de nivel, etc.).
 */
export const addXpGp = async (
  exec: Executor,
  studentProfileId: string,
  deltas: { xp?: number; gp?: number },
  xpPerLevel = 100
): Promise<{ xp: number; gp: number; level: number; previousLevel: number } | null> => {
  const xp = Math.trunc(deltas.xp ?? 0);
  const gp = Math.trunc(deltas.gp ?? 0);

  const result = await exec
    .update(studentProfiles)
    .set({
      xp: sql`${studentProfiles.xp} + ${xp}`,
      gp: sql`${studentProfiles.gp} + ${gp}`,
      updatedAt: new Date(),
    })
    .where(eq(studentProfiles.id, studentProfileId));
  if (affectedRows(result) !== 1) return null;

  // El UPDATE bloqueó la fila dentro de la transacción: esta lectura ya es consistente.
  const [row] = await exec
    .select({ xp: studentProfiles.xp, gp: studentProfiles.gp, level: studentProfiles.level })
    .from(studentProfiles)
    .where(eq(studentProfiles.id, studentProfileId));
  if (!row) return null;

  const level = xp > 0 ? Math.max(row.level, calculateLevel(row.xp, xpPerLevel)) : row.level;
  if (level !== row.level) {
    await exec.update(studentProfiles).set({ level }).where(eq(studentProfiles.id, studentProfileId));
  }
  return { xp: row.xp, gp: row.gp, level, previousLevel: row.level };
};
