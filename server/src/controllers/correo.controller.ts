import type { Request, Response } from 'express';
import { z } from 'zod';
import { correoService } from '../services/correo.service.js';
import { requireClassroomTeacher } from '../utils/access.js';
import { AppError } from '../utils/errors.js';

const createSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(2, 'Se necesitan al menos 2 alumnos presentes').max(200),
  prompt: z.string().trim().min(5, 'Escribe la consigna').max(300),
  mode: z.enum(['papel', 'dispositivo']),
});
const moderateSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'PENDING']) });
const letterSchema = z.object({ message: z.string().trim().min(5, 'Escribe al menos una frase').max(800, 'La carta es muy larga (máx. 800 caracteres)') });

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

class CorreoController {
  // POST /correo/classroom/:classroomId { studentIds, prompt, mode } (docente)
  async create(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const { studentIds, prompt, mode } = createSchema.parse(req.body);
      res.status(201).json({ success: true, data: await correoService.create(classroomId, req.user!.id, studentIds, prompt, mode) });
    } catch (error) {
      fail(res, error, 'No se pudo abrir el Correo Estelar');
    }
  }

  // GET /correo/sessions/:sessionId/letters (docente)
  async letters(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await correoService.letters(req.params.sessionId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudieron cargar las cartas');
    }
  }

  // PUT /correo/letters/:letterId { status } (docente)
  async moderate(req: Request, res: Response) {
    try {
      const { status } = moderateSchema.parse(req.body);
      res.json({ success: true, data: await correoService.moderate(req.params.letterId, req.user!.id, status) });
    } catch (error) {
      fail(res, error, 'No se pudo revisar la carta');
    }
  }

  // GET /correo/me/:profileId (alumno dueño del perfil)
  async mine(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await correoService.forStudent(req.params.profileId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudo cargar tu correo');
    }
  }

  // POST /correo/me/:profileId/letter { message } (alumno dueño del perfil)
  async send(req: Request, res: Response) {
    try {
      const { message } = letterSchema.parse(req.body);
      res.status(201).json({ success: true, data: await correoService.send(req.params.profileId, req.user!.id, message) });
    } catch (error) {
      fail(res, error, 'No se pudo enviar tu carta');
    }
  }
}

export const correoController = new CorreoController();
