import { Request, Response } from 'express';
import { z } from 'zod';
import { classStatsService } from '../services/classStats.service.js';
import { requireClassroomTeacher } from '../utils/access.js';
import { AppError, publicErrorMessage } from '../utils/errors.js';

const paramsSchema = z.object({ classroomId: z.string().uuid() });
const querySchema = z.object({
  period: z.enum(['week', 'bimester', 'month', 'all']).default('bimester'),
  // Minutos de diferencia con UTC (Date.getTimezoneOffset del docente) para agrupar por día local.
  tz: z.coerce.number().int().min(-840).max(840).default(0),
});

class ClassStatsController {
  async overview(req: Request, res: Response) {
    try {
      const { classroomId } = paramsSchema.parse(req.params);
      const { period, tz } = querySchema.parse(req.query);
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.json({ success: true, data: await classStatsService.getOverview(classroomId, period, tz) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
        return;
      }
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      console.error('Error al obtener estadísticas', error);
      res.status(500).json({ success: false, message: publicErrorMessage(error) || 'Error al obtener estadísticas' });
    }
  }
}

export const classStatsController = new ClassStatsController();
