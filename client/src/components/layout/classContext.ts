/**
 * Colegio, año y periodo de una clase (los calcula el servidor): en un colegio, su año escolar activo y el periodo de
 * hoy; en una clase que no es de un colegio, su propio bimestre.
 */
export interface ClassContext {
  school: { id: string; name: string } | null;
  year: string | null;
  period: { type: 'BIMESTER' | 'TRIMESTER'; number: number } | null;
}

/** «San Francisco College · 2026 · Bimestre 3» (null si no hay nada que mostrar). */
export const contextLabel = (context?: ClassContext | null) => {
  if (!context) return null;
  const period = context.period ? `${context.period.type === 'TRIMESTER' ? 'Trimestre' : 'Bimestre'} ${context.period.number}` : null;
  const parts = [context.school?.name, context.year, period].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
};
