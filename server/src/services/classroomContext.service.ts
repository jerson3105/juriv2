import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schoolPeriods, schoolYears, schools } from '../db/schema.js';
import { classroomYearIds, setClassroomsCurrentPeriod, type SchoolYearStatus } from './schoolCalendar.service.js';

/**
 * Colegio, año y periodo de una clase, para la cabecera del docente y del estudiante («San Francisco College · 2026 ·
 * Bimestre 3»). En un colegio, el año de la clase (el de su asignación, taller o sección; sin vínculo, el activo) y el
 * periodo de hoy según sus fechas (en vacaciones, el último que empezó). En una clase que no es de un colegio (o si su
 * colegio aún no tiene año), su propio bimestre («2026-B1»).
 */
export interface ClassroomContext {
  school: { id: string; name: string } | null;
  year: string | null;
  /** En preparación (sus clases aún no tienen estudiantes), en curso o cerrado. Null fuera de un colegio. */
  yearStatus: SchoolYearStatus | null;
  period: { type: 'BIMESTER' | 'TRIMESTER'; number: number } | null;
}

// El día de hoy en el Perú (el servidor puede estar en otra zona horaria).
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const fromClassBimester = (value: string | null) => {
  const match = value?.match(/^(\d{4})-B([1-6])$/);
  return match
    ? { year: match[1], period: { type: 'BIMESTER' as const, number: Number(match[2]) } }
    : { year: null, period: null };
};

export const classroomContexts = async (rows: Array<{ id: string; schoolId: string | null; currentBimester: string | null }>) => {
  const result = new Map<string, ClassroomContext>();
  const schoolIds = [...new Set(rows.map((r) => r.schoolId).filter((id): id is string => !!id))];
  const linked = await classroomYearIds(rows.filter((r) => r.schoolId).map((r) => r.id));
  const linkedYearIds = [...new Set(linked.values())];
  const [schoolRows, years] = schoolIds.length
    ? await Promise.all([
      db.select({ id: schools.id, name: schools.name, isActive: schools.isActive }).from(schools).where(inArray(schools.id, schoolIds)),
      db.select({ id: schoolYears.id, schoolId: schoolYears.schoolId, name: schoolYears.name, status: schoolYears.status, periodType: schoolYears.periodType })
        .from(schoolYears).where(or(
          linkedYearIds.length ? inArray(schoolYears.id, linkedYearIds) : undefined,
          and(inArray(schoolYears.schoolId, schoolIds), eq(schoolYears.status, 'ACTIVE')),
        )),
    ])
    : [[], []];
  const periods = years.length
    ? await db.select({ yearId: schoolPeriods.yearId, code: schoolPeriods.code, startsOn: schoolPeriods.startsOn }).from(schoolPeriods)
      .where(inArray(schoolPeriods.yearId, years.map((y) => y.id)))
    : [];
  const now = today();
  // Clases cuyo bimestre guardado quedó atrás del de su año (lo leen familias, progreso y exportación).
  const stale = new Map<string, string[]>();
  for (const row of rows) {
    const school = schoolRows.find((s) => s.id === row.schoolId && s.isActive);
    const linkedYear = school ? years.find((y) => y.id === linked.get(row.id) && y.schoolId === school.id) : undefined;
    const year = linkedYear ?? (school ? years.find((y) => y.schoolId === school.id && y.status === 'ACTIVE') : undefined);
    if (school && year) {
      const own = periods.filter((p) => p.yearId === year.id).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
      const current = [...own].reverse().find((p) => p.startsOn <= now) ?? own[0];
      const number = current ? Number(current.code.replace(/\D/g, '')) : 0;
      const value = current ? `${year.name}-${current.code}` : null;
      if (value && year.periodType === 'BIMESTER' && row.currentBimester !== value) stale.set(value, [...(stale.get(value) ?? []), row.id]);
      result.set(row.id, {
        school: { id: school.id, name: school.name },
        year: year.name,
        yearStatus: year.status,
        period: number ? { type: year.periodType, number } : null,
      });
    } else {
      result.set(row.id, { school: school ? { id: school.id, name: school.name } : null, yearStatus: null, ...fromClassBimester(row.currentBimester) });
    }
  }
  for (const [value, ids] of stale) await setClassroomsCurrentPeriod(ids, value);
  return result;
};
