import { Request, Response } from 'express';
import { historyService } from '../services/history.service.js';
import { z } from 'zod';

const classroomParamsSchema = z.object({
  classroomId: z.string().uuid(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(1_000).optional(),
  type: z.enum(['POINTS', 'PURCHASE', 'ITEM_USED', 'BADGE', 'ATTENDANCE', 'ALL']).optional(),
  studentId: z.string().uuid().optional(),
});

const handleValidationError = (res: Response, error: z.ZodError) => {
  return res.status(400).json({
    success: false,
    message: 'Datos inválidos',
    errors: error.errors,
  });
};

const handleControllerError = (res: Response, error: unknown, fallbackMessage: string) => {
  console.error(fallbackMessage, error);

  const message = error instanceof Error ? error.message : fallbackMessage;
  const normalizedMessage = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let statusCode = 500;
  if (normalizedMessage.includes('no encontrado')) {
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
}

export const historyController = new HistoryController();
