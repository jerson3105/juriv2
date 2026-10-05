/**
 * Colegio, año y periodo de una clase (los calcula el servidor): en un colegio, el año de la clase (en preparación, en
 * curso o cerrado) y el periodo de hoy; en una clase que no es de un colegio, su propio bimestre.
 */
export interface ClassContext {
  school: { id: string; name: string } | null;
  year: string | null;
  yearStatus?: 'PLANNING' | 'ACTIVE' | 'CLOSED' | null;
  period: { type: 'BIMESTER' | 'TRIMESTER'; number: number } | null;
  /** La escala que fija su nivel en el colegio (literal o vigesimal): el docente no la cambia. */
  gradeScale?: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | null;
}

/** «San Francisco College · 2026 · Bimestre 3» o «… · 2027 · En preparación» (null si no hay nada que mostrar). */
export const contextLabel = (context?: ClassContext | null) => {
  if (!context) return null;
  const period = context.yearStatus === 'PLANNING' ? 'En preparación'
    : context.period ? `${context.period.type === 'TRIMESTER' ? 'Trimestre' : 'Bimestre'} ${context.period.number}` : null;
  const parts = [context.school?.name, context.year, period, context.yearStatus === 'CLOSED' ? 'Año cerrado' : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
};
