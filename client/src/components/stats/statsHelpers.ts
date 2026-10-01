import type { AttentionKind, StatsPeriod } from '../../lib/statsApi';

export const statsKey = (classroomId: string, period: StatsPeriod) => ['class-stats', classroomId, period] as const;

export const STATS_PERIODS: { id: StatsPeriod; label: string }[] = [
  { id: 'week', label: 'Esta semana' },
  { id: 'bimester', label: 'Bimestre' },
  { id: 'month', label: 'Últimos 30 días' },
  { id: 'all', label: 'Todo el curso' },
];

// Motivo de atención: color + texto (nunca solo color). AA claro y oscuro.
export const REASON_STYLE: Record<AttentionKind, string> = {
  LOW_HP: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
  ABSENCES: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
  GRADE_C: 'bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100',
  NEGATIVE: 'bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100',
  INACTIVE: 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100',
};

/** Variación frente al periodo anterior, en texto ("+12 %", "igual", "nuevo"). */
export const changeLabel = (current: number, previous: number | null | undefined) => {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 'igual que antes' : 'sin datos del periodo anterior';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return 'igual que el periodo anterior';
  return `${pct > 0 ? '+' : ''}${pct} % frente al periodo anterior`;
};

export const shortDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' });
};
