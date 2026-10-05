import type { Request, Response } from 'express';
import { z } from 'zod';
import { schoolRosterService, type RosterFilter } from '../services/schoolRoster.service.js';
import { schoolStudentMoveService, TRANSFER_REASONS, WITHDRAWAL_REASONS } from '../services/schoolStudentMove.service.js';
import { SCHOOL_LEVELS } from '../services/schoolYear.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';
import { DOCUMENT_TYPES } from '../utils/personalDocument.js';
import { cleanText } from '../utils/textClean.js';

/** Motivos de «Mostrar» el documento: una lista fija (un texto libre podría llevar datos personales al registro). */
export const REVEAL_REASONS = ['SIAGIE', 'IDENTITY', 'CORRECTION', 'FAMILY', 'OTHER'] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Fecha inválida');

/** Fecha de nacimiento creíble para un estudiante: entre 2 y 30 años. */
const birthDateSchema = isoDate.refine((value) => {
  const years = (Date.now() - Date.parse(`${value}T00:00:00Z`)) / (365.25 * 86_400_000);
  return years >= 2 && years <= 30;
}, 'Revisa la fecha de nacimiento');

const personName = (label: string) => z.string().max(200).transform(cleanText)
  .refine((value) => value.length >= 1 && value.length <= 100, `${label}: de 1 a 100 caracteres`)
  .refine((value) => /\p{L}/u.test(value), `${label}: escribe al menos una letra`);

const studentFields = {
  firstNames: personName('Nombres'),
  lastNames: personName('Apellidos'),
  document: z.object({
    type: z.enum(DOCUMENT_TYPES, { errorMap: () => ({ message: 'Tipo de documento inválido' }) }),
    number: z.string().max(40),
  }).strict().nullable().optional(),
  birthDate: birthDateSchema.nullable().optional(),
  email: z.string().trim().toLowerCase().email('Escribe un correo válido').max(255).nullable().optional(),
  siagieCode: z.string().trim().toUpperCase().regex(/^[0-9A-Z]{4,20}$/, 'El código SIAGIE tiene de 4 a 20 letras o números').nullable().optional(),
  sectionId: z.string().uuid().nullable().optional(),
};
const createSchema = z.object(studentFields).strict();
const patchSchema = z.object({
  ...studentFields,
  firstNames: studentFields.firstNames.optional(),
  lastNames: studentFields.lastNames.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No hay nada que cambiar');

const listSchema = z.object({
  filter: z.enum(['all', 'no_section', 'incomplete', 'withdrawn']).default('all'),
  level: z.enum(SCHOOL_LEVELS).optional(),
  grade: z.coerce.number().int().min(1).max(6).optional(),
  sectionId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

const revealSchema = z.object({
  reason: z.enum(REVEAL_REASONS, { errorMap: () => ({ message: 'Elige el motivo' }) }),
}).strict();

const idSchema = z.string().uuid();

// Traslado, retiro y reincorporación: motivo de una lista fija; la nota es interna (solo la administración la ve).
const moveNote = z.string().max(255, 'La nota: hasta 255 caracteres').nullable().optional();
const sectionIdSchema = z.string({ required_error: 'Elige la sección' }).uuid('Elige la sección');
const transferSchema = z.object({
  sectionId: sectionIdSchema,
  effectiveDate: isoDate,
  reason: z.enum(TRANSFER_REASONS, { errorMap: () => ({ message: 'Elige el motivo del traslado' }) }),
  note: moveNote,
}).strict();
const withdrawSchema = z.object({
  effectiveDate: isoDate,
  reason: z.enum(WITHDRAWAL_REASONS, { errorMap: () => ({ message: 'Elige el motivo del retiro' }) }),
  note: moveNote,
}).strict();
const reinstateSchema = z.object({ sectionId: sectionIdSchema.nullable().optional(), effectiveDate: isoDate, note: moveNote }).strict();
const undoSchema = z.object({ moveId: z.string().uuid('Traslado no encontrado') }).strict();

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return res.status(400).json({ success: false, message: !issue || issue.code === 'unrecognized_keys' ? 'Datos inválidos' : issue.message });
  }
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

/** Escuela y año de la ruta, con la administración verificada. */
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

const studentIdOf = (req: Request, res: Response) => {
  const studentId = idSchema.safeParse(req.params.studentId);
  if (!studentId.success) res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
  return studentId.success ? studentId.data : null;
};

export const schoolRosterController = {
  // GET /schools/:schoolId/years/:yearId/students — padrón con filtros (administración)
  async list(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const params = listSchema.parse(req.query);
      res.json({ success: true, data: await schoolRosterService.list(scope.schoolId, scope.yearId, { ...params, filter: params.filter as RosterFilter }) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener el padrón');
    }
  },

  // GET /schools/:schoolId/years/:yearId/students/:studentId — ficha
  async get(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const studentId = studentIdOf(req, res);
      if (!studentId) return;
      res.json({ success: true, data: await schoolRosterService.get(scope.schoolId, scope.yearId, studentId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener la ficha');
    }
  },

  // POST /schools/:schoolId/years/:yearId/students — alta manual
  async create(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const input = createSchema.parse(req.body);
      const data = await schoolRosterService.create(scope.schoolId, scope.yearId, req.user!.id, input);
      await auditRequest(req, {
        action: 'student.enrolled',
        schoolId: scope.schoolId,
        target: { type: 'school_student', id: data.student.id },
        metadata: { withDocument: data.student.hasDocument, withSection: !!data.enrollment?.section },
      });
      res.status(201).json({ success: true, data, message: 'Estudiante agregado al padrón' });
    } catch (error) {
      return sendError(res, error, 'Error al agregar al estudiante');
    }
  },

  // PATCH /schools/:schoolId/years/:yearId/students/:studentId — datos (y sección si aún no tiene)
  async update(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const studentId = studentIdOf(req, res);
      if (!studentId) return;
      const patch = patchSchema.parse(req.body);
      const { detail, changed } = await schoolRosterService.update(scope.schoolId, scope.yearId, studentId, req.user!.id, patch);
      if (changed.length > 0) {
        await auditRequest(req, {
          action: 'student.data_updated',
          schoolId: scope.schoolId,
          target: { type: 'school_student', id: studentId },
          metadata: { fields: changed.join(',') },
        });
      }
      res.json({ success: true, data: detail, message: changed.length > 0 ? 'Datos guardados' : 'No había cambios' });
    } catch (error) {
      return sendError(res, error, 'Error al guardar los datos');
    }
  },

  // GET /schools/:schoolId/years/:yearId/students/:studentId/moves — sus movimientos y si se puede deshacer el último traslado
  async moves(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const studentId = studentIdOf(req, res);
      if (!studentId) return;
      const [history, undo] = await Promise.all([
        schoolStudentMoveService.history(scope.schoolId, studentId),
        schoolStudentMoveService.undoState(scope.schoolId, scope.yearId, studentId),
      ]);
      res.json({ success: true, data: { history, undo } });
    } catch (error) {
      return sendError(res, error, 'Error al obtener sus movimientos');
    }
  },

  // GET /schools/:schoolId/years/:yearId/students/:studentId/transfer-preview?sectionId= — «Qué cambia»
  async transferPreview(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const studentId = studentIdOf(req, res);
      if (!studentId) return;
      const { sectionId } = z.object({ sectionId: sectionIdSchema }).parse(req.query);
      res.json({ success: true, data: await schoolStudentMoveService.preview(scope.schoolId, scope.yearId, studentId, sectionId) });
    } catch (error) {
      return sendError(res, error, 'Error al preparar el traslado');
    }
  },

  // POST /schools/:schoolId/years/:yearId/students/:studentId/transfer — trasladar a otra sección
  async transfer(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const studentId = studentIdOf(req, res);
      if (!studentId) return;
      const input = transferSchema.parse(req.body);
      const result = await schoolStudentMoveService.transfer(scope.schoolId, scope.yearId, studentId, req.user!.id, input);
      await auditRequest(req, {
        action: 'student.transferred',
        schoolId: scope.schoolId,
        target: { type: 'school_student', id: studentId },
        metadata: { moveId: result.moveId, toSection: input.sectionId, reason: input.reason },
      });
      res.json({ success: true, data: await schoolRosterService.get(scope.schoolId, scope.yearId, studentId), message: 'Listo: ya está en su sección nueva' });
    } catch (error) {
      return sendError(res, error, 'Error al trasladar');
    }
  },

  // POST /schools/:schoolId/years/:yearId/students/:studentId/transfer/undo — deshacer su último traslado
  async undoTransfer(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const studentId = studentIdOf(req, res);
      if (!studentId) return;
      const { moveId } = undoSchema.parse(req.body);
      await schoolStudentMoveService.undoTransfer(scope.schoolId, scope.yearId, studentId, req.user!.id, moveId);
      await auditRequest(req, {
        action: 'student.transfer_undone',
        schoolId: scope.schoolId,
        target: { type: 'school_student', id: studentId },
        metadata: { moveId },
      });
      res.json({ success: true, data: await schoolRosterService.get(scope.schoolId, scope.yearId, studentId), message: 'Traslado deshecho: volvió a su sección' });
    } catch (error) {
      return sendError(res, error, 'Error al deshacer el traslado');
    }
  },

  // POST /schools/:schoolId/years/:yearId/students/:studentId/withdraw — retiro (baja blanda)
  async withdraw(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const studentId = studentIdOf(req, res);
      if (!studentId) return;
      const input = withdrawSchema.parse(req.body);
      const result = await schoolStudentMoveService.withdraw(scope.schoolId, scope.yearId, studentId, req.user!.id, input);
      await auditRequest(req, {
        action: 'student.withdrawn',
        schoolId: scope.schoolId,
        target: { type: 'school_student', id: studentId },
        metadata: { moveId: result.moveId, reason: input.reason, classes: result.classes },
      });
      res.json({ success: true, data: await schoolRosterService.get(scope.schoolId, scope.yearId, studentId), message: 'Retiro registrado' });
    } catch (error) {
      return sendError(res, error, 'Error al registrar el retiro');
    }
  },

  // POST /schools/:schoolId/years/:yearId/students/:studentId/reinstate — reincorporación
  async reinstate(req: Request, res: Response) {
    try {
      const scope = await managerScope(req, res);
      if (!scope) return;
      const studentId = studentIdOf(req, res);
      if (!studentId) return;
      const input = reinstateSchema.parse(req.body);
      const result = await schoolStudentMoveService.reinstate(scope.schoolId, scope.yearId, studentId, req.user!.id, input);
      await auditRequest(req, {
        action: 'student.reinstated',
        schoolId: scope.schoolId,
        target: { type: 'school_student', id: studentId },
        metadata: { moveId: result.moveId, toSection: input.sectionId ?? null, recovered: result.recovered },
      });
      res.json({ success: true, data: await schoolRosterService.get(scope.schoolId, scope.yearId, studentId), message: 'Volvió al colegio' });
    } catch (error) {
      return sendError(res, error, 'Error al reincorporar');
    }
  },

  // POST /schools/:schoolId/students/:studentId/document/reveal — «Mostrar» el documento (motivo obligatorio)
  async revealDocument(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const studentId = studentIdOf(req, res);
      if (!studentId) return;
      const { reason } = revealSchema.parse(req.body);
      const data = await schoolRosterService.revealDocument(schoolId, studentId);
      await auditRequest(req, {
        action: 'student.document_revealed',
        schoolId,
        target: { type: 'school_student', id: studentId },
        metadata: { reason },
      });
      // Nada de caché intermedia para un dato así.
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data });
    } catch (error) {
      return sendError(res, error, 'Error al mostrar el documento');
    }
  },
};
