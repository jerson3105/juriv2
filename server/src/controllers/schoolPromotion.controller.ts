import type { Request, Response } from 'express';
import { z } from 'zod';
import { FINAL_SITUATIONS, schoolPromotionService } from '../services/schoolPromotion.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

/** Promoción y cierre del año: solo la administración del colegio (sin atajo para el ADMIN de la plataforma). */

const idSchema = z.string().uuid();
const sectionChoiceSchema = z.object({ target: z.union([idSchema, z.literal('GRADUATE')]).nullable() }).strict();
const studentChoiceSchema = z.object({
  situation: z.enum(FINAL_SITUATIONS, { errorMap: () => ({ message: 'Elige su situación' }) }).nullable(),
  targetSectionId: idSchema.nullable().optional(),
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

/** Escuela y año, con la administración verificada. */
const managerScope = async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return null;
  const yearId = idSchema.safeParse(req.params.yearId);
  if (!yearId.success) {
    res.status(404).json({ success: false, message: 'Año escolar no encontrado' });
    return null;
  }
  return { schoolId, yearId: yearId.data };
};

export const schoolPromotionController = {
  // GET /schools/:schoolId/years/:yearId/promotion — destinos por sección, conteos y si se puede cerrar
  async overview(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      res.json({ success: true, data: await schoolPromotionService.overview(s.schoolId, s.yearId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener la promoción');
    }
  },

  // GET /schools/:schoolId/years/:yearId/promotion/sections/:sectionId/students — «sin-seccion» para los que no tienen
  async sectionStudents(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const raw = req.params.sectionId;
      const sectionId = raw === 'sin-seccion' ? null : idSchema.safeParse(raw).success ? raw : undefined;
      if (sectionId === undefined) return res.status(404).json({ success: false, message: 'Sección no encontrada' });
      res.json({ success: true, data: await schoolPromotionService.sectionStudents(s.schoolId, s.yearId, sectionId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener los estudiantes');
    }
  },

  // PUT /schools/:schoolId/years/:yearId/promotion/sections/:sectionId — su destino (sección, «egresan» o por defecto)
  async setSection(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const sectionId = idSchema.safeParse(req.params.sectionId);
      if (!sectionId.success) return res.status(404).json({ success: false, message: 'Sección no encontrada' });
      const body = sectionChoiceSchema.parse(req.body);
      await schoolPromotionService.setSectionDestination(s.schoolId, s.yearId, sectionId.data, req.user!.id, body);
      await auditRequest(req, {
        action: 'school.promotion_updated', schoolId: s.schoolId, target: { type: 'school_section', id: sectionId.data },
        metadata: { kind: 'section', destination: body.target === 'GRADUATE' ? 'GRADUATE' : body.target ? 'SECTION' : 'DEFAULT' },
      });
      res.json({ success: true, message: 'Destino guardado' });
    } catch (error) {
      return sendError(res, error, 'Error al guardar el destino');
    }
  },

  // PUT /schools/:schoolId/years/:yearId/promotion/students/:studentId — su situación y su sección del año siguiente
  async setStudent(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const studentId = idSchema.safeParse(req.params.studentId);
      if (!studentId.success) return res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
      const body = studentChoiceSchema.parse(req.body);
      const data = await schoolPromotionService.setStudentSituation(s.schoolId, s.yearId, studentId.data, req.user!.id, body);
      await auditRequest(req, {
        action: 'school.promotion_updated', schoolId: s.schoolId, target: { type: 'school_student', id: studentId.data },
        metadata: { kind: 'student', situation: body.situation ?? 'DEFAULT', withSection: !!body.targetSectionId },
      });
      res.json({ success: true, data });
    } catch (error) {
      return sendError(res, error, 'Error al guardar la situación');
    }
  },

  // POST /schools/:schoolId/years/:yearId/close — cerrar el año (promoción, archivo de sus clases)
  async close(req: Request, res: Response) {
    try {
      const s = await managerScope(req, res);
      if (!s) return;
      const data = await schoolPromotionService.close(s.schoolId, s.yearId, req.user!.id);
      await auditRequest(req, {
        action: 'school.year_closed', schoolId: s.schoolId, target: { type: 'school_year', id: s.yearId },
        metadata: { ...data.counts, archived: data.archived },
      });
      res.json({ success: true, data, message: `${data.year} cerrado: sus estudiantes ya están en ${data.target}` });
    } catch (error) {
      return sendError(res, error, 'Error al cerrar el año');
    }
  },
};
