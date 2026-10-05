import type { Request, Response } from 'express';
import { z } from 'zod';
import { schoolRosterBuilderService, type Decision, type Mapping } from '../services/schoolRosterBuilder.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';
import { cleanText } from '../utils/textClean.js';

const nameSchema = z.object({
  lastNames: z.string().max(200).transform(cleanText).refine((v) => v.length <= 100, 'Apellidos: hasta 100 caracteres'),
  firstNames: z.string().max(200).transform(cleanText)
    .refine((v) => v.length >= 1 && v.length <= 100, 'Nombres: de 1 a 100 caracteres')
    .refine((v) => /\p{L}/u.test(v), 'Nombres: escribe al menos una letra'),
}).strict();

const mappingSchema = z.object({
  mapping: z.record(z.string().uuid(), z.object({ sectionId: z.string().uuid().nullable() }).strict())
    .refine((value) => Object.keys(value).length <= 500, 'Son demasiadas clases'),
}).strict();

const decisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('SAFE'), name: nameSchema.optional() }).strict(),
  z.object({ kind: z.literal('PROBABLE'), action: z.enum(['merge', 'split']), name: nameSchema.optional() }).strict(),
  z.object({
    kind: z.literal('REVIEW'),
    assignments: z.record(z.string().uuid(), z.union([z.number().int().min(0).max(50), z.literal('new')])),
    names: z.record(z.string().regex(/^\d{1,2}$/), nameSchema).optional(),
  }).strict(),
]);

const decisionsSchema = z.object({
  decisions: z.record(z.string().regex(/^[0-9a-f]{16}$/), decisionSchema)
    .refine((value) => Object.keys(value).length <= 3000, 'Son demasiadas decisiones'),
}).strict();

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

const scope = async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return null;
  const yearId = idSchema.safeParse(req.params.yearId);
  if (!yearId.success) {
    res.status(404).json({ success: false, message: 'Año escolar no encontrado' });
    return null;
  }
  return { schoolId, yearId: yearId.data };
};

export const schoolRosterBuilderController = {
  // GET /schools/:schoolId/years/:yearId/roster-builder — clases, sugerencias y borrador
  async overview(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      res.json({ success: true, data: await schoolRosterBuilderService.overview(s.schoolId, s.yearId) });
    } catch (error) {
      return sendError(res, error, 'Error al preparar el armado del padrón');
    }
  },

  // PUT /schools/:schoolId/years/:yearId/roster-builder/mapping — clase → sección (o null: no es de una sección)
  async saveMapping(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const { mapping } = mappingSchema.parse(req.body);
      await schoolRosterBuilderService.saveMapping(s.schoolId, s.yearId, req.user!.id, mapping as Mapping);
      res.json({ success: true, message: 'Mapeo guardado' });
    } catch (error) {
      return sendError(res, error, 'Error al guardar el mapeo');
    }
  },

  // GET /schools/:schoolId/years/:yearId/roster-builder/proposal — uniones propuestas
  async proposal(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      res.json({ success: true, data: await schoolRosterBuilderService.proposal(s.schoolId, s.yearId) });
    } catch (error) {
      return sendError(res, error, 'Error al proponer las uniones');
    }
  },

  // PUT /schools/:schoolId/years/:yearId/roster-builder/decisions — decisiones tomadas (para seguir después)
  async saveDecisions(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const { decisions } = decisionsSchema.parse(req.body);
      await schoolRosterBuilderService.saveDecisions(s.schoolId, s.yearId, req.user!.id, decisions as Record<string, Decision>);
      res.json({ success: true, message: 'Decisiones guardadas' });
    } catch (error) {
      return sendError(res, error, 'Error al guardar las decisiones');
    }
  },

  // POST /schools/:schoolId/years/:yearId/roster-builder/confirm — crea el padrón
  async confirm(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const result = await schoolRosterBuilderService.confirm(s.schoolId, s.yearId, req.user!.id);
      await auditRequest(req, {
        action: 'school.roster_built',
        schoolId: s.schoolId,
        target: { type: 'school_year', id: s.yearId },
        metadata: { created: result.created, linked: result.linked },
      });
      res.json({
        success: true,
        data: result,
        message: `Padrón armado: ${result.created} ${result.created === 1 ? 'estudiante nuevo' : 'estudiantes nuevos'} y ${result.linked} ${result.linked === 1 ? 'perfil vinculado' : 'perfiles vinculados'}`,
      });
    } catch (error) {
      return sendError(res, error, 'Error al armar el padrón');
    }
  },
};
