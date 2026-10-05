import type { Request, Response } from 'express';
import { z } from 'zod';
import { cleanSectionName, schoolSectionService, sectionDisplayName } from '../services/schoolSection.service.js';
import { SCHOOL_LEVELS } from '../services/schoolYear.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES, SCHOOL_MEMBER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

const nameSchema = z.string().max(120).transform(cleanSectionName)
  .refine((value) => value.length >= 1 && value.length <= 40, 'El nombre de la sección tiene de 1 a 40 caracteres');

const bulkSchema = z.object({
  items: z.array(z.object({
    level: z.enum(SCHOOL_LEVELS, { errorMap: () => ({ message: 'Nivel inválido' }) }),
    grade: z.number().int().min(1).max(6),
    name: nameSchema,
  }).strict()).min(1, 'Elige al menos una sección').max(60, 'Son demasiadas secciones de una vez: máximo 60'),
}).strict();

const patchSchema = z.object({
  name: nameSchema.optional(),
  shift: z.enum(['MORNING', 'AFTERNOON'], { errorMap: () => ({ message: 'Turno inválido' }) }).optional(),
  tutorUserId: z.string().uuid().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No hay nada que cambiar');

const idSchema = z.string().uuid();

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return res.status(400).json({ success: false, message: !issue || issue.code === 'unrecognized_keys' ? 'Datos inválidos' : issue.message });
  }
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

const notFound = (res: Response, message: string) => res.status(404).json({ success: false, message });

export const schoolSectionController = {
  // GET /schools/:schoolId/years/:yearId/sections
  async list(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MEMBER_ROLES))) return;
      const yearId = idSchema.safeParse(req.params.yearId);
      if (!yearId.success) return notFound(res, 'Año escolar no encontrado');
      res.json({ success: true, data: await schoolSectionService.list(schoolId, yearId.data) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener las secciones');
    }
  },

  // POST /schools/:schoolId/years/:yearId/sections — varias de una vez (administración)
  async createMany(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = idSchema.safeParse(req.params.yearId);
      if (!yearId.success) return notFound(res, 'Año escolar no encontrado');
      const { items } = bulkSchema.parse(req.body);
      const result = await schoolSectionService.createMany(schoolId, yearId.data, items);
      if (result.created.length > 0) {
        await auditRequest(req, {
          action: 'school.sections_created',
          schoolId,
          target: { type: 'school_year', id: yearId.data },
          metadata: { created: result.created.length, skipped: result.skipped.length },
        });
      }
      const message = result.created.length === 0
        ? 'Esas secciones ya existían'
        : `${result.created.length} ${result.created.length === 1 ? 'sección creada' : 'secciones creadas'}`;
      res.status(result.created.length > 0 ? 201 : 200).json({ success: true, data: result, message });
    } catch (error) {
      return sendError(res, error, 'Error al crear las secciones');
    }
  },

  // PATCH /schools/:schoolId/sections/:sectionId — nombre, turno o tutoría (administración)
  async update(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const sectionId = idSchema.safeParse(req.params.sectionId);
      if (!sectionId.success) return notFound(res, 'Sección no encontrada');
      const patch = patchSchema.parse(req.body);
      const { section, before } = await schoolSectionService.update(schoolId, sectionId.data, patch);
      const changed = [
        patch.name !== undefined && patch.name !== before.name ? 'name' : null,
        patch.shift !== undefined && patch.shift !== before.shift ? 'shift' : null,
        patch.tutorUserId !== undefined && patch.tutorUserId !== before.tutorUserId ? 'tutor' : null,
      ].filter(Boolean).join(',');
      if (changed) {
        await auditRequest(req, {
          action: 'school.section_updated',
          schoolId,
          target: { type: 'school_section', id: section.id },
          metadata: { fields: changed, ...(changed.includes('tutor') ? { tutorUserId: section.tutor?.userId ?? null } : {}) },
        });
      }
      res.json({ success: true, data: section });
    } catch (error) {
      return sendError(res, error, 'Error al guardar la sección');
    }
  },

  // DELETE /schools/:schoolId/sections/:sectionId (administración)
  async remove(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const sectionId = idSchema.safeParse(req.params.sectionId);
      if (!sectionId.success) return notFound(res, 'Sección no encontrada');
      const removed = await schoolSectionService.remove(schoolId, sectionId.data);
      await auditRequest(req, {
        action: 'school.section_deleted',
        schoolId,
        target: { type: 'school_section', id: removed.id },
        metadata: { section: sectionDisplayName(removed.level, removed.grade, removed.name) },
      });
      res.json({ success: true, message: `Sección ${sectionDisplayName(removed.level, removed.grade, removed.name)} quitada` });
    } catch (error) {
      return sendError(res, error, 'Error al quitar la sección');
    }
  },
};
