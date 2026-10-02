import { Flag, Footprints, Sprout, Star, type LucideIcon } from 'lucide-react';
import type { PerformanceBucket, StudentCompetencyView, StudentGradesView } from '../../../lib/gradeApi';
import { plural } from '../home/studentHomeHelpers';

/** Niveles oficiales (CNEB) con una frase en tuteo y su ícono: el significado nunca depende del color. */
export const LEVELS: Record<PerformanceBucket, { name: string; phrase: string; icon: LucideIcon; step: number }> = {
  C: { name: 'En inicio', phrase: 'Estás empezando. Tu profe te ayuda a avanzar.', icon: Sprout, step: 1 },
  B: { name: 'En proceso', phrase: 'Vas en camino a lo esperado.', icon: Footprints, step: 2 },
  A: { name: 'Logro esperado', phrase: 'Estás logrando lo esperado.', icon: Flag, step: 3 },
  AD: { name: 'Logro destacado', phrase: 'Vas más allá de lo esperado.', icon: Star, step: 4 },
};

/** El camino, de menos a más. */
export const PATH: PerformanceBucket[] = ['C', 'B', 'A', 'AD'];

// Un solo tono (azul) para todos los niveles: B y C no se leen como alerta (sin rojo).
export const levelChip = 'inline-flex h-12 min-w-[3rem] flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 px-2 text-xl font-black tabular-nums text-primary-900 ring-1 ring-primary-200 dark:bg-primary-900/40 dark:text-primary-100 dark:ring-primary-700/60';
export const smallChip = 'inline-flex min-w-[2rem] flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 px-1.5 py-0.5 text-xs font-bold text-primary-900 ring-1 ring-primary-200 dark:bg-primary-900/40 dark:text-primary-100 dark:ring-primary-700/60';
export const noteChip = 'inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-100';
export const levelIcon = 'text-primary-700 dark:text-primary-300';

const ORDER: Record<PerformanceBucket, number> = { C: 0, B: 1, A: 2, AD: 3 };

/** Nombre corto para frases ("En Indagación…"); sin él, el nombre completo. */
export const shortOf = (competency: StudentCompetencyView) => competency.shortName || competency.name || 'esta competencia';

/** "2 destrezas · 3 registros", "1 evaluación", "Puesta por tu profe"… */
export const evidenceLine = (competency: StudentCompetencyView) => {
  if (competency.isManual) return 'Puesta por tu profe';
  const parts: string[] = [];
  const skillsWithLevel = competency.skills.filter((skill) => skill.level).length;
  if (skillsWithLevel > 0) parts.push(plural(skillsWithLevel, 'destreza', 'destrezas'));
  if (competency.evaluations > 0) parts.push(plural(competency.evaluations, 'evaluación', 'evaluaciones'));
  if (competency.records > 0) parts.push(plural(competency.records, 'registro', 'registros'));
  return parts.join(' · ') || 'Puesta por tu profe';
};

/** "✓ 2 veces bien · ↺ 1 por mejorar" (solo lo que no es 0). */
export const goodAndBetter = (positive: number, negative: number) => [
  positive > 0 ? `${positive === 1 ? '1 vez' : `${positive} veces`} bien` : null,
  negative > 0 ? `${negative} por mejorar` : null,
].filter(Boolean).join(' · ');

export interface AdvanceTip {
  text: string;
  /** Abrir el detalle de esta competencia. */
  competencyId?: string;
  /** Ir a este bimestre. */
  period?: string;
  periodLabel?: string;
}

/** Consejo para una competencia en C o B (reglas 3, 5, 6 y 7); null en A o AD. */
const tipFor = (competency: StudentCompetencyView): string | null => {
  const short = shortOf(competency);
  if (competency.lowEvidence) return `En ${short} aún hay poca evidencia. Participa en clase: cada registro de tu profe cuenta.`;
  const evaluation = competency.sources.find((source) => source.kind === 'evaluation' && source.name);
  if (evaluation) return `En ${short}, pregúntale a tu profe qué puedes mejorar de «${evaluation.name}».`;
  const skill = [...competency.skills]
    .filter((s) => s.level)
    .sort((a, b) => ORDER[a.level!.bucket] - ORDER[b.level!.bucket])[0];
  if (skill) return `Tu siguiente reto en ${short}: «${skill.name}».`;
  return `Pregúntale a tu profe qué puedes practicar en ${short}.`;
};

/**
 * "Para avanzar": gana la primera regla que se cumpla. Nunca es negativo y nunca promete algo que no
 * existe. La competencia foco es la de nivel más bajo (primero C, luego B), en el orden de la clase.
 */
export const advanceTip = (view: StudentGradesView, currentPeriod: string | null): AdvanceTip | null => {
  if (view.isClosed && currentPeriod && currentPeriod !== view.period) {
    const n = currentPeriod.split('-B')[1];
    return { text: `Estas notas ya son finales. Lo que hagas ahora cuenta para el Bimestre ${n}.`, period: currentPeriod, periodLabel: `Ver Bimestre ${n}` };
  }
  const graded = view.competencies.filter((competency) => competency.level);
  if (graded.length === 0) return null;
  const focus = graded.find((c) => c.level!.bucket === 'C') ?? graded.find((c) => c.level!.bucket === 'B');
  if (!focus) return { text: '¡Vas muy bien en todas tus competencias! Sigue así.' };
  return { text: tipFor(focus)!, competencyId: focus.id };
};

/** El consejo dentro del detalle de una competencia. */
export const detailTip = (competency: StudentCompetencyView): string | null => {
  if (!competency.level) return null;
  if (competency.level.bucket === 'AD') return '¡Excelente! Sigue así.';
  if (competency.level.bucket === 'A') return 'Para ir más allá, pregúntale a tu profe por un reto.';
  return tipFor(competency);
};
