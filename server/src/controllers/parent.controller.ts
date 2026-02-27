import { Request, Response } from 'express';
import { z } from 'zod';
import { parentService } from '../services/parent.service.js';

// ==================== VALIDATION SCHEMAS ====================

const registerSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  lastName: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres').max(100),
  phone: z.string().max(20).optional(),
  relationship: z.enum(['FATHER', 'MOTHER', 'TUTOR', 'GUARDIAN']).default('GUARDIAN'),
});

const linkChildSchema = z.object({
  linkCode: z.string().trim().min(6, 'Código muy corto').max(8, 'Código muy largo'),
});

const studentIdParamsSchema = z.object({
  studentId: z.string().trim().min(1, 'studentId requerido'),
});

const classroomIdParamsSchema = z.object({
  classroomId: z.string().trim().min(1, 'classroomId requerido'),
});

const childActivityQuerySchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

const childGradesQuerySchema = z.object({
  period: z.string().trim().optional(),
});

const updatePreferencesSchema = z.object({
  phone: z.string().max(20).optional(),
  relationship: z.enum(['FATHER', 'MOTHER', 'TUTOR', 'GUARDIAN']).optional(),
  notifyByEmail: z.boolean().optional(),
  notifyWeeklySummary: z.boolean().optional(),
  notifyAlerts: z.boolean().optional(),
});

// ==================== ERROR HELPERS ====================

const handleValidationError = (res: Response, error: z.ZodError) => {
  res.status(400).json({
    success: false,
    message: 'Datos inválidos',
    errors: error.errors,
  });
};

const handleControllerError = (res: Response, error: unknown, fallbackMessage: string) => {
  if (error instanceof z.ZodError) {
    return handleValidationError(res, error);
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const normalizedMessage = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let statusCode = 500;
  if (normalizedMessage.includes('no encontrado') || normalizedMessage.includes('no encontrada')) {
    statusCode = 404;
  } else if (normalizedMessage.includes('sin acceso') || normalizedMessage.includes('no autorizado') || normalizedMessage.includes('no tienes acceso') || normalizedMessage.includes('no tienes permiso')) {
    statusCode = 403;
  } else if (normalizedMessage.includes('ya esta vinculado') || normalizedMessage.includes('ya esta registrado') || normalizedMessage.includes('ya está vinculado') || normalizedMessage.includes('ya está registrado')) {
    statusCode = 409;
  } else if (
    normalizedMessage.includes('inval') ||
    normalizedMessage.includes('requeri') ||
    normalizedMessage.includes('muy corto') ||
    normalizedMessage.includes('muy largo')
  ) {
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? fallbackMessage : message,
  });
};

// ==================== ACCESS HELPERS ====================

const ensureParentProfile = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return null;
  }

  const profile = await parentService.getParentProfile(userId);
  if (!profile) {
    res.status(404).json({ success: false, message: 'Perfil de padre no encontrado' });
    return null;
  }

  return profile;
};

const ensureTeacherOwnsStudent = async (req: Request, res: Response, studentProfileId: string): Promise<boolean> => {
  const teacherId = req.user?.id;
  if (!teacherId) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  const owns = await parentService.verifyTeacherOwnsStudent(teacherId, studentProfileId);
  if (!owns) {
    res.status(403).json({ success: false, message: 'No tienes permiso sobre este estudiante' });
    return false;
  }

  return true;
};

const ensureTeacherOwnsClassroom = async (req: Request, res: Response, classroomId: string): Promise<boolean> => {
  const teacherId = req.user?.id;
  if (!teacherId) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  const owns = await parentService.verifyTeacherOwnsClassroom(teacherId, classroomId);
  if (!owns) {
    res.status(403).json({ success: false, message: 'No tienes permiso sobre esta clase' });
    return false;
  }

  return true;
};

// ==================== CONTROLLER ====================

class ParentController {
  // Registrar nuevo padre
  async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await parentService.registerParent(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      handleControllerError(res, error, 'Error al registrar padre');
    }
  }

  // Obtener perfil del padre autenticado
  async getProfile(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      res.json({ success: true, data: profile });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener perfil');
    }
  }

  // Vincular hijo con código
  async linkChild(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const validation = linkChildSchema.safeParse(req.body);
      if (!validation.success) return handleValidationError(res, validation.error);

      const result = await parentService.linkChild(profile.id, validation.data.linkCode);
      res.json({ success: true, data: result });
    } catch (error) {
      handleControllerError(res, error, 'Error al vincular hijo');
    }
  }

  // Obtener lista de hijos
  async getChildren(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const children = await parentService.getChildren(profile.id);
      res.json(children);
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener hijos');
    }
  }

  // Obtener detalle de un hijo
  async getChildDetail(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const paramsValidation = studentIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      const detail = await parentService.getChildDetail(profile.id, paramsValidation.data.studentId);

      if (!detail) {
        return res.status(404).json({ success: false, message: 'Estudiante no encontrado o sin acceso' });
      }

      res.json(detail);
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener detalle del hijo');
    }
  }

  // Obtener calificaciones de un hijo
  async getChildGrades(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const paramsValidation = studentIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      const queryValidation = childGradesQuerySchema.safeParse(req.query);
      if (!queryValidation.success) return handleValidationError(res, queryValidation.error);

      const grades = await parentService.getChildGrades(
        profile.id,
        paramsValidation.data.studentId,
        queryValidation.data.period
      );

      res.json(grades);
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener calificaciones');
    }
  }

  // Obtener historial de actividad de un hijo
  async getChildActivity(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const paramsValidation = studentIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      const queryValidation = childActivityQuerySchema.safeParse(req.query);
      if (!queryValidation.success) return handleValidationError(res, queryValidation.error);

      const { startDate, endDate } = queryValidation.data;

      const activity = await parentService.getChildActivity(
        profile.id,
        paramsValidation.data.studentId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      res.json(activity);
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener actividad');
    }
  }

  // Obtener reporte completo de un hijo
  async getChildReport(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const paramsValidation = studentIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      const report = await parentService.getChildReport(profile.id, paramsValidation.data.studentId);
      res.json(report);
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener reporte del hijo');
    }
  }

  // Desvincular hijo
  async unlinkChild(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const paramsValidation = studentIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      const result = await parentService.unlinkChild(profile.id, paramsValidation.data.studentId);
      res.json({ success: true, data: result });
    } catch (error) {
      handleControllerError(res, error, 'Error al desvincular hijo');
    }
  }

  // Actualizar preferencias
  async updatePreferences(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const validation = updatePreferencesSchema.safeParse(req.body);
      if (!validation.success) return handleValidationError(res, validation.error);

      const result = await parentService.updatePreferences(profile.id, validation.data);
      res.json({ success: true, data: result });
    } catch (error) {
      handleControllerError(res, error, 'Error al actualizar preferencias');
    }
  }

  // Generar código de vinculación (para profesor) — IDOR protected
  async generateParentLinkCode(req: Request, res: Response) {
    try {
      const paramsValidation = studentIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      if (!(await ensureTeacherOwnsStudent(req, res, paramsValidation.data.studentId))) return;

      const code = await parentService.generateParentLinkCode(paramsValidation.data.studentId);
      res.json({ success: true, data: { code } });
    } catch (error) {
      handleControllerError(res, error, 'Error al generar código de vinculación');
    }
  }

  // Generar códigos de vinculación masivos (para profesor) — IDOR protected
  async generateBulkParentLinkCodes(req: Request, res: Response) {
    try {
      const paramsValidation = classroomIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      if (!(await ensureTeacherOwnsClassroom(req, res, paramsValidation.data.classroomId))) return;

      const result = await parentService.generateBulkParentLinkCodes(paramsValidation.data.classroomId);
      res.json({ success: true, data: result });
    } catch (error) {
      handleControllerError(res, error, 'Error al generar códigos masivos');
    }
  }

  // Obtener informe IA del estudiante (con cache 24h)
  async getAIReport(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const paramsValidation = studentIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      const report = await parentService.getAIReport(profile.id, paramsValidation.data.studentId);
      res.json({ success: true, data: report });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener informe IA');
    }
  }

  // Regenerar informe IA del estudiante (forzar nueva generación)
  async regenerateAIReport(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const paramsValidation = studentIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      const report = await parentService.getAIReport(profile.id, paramsValidation.data.studentId, true);
      res.json({ success: true, data: report });
    } catch (error) {
      handleControllerError(res, error, 'Error al regenerar informe IA');
    }
  }

  // Generar informe IA del estudiante (legacy)
  async generateAIReport(req: Request, res: Response) {
    try {
      const profile = await ensureParentProfile(req, res);
      if (!profile) return;

      const paramsValidation = studentIdParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) return handleValidationError(res, paramsValidation.error);

      const report = await parentService.generateAIReport(profile.id, paramsValidation.data.studentId);
      res.json(report);
    } catch (error) {
      handleControllerError(res, error, 'Error al generar informe IA');
    }
  }
}

export const parentController = new ParentController();
