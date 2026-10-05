import type { PeriodType, SchoolLevel, SchoolPeriod, SchoolYearInput } from '../../../lib/schoolYearApi';
import { localDay } from '../schoolHelpers';

export const PERIOD_CODES: Record<PeriodType, string[]> = { BIMESTER: ['B1', 'B2', 'B3', 'B4'], TRIMESTER: ['T1', 'T2', 'T3'] };
export const PERIOD_NAME: Record<PeriodType, string> = { BIMESTER: 'Bimestre', TRIMESTER: 'Trimestre' };
export const PERIOD_PLURAL: Record<PeriodType, string> = { BIMESTER: 'bimestres', TRIMESTER: 'trimestres' };
export const LEVELS: SchoolLevel[] = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'];
export const LEVEL_LABEL: Record<SchoolLevel, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' };

const DAY = 86_400_000;
/** Días desde 1970 (UTC): las fechas del año escolar no tienen hora ni zona. */
export const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
export const fromDay = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const weekday = (day: number) => new Date(day * DAY).getUTCDay();
export const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && fromDay(toDay(value)) === value;

const shortDate = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** «9 mar» */
export const formatDay = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`)).replace('.', '');
/** «9 mar – 18 dic» */
export const formatRange = (start: string, end: string) => `${formatDay(start)} – ${formatDay(end)}`;

export const periodLabel = (type: PeriodType, index: number) => `${PERIOD_NAME[type]} ${index + 1}`;

/** Semanas (redondeadas) de un periodo. */
export const weeksOf = (start: string, end: string) => Math.max(1, Math.round((toDay(end) - toDay(start) + 1) / 7));

/** Año típico en Perú: del primer lunes de marzo al último viernes antes del 21 de diciembre. */
export const defaultYearDates = (year: number) => {
  let start = toDay(`${year}-03-01`);
  while (weekday(start) !== 1) start += 1;
  let end = toDay(`${year}-12-20`);
  while (weekday(end) !== 5) end -= 1;
  return { startsOn: fromDay(start), endsOn: fromDay(end) };
};

/**
 * Reparte el año en periodos seguidos por semanas enteras: cada uno empieza el lunes y termina el viernes (el primero
 * y el último respetan las fechas del año). Las vacaciones se ajustan después a mano.
 */
export const splitPeriods = (startsOn: string, endsOn: string, type: PeriodType) => {
  const codes = PERIOD_CODES[type];
  const first = toDay(startsOn);
  const last = toDay(endsOn);
  const monday = first - ((weekday(first) + 6) % 7);
  const weeks = Math.max(codes.length, Math.ceil((last - monday + 1) / 7));
  const base = Math.floor(weeks / codes.length);
  const extra = weeks % codes.length;
  let week = 0;
  return codes.map((code, i) => {
    const length = base + (i < extra ? 1 : 0);
    const start = i === 0 ? first : monday + week * 7;
    week += length;
    const end = i === codes.length - 1 ? last : monday + week * 7 - 3;
    return { code, startsOn: fromDay(start), endsOn: fromDay(Math.max(start, end)) };
  });
};

export interface PeriodIssue {
  index: number;
  kind: 'error' | 'gap';
  text: string;
}

/**
 * Las mismas reglas del servidor (schoolYear.service): `errors` e issues 'error' impiden guardar; un descanso de más
 * de un fin de semana entre periodos solo se avisa (son las vacaciones).
 */
export const reviewYear = (input: SchoolYearInput): { errors: string[]; issues: PeriodIssue[] } => {
  const errors: string[] = [];
  const issues: PeriodIssue[] = [];
  if (!isIsoDate(input.startsOn) || !isIsoDate(input.endsOn)) {
    errors.push('Revisa las fechas del año escolar');
    return { errors, issues };
  }
  const start = toDay(input.startsOn);
  const end = toDay(input.endsOn);
  if (end <= start) errors.push('El año escolar debe terminar después de empezar');
  else if (end - start > 366) errors.push('El año escolar no puede durar más de un año');

  const label = PERIOD_NAME[input.periodType].toLowerCase();
  let previousEnd: number | null = null;
  input.periods.forEach((p, i) => {
    if (!isIsoDate(p.startsOn) || !isIsoDate(p.endsOn)) {
      issues.push({ index: i, kind: 'error', text: 'Completa las dos fechas' });
      return;
    }
    const pStart = toDay(p.startsOn);
    const pEnd = toDay(p.endsOn);
    if (pEnd < pStart) issues.push({ index: i, kind: 'error', text: 'Termina antes de empezar' });
    else if (pStart < start || pEnd > end) issues.push({ index: i, kind: 'error', text: 'Queda fuera de las fechas del año' });
    if (previousEnd !== null) {
      if (pStart <= previousEnd) {
        issues.push({ index: i, kind: 'error', text: `Empieza antes de que termine el ${label} ${i}` });
      } else if (pStart - previousEnd > 3) {
        const days = pStart - previousEnd - 1;
        issues.push({ index: i, kind: 'gap', text: `${days} días de descanso antes de este ${label}` });
      }
    }
    previousEnd = pEnd;
  });
  if (input.levels.length === 0) errors.push('Elige al menos un nivel');
  return { errors, issues };
};

/** El periodo en curso (o el próximo, o el último si el año ya terminó). */
export const currentPeriod = (periods: SchoolPeriod[], today = localDay()) => {
  const now = toDay(today);
  const index = periods.findIndex((p) => toDay(p.startsOn) <= now && now <= toDay(p.endsOn));
  if (index >= 0) return { period: periods[index], index, state: 'now' as const };
  const next = periods.findIndex((p) => toDay(p.startsOn) > now);
  if (next >= 0) return { period: periods[next], index: next, state: 'next' as const };
  return periods.length ? { period: periods[periods.length - 1], index: periods.length - 1, state: 'past' as const } : null;
};
