import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classrooms, schoolPeriods, schoolYears, schools } from '../db/schema.js';

/**
 * Calendario del colegio para Calificaciones. Una clase de un colegio con año escolar ACTIVO por bimestres sigue ese
 * año: sus bimestres, fechas y cierres los maneja la administración («Año escolar»). Sin año activo, la clase maneja sus
 * propios bimestres, como la de un docente independiente.
 */

// Perú no tiene horario de verano: la medianoche de Lima es a las 05:00 UTC.
const limaMidnight = (day: string) => new Date(`${day}T00:00:00-05:00`);
const nextDay = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

/** Hoy en el Perú (AAAA-MM-DD), aunque el servidor esté en otra zona horaria. */
export const limaToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export interface CalendarPeriod {
  /** Como lo guarda Calificaciones: «2027-B1». */
  period: string;
  code: string;
  number: number;
  startsOn: string;
  endsOn: string;
  /** Ventana de la evidencia: desde su inicio hasta que empieza el siguiente (el último, hasta el fin de su último día). */
  start: Date;
  end: Date;
  /** Lo cerró la administración: sus notas quedan congeladas en todas las clases. */
  locked: boolean;
  lockedAt: Date | null;
}

export interface SchoolCalendar {
  schoolId: string;
  schoolName: string;
  yearId: string;
  yearName: string;
  periods: CalendarPeriod[];
  /** El bimestre en curso: el último que ya empezó (fecha de Lima); antes del primero, el primero. */
  current: string;
}

type PeriodRow = { code: string; startsOn: string; endsOn: string; status: string; lockedAt: Date | null };

const build = (school: { id: string; name: string }, year: { id: string; name: string }, rows: PeriodRow[]): SchoolCalendar | null => {
  const sorted = rows.filter((r) => /^B[1-4]$/.test(r.code)).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  if (sorted.length === 0) return null;
  const today = limaToday();
  const periods = sorted.map((p, i) => ({
    period: `${year.name}-${p.code}`,
    code: p.code,
    number: Number(p.code.slice(1)),
    startsOn: p.startsOn,
    endsOn: p.endsOn,
    start: limaMidnight(p.startsOn),
    end: limaMidnight(i + 1 < sorted.length ? sorted[i + 1].startsOn : nextDay(p.endsOn)),
    locked: p.status === 'LOCKED' || p.status === 'PUBLISHED',
    lockedAt: p.lockedAt ?? null,
  }));
  const current = [...periods].reverse().find((p) => p.startsOn <= today) ?? periods[0];
  return { schoolId: school.id, schoolName: school.name, yearId: year.id, yearName: year.name, periods, current: current.period };
};

/** Calendarios de unos colegios: solo los que tienen año escolar ACTIVO por bimestres. */
export const schoolCalendars = async (schoolIds: string[]) => {
  const result = new Map<string, SchoolCalendar>();
  const ids = [...new Set(schoolIds)];
  if (ids.length === 0) return result;
  const rows = await db.select({
    schoolId: schools.id, schoolName: schools.name, yearId: schoolYears.id, yearName: schoolYears.name,
    code: schoolPeriods.code, startsOn: schoolPeriods.startsOn, endsOn: schoolPeriods.endsOn, status: schoolPeriods.status, lockedAt: schoolPeriods.lockedAt,
  }).from(schools)
    .innerJoin(schoolYears, and(eq(schoolYears.schoolId, schools.id), eq(schoolYears.status, 'ACTIVE'), eq(schoolYears.periodType, 'BIMESTER')))
    .innerJoin(schoolPeriods, eq(schoolPeriods.yearId, schoolYears.id))
    .where(and(inArray(schools.id, ids), eq(schools.isActive, true)));
  for (const id of ids) {
    const own = rows.filter((r) => r.schoolId === id);
    if (own.length === 0) continue;
    const calendar = build({ id, name: own[0].schoolName }, { id: own[0].yearId, name: own[0].yearName }, own);
    if (calendar) result.set(id, calendar);
  }
  return result;
};

/** El bimestre en curso del colegio en todas sus clases (lo leen familias, «Mi progreso», el resumen y la exportación). */
export const setSchoolCurrentPeriod = async (schoolId: string, current: string) => {
  await db.update(classrooms)
    .set({ currentBimester: current })
    .where(and(eq(classrooms.schoolId, schoolId), or(isNull(classrooms.currentBimester), ne(classrooms.currentBimester, current))));
};
export const syncCurrentPeriod = (calendar: SchoolCalendar) => setSchoolCurrentPeriod(calendar.schoolId, calendar.current);

// Calificaciones pregunta por el calendario varias veces en un mismo cálculo (por cada estudiante): se recuerda 2 segundos.
// Cerrar, reabrir o guardar el año lo olvida al instante (invalidateSchoolCalendar).
const CACHE_MS = 2000;
const cache = new Map<string, { at: number; schoolId: string | null; value: Promise<SchoolCalendar | null> }>();

export const invalidateSchoolCalendar = (schoolId: string) => {
  for (const [key, entry] of cache) if (entry.schoolId === schoolId || entry.schoolId === null) cache.delete(key);
};

/** El calendario de la clase, o null si maneja sus propios bimestres. Si su bimestre guardado quedó atrás, lo pone al día. */
export const classroomCalendar = (classroomId: string): Promise<SchoolCalendar | null> => {
  const now = Date.now();
  const hit = cache.get(classroomId);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  if (cache.size > 1000) for (const [key, entry] of cache) if (now - entry.at >= CACHE_MS) cache.delete(key);
  const entry: { at: number; schoolId: string | null; value: Promise<SchoolCalendar | null> } = { at: now, schoolId: null, value: Promise.resolve(null) };
  entry.value = (async () => {
    const [row] = await db.select({ schoolId: classrooms.schoolId, currentBimester: classrooms.currentBimester })
      .from(classrooms).where(eq(classrooms.id, classroomId));
    if (!row?.schoolId) return null;
    entry.schoolId = row.schoolId;
    const calendar = (await schoolCalendars([row.schoolId])).get(row.schoolId) ?? null;
    if (calendar && row.currentBimester !== calendar.current) await syncCurrentPeriod(calendar);
    return calendar;
  })();
  entry.value.catch(() => cache.delete(classroomId));
  cache.set(classroomId, entry);
  return entry.value;
};

/** Pone al día el bimestre en curso de todos los colegios con año activo (cada hora: cambia con la fecha). */
export const syncAllCurrentPeriods = async () => {
  const active = await db.select({ schoolId: schoolYears.schoolId }).from(schoolYears)
    .where(and(eq(schoolYears.status, 'ACTIVE'), eq(schoolYears.periodType, 'BIMESTER')));
  const calendars = await schoolCalendars(active.map((a) => a.schoolId));
  for (const calendar of calendars.values()) await syncCurrentPeriod(calendar);
  return calendars.size;
};
