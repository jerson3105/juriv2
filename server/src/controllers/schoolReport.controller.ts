import type { NextFunction, Request, RequestHandler, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { schools } from '../db/schema.js';
import { libretaPdfService } from '../services/libretaPdf.service.js';
import { schoolReportService } from '../services/schoolReport.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';
import { createUploadFilter, IMAGE_MIMES, verifyUploadedFile } from '../utils/fileValidation.js';

/**
 * Libretas del colegio (administración): los datos de su cabecera (DRE, UGEL, director(a), códigos modulares y logo), la
 * libreta de una sección para revisarla y su PDF (toda la sección o un estudiante).
 */

const idSchema = z.string().uuid();
const periodSchema = z.enum(['B1', 'B2', 'B3', 'B4']).optional();
const optionalText = (max: number) => z.string().trim().max(max, 'Es muy largo').nullable().transform((v) => (v ? v : null));
const modularCode = z.string().trim().nullable()
  .refine((v) => !v || /^\d{7}$/.test(v), 'El código modular tiene 7 números')
  .transform((v) => (v ? v : null));
const settingsSchema = z.object({
  dre: optionalText(120),
  ugel: optionalText(120),
  directorName: optionalText(150),
  codes: z.object({ INICIAL: modularCode, PRIMARIA: modularCode, SECUNDARIA: modularCode }).strict(),
}).strict();

const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
export const SCHOOL_LOGO_DIR = path.join(uploadsDir, 'school-logos');
const LOGO_URL_PREFIX = '/api/uploads/school-logos/';
// El escudo del MINEDU para la cabecera: si el colegio pasa la imagen, va aquí (si no, el texto «Ministerio de Educación»).
const MINEDU_IMAGE = path.join(process.cwd(), 'assets', 'libreta', 'minedu.png');

// El nombre del archivo, sin tildes ni signos (algunos navegadores los rompen en Content-Disposition).
const fileName = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'libreta';

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0]?.message ?? 'Datos inválidos' });
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

/** El archivo del logo en el disco (solo los que guardó esta función: nunca una ruta que venga de afuera). */
const logoPath = (logoUrl: string | null) =>
  (logoUrl?.startsWith(LOGO_URL_PREFIX) ? path.join(SCHOOL_LOGO_DIR, path.basename(logoUrl)) : null);

const readIfExists = async (file: string | null) => {
  if (!file) return null;
  try { return await fs.promises.readFile(file); } catch { return null; }
};

let mineduImage: Promise<Buffer | null> | null = null;
const minedu = () => (mineduImage ??= readIfExists(MINEDU_IMAGE));

/** El logo: una imagen en memoria (se revisa su contenido y se recodifica a PNG antes de tocar el disco). */
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 2, parts: 3 },
  fileFilter: createUploadFilter(IMAGE_MIMES, 'El logo debe ser una imagen (PNG, JPG, GIF o WebP)'),
});

export const uploadSchoolLogo: RequestHandler[] = [
  (req: Request, res: Response, next: NextFunction) => {
    logoUpload.single('logo')(req, res, (error: unknown) => {
      if (!error) return next();
      const tooBig = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
      res.status(tooBig ? 413 : 400).json({ success: false, message: tooBig ? 'El logo pesa más de 2 MB.' : (error as Error).message || 'No se pudo leer la imagen.' });
    });
  },
  verifyUploadedFile,
];

export const schoolReportController = {
  // GET /schools/:schoolId/report-settings — datos de la cabecera de la libreta
  async getSettings(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      res.json({ success: true, data: await schoolReportService.settings(schoolId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener los datos de la libreta');
    }
  },

  // PUT /schools/:schoolId/report-settings
  async saveSettings(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const input = settingsSchema.parse(req.body);
      const data = await schoolReportService.saveSettings(schoolId, input, req.user!.id);
      await auditRequest(req, { action: 'school.report_settings_updated', schoolId, target: { type: 'school', id: schoolId } });
      res.json({ success: true, data });
    } catch (error) {
      return sendError(res, error, 'Error al guardar los datos de la libreta');
    }
  },

  // POST /schools/:schoolId/logo (multipart «logo») — el logo del colegio, en PNG de hasta 600 px
  async uploadLogo(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      if (!req.file?.buffer) return res.status(400).json({ success: false, message: 'Elige una imagen' });
      let png: Buffer;
      try {
        png = await sharp(req.file.buffer, { failOn: 'error' })
          .rotate()
          .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
      } catch {
        return res.status(400).json({ success: false, message: 'No se pudo leer la imagen' });
      }
      const [school] = await db.select({ logoUrl: schools.logoUrl }).from(schools).where(eq(schools.id, schoolId));
      await fs.promises.mkdir(SCHOOL_LOGO_DIR, { recursive: true });
      const name = `${uuidv4()}.png`;
      await fs.promises.writeFile(path.join(SCHOOL_LOGO_DIR, name), png);
      const logoUrl = `${LOGO_URL_PREFIX}${name}`;
      await db.update(schools).set({ logoUrl, updatedAt: new Date() }).where(eq(schools.id, schoolId));
      const old = logoPath(school?.logoUrl ?? null);
      if (old) fs.promises.unlink(old).catch(() => undefined);
      await auditRequest(req, { action: 'school.logo_updated', schoolId, target: { type: 'school', id: schoolId }, metadata: { removed: false } });
      res.json({ success: true, data: { logoUrl } });
    } catch (error) {
      return sendError(res, error, 'Error al guardar el logo');
    }
  },

  // DELETE /schools/:schoolId/logo
  async removeLogo(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const [school] = await db.select({ logoUrl: schools.logoUrl }).from(schools).where(eq(schools.id, schoolId));
      await db.update(schools).set({ logoUrl: null, updatedAt: new Date() }).where(eq(schools.id, schoolId));
      const old = logoPath(school?.logoUrl ?? null);
      if (old) fs.promises.unlink(old).catch(() => undefined);
      await auditRequest(req, { action: 'school.logo_updated', schoolId, target: { type: 'school', id: schoolId }, metadata: { removed: true } });
      res.json({ success: true, data: { logoUrl: null } });
    } catch (error) {
      return sendError(res, error, 'Error al quitar el logo');
    }
  },

  // GET /schools/:schoolId/years/:yearId/report-cards/sections/:sectionId?period=B1 — la libreta de la sección (sin documentos)
  async section(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const sectionId = idSchema.parse(req.params.sectionId);
      const period = periodSchema.parse(req.query.period);
      res.json({ success: true, data: await schoolReportService.section(schoolId, yearId, sectionId, period ?? null) });
    } catch (error) {
      return sendError(res, error, 'Error al armar las libretas');
    }
  },

  // GET /schools/:schoolId/years/:yearId/report-cards/sections/:sectionId/pdf?period=B1[&studentId=] — PDF de la sección o de uno
  async pdf(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const sectionId = idSchema.parse(req.params.sectionId);
      const period = periodSchema.parse(req.query.period);
      const studentId = req.query.studentId === undefined ? null : idSchema.parse(req.query.studentId);
      const report = await schoolReportService.section(schoolId, yearId, sectionId, period ?? null, {
        readDocuments: true,
        ...(studentId ? { studentIds: [studentId] } : {}),
      });
      if (studentId && report.students.length === 0) return res.status(404).json({ success: false, message: 'Ese estudiante no está en esta sección' });
      // La de toda la sección es para imprimir: sin quienes se retiraron (la suya sale por separado).
      if (!studentId) report.students = report.students.filter((s) => s.student.status === 'ACTIVE');
      const [logo, mineduImage] = await Promise.all([readIfExists(logoPath(report.school.logoUrl)), minedu()]);
      const pdf = await libretaPdfService.render(report, { logo, minedu: mineduImage });
      // Sin datos personales en la auditoría: qué libreta y cuántas.
      await auditRequest(req, {
        action: 'school.report_generated',
        schoolId,
        target: { type: 'school_section', id: sectionId },
        metadata: { yearId, period: report.upTo, students: report.students.length, single: !!studentId, preview: report.preview },
      });
      const who = studentId ? `${report.students[0].student.lastNames} ${report.students[0].student.firstNames}` : report.section.label;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="libreta-${fileName(`${who} ${report.year.name} ${report.upTo}`)}.pdf"`);
      // Lleva datos de menores (documento): sin caché intermedia.
      res.setHeader('Cache-Control', 'no-store');
      res.send(pdf);
    } catch (error) {
      return sendError(res, error, 'Error al generar la libreta');
    }
  },
};
