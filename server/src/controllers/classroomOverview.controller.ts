import type { Request, Response } from 'express';
import { z } from 'zod';
import { classroomOverviewService } from '../services/classroomOverview.service.js';
import { requireClassroomTeacher } from '../utils/access.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const overviewQuerySchema = z.object({
  since: z.string().datetime({ offset: true }), // medianoche local del profesor
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // su fecha local (formato de asistencia)
});

class ClassroomOverviewController {
  // GET /classrooms/my/overview?since=ISO&date=YYYY-MM-DD
  async getOverview(req: Request, res: Response) {
    try {
      const parsed = overviewQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Fecha inválida' });
      }
      const since = new Date(parsed.data.since);
      // "Hoy" del profesor: como mucho un día y medio atrás (cubre cualquier zona horaria).
      if (Number.isNaN(since.getTime()) || since.getTime() > Date.now() || Date.now() - since.getTime() > 1.5 * DAY_MS) {
        return res.status(400).json({ success: false, message: 'Fecha fuera de rango' });
      }
      // Mismo criterio que el pase de lista: la fecha se guarda a las 12:00 UTC.
      const day = new Date(`${parsed.data.date}T12:00:00.000Z`);
      const data = await classroomOverviewService.getOverview(req.user!.id, since, day);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting classroom overview:', error);
      res.status(500).json({ success: false, message: 'Error al obtener el resumen de tus clases' });
    }
  }

  // POST /classrooms/:id/archive y /classrooms/:id/restore
  async archive(req: Request, res: Response) {
    return this.setArchived(req, res, true);
  }

  async restore(req: Request, res: Response) {
    return this.setArchived(req, res, false);
  }

  private async setArchived(req: Request, res: Response, archived: boolean) {
    try {
      const classroomId = req.params.id;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      await classroomOverviewService.setArchived(classroomId, archived);
      res.json({ success: true, message: archived ? 'Clase archivada' : 'Clase restaurada' });
    } catch (error) {
      console.error('Error archiving classroom:', error);
      res.status(500).json({ success: false, message: 'Error al archivar la clase' });
    }
  }
}

export const classroomOverviewController = new ClassroomOverviewController();
