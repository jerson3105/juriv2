import type { Request, Response } from 'express';
import { z } from 'zod';
import { schoolCoordinatorService } from '../services/schoolCoordinator.service.js';
import { SCHOOL_LEVELS } from '../services/schoolYear.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES, SCHOOL_MEMBER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

const idSchema = z.string().uuid();
// Las áreas del CNEB tienen ids fijos (area-pe-mat…), no UUID.
const areaIdSchema = z.string().regex(/^[a-z0-9-]{3,36}$/, 'Área inválida');
const setSchema = z.object({
  level: z.enum(SCHOOL_LEVELS),
  areaId: areaIdSchema,
  userId: idSchema.nullable(),
}).strict();

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return res.status(400).json({ success: false, message: !issue || issue.code === 'unrecognized_keys' ? 'Datos inválidos' : issue.message });
  }
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

const yearOf = (req: Request, res: Response) => {
  const yearId = idSchema.safeParse(req.params.yearId);
  if (!yearId.success) res.status(404).json({ success: false, message: 'Año escolar no encontrado' });
  return yearId.success ? yearId.data : null;
};

/** Escuela y año con el rol pedido (sin atajo para el ADMIN de la plataforma). */
const scope = async (req: Request, res: Response, roles: typeof SCHOOL_MEMBER_ROLES) => {
  const { schoolId } = req.params;
  if (!(await requireSchoolRole(req, res, schoolId, roles))) return null;
  const yearId = yearOf(req, res);
  return yearId ? { schoolId, yearId } : null;
};

export const schoolCoordinatorController = {
  // GET /schools/:schoolId/years/:yearId/coordinators — áreas de cada nivel con su coordinador (administración)
  async list(req: Request, res: Response) {
    try {
      const s = await scope(req, res, SCHOOL_MANAGER_ROLES);
      if (!s) return;
      res.json({ success: true, data: await schoolCoordinatorService.list(s.schoolId, s.yearId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener los coordinadores');
    }
  },

  // PUT /schools/:schoolId/years/:yearId/coordinators — nombrar o quitar al coordinador de un área (administración)
  async set(req: Request, res: Response) {
    try {
      const s = await scope(req, res, SCHOOL_MANAGER_ROLES);
      if (!s) return;
      const input = setSchema.parse(req.body);
      const data = await schoolCoordinatorService.set(s.schoolId, s.yearId, input, req.user!.id);
      await auditRequest(req, {
        action: 'school.coordinator_set',
        schoolId: s.schoolId,
        target: { type: 'school_year', id: s.yearId },
        metadata: { level: input.level, areaId: input.areaId, userId: input.userId, previousUserId: data.previousUserId },
      });
      res.json({
        success: true,
        data,
        message: data.coordinator ? `${data.coordinator.name} coordina ${data.area}` : `${data.area} quedó sin coordinador`,
      });
    } catch (error) {
      return sendError(res, error, 'Error al guardar el coordinador');
    }
  },

  // GET /schools/:schoolId/years/:yearId/coordinators/mine — lo que coordino (cualquier miembro verificado)
  async mine(req: Request, res: Response) {
    try {
      const s = await scope(req, res, SCHOOL_MEMBER_ROLES);
      if (!s) return;
      res.json({ success: true, data: await schoolCoordinatorService.mine(s.schoolId, s.yearId, req.user!.id) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener tu coordinación');
    }
  },

  // GET /schools/:schoolId/years/:yearId/coordination — panel del coordinador (solo sus áreas)
  async panel(req: Request, res: Response) {
    try {
      const s = await scope(req, res, SCHOOL_MEMBER_ROLES);
      if (!s) return;
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data: await schoolCoordinatorService.panel(s.schoolId, s.yearId, req.user!.id) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener el panel de tu área');
    }
  },
};
