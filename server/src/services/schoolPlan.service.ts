import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { curriculumAreas, schoolPlanAreas, schoolSections, schoolTeachingAssignments, schoolYearLevels, schoolYears } from '../db/schema.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { LEVEL_GRADES, sectionDisplayName } from './schoolSection.service.js';
import type { SchoolLevel } from './schoolYear.service.js';

/**
 * Plan de estudios del año: qué áreas lleva cada nivel y en qué grados. Sin filas guardadas, un nivel usa el plan del
 * CNEB (EBR). Las columnas de la matriz de asignaciones son las áreas del plan.
 */

/** Plan del CNEB por defecto, en el orden del plan de estudios. Castellano como segunda lengua (EIB) se agrega a mano. */
export const CNEB_PLAN: Record<SchoolLevel, string[]> = {
  INICIAL: ['area-pe-ini-ps', 'area-pe-ini-psi', 'area-pe-ini-com', 'area-pe-ini-mat', 'area-pe-ini-cyt'],
  PRIMARIA: ['area-pe-mat', 'area-pe-com', 'area-pe-ing', 'area-pe-ayc', 'area-pe-ps', 'area-pe-ef', 'area-pe-er', 'area-pe-cyt'],
  SECUNDARIA: ['area-pe-mat', 'area-pe-com', 'area-pe-ing', 'area-pe-ayc', 'area-pe-ccss', 'area-pe-dpcc', 'area-pe-ef', 'area-pe-er', 'area-pe-cyt', 'area-pe-ept'],
};

export interface PlanArea {
  areaId: string;
  name: string;
  shortName: string | null;
  grades: number[];
}

type AreaRow = { id: string; name: string; shortName: string | null; educationLevel: string | null; displayOrder: number };

/** Las áreas que puede llevar un nivel: Inicial, las suyas; Primaria y Secundaria, las comunes más las del nivel. */
export const areasForLevel = async (level: SchoolLevel): Promise<AreaRow[]> => {
  const rows = await db.select({
    id: curriculumAreas.id, name: curriculumAreas.name, shortName: curriculumAreas.shortName,
    educationLevel: curriculumAreas.educationLevel, displayOrder: curriculumAreas.displayOrder,
  }).from(curriculumAreas)
    .where(and(eq(curriculumAreas.countryCode, 'PE'), eq(curriculumAreas.isActive, true)))
    .orderBy(asc(curriculumAreas.displayOrder), asc(curriculumAreas.name));
  return rows.filter((a) => (level === 'INICIAL' ? a.educationLevel === 'INICIAL' : a.educationLevel === null || a.educationLevel === level));
};

const parseGrades = (text: string, level: SchoolLevel) => {
  const valid = new Set(LEVEL_GRADES[level]);
  return [...new Set(text.split(',').map(Number).filter((g) => valid.has(g)))].sort((a, b) => a - b);
};

/** El plan vigente de un nivel (el guardado o el del CNEB). */
export const effectivePlan = async (yearId: string, level: SchoolLevel): Promise<{ custom: boolean; areas: PlanArea[] }> => {
  const available = await areasForLevel(level);
  const byId = new Map(available.map((a) => [a.id, a]));
  const rows = await db.select().from(schoolPlanAreas)
    .where(and(eq(schoolPlanAreas.yearId, yearId), eq(schoolPlanAreas.level, level)))
    .orderBy(asc(schoolPlanAreas.displayOrder));
  const toArea = (areaId: string, grades: number[]): PlanArea | null => {
    const area = byId.get(areaId);
    return area ? { areaId, name: area.name, shortName: area.shortName, grades } : null;
  };
  if (rows.length === 0) {
    return { custom: false, areas: CNEB_PLAN[level].map((id) => toArea(id, LEVEL_GRADES[level])).filter((a): a is PlanArea => !!a) };
  }
  return {
    custom: true,
    areas: rows.map((r) => toArea(r.areaId, parseGrades(r.grades, level))).filter((a): a is PlanArea => !!a && a.grades.length > 0),
  };
};

const loadYear = async (schoolId: string, yearId: string, forWrite: boolean) => {
  const [year] = await db.select({ id: schoolYears.id, status: schoolYears.status }).from(schoolYears)
    .where(and(eq(schoolYears.id, yearId), eq(schoolYears.schoolId, schoolId)));
  if (!year) throw new NotFoundError('Año escolar no encontrado');
  if (forWrite && year.status === 'CLOSED') throw new ConflictError('Este año escolar ya cerró: solo se puede consultar');
  return year;
};

const yearLevels = async (yearId: string) =>
  (await db.select({ level: schoolYearLevels.level }).from(schoolYearLevels).where(eq(schoolYearLevels.yearId, yearId))).map((l) => l.level);

const LEVEL_ORDER: SchoolLevel[] = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'];

export const schoolPlanService = {
  /** El plan de cada nivel del año, con las áreas que se pueden agregar. */
  async get(schoolId: string, yearId: string) {
    await loadYear(schoolId, yearId, false);
    const levels = (await yearLevels(yearId)).sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
    return {
      levels: await Promise.all(levels.map(async (level) => {
        const plan = await effectivePlan(yearId, level);
        const available = await areasForLevel(level);
        return {
          level,
          grades: LEVEL_GRADES[level],
          custom: plan.custom,
          areas: plan.areas,
          available: available.map((a) => ({ areaId: a.id, name: a.name, shortName: a.shortName })),
        };
      })),
    };
  },

  /**
   * Guarda el plan de un nivel (todas sus áreas, en orden). No deja quitar un área, o un grado de un área, que ya
   * tiene asignaciones: primero se quitan las asignaciones.
   */
  async save(schoolId: string, yearId: string, level: SchoolLevel, input: Array<{ areaId: string; grades: number[] }>) {
    await loadYear(schoolId, yearId, true);
    if (!(await yearLevels(yearId)).includes(level)) throw new ValidationError('Ese nivel no es de este año escolar');
    const available = new Map((await areasForLevel(level)).map((a) => [a.id, a]));
    const valid = new Set(LEVEL_GRADES[level]);
    const seen = new Set<string>();
    const areas = input.map((item) => {
      if (!available.has(item.areaId)) throw new ValidationError('Esa área no es de este nivel');
      if (seen.has(item.areaId)) throw new ValidationError('Hay un área repetida');
      seen.add(item.areaId);
      const grades = [...new Set(item.grades)].sort((a, b) => a - b);
      if (grades.length === 0 || grades.some((g) => !valid.has(g))) throw new ValidationError(`Elige en qué grados va ${available.get(item.areaId)!.name}`);
      return { areaId: item.areaId, grades };
    });
    if (areas.length === 0) throw new ValidationError('El plan necesita al menos un área');

    // Asignaciones que quedarían fuera del plan.
    const assigned = await db.select({
      areaId: schoolTeachingAssignments.areaId, grade: schoolSections.grade, name: schoolSections.name,
    }).from(schoolTeachingAssignments)
      .innerJoin(schoolSections, eq(schoolSections.id, schoolTeachingAssignments.sectionId))
      .where(and(eq(schoolTeachingAssignments.yearId, yearId), eq(schoolSections.level, level)));
    const planned = new Map(areas.map((a) => [a.areaId, new Set(a.grades)]));
    const orphan = assigned.filter((a) => !planned.get(a.areaId)?.has(a.grade));
    if (orphan.length > 0) {
      const area = available.get(orphan[0].areaId)?.name ?? 'Un área';
      const where = [...new Set(orphan.filter((o) => o.areaId === orphan[0].areaId).map((o) => sectionDisplayName(level, o.grade, o.name)))].slice(0, 3).join(', ');
      throw new ConflictError(`${area} tiene docente asignado en ${where}: quita esas asignaciones antes de sacarla del plan`);
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(schoolPlanAreas).where(and(eq(schoolPlanAreas.yearId, yearId), eq(schoolPlanAreas.level, level)));
      await tx.insert(schoolPlanAreas).values(areas.map((a, i) => ({
        yearId, level, areaId: a.areaId, schoolId, grades: a.grades.join(','), displayOrder: i, createdAt: now,
      })));
    });
    return this.get(schoolId, yearId);
  },
};
