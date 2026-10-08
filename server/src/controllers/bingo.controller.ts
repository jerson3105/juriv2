import type { Request, Response } from 'express';
import { z } from 'zod';
import { bingoService } from '../services/bingo.service.js';
import { requireClassroomTeacher } from '../utils/access.js';
import { MAX_CARDS } from '../utils/bingo.js';
import { AppError } from '../utils/errors.js';

const sourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bank'), bankId: z.string().uuid() }),
  z.object({ kind: z.literal('tables'), tables: z.array(z.number().int().min(2).max(12)).min(1, 'Elige al menos una tabla').max(11) }),
]);
const previewSchema = z.object({ source: sourceSchema });
const createSchema = z.object({
  source: sourceSchema,
  size: z.union([z.literal(3), z.literal(4)]),
  paperCount: z.number().int().min(0).max(MAX_CARDS),
  screenStudentIds: z.array(z.string().uuid()).max(MAX_CARDS),
});

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

class BingoController {
  // POST /bingo/classroom/:classroomId/preview { source } (docente)
  async preview(req: Request, res: Response) {
    try {
      if (!(await requireClassroomTeacher(req, res, req.params.classroomId))) return;
      const { source } = previewSchema.parse(req.body);
      res.json({ success: true, data: await bingoService.preview(req.user!.id, source) });
    } catch (error) {
      fail(res, error, 'No se pudo revisar la fuente del Bingo');
    }
  }

  // POST /bingo/classroom/:classroomId { source, size, paperCount, screenStudentIds } (docente)
  async create(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const input = createSchema.parse(req.body);
      res.status(201).json({ success: true, data: await bingoService.create(classroomId, req.user!.id, input) });
    } catch (error) {
      fail(res, error, 'No se pudo abrir el Bingo Estelar');
    }
  }

  // GET /bingo/sessions/:sessionId/cards (docente dueño de la partida)
  async cards(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await bingoService.cards(req.params.sessionId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudieron cargar los cartones');
    }
  }

  // GET /bingo/me/:profileId (alumno dueño del perfil)
  async mine(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await bingoService.forStudent(req.params.profileId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudo cargar tu cartón');
    }
  }
}

export const bingoController = new BingoController();
