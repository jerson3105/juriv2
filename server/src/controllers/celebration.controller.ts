import type { Request, Response } from 'express';
import { z } from 'zod';
import { celebrationService } from '../services/celebration.service.js';
import { AppError } from '../utils/errors.js';

const seenSchema = z.object({ until: z.string().datetime() });

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Datos inválidos' });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

class CelebrationController {
  // GET /students/profiles/:profileId/celebrations (solo el dueño del perfil)
  async getPending(req: Request, res: Response) {
    try {
      const data = await celebrationService.getPending(req.params.profileId, req.user!.id);
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudieron cargar las celebraciones');
    }
  }

  // POST /students/profiles/:profileId/celebrations/seen { until }
  async markSeen(req: Request, res: Response) {
    try {
      const { until } = seenSchema.parse(req.body);
      await celebrationService.markSeen(req.params.profileId, req.user!.id, new Date(until));
      res.json({ success: true });
    } catch (error) {
      fail(res, error, 'No se pudo guardar');
    }
  }
}

export const celebrationController = new CelebrationController();
