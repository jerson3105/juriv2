import type { Request, Response } from 'express';
import { z } from 'zod';
import { schoolYearService, SCHOOL_LEVELS } from '../services/schoolYear.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES, SCHOOL_MEMBER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

/** Fecha real en AAAA-MM-DD (rechaza el 30 de febrero). */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Fecha inválida');

const yearBodySchema = z.object({
  startsOn: isoDate,
  endsOn: isoDate,
  periodType: z.enum(['BIMESTER', 'TRIMESTER'], { errorMap: () => ({ message: 'Elige bimestres o trimestres' }) }),
  periods: z.array(z.object({ code: z.string().regex(/^[BT][1-4]$/), startsOn: isoDate, endsOn: isoDate }).strict()).min(3, 'Faltan periodos').max(4, 'Sobran periodos'),
  levels: z.array(z.object({
    level: z.enum(SCHOOL_LEVELS, { errorMap: () => ({ message: 'Nivel inválido' }) }),
    gradeScale: z.enum(['LITERAL', 'VIGESIMAL'], { errorMap: () => ({ message: 'Escala inválida' }) }),
  }).strict()).min(1, 'Elige al menos un nivel').max(3, 'Hay un nivel repetido'),
}).strict();

const createYearSchema = yearBodySchema.extend({
  name: z.string().regex(/^\d{4}$/, 'El año escolar se nombra con su año, por ejemplo 2026'),
}).strict();

const yearIdSchema = z.string().uuid();

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return res.status(400).json({ success: false, message: !issue || issue.code === 'unrecognized_keys' ? 'Datos inválidos' : issue.message });
  }
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

export const schoolYearController = {
  // GET /schools/:schoolId/years — años de la escuela (la ven todos sus miembros)
  async list(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MEMBER_ROLES))) return;
      res.json({ success: true, data: await schoolYearService.list(schoolId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener los años escolares');
    }
  },

  // GET /schools/:schoolId/years/:yearId — fechas, periodos y niveles
  async get(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MEMBER_ROLES))) return;
      const yearId = yearIdSchema.safeParse(req.params.yearId);
      if (!yearId.success) return res.status(404).json({ success: false, message: 'Año escolar no encontrado' });
      res.json({ success: true, data: await schoolYearService.get(schoolId, yearId.data) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener el año escolar');
    }
  },

  // POST /schools/:schoolId/years — el primer año de la escuela (administración)
  async create(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const data = await schoolYearService.create(schoolId, req.user!.id, createYearSchema.parse(req.body));
      await auditRequest(req, {
        action: 'school.year_created',
        schoolId,
        target: { type: 'school_year', id: data.id },
        metadata: { name: data.name, periodType: data.periodType, levels: data.levels.map((l) => l.level).join(',') },
      });
      res.status(201).json({ success: true, data, message: `Año escolar ${data.name} creado` });
    } catch (error) {
      return sendError(res, error, 'Error al crear el año escolar');
    }
  },

  // PUT /schools/:schoolId/years/:yearId — fechas, periodos y niveles (administración)
  async update(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = yearIdSchema.safeParse(req.params.yearId);
      if (!yearId.success) return res.status(404).json({ success: false, message: 'Año escolar no encontrado' });
      const data = await schoolYearService.update(schoolId, yearId.data, yearBodySchema.parse(req.body));
      await auditRequest(req, {
        action: 'school.year_updated',
        schoolId,
        target: { type: 'school_year', id: data.id },
        metadata: { periodType: data.periodType, levels: data.levels.map((l) => l.level).join(',') },
      });
      res.json({ success: true, data, message: 'Año escolar guardado' });
    } catch (error) {
      return sendError(res, error, 'Error al guardar el año escolar');
    }
  },
};
