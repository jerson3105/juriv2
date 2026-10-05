import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classrooms, schoolSections, schoolTeachingAssignments, schoolWorkshops, schoolYearLevels } from '../db/schema.js';
import { ConflictError } from '../utils/errors.js';

/**
 * Escala de las clases del colegio: la de su nivel en el año («Año escolar»: literal o vigesimal), para que una libreta nunca
 * mezcle letras y números. El docente no la cambia; al vincular una clase o si la administración cambia la del nivel, sus
 * clases la toman. Los bimestres cerrados conservan sus notas (Calificaciones no reescribe una etiqueta cerrada).
 */

export type SchoolLevelName = 'INICIAL' | 'PRIMARIA' | 'SECUNDARIA';
export type LevelScale = 'PERU_LETTERS' | 'PERU_VIGESIMAL';

// Lo mismo que SCALE_OF de schoolAssignment.service, sin importarlo (ese servicio depende de muchos otros).
const SCALE: Record<string, LevelScale> = { LITERAL: 'PERU_LETTERS', VIGESIMAL: 'PERU_VIGESIMAL' };

export const LEVEL_SCALE_MESSAGE = 'La escala de las clases del colegio la define su nivel en «Año escolar»';

/** El año y el nivel de cada clase del colegio: el de la sección de su asignación, el de su taller o el de su sección. */
export const classroomLevels = async (classroomIds: string[]) => {
  const result = new Map<string, { yearId: string; level: SchoolLevelName }>();
  const ids = [...new Set(classroomIds)];
  if (ids.length === 0) return result;
  const [byAssignment, byWorkshop, bySection] = await Promise.all([
    db.select({ id: schoolTeachingAssignments.classroomId, yearId: schoolSections.yearId, level: schoolSections.level })
      .from(schoolTeachingAssignments)
      .innerJoin(schoolSections, eq(schoolSections.id, schoolTeachingAssignments.sectionId))
      .where(inArray(schoolTeachingAssignments.classroomId, ids)),
    db.select({ id: schoolWorkshops.classroomId, yearId: schoolWorkshops.yearId, level: schoolWorkshops.level })
      .from(schoolWorkshops).where(inArray(schoolWorkshops.classroomId, ids)),
    db.select({ id: classrooms.id, yearId: schoolSections.yearId, level: schoolSections.level })
      .from(classrooms)
      .innerJoin(schoolSections, eq(schoolSections.id, classrooms.schoolSectionId))
      .where(inArray(classrooms.id, ids)),
  ]);
  // Como el año de la clase: manda la asignación, después el taller y al final la sección.
  for (const row of [...bySection, ...byWorkshop, ...byAssignment]) {
    if (row.id) result.set(row.id, { yearId: row.yearId, level: row.level });
  }
  return result;
};

/** La escala que fija el nivel de cada clase del colegio (una clase sin nivel o de un docente independiente no aparece). */
export const levelScales = async (classroomIds: string[]) => {
  const result = new Map<string, LevelScale>();
  const levels = await classroomLevels(classroomIds);
  if (levels.size === 0) return result;
  const yearIds = [...new Set([...levels.values()].map((l) => l.yearId))];
  const rows = await db.select({ yearId: schoolYearLevels.yearId, level: schoolYearLevels.level, gradeScale: schoolYearLevels.gradeScale })
    .from(schoolYearLevels).where(inArray(schoolYearLevels.yearId, yearIds));
  for (const [classroomId, { yearId, level }] of levels) {
    const row = rows.find((r) => r.yearId === yearId && r.level === level);
    if (row) result.set(classroomId, SCALE[row.gradeScale]);
  }
  return result;
};

/** Una clase del colegio solo usa la escala de su nivel (tampoco se queda sin escala). Undefined: no se cambia. */
export const assertScaleAllowed = async (classroomId: string, scale: string | null | undefined) => {
  if (scale === undefined) return;
  const fixed = (await levelScales([classroomId])).get(classroomId);
  if (fixed && fixed !== scale) throw new ConflictError(LEVEL_SCALE_MESSAGE);
};

/** Pone en unas clases la escala de su nivel (al vincularlas, o si la administración la cambia en «Año escolar»). */
export const applyLevelScale = async (classroomIds: string[]) => {
  const scales = await levelScales(classroomIds);
  const byScale = new Map<LevelScale, string[]>();
  for (const [classroomId, scale] of scales) byScale.set(scale, [...(byScale.get(scale) ?? []), classroomId]);
  for (const [scale, ids] of byScale) {
    for (let i = 0; i < ids.length; i += 500) {
      await db.update(classrooms)
        .set({ gradeScaleType: scale, gradeScaleConfig: null, updatedAt: new Date() })
        .where(and(inArray(classrooms.id, ids.slice(i, i + 500)), or(isNull(classrooms.gradeScaleType), ne(classrooms.gradeScaleType, scale))));
    }
  }
};
