import { and, eq, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classrooms, schoolPeriods, schoolSections, schoolTeachingAssignments, schoolWorkshops, schoolYearClassrooms, schoolYears, schools } from '../db/schema.js';

/**
 * Calendario del colegio para Calificaciones. Una clase vinculada a un año del colegio (por su asignación, su taller o
 * su sección) sigue ese año, en preparación, en curso o cerrado: sus bimestres, fechas y cierres los maneja la
 * administración («Año escolar»). Una clase del colegio que aún no está vinculada sigue el año activo; al cerrarlo se archiva
 * y queda en él (school_year_classrooms). Sin año, la clase maneja sus propios bimestres, como la de un docente independiente.
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

export type SchoolYearStatus = 'PLANNING' | 'ACTIVE' | 'CLOSED';

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
  yearStatus: SchoolYearStatus;
  periods: CalendarPeriod[];
  /** El bimestre en curso: el último que ya empezó (fecha de Lima); antes del primero, el primero. */
  current: string;
}

type CalendarRow = {
  schoolId: string; schoolName: string; yearId: string; yearName: string; yearStatus: SchoolYearStatus;
  code: string; startsOn: string; endsOn: string; status: string; lockedAt: Date | null;
};

const build = (rows: CalendarRow[]): SchoolCalendar | null => {
  const sorted = rows.filter((r) => /^B[1-4]$/.test(r.code)).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  if (sorted.length === 0) return null;
  const { schoolId, schoolName, yearId, yearName, yearStatus } = sorted[0];
  const today = limaToday();
  const periods = sorted.map((p, i) => ({
    period: `${yearName}-${p.code}`,
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
  return { schoolId, schoolName, yearId, yearName, yearStatus, periods, current: current.period };
};

/** Calendarios por año (solo años por bimestres de colegios activos). */
const calendarsWhere = async (where: ReturnType<typeof and>) => {
  const rows = await db.select({
    schoolId: schools.id, schoolName: schools.name, yearId: schoolYears.id, yearName: schoolYears.name, yearStatus: schoolYears.status,
    code: schoolPeriods.code, startsOn: schoolPeriods.startsOn, endsOn: schoolPeriods.endsOn, status: schoolPeriods.status, lockedAt: schoolPeriods.lockedAt,
  }).from(schoolYears)
    .innerJoin(schools, eq(schools.id, schoolYears.schoolId))
    .innerJoin(schoolPeriods, eq(schoolPeriods.yearId, schoolYears.id))
    .where(and(where, eq(schoolYears.periodType, 'BIMESTER'), eq(schools.isActive, true)));
  const byYear = new Map<string, CalendarRow[]>();
  for (const row of rows) byYear.set(row.yearId, [...(byYear.get(row.yearId) ?? []), row]);
  const result = new Map<string, SchoolCalendar>();
  for (const [yearId, own] of byYear) {
    const calendar = build(own);
    if (calendar) result.set(yearId, calendar);
  }
  return result;
};

/** Calendarios de unos años, por id de año. */
export const yearCalendars = async (yearIds: string[]) => {
  const ids = [...new Set(yearIds)];
  return ids.length === 0 ? new Map<string, SchoolCalendar>() : calendarsWhere(inArray(schoolYears.id, ids));
};

/** El calendario del año ACTIVO de unos colegios, por id de colegio. */
export const schoolCalendars = async (schoolIds: string[]) => {
  const ids = [...new Set(schoolIds)];
  const result = new Map<string, SchoolCalendar>();
  if (ids.length === 0) return result;
  for (const calendar of (await calendarsWhere(and(inArray(schoolYears.schoolId, ids), eq(schoolYears.status, 'ACTIVE')))).values()) {
    result.set(calendar.schoolId, calendar);
  }
  return result;
};

/** El año al que está vinculada cada clase: por su asignación, su taller, su sección o el cierre que la archivó (en ese orden). */
export const classroomYearIds = async (classroomIds: string[]) => {
  const result = new Map<string, string>();
  const ids = [...new Set(classroomIds)];
  if (ids.length === 0) return result;
  const rows = await db.select({
    id: classrooms.id, byAssignment: schoolTeachingAssignments.yearId, byWorkshop: schoolWorkshops.yearId, bySection: schoolSections.yearId,
    byClosing: schoolYearClassrooms.yearId,
  }).from(classrooms)
    .leftJoin(schoolTeachingAssignments, eq(schoolTeachingAssignments.classroomId, classrooms.id))
    .leftJoin(schoolWorkshops, eq(schoolWorkshops.classroomId, classrooms.id))
    .leftJoin(schoolSections, eq(schoolSections.id, classrooms.schoolSectionId))
    .leftJoin(schoolYearClassrooms, eq(schoolYearClassrooms.classroomId, classrooms.id))
    .where(inArray(classrooms.id, ids));
  for (const row of rows) {
    const yearId = row.byAssignment ?? row.byWorkshop ?? row.bySection ?? row.byClosing;
    if (yearId) result.set(row.id, yearId);
  }
  return result;
};

/** Las clases vinculadas a un año: las de sus asignaciones, sus talleres, sus secciones y las sueltas que archivó su cierre. */
export const yearClassroomIds = async (yearId: string) => {
  const [byAssignment, byWorkshop, bySection, byClosing] = await Promise.all([
    db.select({ id: schoolTeachingAssignments.classroomId }).from(schoolTeachingAssignments)
      .where(and(eq(schoolTeachingAssignments.yearId, yearId), isNotNull(schoolTeachingAssignments.classroomId))),
    db.select({ id: schoolWorkshops.classroomId }).from(schoolWorkshops)
      .where(and(eq(schoolWorkshops.yearId, yearId), isNotNull(schoolWorkshops.classroomId))),
    db.select({ id: classrooms.id }).from(classrooms)
      .innerJoin(schoolSections, eq(schoolSections.id, classrooms.schoolSectionId))
      .where(eq(schoolSections.yearId, yearId)),
    db.select({ id: schoolYearClassrooms.classroomId }).from(schoolYearClassrooms).where(eq(schoolYearClassrooms.yearId, yearId)),
  ]);
  return [...new Set([...byAssignment, ...byWorkshop, ...bySection, ...byClosing].map((r) => r.id).filter((id): id is string => !!id))];
};

/** Las clases de los años cerrados de un colegio: su historia no cambia (retiros, salida de docentes). */
export const closedYearClassroomIds = async (schoolId: string) => {
  const years = await db.select({ id: schoolYears.id }).from(schoolYears).where(and(eq(schoolYears.schoolId, schoolId), eq(schoolYears.status, 'CLOSED')));
  const ids = new Set<string>();
  for (const year of years) for (const id of await yearClassroomIds(year.id)) ids.add(id);
  return [...ids];
};

/** Las clases activas del colegio que no están vinculadas a ningún año: siguen el año activo (una archivada, a ninguno). */
export const unlinkedClassroomIds = async (schoolId: string) => {
  const rows = await db.select({ id: classrooms.id }).from(classrooms)
    .leftJoin(schoolTeachingAssignments, eq(schoolTeachingAssignments.classroomId, classrooms.id))
    .leftJoin(schoolWorkshops, eq(schoolWorkshops.classroomId, classrooms.id))
    .leftJoin(schoolYearClassrooms, eq(schoolYearClassrooms.classroomId, classrooms.id))
    .where(and(
      eq(classrooms.schoolId, schoolId), eq(classrooms.isActive, true), isNull(classrooms.schoolSectionId),
      isNull(schoolTeachingAssignments.id), isNull(schoolWorkshops.id), isNull(schoolYearClassrooms.classroomId),
    ));
  return rows.map((r) => r.id);
};

/** Las clases que siguen un año: las vinculadas y, si es el activo, también las del colegio aún sin vincular. */
export const classroomsFollowing = async (calendar: Pick<SchoolCalendar, 'schoolId' | 'yearId' | 'yearStatus'>) => {
  const linked = await yearClassroomIds(calendar.yearId);
  const unlinked = calendar.yearStatus === 'ACTIVE' ? await unlinkedClassroomIds(calendar.schoolId) : [];
  return [...new Set([...linked, ...unlinked])];
};

/** El bimestre en curso de unas clases (lo leen familias, «Mi progreso», el resumen y la exportación). */
export const setClassroomsCurrentPeriod = async (classroomIds: string[], current: string) => {
  for (let i = 0; i < classroomIds.length; i += 500) {
    await db.update(classrooms)
      .set({ currentBimester: current })
      .where(and(inArray(classrooms.id, classroomIds.slice(i, i + 500)), or(isNull(classrooms.currentBimester), ne(classrooms.currentBimester, current))));
  }
};

/** Pone al día el bimestre en curso de las clases que siguen un año. */
export const syncCurrentPeriod = async (calendar: SchoolCalendar) =>
  setClassroomsCurrentPeriod(await classroomsFollowing(calendar), calendar.current);

// Calificaciones pregunta por el calendario varias veces en un mismo cálculo (por cada estudiante): se recuerda 2 segundos.
// Cerrar, reabrir o guardar el año lo olvida al instante (invalidateSchoolCalendar).
const CACHE_MS = 2000;
const cache = new Map<string, { at: number; schoolId: string | null; value: Promise<SchoolCalendar | null> }>();

export const invalidateSchoolCalendar = (schoolId: string) => {
  for (const [key, entry] of cache) if (entry.schoolId === schoolId || entry.schoolId === null) cache.delete(key);
};

/** El calendario que sigue una clase del colegio: el de su año vinculado o, sin vínculo, el del año activo. */
const calendarOf = async (classroomId: string, schoolId: string): Promise<SchoolCalendar | null> => {
  const linked = (await classroomYearIds([classroomId])).get(classroomId);
  if (linked) {
    const calendar = (await yearCalendars([linked])).get(linked);
    return calendar && calendar.schoolId === schoolId ? calendar : null;
  }
  return (await schoolCalendars([schoolId])).get(schoolId) ?? null;
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
    const calendar = await calendarOf(classroomId, row.schoolId);
    if (calendar && row.currentBimester !== calendar.current) await setClassroomsCurrentPeriod([classroomId], calendar.current);
    return calendar;
  })();
  entry.value.catch(() => cache.delete(classroomId));
  cache.set(classroomId, entry);
  return entry.value;
};

/** Pone al día el bimestre en curso de las clases de los años activos y en preparación (cada hora: cambia con la fecha). */
export const syncAllCurrentPeriods = async () => {
  const calendars = await calendarsWhere(inArray(schoolYears.status, ['ACTIVE', 'PLANNING']));
  for (const calendar of calendars.values()) await syncCurrentPeriod(calendar);
  return calendars.size;
};
