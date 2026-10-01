import type { Request, Response } from 'express';
import { z } from 'zod';
import { recoveryService } from '../services/recovery.service.js';
import { requireClassroomTeacher } from '../utils/access.js';
import { AppError } from '../utils/errors.js';

const assignSchema = z.object({
  text: z.string().trim().min(3, 'Escribe la misión').max(255),
  complete: z.boolean().optional(),
});

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

class RecoveryController {
  // GET /recovery/classroom/:classroomId → quién descansa, su misión y las plantillas
  async listResting(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.json({ success: true, data: await recoveryService.listResting(classroomId) });
    } catch (error) {
      fail(res, error, 'No se pudo cargar quién está descansando');
    }
  }

  // POST /recovery/classroom/:classroomId/students/:studentId { text, complete? }
  async assign(req: Request, res: Response) {
    try {
      const { classroomId, studentId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const { text, complete } = assignSchema.parse(req.body);
      const data = await recoveryService.assign(classroomId, studentId, req.user!.id, text, !!complete);
      res.status(201).json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudo asignar la misión');
    }
  }

  // POST /recovery/missions/:missionId/complete
  async complete(req: Request, res: Response) {
    try {
      const data = await recoveryService.complete(req.params.missionId, req.user!.id);
      res.json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudo validar la misión');
    }
  }

  // GET /recovery/me/:profileId (alumno dueño del perfil)
  async forStudent(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await recoveryService.forStudent(req.params.profileId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudo cargar tu energía');
    }
  }
}

export const recoveryController = new RecoveryController();
