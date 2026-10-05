import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { FIX_VALUE_FIELDS, schoolRosterImportService } from '../services/schoolRosterImport.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';
import { IMPORT_FIELDS } from '../utils/rosterImportParsing.js';

/** Un padrón de un colegio grande en .xlsx pesa unos cientos de KB: 2 MB sobra. */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

// En memoria: el archivo se revisa (bomba zip, filas, columnas) y se guarda cifrado; nunca toca el disco.
// defParamCharset: los nombres de archivo con tildes llegan bien.
const rosterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1, fields: 2, fieldSize: 1000, parts: 3 },
  defParamCharset: 'utf8',
} as multer.Options);

const mappingSchema = z.object({
  mapping: z.array(z.enum(IMPORT_FIELDS).nullable()).max(40),
}).strict().refine(({ mapping }) => {
  const used = mapping.filter((field): field is NonNullable<typeof field> => field !== null);
  return new Set(used).size === used.length;
}, 'Cada dato va en una sola columna');

const valueSchema = z.string().max(120).nullable().optional();
const fixSchema = z.object({
  skip: z.boolean().optional(),
  newPerson: z.boolean().optional(),
  sectionId: z.union([z.string().uuid(), z.null(), z.literal('auto')]).optional(),
  values: z.object(Object.fromEntries(FIX_VALUE_FIELDS.map((field) => [field, valueSchema])) as Record<(typeof FIX_VALUE_FIELDS)[number], typeof valueSchema>)
    .strict().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No hay nada que corregir');

const confirmSchema = z.object({ revision: z.number().int().min(0) }).strict();
const idSchema = z.string().uuid();
const lineSchema = z.coerce.number().int().min(1).max(1_048_576);

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return res.status(400).json({ success: false, message: !issue || issue.code === 'unrecognized_keys' ? 'Datos inválidos' : issue.message });
  }
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

/** Escuela y año de la ruta, con la administración verificada (antes de leer cualquier archivo). */
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

const batchIdOf = (req: Request, res: Response) => {
  const batchId = idSchema.safeParse(req.params.batchId);
  if (!batchId.success) res.status(404).json({ success: false, message: 'Esa importación ya no está' });
  return batchId.success ? batchId.data : null;
};

const sendXlsx = (res: Response, buffer: Buffer, filename: string) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // Datos de estudiantes: sin caché intermedia.
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
};

export const schoolRosterImportController = {
  // GET /schools/:schoolId/years/:yearId/roster-import/template — plantilla con el padrón del año
  async template(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const { buffer, filename, students } = await schoolRosterImportService.template(s.schoolId, s.yearId);
      await auditRequest(req, { action: 'school.roster_exported', schoolId: s.schoolId, target: { type: 'school_year', id: s.yearId }, metadata: { students, kind: 'template' } });
      sendXlsx(res, buffer, filename);
    } catch (error) {
      return sendError(res, error, 'Error al preparar la plantilla');
    }
  },

  // GET /schools/:schoolId/years/:yearId/roster-import/current — importación en revisión y última confirmada
  async current(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      res.json({ success: true, data: await schoolRosterImportService.current(s.schoolId, s.yearId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener la importación');
    }
  },

  // POST /schools/:schoolId/years/:yearId/roster-import — sube el Excel (multipart, campo «file»)
  async upload(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      rosterUpload.single('file')(req, res, async (error: unknown) => {
        try {
          if (error instanceof multer.MulterError) {
            const tooBig = error.code === 'LIMIT_FILE_SIZE';
            res.status(tooBig ? 413 : 400).json({ success: false, message: tooBig ? 'El archivo pesa más de 2 MB: deja solo la hoja del padrón' : 'No se pudo leer el archivo' });
            return;
          }
          if (error) throw error;
          if (!req.file) {
            res.status(400).json({ success: false, message: 'Elige un archivo de Excel (.xlsx)' });
            return;
          }
          const data = await schoolRosterImportService.upload(s.schoolId, s.yearId, req.user!.id, { buffer: req.file.buffer, name: req.file.originalname });
          await auditRequest(req, {
            action: 'school.roster_import_uploaded',
            schoolId: s.schoolId,
            target: { type: 'school_import', id: data.id },
            metadata: { rows: data.rowCount, source: data.source },
          });
          res.status(201).json({ success: true, data });
        } catch (inner) {
          sendError(res, inner, 'Error al leer el archivo');
        }
      });
    } catch (error) {
      return sendError(res, error, 'Error al leer el archivo');
    }
  },

  // GET /schools/:schoolId/years/:yearId/roster-import/:batchId — columnas y filas evaluadas
  async get(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const batchId = batchIdOf(req, res);
      if (!batchId) return;
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data: await schoolRosterImportService.get(s.schoolId, s.yearId, batchId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener la importación');
    }
  },

  // PUT /schools/:schoolId/years/:yearId/roster-import/:batchId/mapping — qué dato es cada columna
  async saveMapping(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const batchId = batchIdOf(req, res);
      if (!batchId) return;
      const { mapping } = mappingSchema.parse(req.body);
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data: await schoolRosterImportService.saveMapping(s.schoolId, s.yearId, batchId, mapping) });
    } catch (error) {
      return sendError(res, error, 'Error al guardar las columnas');
    }
  },

  // PATCH /schools/:schoolId/years/:yearId/roster-import/:batchId/rows/:line — corregir una fila
  async fixRow(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const batchId = batchIdOf(req, res);
      if (!batchId) return;
      const line = lineSchema.parse(req.params.line);
      const patch = fixSchema.parse(req.body);
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data: await schoolRosterImportService.fixRow(s.schoolId, s.yearId, batchId, line, patch) });
    } catch (error) {
      return sendError(res, error, 'Error al corregir la fila');
    }
  },

  // POST /schools/:schoolId/years/:yearId/roster-import/:batchId/confirm — importar (revision: la que se revisó)
  async confirm(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const batchId = batchIdOf(req, res);
      if (!batchId) return;
      const { revision } = confirmSchema.parse(req.body);
      const data = await schoolRosterImportService.confirm(s.schoolId, s.yearId, batchId, req.user!.id, revision);
      await auditRequest(req, {
        action: 'school.roster_imported',
        schoolId: s.schoolId,
        target: { type: 'school_import', id: batchId },
        metadata: { created: data.created, updated: data.updated, errors: data.errors, skipped: data.skipped },
      });
      const parts = [
        data.created ? `${data.created} ${data.created === 1 ? 'estudiante nuevo' : 'estudiantes nuevos'}` : '',
        data.updated ? `${data.updated} ${data.updated === 1 ? 'estudiante completado' : 'estudiantes completados'}` : '',
      ].filter(Boolean);
      res.json({ success: true, data, message: `Importación lista: ${parts.join(' y ')}` });
    } catch (error) {
      return sendError(res, error, 'Error al importar');
    }
  },

  // POST /schools/:schoolId/years/:yearId/roster-import/:batchId/undo — deshacer (24 h, sin cambios después)
  async undo(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const batchId = batchIdOf(req, res);
      if (!batchId) return;
      const data = await schoolRosterImportService.undo(s.schoolId, s.yearId, batchId);
      await auditRequest(req, {
        action: 'school.roster_import_undone',
        schoolId: s.schoolId,
        target: { type: 'school_import', id: batchId },
        metadata: { removed: data.removed, restored: data.restored },
      });
      res.json({ success: true, data, message: 'Importación deshecha: el padrón volvió a como estaba' });
    } catch (error) {
      return sendError(res, error, 'Error al deshacer la importación');
    }
  },

  // GET /schools/:schoolId/years/:yearId/roster-import/:batchId/errors — filas con error en Excel
  async errorRows(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const batchId = batchIdOf(req, res);
      if (!batchId) return;
      const { buffer, filename, rows } = await schoolRosterImportService.errorRows(s.schoolId, s.yearId, batchId);
      await auditRequest(req, { action: 'school.roster_exported', schoolId: s.schoolId, target: { type: 'school_import', id: batchId }, metadata: { rows, kind: 'import_errors' } });
      sendXlsx(res, buffer, filename);
    } catch (error) {
      return sendError(res, error, 'Error al preparar las filas con error');
    }
  },

  // DELETE /schools/:schoolId/years/:yearId/roster-import/:batchId — descartar la importación en revisión
  async discard(req: Request, res: Response) {
    try {
      const s = await scope(req, res);
      if (!s) return;
      const batchId = batchIdOf(req, res);
      if (!batchId) return;
      await schoolRosterImportService.discard(s.schoolId, s.yearId, batchId);
      res.json({ success: true, message: 'Importación descartada' });
    } catch (error) {
      return sendError(res, error, 'Error al descartar la importación');
    }
  },
};
