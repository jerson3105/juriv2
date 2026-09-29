import { Request, Response } from 'express';
import { z } from 'zod';
import { rankingService } from '../services/ranking.service.js';
import { requireClassroomTeacher } from '../utils/access.js';

const MAX_PERIOD_MS = 400 * 24 * 60 * 60 * 1000;

const deltasQuerySchema = z.object({
  since: z.string().datetime({ offset: true }),
  timeline: z.enum(['0', '1']).optional(),
});

class RankingController {
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
