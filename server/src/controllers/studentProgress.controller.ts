import type { Request, Response } from 'express';
import { z } from 'zod';
import { studentProgressService } from '../services/studentProgress.service.js';
import { AppError } from '../utils/errors.js';

const periodSchema = z.enum(['bimester', 'all']).default('bimester');

// tz = getTimezoneOffset() del navegador del alumno (de UTC−14 a UTC+14).
const progressSchema = z.object({
  period: periodSchema,
  tz: z.coerce.number().int().min(-840).max(840).default(0),
});

// Cursor opaco: base64url de «instante ISO|id» de la última línea entregada.
const cursorSchema = z.string().max(200).transform((value, ctx) => {
  const [at, id] = Buffer.from(value, 'base64url').toString('utf8').split('|');
  const date = new Date(at ?? '');
  if (!at || Number.isNaN(date.getTime()) || !/^[0-9a-f-]{36}$/i.test(id ?? '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cursor inválido' });
    return z.NEVER;
  }
  return { at: date, id };
});

const historySchema = z.object({
  period: periodSchema,
  type: z.enum(['ALL', 'XP', 'GP', 'HP']).default('ALL'),
  cursor: cursorSchema.optional(),
});

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Datos inválidos' });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

class StudentProgressController {
  // GET /students/profiles/:profileId/progress?period=bimester|all&tz= (solo el dueño del perfil)
  async getProgress(req: Request, res: Response) {
    try {
      const { period, tz } = progressSchema.parse(req.query);
      const data = await studentProgressService.getProgress(req.params.profileId, req.user!.id, period, tz);
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudo cargar tu progreso');
    }
  }

  // GET /students/profiles/:profileId/progress/history?period=&type=&cursor= (solo el dueño del perfil)
  async getHistory(req: Request, res: Response) {
    try {
      const { period, type, cursor } = historySchema.parse(req.query);
      const data = await studentProgressService.getHistory(req.params.profileId, req.user!.id, { period, type, cursor: cursor ?? null });
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudo cargar tu historial');
    }
  }
}

export const studentProgressController = new StudentProgressController();
