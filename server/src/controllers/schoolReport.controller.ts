import type { NextFunction, Request, RequestHandler, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/index.js';
import { schoolSections, schools } from '../db/schema.js';
import { libretaImages, logoPath, SCHOOL_LOGO_DIR } from '../services/libretaAssets.js';
import { libretaPdfService } from '../services/libretaPdf.service.js';
import { schoolReportPublishService } from '../services/schoolReportPublish.service.js';
import { schoolReportService } from '../services/schoolReport.service.js';
import { yearCalendars } from '../services/schoolCalendar.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES, SCHOOL_MEMBER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';
import { createUploadFilter, IMAGE_MIMES, verifyUploadedFile } from '../utils/fileValidation.js';

/**
 * Libretas del colegio (administración): los datos de su cabecera (DRE, UGEL, director(a), códigos modulares y logo), la
 * libreta de una sección para revisarla y su PDF (toda la sección o un estudiante), las exoneraciones y el avance de cada
 * bimestre con «Recordar». El tutor de una sección también ve sus libretas (sin el DNI).
 */

const idSchema = z.string().uuid();
const periodSchema = z.enum(['B1', 'B2', 'B3', 'B4']).optional();
const optionalText = (max: number) => z.string().trim().max(max, 'Es muy largo').nullable().transform((v) => (v ? v : null));
const modularCode = z.string().trim().nullable()
  .refine((v) => !v || /^\d{7}$/.test(v), 'El código modular tiene 7 números')
  .transform((v) => (v ? v : null));
const exemptionsSchema = z.object({ areaIds: z.array(z.string().regex(/^[a-z0-9-]{3,36}$/)).max(4) }).strict();
const codeSchema = z.enum(['B1', 'B2', 'B3', 'B4']);
const remindSchema = z.object({ sectionId: z.string().uuid(), areaId: z.string().regex(/^[a-z0-9-]{3,36}$/), period: z.enum(['B1', 'B2', 'B3', 'B4']).optional() }).strict();
const settingsSchema = z.object({
  dre: optionalText(120),
  ugel: optionalText(120),
  directorName: optionalText(150),
  codes: z.object({ INICIAL: modularCode, PRIMARIA: modularCode, SECUNDARIA: modularCode }).strict(),
}).strict();

const LOGO_URL_PREFIX = '/api/uploads/school-logos/';

// El nombre del archivo, sin tildes ni signos (algunos navegadores los rompen en Content-Disposition).
const fileName = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'libreta';

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0]?.message ?? 'Datos inválidos' });
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};


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

/** La administración, o el tutor de esa sección (solo para consultar). Responde 403 a los demás. */
const sectionReader = async (req: Request, res: Response, schoolId: string, sectionId: string) => {
  const role = await requireSchoolRole(req, res, schoolId, SCHOOL_MEMBER_ROLES);
  if (!role) return null;
  if (SCHOOL_MANAGER_ROLES.includes(role)) return { manager: true };
  const [section] = await db.select({ tutorUserId: schoolSections.tutorUserId }).from(schoolSections)
    .where(and(eq(schoolSections.id, sectionId), eq(schoolSections.schoolId, schoolId)));
  if (section?.tutorUserId && section.tutorUserId === req.user!.id) return { manager: false };
  res.status(403).json({ success: false, message: 'Solo la administración o el tutor de la sección ven sus libretas' });
  return null;
};

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
      const yearId = idSchema.parse(req.params.yearId);
      const sectionId = idSchema.parse(req.params.sectionId);
      if (!(await sectionReader(req, res, schoolId, sectionId))) return;
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
      const yearId = idSchema.parse(req.params.yearId);
      const sectionId = idSchema.parse(req.params.sectionId);
      const reader = await sectionReader(req, res, schoolId, sectionId);
      if (!reader) return;
      const period = periodSchema.parse(req.query.period);
      const studentId = req.query.studentId === undefined ? null : idSchema.parse(req.query.studentId);
      const report = await schoolReportService.section(schoolId, yearId, sectionId, period ?? null, {
        // El tutor no ve los documentos: su libreta sale sin el DNI.
        readDocuments: reader.manager,
        ...(studentId ? { studentIds: [studentId] } : {}),
      });
      if (studentId && report.students.length === 0) return res.status(404).json({ success: false, message: 'Ese estudiante no está en esta sección' });
      // La de toda la sección es para imprimir: sin quienes se retiraron (la suya sale por separado).
      if (!studentId) report.students = report.students.filter((s) => s.student.status === 'ACTIVE');
      const pdf = await libretaPdfService.render(report, await libretaImages(report.school.logoUrl));
      // Sin datos personales en la auditoría: qué libreta y cuántas.
      await auditRequest(req, {
        action: 'school.report_generated',
        schoolId,
        target: { type: 'school_section', id: sectionId },
        metadata: { yearId, period: report.upTo, students: report.students.length, single: !!studentId, preview: report.preview, tutor: !reader.manager },
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

  // GET /schools/:schoolId/years/:yearId/report-cards/periods — estado de cada bimestre y su última publicación
  async periods(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const calendar = (await yearCalendars([yearId])).get(yearId);
      if (!calendar || calendar.schoolId !== schoolId) return res.status(404).json({ success: false, message: 'Año escolar no encontrado' });
      const latest = await schoolReportPublishService.latestOfYear(yearId);
      res.json({
        success: true,
        data: {
          yearStatus: calendar.yearStatus,
          periods: calendar.periods.map((p) => {
            const publication = latest.get(p.code);
            return {
              code: p.code, number: p.number, status: p.status, startsOn: p.startsOn, endsOn: p.endsOn, lockedAt: p.lockedAt,
              started: p.start.getTime() <= Date.now(),
              publication: publication ? { version: publication.version, publishedAt: publication.publishedAt, students: publication.students } : null,
            };
          }),
        },
      });
    } catch (error) {
      return sendError(res, error, 'Error al leer los bimestres');
    }
  },

  // POST /schools/:schoolId/years/:yearId/periods/:code/publish — publicar las libretas de un bimestre cerrado (todo el colegio)
  async publish(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const code = codeSchema.parse(req.params.code);
      const data = await schoolReportPublishService.publish(schoolId, yearId, code, req.user!.id);
      await auditRequest(req, {
        action: 'school.report_published', schoolId, target: { type: 'school_year', id: yearId },
        metadata: { code, version: data.version, students: data.students, notified: data.notified },
      });
      res.json({ success: true, data, message: `Libretas publicadas: ${data.students} ${data.students === 1 ? 'estudiante' : 'estudiantes'}` });
    } catch (error) {
      return sendError(res, error, 'Error al publicar las libretas');
    }
  },

  // PUT /schools/:schoolId/years/:yearId/students/:studentId/exemptions — exoneraciones del año (Religión, Educación Física)
  async setExemptions(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const studentId = idSchema.parse(req.params.studentId);
      const { areaIds } = exemptionsSchema.parse(req.body);
      const data = await schoolReportService.setExemptions(schoolId, yearId, studentId, areaIds, req.user!.id);
      await auditRequest(req, { action: 'school.exemption_updated', schoolId, target: { type: 'school_student', id: studentId }, metadata: { yearId, areaIds: data.join(',') } });
      res.json({ success: true, data: { areaIds: data } });
    } catch (error) {
      return sendError(res, error, 'Error al guardar las exoneraciones');
    }
  },

  // GET /schools/:schoolId/years/:yearId/report-cards/progress?period=B1 — avance por sección y área
  async progress(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const period = periodSchema.parse(req.query.period);
      res.json({ success: true, data: await schoolReportService.progress(schoolId, yearId, period ?? null) });
    } catch (error) {
      return sendError(res, error, 'Error al calcular el avance');
    }
  },

  // POST /schools/:schoolId/years/:yearId/report-cards/remind — aviso al docente de una sección y área
  async remind(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const input = remindSchema.parse(req.body);
      const data = await schoolReportService.remind(schoolId, yearId, input.sectionId, input.areaId, input.period ?? null);
      await auditRequest(req, {
        action: 'school.report_reminder_sent', schoolId, target: { type: 'school_section', id: input.sectionId },
        metadata: { yearId, areaId: input.areaId, period: input.period ?? null, ...data },
      });
      res.json({ success: true, data, message: 'Le llegó un aviso a su campana' });
    } catch (error) {
      return sendError(res, error, 'Error al enviar el recordatorio');
    }
  },
};
