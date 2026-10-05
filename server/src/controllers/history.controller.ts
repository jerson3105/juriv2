import { Request, Response } from 'express';
import { historyService } from '../services/history.service.js';
import { historyFeedService } from '../services/historyFeed.service.js';
import { gradeService } from '../services/grade.service.js';
import { z } from 'zod';
import { requireWritableClassroom } from '../utils/access.js';
import { AppError } from '../utils/errors.js';

const classroomParamsSchema = z.object({
  classroomId: z.string().uuid(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(1_000).optional(),
  type: z.enum(['POINTS', 'PURCHASE', 'ITEM_USED', 'BADGE', 'ATTENDANCE', 'ALL']).optional(),
  studentId: z.string().uuid().optional(),
});

const feedTypeSchema = z.enum(['POINTS', 'PURCHASE', 'ITEM_USED', 'BADGE', 'ATTENDANCE', 'LEVEL_UP', 'ALL']);

// Periodo: "bimester" lo resuelve el servidor; si no, [from, to) en instantes ISO calculados por el cliente en su zona.
const periodSchema = z.object({
  studentId: z.string().uuid().optional(),
  period: z.enum(['bimester']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).refine((q) => !q.from || !q.to || new Date(q.from) < new Date(q.to), { message: 'El inicio debe ser anterior al fin', path: ['from'] });

const feedQuerySchema = periodSchema.and(z.object({
  type: feedTypeSchema.optional().default('ALL'),
  cursor: z.string().max(2000).optional(),
  limit: z.coerce.number().int().min(5).max(50).optional().default(25),
}));

const revertBatchSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1).max(60).refine((ids) => new Set(ids).size === ids.length, 'IDs repetidos'),
});

const resolvePeriod = async (classroomId: string, q: z.infer<typeof periodSchema>) => {
  if (q.period === 'bimester') {
    const { startDate } = await gradeService.getBimesterDateRange(classroomId, 'CURRENT');
    return { from: startDate, to: null };
  }
  return { from: q.from ? new Date(q.from) : null, to: q.to ? new Date(q.to) : null };
};

const handleValidationError = (res: Response, error: z.ZodError) => {
  return res.status(400).json({
    success: false,
    message: 'Datos inválidos',
    errors: error.errors,
  });
};

const handleControllerError = (res: Response, error: unknown, fallbackMessage: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallbackMessage, error);

  const message = error instanceof Error ? error.message : fallbackMessage;
  const normalizedMessage = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let statusCode = 500;
  if (normalizedMessage.includes('ya fue revertid') || normalizedMessage.includes('ya estaba revertid')) {
    statusCode = 409;
  } else if (normalizedMessage.includes('no encontrado')) {
    statusCode = 404;
  } else if (normalizedMessage.includes('sin acceso') || normalizedMessage.includes('no autorizado')) {
    statusCode = 403;
  } else if (
    normalizedMessage.includes('inval') ||
    normalizedMessage.includes('requiere') ||
    normalizedMessage.includes('debe')
  ) {
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? fallbackMessage : message,
  });
};

const ensureHistoryClassroomAccess = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId || !role) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  if (role === 'ADMIN') {
    return true;
  }

  if (role !== 'TEACHER') {
    res.status(403).json({ success: false, message: 'Sin permisos para ver historial del aula' });
    return false;
  }

  const hasAccess = await historyService.verifyTeacherOwnsClassroom(userId, classroomId);
  if (!hasAccess) {
    res.status(403).json({ success: false, message: 'Sin acceso a este salón' });
    return false;
  }

  return true;
};

class HistoryController {
  async getClassroomHistory(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const queryValidation = historyQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return handleValidationError(res, queryValidation.error);
      }

      const { classroomId } = paramsValidation.data;
      const { studentId } = queryValidation.data;

      if (!(await ensureHistoryClassroomAccess(req, res, classroomId))) {
        return;
      }

      if (studentId) {
        const studentBelongsToClassroom = await historyService.verifyStudentBelongsToClassroom(studentId, classroomId);
        if (!studentBelongsToClassroom) {
          return res.status(403).json({
            success: false,
            message: 'Sin acceso al estudiante seleccionado',
          });
        }
      }

      const result = await historyService.getClassroomHistory(classroomId, {
        limit: queryValidation.data.limit,
        offset: queryValidation.data.offset,
        type: queryValidation.data.type,
        studentId: queryValidation.data.studentId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener historial');
    }
  }

  async getClassroomStats(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const { classroomId } = paramsValidation.data;

      if (!(await ensureHistoryClassroomAccess(req, res, classroomId))) {
        return;
      }

      const stats = await historyService.getClassroomStats(classroomId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener estadísticas');
    }
  }

  /** Registro paginado por cursor, con filtros de tipo, alumno y periodo. */
  async getFeed(req: Request, res: Response) {
    try {
      const params = classroomParamsSchema.safeParse(req.params);
      if (!params.success) return handleValidationError(res, params.error);
      const query = feedQuerySchema.safeParse(req.query);
      if (!query.success) return handleValidationError(res, query.error);

      const { classroomId } = params.data;
      if (!(await ensureHistoryClassroomAccess(req, res, classroomId))) return;

      const { from, to } = await resolvePeriod(classroomId, query.data);
      const data = await historyFeedService.getFeed(classroomId, {
        type: query.data.type,
        studentId: query.data.studentId,
        from,
        to,
        cursor: query.data.cursor ?? null,
        limit: query.data.limit,
      });
      res.json({ success: true, data });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener el registro');
    }
  }

  /** Resumen del periodo filtrado. */
  async getSummary(req: Request, res: Response) {
    try {
      const params = classroomParamsSchema.safeParse(req.params);
      if (!params.success) return handleValidationError(res, params.error);
      const query = periodSchema.safeParse(req.query);
      if (!query.success) return handleValidationError(res, query.error);

      const { classroomId } = params.data;
      if (!(await ensureHistoryClassroomAccess(req, res, classroomId))) return;

      const { from, to } = await resolvePeriod(classroomId, query.data);
      const data = await historyFeedService.getSummary(classroomId, { studentId: query.data.studentId, from, to });
      res.json({ success: true, data });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener el resumen');
    }
  }

  /** Revertir un lote de puntos (la misma acción a varios alumnos). */
  async revertBatch(req: Request, res: Response) {
    try {
      const params = classroomParamsSchema.safeParse(req.params);
      if (!params.success) return handleValidationError(res, params.error);
      const body = revertBatchSchema.safeParse(req.body);
      if (!body.success) return handleValidationError(res, body.error);

      const { classroomId } = params.data;
      if (!(await ensureHistoryClassroomAccess(req, res, classroomId))) return;
      if (!(await requireWritableClassroom(res, classroomId))) return;

      const result = await historyService.revertPointBatch(classroomId, body.data.entryIds, req.user!.id);
      res.json({ success: true, data: { reverted: result.reverted, skipped: result.skipped }, message: result.message });
    } catch (error) {
      handleControllerError(res, error, 'Error al revertir el lote');
    }
  }

  async revertEntry(req: Request, res: Response) {
    try {
      const { entryType, entryId } = req.params;
      const teacherId = req.user?.id;

      if (!teacherId) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }

      if (!entryId || typeof entryId !== 'string') {
        return res.status(400).json({ success: false, message: 'ID de entrada inválido' });
      }

      let result: { message: string };

      switch (entryType) {
        case 'POINTS':
          result = await historyService.revertPointLog(entryId, teacherId);
          break;
        case 'BADGE':
          result = await historyService.revertBadge(entryId, teacherId);
          break;
        case 'ATTENDANCE':
          result = await historyService.revertAttendance(entryId, teacherId);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de entrada no soportado para revertir. Tipos válidos: POINTS, BADGE, ATTENDANCE',
          });
      }

      res.json({ success: true, ...result });
    } catch (error) {
      handleControllerError(res, error, 'Error al revertir acción');
    }
  }
}

export const historyController = new HistoryController();
