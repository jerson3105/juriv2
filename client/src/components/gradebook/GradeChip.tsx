import { forwardRef } from 'react';
import { Pencil } from 'lucide-react';
import type { CompetencyIndicatorBreakdown, StudentGrade } from '../../lib/gradeApi';
import { BUCKET_LABEL, BUCKET_STYLE, hasGrade } from './gradebookHelpers';

interface GradeChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  grade?: StudentGrade | null;
  /** Nombre de la competencia y del alumno para el nombre accesible. */
  context: string;
}

// Nota de una celda: etiqueta + color por nivel; lápiz si está ajustada a mano; "—" sin evidencia.
export const GradeChip = forwardRef<HTMLButtonElement, GradeChipProps>(({ grade, context, className = '', ...props }, ref) => {
  const graded = hasGrade(grade);
  const manual = !!grade?.isManualOverride;
  const description = graded && grade
    ? `${grade.gradeLabel}, ${BUCKET_LABEL[grade.bucket].toLowerCase()}${manual ? ', ajustada a mano' : ''}${grade.calculatedChanged ? `, la calculada ahora es ${grade.calculatedLabel}` : ''}`
    : 'sin nota';
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`${context}: ${description}`}
      className={`relative inline-flex h-11 min-w-[52px] items-center justify-center gap-1 rounded-xl px-2 text-base font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${graded && grade ? `${BUCKET_STYLE[grade.bucket]} hover:brightness-95` : 'border-2 border-dashed border-gray-300 text-gray-700 hover:border-gray-500 dark:border-gray-600 dark:text-gray-300'} ${manual ? 'ring-2 ring-gray-900/70 ring-offset-1 dark:ring-white/70 dark:ring-offset-gray-800' : ''} ${className}`}
      {...props}
    >
      {graded && grade ? grade.gradeLabel : '—'}
      {manual && <Pencil size={13} aria-hidden="true" />}
      {grade?.calculatedChanged && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-500 dark:border-gray-800" aria-hidden="true" />}
    </button>
  );
});
GradeChip.displayName = 'GradeChip';

interface SkillChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  skill?: CompetencyIndicatorBreakdown | null;
  /** Bimestre anterior a que existieran las destrezas: no hay desglose. */
  historical?: boolean;
  context: string;
}

// Nota de una destreza (sale de los comportamientos vinculados a ella). Solo lectura: abre el detalle.
export const SkillChip = forwardRef<HTMLButtonElement, SkillChipProps>(({ skill, historical, context, className = '', ...props }, ref) => {
  const graded = !!skill?.hasEvidence && !!skill.gradeLabel && !!skill.bucket;
  const description = historical
    ? 'sin desglose en este bimestre'
    : graded && skill ? `${skill.gradeLabel}, ${BUCKET_LABEL[skill.bucket!].toLowerCase()}, ${skill.observations} observaciones` : 'sin evidencia';
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`${context}: ${description}`}
      className={`inline-flex h-10 min-w-[44px] items-center justify-center rounded-lg px-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${graded && skill ? `${BUCKET_STYLE[skill.bucket!]} hover:brightness-95` : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'} ${className}`}
      {...props}
    >
      {graded && skill ? skill.gradeLabel : '—'}
    </button>
  );
});
SkillChip.displayName = 'SkillChip';
