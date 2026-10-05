import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schoolPeriods, schoolYears, schools } from '../db/schema.js';

/**
 * Colegio, año y periodo de una clase, para la cabecera del docente y del estudiante («San Francisco College · 2026 ·
 * Bimestre 3»). En un colegio, el año escolar activo y el periodo de hoy según sus fechas (en vacaciones, el último que
 * empezó). En una clase que no es de un colegio (o si su colegio aún no tiene año), su propio bimestre («2026-B1»).
 */
export interface ClassroomContext {
  school: { id: string; name: string } | null;
  year: string | null;
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
  const [schoolRows, years] = schoolIds.length
    ? await Promise.all([
      db.select({ id: schools.id, name: schools.name, isActive: schools.isActive }).from(schools).where(inArray(schools.id, schoolIds)),
      db.select({ id: schoolYears.id, schoolId: schoolYears.schoolId, name: schoolYears.name, periodType: schoolYears.periodType })
        .from(schoolYears).where(and(inArray(schoolYears.schoolId, schoolIds), eq(schoolYears.status, 'ACTIVE'))),
    ])
    : [[], []];
  const periods = years.length
    ? await db.select({ yearId: schoolPeriods.yearId, code: schoolPeriods.code, startsOn: schoolPeriods.startsOn }).from(schoolPeriods)
      .where(inArray(schoolPeriods.yearId, years.map((y) => y.id)))
    : [];
  const now = today();
  for (const row of rows) {
    const school = schoolRows.find((s) => s.id === row.schoolId && s.isActive);
    const year = school ? years.find((y) => y.schoolId === school.id) : undefined;
    if (school && year) {
      const own = periods.filter((p) => p.yearId === year.id).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
      const current = [...own].reverse().find((p) => p.startsOn <= now) ?? own[0];
      const number = current ? Number(current.code.replace(/\D/g, '')) : 0;
      result.set(row.id, {
        school: { id: school.id, name: school.name },
        year: year.name,
        period: number ? { type: year.periodType, number } : null,
      });
    } else {
      result.set(row.id, { school: school ? { id: school.id, name: school.name } : null, ...fromClassBimester(row.currentBimester) });
    }
  }
  return result;
};
