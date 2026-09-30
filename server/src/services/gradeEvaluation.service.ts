import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  classroomCompetencies,
  classroomCompetencyIndicators,
  curriculumCompetencies,
  gradeEvaluationScores,
  gradeEvaluations,
  studentProfiles,
  users,
  type GradeEvaluationKind,
} from '../db/schema.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { scaleValueToScore } from '../utils/gradeScale.js';
import { gradeService } from './grade.service.js';

export interface EvaluationInput {
  period?: string;
  competencyId: string;
  indicatorId?: string | null;
  title: string;
  kind: GradeEvaluationKind;
  evaluatedOn?: string | null;
  weight?: number;
}

export interface ScoreInput {
  studentProfileId: string;
  /** Valor en la escala de la clase; null = quitar la nota. */
  value: string | null;
  note?: string | null;
}

/**
 * Evaluaciones propias del docente (examen, tarea…): nota directa por alumno en la escala de la
 * clase. Se guardan en porcentaje y se mezclan con la evidencia gamificada al calcular la nota.
 */
class GradeEvaluationService {
  private async loadEvaluation(evaluationId: string) {
    const [evaluation] = await db.select().from(gradeEvaluations).where(eq(gradeEvaluations.id, evaluationId));
    if (!evaluation) throw new NotFoundError('Evaluación no encontrada');
    return evaluation;
  }

  async getClassroomIdOf(evaluationId: string) {
    return (await this.loadEvaluation(evaluationId)).classroomId;
  }

  private async validateTarget(classroomId: string, competencyId: string, indicatorId?: string | null) {
    const [competency] = await db.select({ id: classroomCompetencies.id }).from(classroomCompetencies)
      .where(and(eq(classroomCompetencies.classroomId, classroomId), eq(classroomCompetencies.competencyId, competencyId), eq(classroomCompetencies.isActive, true)));
    if (!competency) throw new ValidationError('La competencia no está activa en esta clase');
    if (indicatorId) {
      const [indicator] = await db.select({ id: classroomCompetencyIndicators.id }).from(classroomCompetencyIndicators)
        .where(and(
          eq(classroomCompetencyIndicators.id, indicatorId),
          eq(classroomCompetencyIndicators.classroomId, classroomId),
          eq(classroomCompetencyIndicators.competencyId, competencyId),
          eq(classroomCompetencyIndicators.isActive, true),
        ));
      if (!indicator) throw new ValidationError('La destreza no pertenece a esa competencia');
    }
  }

  /** Evaluaciones del bimestre con cuántos alumnos tienen nota y su promedio. */
  async list(classroomId: string, period = 'CURRENT') {
    const resolved = await gradeService.resolvePeriod(classroomId, period);
    const rows = await db.select({
      id: gradeEvaluations.id,
      title: gradeEvaluations.title,
      kind: gradeEvaluations.kind,
      competencyId: gradeEvaluations.competencyId,
      competencyName: curriculumCompetencies.name,
      competencyShortName: curriculumCompetencies.shortName,
      indicatorId: gradeEvaluations.indicatorId,
      indicatorName: classroomCompetencyIndicators.name,
      evaluatedOn: gradeEvaluations.evaluatedOn,
      weight: gradeEvaluations.weight,
      createdAt: gradeEvaluations.createdAt,
      scored: sql<number>`(SELECT COUNT(*) FROM grade_evaluation_scores s WHERE s.evaluation_id = ${gradeEvaluations.id})`,
      average: sql<string | null>`(SELECT AVG(s.score) FROM grade_evaluation_scores s WHERE s.evaluation_id = ${gradeEvaluations.id})`,
    })
      .from(gradeEvaluations)
      .leftJoin(curriculumCompetencies, eq(gradeEvaluations.competencyId, curriculumCompetencies.id))
      .leftJoin(classroomCompetencyIndicators, eq(gradeEvaluations.indicatorId, classroomCompetencyIndicators.id))
      .where(and(eq(gradeEvaluations.classroomId, classroomId), eq(gradeEvaluations.period, resolved)))
      .orderBy(desc(gradeEvaluations.evaluatedOn), desc(gradeEvaluations.createdAt));
    return { period: resolved, evaluations: rows.map((r) => ({ ...r, scored: Number(r.scored), average: r.average === null ? null : Number(r.average) })) };
  }

  async create(classroomId: string, teacherId: string, input: EvaluationInput) {
    const period = await gradeService.resolvePeriod(classroomId, input.period ?? 'CURRENT');
    await gradeService.assertPeriodEditable(classroomId, period);
    await this.validateTarget(classroomId, input.competencyId, input.indicatorId);
    const now = new Date();
    const id = uuidv4();
    await db.insert(gradeEvaluations).values({
      id,
      classroomId,
      period,
      competencyId: input.competencyId,
      indicatorId: input.indicatorId || null,
      title: input.title.trim(),
      kind: input.kind,
      evaluatedOn: input.evaluatedOn || null,
      weight: Math.max(1, Math.min(10, Math.round(input.weight ?? 1))),
      createdBy: teacherId,
      createdAt: now,
      updatedAt: now,
    });
    return this.get(id);
  }

  async update(evaluationId: string, input: Partial<EvaluationInput>) {
    const evaluation = await this.loadEvaluation(evaluationId);
    await gradeService.assertPeriodEditable(evaluation.classroomId, evaluation.period);
    const competencyId = input.competencyId ?? evaluation.competencyId;
    const indicatorId = input.indicatorId === undefined ? evaluation.indicatorId : input.indicatorId;
    await this.validateTarget(evaluation.classroomId, competencyId, indicatorId);
    await db.update(gradeEvaluations).set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.evaluatedOn !== undefined ? { evaluatedOn: input.evaluatedOn || null } : {}),
      ...(input.weight !== undefined ? { weight: Math.max(1, Math.min(10, Math.round(input.weight))) } : {}),
      competencyId,
      indicatorId: indicatorId || null,
      updatedAt: new Date(),
    }).where(eq(gradeEvaluations.id, evaluationId));
    // Cambiar competencia o peso cambia las notas de quienes ya tienen nota en esta evaluación.
    if (input.competencyId !== undefined || input.weight !== undefined) {
      await gradeService.recalculateStudents(evaluation.classroomId, evaluation.period, await this.scoredStudents(evaluationId));
    }
    return this.get(evaluationId);
  }

  async remove(evaluationId: string) {
    const evaluation = await this.loadEvaluation(evaluationId);
    await gradeService.assertPeriodEditable(evaluation.classroomId, evaluation.period);
    const affected = await this.scoredStudents(evaluationId);
    await db.transaction(async (tx) => {
      await tx.delete(gradeEvaluationScores).where(eq(gradeEvaluationScores.evaluationId, evaluationId));
      await tx.delete(gradeEvaluations).where(eq(gradeEvaluations.id, evaluationId));
    });
    await gradeService.recalculateStudents(evaluation.classroomId, evaluation.period, affected);
    return { success: true };
  }

  private async scoredStudents(evaluationId: string) {
    const rows = await db.select({ id: gradeEvaluationScores.studentProfileId }).from(gradeEvaluationScores)
      .where(eq(gradeEvaluationScores.evaluationId, evaluationId));
    return rows.map((r) => r.id);
  }

  /** La evaluación con la nota (o vacío) de cada alumno activo de la clase. */
  async get(evaluationId: string) {
    const evaluation = await this.loadEvaluation(evaluationId);
    const [students, scores, [competency]] = await Promise.all([
      db.select({
        id: studentProfiles.id,
        characterName: studentProfiles.characterName,
        displayName: studentProfiles.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
      })
        .from(studentProfiles)
        .leftJoin(users, eq(studentProfiles.userId, users.id))
        .where(and(eq(studentProfiles.classroomId, evaluation.classroomId), eq(studentProfiles.isActive, true), eq(studentProfiles.isDemo, false))),
      db.select().from(gradeEvaluationScores).where(eq(gradeEvaluationScores.evaluationId, evaluationId)),
      db.select({ name: curriculumCompetencies.name, shortName: curriculumCompetencies.shortName })
        .from(curriculumCompetencies).where(eq(curriculumCompetencies.id, evaluation.competencyId)),
    ]);
    const byStudent = new Map(scores.map((s) => [s.studentProfileId, s]));
    const nameOf = (s: typeof students[number]) =>
      `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.displayName?.trim() || s.characterName || 'Estudiante';
    return {
      ...evaluation,
      competencyName: competency?.name ?? null,
      competencyShortName: competency?.shortName ?? null,
      isClosed: await gradeService.isPeriodClosed(evaluation.classroomId, evaluation.period),
      students: students
        .map((s) => {
          const score = byStudent.get(s.id);
          return {
            studentProfileId: s.id,
            studentName: nameOf(s),
            characterName: s.characterName,
            label: score?.label ?? null,
            score: score ? Number(score.score) : null,
            note: score?.note ?? null,
          };
        })
        .sort((a, b) => a.studentName.localeCompare(b.studentName, 'es')),
    };
  }

  /**
   * Guarda notas de varios alumnos (valor de la escala; null quita la nota) y recalcula a esos alumnos.
   * Todo o nada: si un valor no vale para la escala, no se guarda ninguno.
   */
  async saveScores(evaluationId: string, entries: ScoreInput[]) {
    const evaluation = await this.loadEvaluation(evaluationId);
    await gradeService.assertPeriodEditable(evaluation.classroomId, evaluation.period);

    const ids = [...new Set(entries.map((e) => e.studentProfileId))];
    if (ids.length !== entries.length) throw new ValidationError('Hay alumnos repetidos');
    const valid = await db.select({ id: studentProfiles.id }).from(studentProfiles)
      .where(and(inArray(studentProfiles.id, ids), eq(studentProfiles.classroomId, evaluation.classroomId)));
    if (valid.length !== ids.length) throw new ValidationError('Hay alumnos que no son de esta clase');

    const { gradeScaleType, parsedScaleConfig } = await gradeService.getScaleSettings(evaluation.classroomId);
    const parsed = entries.map((entry) => {
      if (entry.value === null || entry.value.trim() === '') return { ...entry, result: null };
      try {
        return { ...entry, result: scaleValueToScore(entry.value, gradeScaleType, parsedScaleConfig) };
      } catch (error) {
        throw new ValidationError(`${(error as Error).message.replace('Valor invalido', 'Nota inválida')}`);
      }
    });

    const now = new Date();
    await db.transaction(async (tx) => {
      for (const entry of parsed) {
        if (!entry.result) {
          await tx.delete(gradeEvaluationScores).where(and(
            eq(gradeEvaluationScores.evaluationId, evaluationId),
            eq(gradeEvaluationScores.studentProfileId, entry.studentProfileId),
          ));
          continue;
        }
        const values = {
          score: entry.result.score.toFixed(2),
          label: entry.result.label,
          note: entry.note?.trim() || null,
          updatedAt: now,
        };
        await tx.insert(gradeEvaluationScores)
          .values({ id: uuidv4(), evaluationId, studentProfileId: entry.studentProfileId, createdAt: now, ...values })
          .onDuplicateKeyUpdate({ set: values });
      }
    });

    await gradeService.recalculateStudents(evaluation.classroomId, evaluation.period, ids);
    return this.get(evaluationId);
  }
}

export const gradeEvaluationService = new GradeEvaluationService();
