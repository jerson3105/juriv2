import type { FinalSituation } from '../../../lib/schoolPromotionApi';

/** Situación final del estudiante: nombre y color de su etiqueta (padrón de un año cerrado y promoción). */
export const SITUATION: Record<FinalSituation, { label: string; plural: string; chip: string }> = {
  PROMOTED: { label: 'Promovido', plural: 'promovidos', chip: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' },
  REPEATS: { label: 'Permanece', plural: 'permanecen', chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' },
  RECOVERY: { label: 'Recuperación', plural: 'en recuperación', chip: 'bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100' },
  LEAVES: { label: 'No continúa', plural: 'no continúan', chip: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100' },
  GRADUATED: { label: 'Egresa', plural: 'egresan', chip: 'bg-primary-100 text-primary-900 dark:bg-primary-900/50 dark:text-primary-100' },
};

export const SITUATIONS: FinalSituation[] = ['PROMOTED', 'REPEATS', 'RECOVERY', 'LEAVES', 'GRADUATED'];
