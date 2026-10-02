import { and, eq, gt, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { behaviors, pointLogs, studentProfiles, type ItemRarity } from '../db/schema.js';

// Economía de la tienda: precios relativos a lo que gana un alumno de la clase en una semana (W).
// Común = 1–2 semanas, raro = 3–5, legendario = 8–12; nada más allá de un bimestre (12 semanas).
// Sin datos de ingreso se usa un W por defecto, y el docente ve que sus comportamientos no dan oro.

export const DEFAULT_WEEKLY_GOLD = 10;
const WINDOW_DAYS = 28;

export interface ShopEconomy {
  /** Mediana del oro semanal de los alumnos activos (con algún registro en 4 semanas); 0 si no hay. */
  weeklyGold: number;
  /** El W con el que se calculan las bandas (weeklyGold o el valor por defecto). */
  effectiveWeekly: number;
  activeStudents: number;
  /** ¿Algún comportamiento positivo activo da oro? */
  behaviorsGiveGold: boolean;
  bands: Record<ItemRarity, { min: number; max: number }>;
  /** Un "primer premio" se consigue en una semana o menos. */
  firstPrizeMax: number;
  /** Más que esto es más de un bimestre de ahorro. */
  maxPrice: number;
}

const round = (value: number) => Math.max(1, Math.round(value));

export const bandsFor = (weekly: number): ShopEconomy['bands'] => ({
  COMMON: { min: round(weekly), max: round(weekly * 2) },
  RARE: { min: round(weekly * 3), max: round(weekly * 5) },
  LEGENDARY: { min: round(weekly * 8), max: round(weekly * 12) },
});

/** La rareza sale del precio: hasta 2 semanas común, hasta 5 raro, más legendario. */
export const rarityForPrice = (price: number, weekly: number): ItemRarity => {
  if (price <= weekly * 2) return 'COMMON';
  if (price <= weekly * 5) return 'RARE';
  return 'LEGENDARY';
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const getShopEconomy = async (classroomId: string): Promise<ShopEconomy> => {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const [rows, [goldBehavior]] = await Promise.all([
    db
      .select({
        logs: sql<string>`COUNT(${pointLogs.id})`,
        gold: sql<string>`COALESCE(SUM(CASE WHEN ${pointLogs.pointType} = 'GP' AND ${pointLogs.action} = 'ADD' THEN ${pointLogs.amount} ELSE 0 END), 0)`,
      })
      .from(studentProfiles)
      .leftJoin(pointLogs, and(
        eq(pointLogs.studentId, studentProfiles.id),
        eq(pointLogs.isReverted, false),
        gte(pointLogs.createdAt, since),
      ))
      .where(and(eq(studentProfiles.classroomId, classroomId), eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false)))
      .groupBy(studentProfiles.id),
    db
      .select({ id: behaviors.id })
      .from(behaviors)
      .where(and(eq(behaviors.classroomId, classroomId), eq(behaviors.isActive, true), eq(behaviors.isPositive, true), gt(behaviors.gpValue, 0)))
      .limit(1),
  ]);

  const active = rows.filter((row) => Number(row.logs) > 0);
  const weeklyGold = Math.round(median(active.map((row) => Number(row.gold) / (WINDOW_DAYS / 7))) * 10) / 10;
  const effectiveWeekly = weeklyGold > 0 ? weeklyGold : DEFAULT_WEEKLY_GOLD;
  return {
    weeklyGold,
    effectiveWeekly,
    activeStudents: active.length,
    behaviorsGiveGold: !!goldBehavior,
    bands: bandsFor(effectiveWeekly),
    firstPrizeMax: round(effectiveWeekly),
    maxPrice: round(effectiveWeekly * 12),
  };
};
