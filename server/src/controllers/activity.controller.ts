import type { Request, Response } from 'express';
import { z } from 'zod';
import { ACTIVITY_TYPES, SELF_ASSESSMENTS, activityService } from '../services/activity.service.js';
import { requireClassroomTeacher } from '../utils/access.js';
import { AppError } from '../utils/errors.js';

// El estado viaja con cada autoguardado: tope para no llenar la fila (express.json acepta 100 kB).
const MAX_JSON_CHARS = 60_000;
const jsonBlob = z.record(z.unknown()).refine((v) => JSON.stringify(v).length <= MAX_JSON_CHARS, 'La partida es demasiado grande para guardarse');

const createSchema = z.object({
  activityType: z.enum(ACTIVITY_TYPES),
  title: z.string().trim().max(120).optional().nullable(),
  state: jsonBlob.optional(),
  // Partida jugada desde una parada «en clase» de una expedición publicada de esta clase.
  expeditionStopId: z.string().uuid().optional().nullable(),
});
const stateSchema = z.object({ state: jsonBlob });
const finishSchema = z.object({ result: jsonBlob.optional(), state: jsonBlob.optional() });
const nameSchema = z.object({ name: z.string().trim().max(60).nullable() });
const selfAssessmentSchema = z.object({ value: z.enum(SELF_ASSESSMENTS).nullable() });
const rewardSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Elige al menos un alumno presente').max(200),
  behaviorId: z.string().uuid().optional().nullable(),
  xp: z.number().int().min(0).max(500).optional(),
  gp: z.number().int().min(0).max(500).optional(),
});

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Datos inválidos' });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

class ActivityController {
  // GET /activities/classroom/:classroomId/overview
  async overview(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.json({ success: true, data: await activityService.overview(classroomId) });
    } catch (error) {
      fail(res, error, 'No se pudo cargar el Observatorio');
    }
  }

  // GET /activities/classroom/:classroomId/album
  async album(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      res.json({ success: true, data: await activityService.album(classroomId) });
    } catch (error) {
      fail(res, error, 'No se pudo cargar el Cielo de Jiro');
    }
  }

  // PUT /activities/sessions/:sessionId/name { name }
  async rename(req: Request, res: Response) {
    try {
      const { name } = nameSchema.parse(req.body);
      res.json({ success: true, data: await activityService.renameConstellation(req.params.sessionId, req.user!.id, name || null) });
    } catch (error) {
      fail(res, error, 'No se pudo guardar el nombre');
    }
  }

  // POST /activities/classroom/:classroomId/sessions { activityType, title?, state? }
  async create(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await requireClassroomTeacher(req, res, classroomId))) return;
      const { activityType, title, state, expeditionStopId } = createSchema.parse(req.body);
      const data = await activityService.create(classroomId, req.user!.id, activityType, title || null, state, expeditionStopId ?? null);
      res.status(201).json({ success: true, data });
    } catch (error) {
      fail(res, error, 'No se pudo empezar la partida');
    }
  }

  // GET /activities/sessions/:sessionId
  async get(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await activityService.get(req.params.sessionId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudo cargar la partida');
    }
  }

  // PUT /activities/sessions/:sessionId/state { state }
  async saveState(req: Request, res: Response) {
    try {
      const { state } = stateSchema.parse(req.body);
      res.json({ success: true, data: await activityService.saveState(req.params.sessionId, req.user!.id, state) });
    } catch (error) {
      fail(res, error, 'No se pudo guardar la partida');
    }
  }

  // POST /activities/sessions/:sessionId/finish { result?, state? }
  async finish(req: Request, res: Response) {
    try {
      const { result, state } = finishSchema.parse(req.body);
      res.json({ success: true, data: await activityService.finish(req.params.sessionId, req.user!.id, result, state) });
    } catch (error) {
      fail(res, error, 'No se pudo terminar la partida');
    }
  }

  // POST /activities/sessions/:sessionId/abandon
  async abandon(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await activityService.abandon(req.params.sessionId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudo descartar la partida');
    }
  }

  // PUT /activities/sessions/:sessionId/self-assessment { value }
  async selfAssessment(req: Request, res: Response) {
    try {
      const { value } = selfAssessmentSchema.parse(req.body);
      res.json({ success: true, data: await activityService.setSelfAssessment(req.params.sessionId, req.user!.id, value) });
    } catch (error) {
      fail(res, error, 'No se pudo guardar la autoevaluación');
    }
  }

  // POST /activities/sessions/:sessionId/reward { studentIds, behaviorId? | xp?, gp? }
  async reward(req: Request, res: Response) {
    try {
      const input = rewardSchema.parse(req.body);
      res.json({ success: true, data: await activityService.reward(req.params.sessionId, req.user!.id, input) });
    } catch (error) {
      fail(res, error, 'No se pudo entregar la recompensa');
    }
  }

  // DELETE /activities/sessions/:sessionId/reward
  async undoReward(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await activityService.undoReward(req.params.sessionId, req.user!.id) });
    } catch (error) {
      fail(res, error, 'No se pudo deshacer la recompensa');
    }
  }
}

export const activityController = new ActivityController();
