import type { Request, Response } from 'express';
import { z } from 'zod';
import { schoolTeacherAccountService } from '../services/schoolTeacherAccount.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

const createSchema = z.object({
  firstName: z.string().max(200),
  lastName: z.string().max(200),
  email: z.string().trim().toLowerCase().email('Escribe un correo válido').max(255),
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

export const schoolTeacherAccountController = {
  // GET /schools/:schoolId/teacher-accounts/domains — dominios del colegio para crear cuentas
  async domains(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      res.json({ success: true, data: await schoolTeacherAccountService.domains(schoolId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener los dominios del colegio');
    }
  },

  // POST /schools/:schoolId/teacher-accounts — crear la cuenta de un docente (o sumarlo si ya tiene una)
  async create(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const input = createSchema.parse(req.body);
      const data = await schoolTeacherAccountService.create(schoolId, input);
      await auditRequest(req, {
        action: 'school.teacher_account_created',
        schoolId,
        target: { type: 'user', id: data.userId },
        metadata: { created: data.created },
      });
      // La clave temporal viaja una sola vez: sin caché intermedia.
      res.set('Cache-Control', 'no-store');
      res.status(data.created ? 201 : 200).json({
        success: true,
        data,
        message: data.created ? 'Cuenta creada: el docente ya es parte del colegio' : 'Ya tenía cuenta: ahora es parte del colegio',
      });
    } catch (error) {
      return sendError(res, error, 'Error al crear la cuenta del docente');
    }
  },
};
