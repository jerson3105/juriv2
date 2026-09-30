import { Request, Response } from 'express';
import { z } from 'zod';
import { gradeEvaluationKinds } from '../db/schema.js';
import { gradeEvaluationService } from '../services/gradeEvaluation.service.js';
import { requireClassroomTeacher } from '../utils/access.js';
import { AppError, publicErrorMessage } from '../utils/errors.js';

const periodSchema = z.string().trim().toUpperCase().refine((v) => v === 'CURRENT' || /^\d{4}-B[1-4]$/.test(v), 'Periodo inválido');
const classroomParams = z.object({ classroomId: z.string().uuid() });
const evaluationParams = z.object({ evaluationId: z.string().uuid() });

const evaluationBody = z.object({
  period: periodSchema.optional(),
  competencyId: z.string().trim().min(1).max(36),
  indicatorId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, 'Ponle un nombre a la evaluación').max(150),
  kind: z.enum(gradeEvaluationKinds).default('OTHER'),
  evaluatedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').nullable().optional(),
  weight: z.number().int().min(1).max(10).optional(),
});

const scoresBody = z.object({
  scores: z.array(z.object({
    studentProfileId: z.string().uuid(),
    value: z.string().trim().max(10).nullable(),
    note: z.string().trim().max(500).nullable().optional(),
  })).min(1).max(200),
});

// AppError lleva su código; los mensajes del servicio de notas (bimestre cerrado, periodo inválido) son 400.
const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos', errors: error.errors });
  }
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (normalized.includes('no encontrad')) return res.status(404).json({ success: false, message });
  if (normalized.includes('cerrado') || normalized.includes('inval') || normalized.includes('debe')) {
    return res.status(400).json({ success: false, message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: publicErrorMessage(error) || fallback });
};

// Operaciones por id de evaluación: el acceso se comprueba contra su clase.
const ensureEvaluationAccess = async (req: Request, res: Response, evaluationId: string) => {
  const classroomId = await gradeEvaluationService.getClassroomIdOf(evaluationId);
  return requireClassroomTeacher(req, res, classroomId);
};

class GradeEvaluationController {
  async list(req: Request, res: Response) {
    try {
      const { classroomId } = classroomParams.parse(req.params);
      const period = periodSchema.optional().parse(req.query.period) ?? 'CURRENT';
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.json({ success: true, data: await gradeEvaluationService.list(classroomId, period) });
    } catch (error) {
      sendError(res, error, 'Error al obtener las evaluaciones');
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { classroomId } = classroomParams.parse(req.params);
      const body = evaluationBody.parse(req.body);
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.status(201).json({ success: true, data: await gradeEvaluationService.create(classroomId, req.user!.id, body) });
    } catch (error) {
      sendError(res, error, 'Error al crear la evaluación');
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { evaluationId } = evaluationParams.parse(req.params);
      if (!(await ensureEvaluationAccess(req, res, evaluationId))) return;
      res.json({ success: true, data: await gradeEvaluationService.get(evaluationId) });
    } catch (error) {
      sendError(res, error, 'Error al obtener la evaluación');
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { evaluationId } = evaluationParams.parse(req.params);
      const body = evaluationBody.partial().omit({ period: true }).parse(req.body);
      if (!(await ensureEvaluationAccess(req, res, evaluationId))) return;
      res.json({ success: true, data: await gradeEvaluationService.update(evaluationId, body) });
    } catch (error) {
      sendError(res, error, 'Error al actualizar la evaluación');
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const { evaluationId } = evaluationParams.parse(req.params);
      if (!(await ensureEvaluationAccess(req, res, evaluationId))) return;
      res.json({ success: true, data: await gradeEvaluationService.remove(evaluationId) });
    } catch (error) {
      sendError(res, error, 'Error al eliminar la evaluación');
    }
  }

  async saveScores(req: Request, res: Response) {
    try {
      const { evaluationId } = evaluationParams.parse(req.params);
      const { scores } = scoresBody.parse(req.body);
      if (!(await ensureEvaluationAccess(req, res, evaluationId))) return;
      res.json({ success: true, data: await gradeEvaluationService.saveScores(evaluationId, scores) });
    } catch (error) {
      sendError(res, error, 'Error al guardar las notas');
    }
  }
}

export const gradeEvaluationController = new GradeEvaluationController();
