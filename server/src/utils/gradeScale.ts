import type { GradeScaleType } from '../db/schema.js';

/**
 * Escalas de calificación: de porcentaje (0-100, lo que guarda el sistema) a la etiqueta de la clase,
 * y del valor que elige el docente (AD, 17, 85…) a porcentaje. Lo comparten el cálculo, la nota
 * manual y las evaluaciones para que una misma nota se lea igual en todas partes.
 */

export type PerformanceBucket = 'AD' | 'A' | 'B' | 'C';

type LetterLevel = { label: string; minPercent: number; value: number };

// Rangos Perú: AD (90-100), A (70-89), B (50-69), C (0-49). value = porcentaje representativo al elegir la letra.
const LETTER_SCALES: Record<'PERU_LETTERS' | 'USA_LETTERS', LetterLevel[]> = {
  PERU_LETTERS: [
    { label: 'AD', minPercent: 90, value: 95 },
    { label: 'A', minPercent: 70, value: 80 },
    { label: 'B', minPercent: 50, value: 60 },
    { label: 'C', minPercent: 0, value: 30 },
  ],
  USA_LETTERS: [
    { label: 'A', minPercent: 90, value: 95 },
    { label: 'B', minPercent: 80, value: 85 },
    { label: 'C', minPercent: 70, value: 75 },
    { label: 'D', minPercent: 60, value: 65 },
    { label: 'F', minPercent: 0, value: 40 },
  ],
};

export interface CustomRange { label: string; minPercent: number }

export const parseScaleConfig = (raw: unknown): unknown => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
};

/** Rangos de la escala personalizada, de mayor a menor, con su valor representativo. */
export const customLevels = (config: unknown): LetterLevel[] => {
  const ranges = (config as { ranges?: unknown } | null)?.ranges;
  if (!Array.isArray(ranges)) return [];
  const sorted = ranges
    .map((r) => ({ label: typeof r?.label === 'string' ? r.label.trim() : '', minPercent: Number(r?.minPercent) }))
    .filter((r) => r.label && Number.isFinite(r.minPercent) && r.minPercent >= 0 && r.minPercent <= 100)
    .sort((a, b) => b.minPercent - a.minPercent);
  return sorted.map((r, i) => {
    const upper = i === 0 ? 100 : sorted[i - 1].minPercent;
    return { ...r, value: Math.round((r.minPercent + upper) / 2) };
  });
};

const lettersFor = (scale: GradeScaleType | null, config: unknown): LetterLevel[] | null => {
  if (scale === 'PERU_LETTERS' || scale === 'USA_LETTERS') return LETTER_SCALES[scale];
  if (scale === 'CUSTOM') {
    const levels = customLevels(config);
    return levels.length > 0 ? levels : null;
  }
  return null;
};

/** Porcentaje → etiqueta de la clase. Vigesimal: entero 0-20 (dos dígitos). */
export const scoreToLabel = (score: number, scale: GradeScaleType | null, config: unknown): string => {
  const safe = Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0));
  if (scale === 'PERU_VIGESIMAL') return String(Math.round(safe / 5)).padStart(2, '0');
  const letters = lettersFor(scale, config);
  if (!letters) return String(Math.round(safe));
  return (letters.find((level) => safe >= level.minPercent) ?? letters[letters.length - 1]).label;
};

/**
 * Valor elegido por el docente en la escala de la clase → porcentaje y etiqueta.
 * Letras: una de la escala. Vigesimal: entero 0-20. Centesimal (o sin escala): 0-100.
 */
export const scaleValueToScore = (raw: string, scale: GradeScaleType | null, config: unknown): { score: number; label: string } => {
  const value = raw.trim().toUpperCase();
  const letters = lettersFor(scale, config);
  if (letters) {
    const level = letters.find((l) => l.label.toUpperCase() === value);
    if (!level) throw new Error(`Valor invalido para esta escala. Usa: ${letters.map((l) => l.label).join(', ')}`);
    return { score: level.value, label: level.label };
  }
  if (!/^\d+([.,]\d+)?$/.test(value)) throw new Error('Valor invalido: escribe un número');
  const number = Number(value.replace(',', '.'));
  if (scale === 'PERU_VIGESIMAL') {
    if (!Number.isInteger(number) || number < 0 || number > 20) throw new Error('Valor invalido: la nota va de 0 a 20');
    return { score: number * 5, label: String(number).padStart(2, '0') };
  }
  if (number < 0 || number > 100) throw new Error('Valor invalido: la nota va de 0 a 100');
  const rounded = Math.round(number * 100) / 100;
  return { score: rounded, label: String(Math.round(rounded)) };
};

/** Nivel de logro (colores y distribución), común a todas las escalas. */
export const performanceBucket = (score: number, scale: GradeScaleType | null, label?: string | null): PerformanceBucket => {
  if (scale === 'PERU_VIGESIMAL') {
    const grade = Number.parseInt(label ?? '', 10);
    if (Number.isFinite(grade)) {
      if (grade >= 18) return 'AD';
      if (grade >= 14) return 'A';
      if (grade >= 11) return 'B';
      return 'C';
    }
  }
  if (score >= 90) return 'AD';
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  return 'C';
};

/** Valores que puede elegir el docente (para el selector de la interfaz). */
export const scaleOptions = (scale: GradeScaleType | null, config: unknown) => {
  const letters = lettersFor(scale, config);
  if (letters) return { kind: 'letters' as const, values: letters.map((l) => ({ label: l.label, minPercent: l.minPercent })) };
  if (scale === 'PERU_VIGESIMAL') return { kind: 'number' as const, min: 0, max: 20, step: 1 };
  return { kind: 'number' as const, min: 0, max: 100, step: 1 };
};
