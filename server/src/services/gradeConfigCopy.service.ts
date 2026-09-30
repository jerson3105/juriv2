import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classroomCompetencies, classrooms, curriculumCompetencies } from '../db/schema.js';
import { ForbiddenError, ValidationError } from '../utils/errors.js';
import { classroomService } from './classroom.service.js';

export interface CopyConfigOptions {
  targetClassroomIds: string[];
  /** Escala, peso de las evaluaciones propias. */
  scale: boolean;
  /** Fechas de los bimestres (solo los que no están cerrados en la clase destino). */
  dates: boolean;
}

export interface CopyConfigTargetResult {
  classroomId: string;
  classroomName: string;
  ok: boolean;
  message: string;
  addedCompetencies: number;
  createdCustomCompetencies: number;
  createdIndicators: number;
}

const parseJson = <T>(raw: unknown): T | null => {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  return raw as T;
};

/**
 * "Copiar configuración a otras clases": competencias (oficiales y propias), destrezas, escala,
 * peso de evaluaciones y fechas de bimestre. Nunca copia notas. Cada clase destino se informa aparte.
 */
class GradeConfigCopyService {
  async copy(sourceClassroomId: string, teacherId: string, options: CopyConfigOptions): Promise<{ targets: CopyConfigTargetResult[] }> {
    const targetIds = [...new Set(options.targetClassroomIds)].filter((id) => id !== sourceClassroomId);
    if (targetIds.length === 0) throw new ValidationError('Elige al menos una clase destino');

    const rows = await db.select().from(classrooms).where(inArray(classrooms.id, [sourceClassroomId, ...targetIds]));
    const source = rows.find((r) => r.id === sourceClassroomId);
    if (!source || source.teacherId !== teacherId) throw new ForbiddenError('No tienes acceso a esta clase');
    if (!source.useCompetencies || !source.curriculumAreaId) throw new ValidationError('Configura primero las competencias de esta clase');

    const sourceCompetencies = await db.select({
      id: curriculumCompetencies.id,
      sourceType: curriculumCompetencies.sourceType,
      name: curriculumCompetencies.name,
      shortName: curriculumCompetencies.shortName,
      description: curriculumCompetencies.description,
    })
      .from(classroomCompetencies)
      .innerJoin(curriculumCompetencies, eq(classroomCompetencies.competencyId, curriculumCompetencies.id))
      .where(and(eq(classroomCompetencies.classroomId, sourceClassroomId), eq(classroomCompetencies.isActive, true)));
    const officialIds = sourceCompetencies.filter((c) => c.sourceType === 'OFFICIAL').map((c) => c.id);
    const customs = sourceCompetencies.filter((c) => c.sourceType !== 'OFFICIAL');

    const results: CopyConfigTargetResult[] = [];
    for (const targetId of targetIds) {
      const target = rows.find((r) => r.id === targetId);
      const result: CopyConfigTargetResult = {
        classroomId: targetId,
        classroomName: target?.name ?? 'Clase',
        ok: false,
        message: '',
        addedCompetencies: 0,
        createdCustomCompetencies: 0,
        createdIndicators: 0,
      };
      results.push(result);
      if (!target || target.teacherId !== teacherId) {
        result.message = 'No tienes acceso a esta clase';
        continue;
      }
      if (!target.useCompetencies || !target.curriculumAreaId) {
        result.message = 'Primero elige su área curricular en Calificaciones';
        continue;
      }

      try {
        // 1. Competencias oficiales (addCompetencies ignora las que no son de su país/nivel).
        if (officialIds.length > 0) {
          result.addedCompetencies = (await classroomService.addCompetencies(targetId, officialIds)).created;
        }
        // 2. Destrezas (crea también las competencias propias que tengan destrezas).
        const transfer = await classroomService.transferCompetencyIndicators(sourceClassroomId, teacherId, {
          mode: 'EXPORT',
          targetClassroomIds: [targetId],
          copyMissingCustomCompetencies: true,
        }).catch((error: Error) => {
          if (error.message.includes('No hay destrezas')) return null;
          throw error;
        });
        result.createdCustomCompetencies += transfer?.createdCompetencies ?? 0;
        result.createdIndicators = transfer?.createdIndicators ?? 0;
        // 3. Competencias propias sin destrezas.
        for (const custom of customs) {
          try {
            await classroomService.createCustomCompetency(targetId, teacherId, { name: custom.name, shortName: custom.shortName, description: custom.description });
            result.createdCustomCompetencies += 1;
          } catch (error) {
            // Ya existe (con el mismo nombre): se deja como está.
            if (!(error instanceof Error) || !/existe|ya hay|mismo nombre/i.test(error.message)) throw error;
          }
        }
        // 4. Escala, peso de evaluaciones y fechas.
        const patch: Partial<typeof classrooms.$inferInsert> = {};
        if (options.scale) {
          patch.gradeScaleType = source.gradeScaleType;
          patch.gradeScaleConfig = source.gradeScaleConfig;
          patch.gradeEvaluationWeight = source.gradeEvaluationWeight;
        }
        if (options.dates) {
          const closed = new Set((parseJson<Array<{ period: string }>>(target.closedBimesters) ?? []).map((c) => c.period));
          const sourceDates = parseJson<Record<string, { start: string; end: string }>>(source.bimesterDates) ?? {};
          const targetDates = parseJson<Record<string, { start: string; end: string }>>(target.bimesterDates) ?? {};
          for (const [period, range] of Object.entries(sourceDates)) {
            if (!closed.has(period)) targetDates[period] = range;
          }
          patch.bimesterDates = targetDates;
        }
        if (Object.keys(patch).length > 0) {
          await db.update(classrooms).set({ ...patch, updatedAt: new Date() }).where(eq(classrooms.id, targetId));
        }
        result.ok = true;
        result.message = 'Configuración copiada';
      } catch (error) {
        result.message = error instanceof Error ? error.message : 'No se pudo copiar';
      }
    }
    return { targets: results };
  }
}

export const gradeConfigCopyService = new GradeConfigCopyService();
