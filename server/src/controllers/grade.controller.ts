import { Request, Response } from 'express';
import { z } from 'zod';
import { gradeService } from '../services/grade.service.js';
import { gradeExportService } from '../services/gradeExport.service.js';

type AuthRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

const BIMESTER_PERIOD_REGEX = /^\d{4}-B[1-4]$/;

const periodSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (value) => value === 'CURRENT' || BIMESTER_PERIOD_REGEX.test(value),
    'Periodo invalido. Usa CURRENT o el formato YYYY-B1..B4'
  );

const studentProfileParamsSchema = z.object({
  studentProfileId: z.string().trim().uuid('studentProfileId invalido'),
});

const classroomParamsSchema = z.object({
  classroomId: z.string().trim().uuid('classroomId invalido'),
});

const gradeParamsSchema = z.object({
  gradeId: z.string().trim().uuid('gradeId invalido'),
});

const periodQuerySchema = z.object({
  period: periodSchema.optional().default('CURRENT'),
});

const calculateStudentBodySchema = z.object({
  classroomId: z.string().trim().uuid('classroomId invalido'),
  period: periodSchema.optional().default('CURRENT'),
});

const calculateClassroomBodySchema = z.object({
  period: periodSchema.optional().default('CURRENT'),
});

const manualGradeBodySchema = z.object({
  manualScore: z.coerce.number().min(0, 'manualScore debe estar entre 0 y 100').max(100, 'manualScore debe estar entre 0 y 100'),
  manualNote: z.string().trim().max(1000, 'manualNote no puede exceder 1000 caracteres').optional(),
});

const bimesterStatusQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

const bimesterActionBodySchema = z.object({
  period: periodSchema,
});

const handleValidationError = (res: Response, error: z.ZodError) => {
  res.status(400).json({
    success: false,
    message: 'Datos invalidos',
    errors: error.errors,
  });
};

const handleControllerError = (res: Response, error: unknown, fallbackMessage: string) => {
  console.error(fallbackMessage, error);

  const message = error instanceof Error ? error.message : fallbackMessage;
  const normalizedMessage = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let statusCode = 500;
  if (normalizedMessage.includes('no encontrado')) {
    statusCode = 404;
  } else if (normalizedMessage.includes('sin acceso') || normalizedMessage.includes('no autorizado')) {
    statusCode = 403;
  } else if (normalizedMessage.includes('ya esta') || normalizedMessage.includes('ya está')) {
    statusCode = 409;
  } else if (
    normalizedMessage.includes('inval') ||
    normalizedMessage.includes('requerido') ||
    normalizedMessage.includes('debe') ||
    normalizedMessage.includes('formato')
  ) {
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? fallbackMessage : message,
  });
};

const ensureTeacherClassroomAccess = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role !== 'TEACHER') {
    res.status(403).json({ success: false, message: 'Sin acceso a este salon' });
    return false;
  }

  const hasAccess = await gradeService.verifyTeacherOwnsClassroom(user.id, classroomId);
  if (!hasAccess) {
    res.status(403).json({ success: false, message: 'Sin acceso a este salon' });
    return false;
  }

  return true;
};

const ensureTeacherStudentProfileAccess = async (
  req: Request,
  res: Response,
  studentProfileId: string
): Promise<string | null> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return null;
  }

  const classroomId = await gradeService.getClassroomIdByStudentProfile(studentProfileId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
    return null;
  }

  if (user.role === 'ADMIN') {
    return classroomId;
  }

  if (user.role !== 'TEACHER') {
    res.status(403).json({ success: false, message: 'Sin acceso a este estudiante' });
    return null;
  }

  const hasAccess = await gradeService.verifyTeacherOwnsClassroom(user.id, classroomId);
  if (!hasAccess) {
    res.status(403).json({ success: false, message: 'Sin acceso a este estudiante' });
    return null;
  }

  return classroomId;
};

const ensureTeacherGradeAccess = async (
  req: Request,
  res: Response,
  gradeId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  const classroomId = await gradeService.getClassroomIdByGrade(gradeId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Calificación no encontrada' });
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role !== 'TEACHER') {
    res.status(403).json({ success: false, message: 'Sin acceso a esta calificación' });
    return false;
  }

  const hasAccess = await gradeService.verifyTeacherOwnsClassroom(user.id, classroomId);
  if (!hasAccess) {
    res.status(403).json({ success: false, message: 'Sin acceso a esta calificación' });
    return false;
  }

  return true;
};

const ensureStudentGradeReadAccess = async (
  req: Request,
  res: Response,
  studentProfileId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  const role = user.role as AuthRole;
  if (role === 'ADMIN') {
    return true;
  }

  if (role === 'TEACHER') {
    return !!(await ensureTeacherStudentProfileAccess(req, res, studentProfileId));
  }

  if (role === 'STUDENT') {
    const hasAccess = await gradeService.verifyStudentOwnsProfile(user.id, studentProfileId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Sin acceso a este estudiante' });
      return false;
    }
    return true;
  }

  res.status(403).json({ success: false, message: 'Sin acceso a este estudiante' });
  return false;
};

const ensureBimesterReadAccess = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  const role = user.role as AuthRole;
  if (role === 'ADMIN') {
    return true;
  }

  if (role === 'TEACHER') {
    return ensureTeacherClassroomAccess(req, res, classroomId);
  }

  if (role === 'STUDENT') {
    const hasAccess = await gradeService.verifyStudentInClassroom(user.id, classroomId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Sin acceso a este salon' });
      return false;
    }
    return true;
  }

  res.status(403).json({ success: false, message: 'Sin acceso a este salon' });
  return false;
};

export class GradeController {
  
  /**
   * Obtiene las calificaciones de un estudiante
   * GET /api/grades/student/:studentProfileId
   */
  async getStudentGrades(req: Request, res: Response) {
    try {
      const paramsValidation = studentProfileParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const queryValidation = periodQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return handleValidationError(res, queryValidation.error);
      }

      const { studentProfileId } = paramsValidation.data;
      const { period } = queryValidation.data;

      if (!(await ensureStudentGradeReadAccess(req, res, studentProfileId))) {
        return;
      }

      const grades = await gradeService.getStudentGrades(
        studentProfileId,
        period
      );

      res.json(grades);
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener calificaciones del estudiante');
    }
  }

  /**
   * Obtiene las calificaciones de toda una clase
   * GET /api/grades/classroom/:classroomId
   */
  async getClassroomGrades(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const queryValidation = periodQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return handleValidationError(res, queryValidation.error);
      }

      const { classroomId } = paramsValidation.data;
      const { period } = queryValidation.data;

      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) {
        return;
      }

      const grades = await gradeService.getClassroomGrades(
        classroomId,
        period
      );

      res.json(grades);
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener calificaciones del salon');
    }
  }

  /**
   * Calcula las calificaciones de un estudiante específico
   * POST /api/grades/calculate/student/:studentProfileId
   */
  async calculateStudentGrades(req: Request, res: Response) {
    try {
      const paramsValidation = studentProfileParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const bodyValidation = calculateStudentBodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return handleValidationError(res, bodyValidation.error);
      }

      const { studentProfileId } = paramsValidation.data;
      const { classroomId, period } = bodyValidation.data;

      const studentClassroomId = await ensureTeacherStudentProfileAccess(req, res, studentProfileId);
      if (!studentClassroomId) {
        return;
      }

      if (studentClassroomId !== classroomId) {
        return res.status(400).json({
          success: false,
          message: 'El estudiante no pertenece al classroomId enviado',
        });
      }

      const results = await gradeService.calculateStudentGrades(
        classroomId,
        studentProfileId,
        period
      );

      res.json({
        success: true,
        studentProfileId,
        grades: results,
      });
    } catch (error) {
      handleControllerError(res, error, 'Error al calcular calificaciones del estudiante');
    }
  }

  /**
   * Recalcula las calificaciones de toda una clase
   * POST /api/grades/calculate/classroom/:classroomId
   */
  async recalculateClassroomGrades(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const bodyValidation = calculateClassroomBodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return handleValidationError(res, bodyValidation.error);
      }

      const { classroomId } = paramsValidation.data;
      const { period } = bodyValidation.data;

      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) {
        return;
      }

      const results = await gradeService.recalculateClassroomGrades(
        classroomId,
        period
      );

      res.json({
        success: true,
        classroomId,
        studentsProcessed: results.length,
        results,
      });
    } catch (error) {
      handleControllerError(res, error, 'Error al recalcular calificaciones del salon');
    }
  }

  /**
   * Establece una calificación manual (override del profesor)
   * PUT /api/grades/:gradeId/manual
   */
  async setManualGrade(req: Request, res: Response) {
    try {
      const paramsValidation = gradeParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const bodyValidation = manualGradeBodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return handleValidationError(res, bodyValidation.error);
      }

      const { gradeId } = paramsValidation.data;
      const { manualScore, manualNote } = bodyValidation.data;

      if (!(await ensureTeacherGradeAccess(req, res, gradeId))) {
        return;
      }

      const result = await gradeService.setManualGrade(
        gradeId,
        manualScore,
        manualNote
      );

      res.json(result);
    } catch (error) {
      handleControllerError(res, error, 'Error al establecer calificación manual');
    }
  }

  /**
   * Elimina la calificación manual y restaura el cálculo automático
   * DELETE /api/grades/:gradeId/manual
   */
  async clearManualGrade(req: Request, res: Response) {
    try {
      const paramsValidation = gradeParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const { gradeId } = paramsValidation.data;

      if (!(await ensureTeacherGradeAccess(req, res, gradeId))) {
        return;
      }

      const result = await gradeService.clearManualGrade(gradeId);

      res.json(result);
    } catch (error) {
      handleControllerError(res, error, 'Error al restaurar calificación automática');
    }
  }

  /**
   * Exporta el libro de calificaciones en PDF
   * GET /api/grades/export/pdf/:classroomId
   */
  async exportPDF(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const queryValidation = periodQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return handleValidationError(res, queryValidation.error);
      }

      const { classroomId } = paramsValidation.data;
      const { period } = queryValidation.data;

      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) {
        return;
      }

      const pdfBuffer = await gradeExportService.generateGradebookPDF(
        classroomId,
        period
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=libro-calificaciones-${classroomId}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      handleControllerError(res, error, 'Error al exportar PDF de calificaciones');
    }
  }

  /**
   * Exporta el libro de calificaciones en Excel (formato SIAGIE)
   * GET /api/grades/export/excel/:classroomId
   */
  async exportExcel(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const queryValidation = periodQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return handleValidationError(res, queryValidation.error);
      }

      const { classroomId } = paramsValidation.data;
      const { period } = queryValidation.data;

      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) {
        return;
      }

      const excelBuffer = await gradeExportService.generateGradebookExcel(
        classroomId,
        period
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=calificaciones-${classroomId}.xlsx`);
      res.send(excelBuffer);
    } catch (error) {
      handleControllerError(res, error, 'Error al exportar Excel de calificaciones');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GESTIÓN DE BIMESTRES
  // ═══════════════════════════════════════════════════════════

  /**
   * Obtiene el estado de los bimestres
   * GET /api/grades/bimesters/:classroomId
   */
  async getBimesterStatus(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const queryValidation = bimesterStatusQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return handleValidationError(res, queryValidation.error);
      }

      const { classroomId } = paramsValidation.data;
      const { year } = queryValidation.data;

      if (!(await ensureBimesterReadAccess(req, res, classroomId))) {
        return;
      }

      const status = await gradeService.getBimesterStatus(
        classroomId, 
        year
      );

      res.json(status);
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener estado de bimestres');
    }
  }

  /**
   * Establece el bimestre actual
   * PUT /api/grades/bimesters/:classroomId/current
   */
  async setCurrentBimester(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const bodyValidation = bimesterActionBodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return handleValidationError(res, bodyValidation.error);
      }

      const { classroomId } = paramsValidation.data;
      const { period } = bodyValidation.data;

      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) {
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const result = await gradeService.setCurrentBimester(classroomId, period, userId);
      res.json(result);
    } catch (error) {
      handleControllerError(res, error, 'Error al establecer bimestre actual');
    }
  }

  /**
   * Cierra un bimestre
   * POST /api/grades/bimesters/:classroomId/close
   */
  async closeBimester(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const bodyValidation = bimesterActionBodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return handleValidationError(res, bodyValidation.error);
      }

      const { classroomId } = paramsValidation.data;
      const { period } = bodyValidation.data;

      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) {
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const result = await gradeService.closeBimester(classroomId, period, userId);
      res.json(result);
    } catch (error) {
      handleControllerError(res, error, 'Error al cerrar bimestre');
    }
  }

  /**
   * Reabre un bimestre cerrado
   * POST /api/grades/bimesters/:classroomId/reopen
   */
  async reopenBimester(req: Request, res: Response) {
    try {
      const paramsValidation = classroomParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return handleValidationError(res, paramsValidation.error);
      }

      const bodyValidation = bimesterActionBodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return handleValidationError(res, bodyValidation.error);
      }

      const { classroomId } = paramsValidation.data;
      const { period } = bodyValidation.data;

      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) {
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }

      const result = await gradeService.reopenBimester(classroomId, period, userId);
      res.json(result);
    } catch (error) {
      handleControllerError(res, error, 'Error al reabrir bimestre');
    }
  }
}

export const gradeController = new GradeController();
