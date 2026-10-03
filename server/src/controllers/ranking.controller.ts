import { Request, Response } from 'express';
import { z } from 'zod';
import { rankingService } from '../services/ranking.service.js';
import { requireClassroomTeacher } from '../utils/access.js';

const MAX_PERIOD_MS = 400 * 24 * 60 * 60 * 1000;

const deltasQuerySchema = z.object({
  since: z.string().datetime({ offset: true }),
  timeline: z.enum(['0', '1']).optional(),
});

const pulseQuerySchema = z.object({
  today: z.string().datetime({ offset: true }),
  week: z.string().datetime({ offset: true }),
});

const DAY_MS = 24 * 60 * 60 * 1000;

class RankingController {
  // GET /classrooms/:id/rankings/pulse?today=ISO&week=ISO — pulso de la Lista de estudiantes (inicio del día
  // y de la semana en la hora del profesor): reconocidos hoy y, por clan, la semana y quiénes aportaron hoy.
  async getPulse(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;

      const parsed = pulseQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Periodo inválido' });
      }
      const today = new Date(parsed.data.today);
      const week = new Date(parsed.data.week);
      const now = Date.now();
      // Un minuto de margen por relojes desfasados; el día empezó hace menos de 2 días y la semana, de 8.
      if (today.getTime() > now + 60_000 || week.getTime() > today.getTime()
        || now - today.getTime() > 2 * DAY_MS || now - week.getTime() > 8 * DAY_MS) {
        return res.status(400).json({ success: false, message: 'Periodo fuera de rango' });
      }

      const data = await rankingService.getPulse(classroomId, today, week);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting students pulse:', error);
      res.status(500).json({ success: false, message: 'Error al obtener la actividad de hoy' });
    }
  }

  // GET /classrooms/:id/rankings?since=ISO[&timeline=1] — lo ganado desde `since` (inicio del periodo del profesor).
  async getDeltas(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;

      const parsed = deltasQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: 'Periodo inválido' });
      }
      const since = new Date(parsed.data.since);
      const now = Date.now();
      if (since.getTime() > now || now - since.getTime() > MAX_PERIOD_MS) {
        return res.status(400).json({ success: false, message: 'Periodo fuera de rango' });
      }

      const data = await rankingService.getDeltas(classroomId, since, parsed.data.timeline === '1');
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting ranking deltas:', error);
      res.status(500).json({ success: false, message: 'Error al obtener el ranking' });
    }
  }
}

export const rankingController = new RankingController();
