import type { EvaluationKind, GradeScaleOptions, GradeScaleType, PerformanceBucket, StudentGrade } from '../../lib/gradeApi';

export const gradebookKey = (classroomId: string, period: string) => ['classroom-grades', classroomId, period] as const;
export const evaluationsKey = (classroomId: string, period: string) => ['grade-evaluations', classroomId, period] as const;
export const evaluationKey = (evaluationId: string) => ['grade-evaluation', evaluationId] as const;
export const bimesterKey = (classroomId: string) => ['bimester-status', classroomId] as const;

// Nivel de logro: mismos 4 tonos en todas las escalas, siempre acompañados de texto (AA claro y oscuro).
export const BUCKET_STYLE: Record<PerformanceBucket, string> = {
  AD: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  A: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100',
  B: 'bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100',
  C: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
};

export const BUCKET_LABEL: Record<PerformanceBucket, string> = {
  AD: 'Logro destacado',
  A: 'Logro esperado',
  B: 'En proceso',
  C: 'En inicio',
};

export const SCALE_LABEL: Record<GradeScaleType, string> = {
  PERU_LETTERS: 'Letras AD, A, B, C',
  PERU_VIGESIMAL: 'Vigesimal 0 a 20',
  CENTESIMAL: 'Centesimal 0 a 100',
  USA_LETTERS: 'Letras A, B, C, D, F',
  CUSTOM: 'Personalizada',
};

export const KIND_LABEL: Record<EvaluationKind, string> = {
  EXAM: 'Examen',
  TASK: 'Tarea',
  PROJECT: 'Proyecto',
  ORAL: 'Exposición',
  PRACTICE: 'Práctica',
  OTHER: 'Otra',
};

export const SOURCE_LABEL: Record<string, string> = {
  EVALUATION: 'Evaluación',
  BEHAVIOR: 'Comportamientos',
  INDICATOR: 'Destreza',
  BADGE: 'Insignia',
  MANUAL_POINTS: 'Puntos',
  TIMED: 'Actividad',
  TOURNAMENT: 'Torneo',
  EXPEDITION: 'Expedición',
  JIRO_EXPEDITION: 'Expedición de Jiro',
};

/** Nivel de logro de un valor de la escala (para colorear lo que elige el docente antes de guardar). */
export const bucketOfLabel = (label: string, scale: GradeScaleOptions, scaleType: GradeScaleType | null): PerformanceBucket => {
  if (scale.kind === 'letters') {
    const level = scale.values.find((v) => v.label.toUpperCase() === label.toUpperCase());
    const min = level?.minPercent ?? 0;
    return min >= 90 ? 'AD' : min >= 70 ? 'A' : min >= 50 ? 'B' : 'C';
  }
  const n = Number(label);
  if (scaleType === 'PERU_VIGESIMAL') return n >= 18 ? 'AD' : n >= 14 ? 'A' : n >= 11 ? 'B' : 'C';
  return n >= 90 ? 'AD' : n >= 70 ? 'A' : n >= 50 ? 'B' : 'C';
};

/** Hay nota: con evidencia o ajustada a mano. */
export const hasGrade = (grade?: StudentGrade | null) => !!grade && (grade.activitiesCount > 0 || grade.isManualOverride);

export const periodLabel = (period: string) => {
  const [year, bim] = period.split('-B');
  return bim ? `Bimestre ${bim} · ${year}` : period;
};

export const relativeTime = (iso: string | null | undefined) => {
  if (!iso) return null;
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

/** YYYY-MM-DD local de un instante ISO (para inputs de fecha). */
export const toDateInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Día local (YYYY-MM-DD) → instante ISO al inicio de ese día. */
export const fromDateInput = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
};

export const competencyTitle = (c: { code: string; shortName: string | null; name: string | null }) =>
  c.shortName?.trim() || c.name || c.code;

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export const tabButton = (active: boolean) =>
  `min-h-[44px] flex-shrink-0 rounded-xl px-4 text-sm font-bold ${active
    ? 'bg-primary-600 text-white'
    : 'text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700'}`;

export const chip = (active: boolean) =>
  `min-h-[40px] flex-shrink-0 rounded-full px-3.5 text-sm font-semibold ${active
    ? 'bg-primary-600 text-white'
    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'}`;

export const card = 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800';
export const secondaryButton = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

/** Porcentaje → valor de la escala de la clase (mismas reglas que el servidor). */
export const percentToLabel = (percent: number, scale: GradeScaleOptions, scaleType: GradeScaleType | null) => {
  const safe = Math.min(100, Math.max(0, percent));
  if (scale.kind === 'letters') {
    const sorted = [...scale.values].sort((a, b) => b.minPercent - a.minPercent);
    return (sorted.find((v) => safe >= v.minPercent) ?? sorted[sorted.length - 1]).label;
  }
  if (scaleType === 'PERU_VIGESIMAL') return String(Math.round(safe / 5)).padStart(2, '0');
  return String(Math.round(safe));
};
