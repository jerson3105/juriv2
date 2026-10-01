import type { Request, Response } from 'express';
import { z } from 'zod';
import { studentNewsService } from '../services/studentNews.service.js';
import { AppError } from '../utils/errors.js';

const seenSchema = z.object({ until: z.string().datetime() });

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Datos inválidos' });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

class StudentNewsController {
  // GET /students/profiles/:profileId/news (solo el dueño del perfil)
  async getNews(req: Request, res: Response) {
    try {
      const data = await studentNewsService.getNews(req.params.profileId, req.user!.id);
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudieron cargar tus novedades');
    }
  }

  // POST /students/profiles/:profileId/news/seen { until }
  async markSeen(req: Request, res: Response) {
    try {
      const { until } = seenSchema.parse(req.body);
      await studentNewsService.markSeen(req.params.profileId, req.user!.id, new Date(until));
      res.json({ success: true });
    } catch (error) {
      fail(res, error, 'No se pudo guardar');
    }
  }
}

export const studentNewsController = new StudentNewsController();
