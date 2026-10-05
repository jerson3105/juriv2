import type { Request, Response } from 'express';
import { z } from 'zod';
import { config_app } from '../config/env.js';
import { pdfService } from '../services/pdf.service.js';
import { schoolAccessService } from '../services/schoolAccess.service.js';
import { requireSchoolRole, SCHOOL_MANAGER_ROLES, SCHOOL_MEMBER_ROLES } from '../utils/access.js';
import { auditRequest } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

const idSchema = z.string().uuid();
const appUrl = () => config_app.clientUrl || 'https://juried.app';
// El nombre del archivo, sin tildes ni signos (algunos navegadores los rompen en Content-Disposition).
const fileName = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'tarjetas';

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) return res.status(404).json({ success: false, message: 'No encontrado' });
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

const sendPdf = (res: Response, pdf: Buffer, name: string) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.pdf"`);
  // Las tarjetas llevan códigos de un solo uso: sin caché intermedia.
  res.setHeader('Cache-Control', 'no-store');
  res.send(pdf);
};

export const schoolAccessController = {
  // GET /schools/:schoolId/years/:yearId/access — código del colegio y cómo va el acceso por sección (administración)
  async overview(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      res.json({ success: true, data: await schoolAccessService.overview(schoolId, yearId) });
    } catch (error) {
      return sendError(res, error, 'Error al obtener el acceso de los estudiantes');
    }
  },

  // POST /schools/:schoolId/access/code — activar el acceso con DNI o cambiar el código del colegio (administración)
  async setCode(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const data = await schoolAccessService.setCode(schoolId);
      await auditRequest(req, { action: 'school.student_code_set', schoolId, target: { type: 'school', id: schoolId } });
      res.json({ success: true, data, message: 'Código del colegio listo' });
    } catch (error) {
      return sendError(res, error, 'Error al preparar el código del colegio');
    }
  },

  // GET /schools/:schoolId/access/poster — póster con el QR del colegio (administración)
  async poster(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MANAGER_ROLES))) return;
      const school = await schoolAccessService.poster(schoolId);
      sendPdf(res, await pdfService.generateSchoolPoster(school, appUrl()), `poster-${fileName(school.name)}`);
    } catch (error) {
      return sendError(res, error, 'Error al generar el póster');
    }
  },

  // POST /schools/:schoolId/years/:yearId/sections/:sectionId/access-cards — tarjetas de una sección (administración o tutor)
  async sectionCards(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MEMBER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const sectionId = idSchema.parse(req.params.sectionId);
      const data = await schoolAccessService.sectionCards(schoolId, yearId, sectionId, req.user!.id);
      await auditRequest(req, {
        action: 'school.access_cards_issued',
        schoolId,
        target: { type: 'school_section', id: sectionId },
        metadata: { cards: data.cards.length, issued: data.issued, skipped: data.skipped },
      });
      sendPdf(res, await pdfService.generateSchoolAccessCards(data.school as { name: string; studentCode: string }, data.cards, appUrl()), `tarjetas-${fileName(data.section)}`);
    } catch (error) {
      return sendError(res, error, 'Error al generar las tarjetas');
    }
  },

  // POST /schools/:schoolId/years/:yearId/students/:studentId/access-card — su tarjeta (si aún no tiene PIN)
  async studentCard(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MEMBER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const studentId = idSchema.parse(req.params.studentId);
      const data = await schoolAccessService.studentCard(schoolId, yearId, studentId, req.user!.id);
      await auditRequest(req, {
        action: 'school.access_cards_issued',
        schoolId,
        target: { type: 'school_student', id: studentId },
        metadata: { cards: 1 },
      });
      sendPdf(res, await pdfService.generateSchoolAccessCards(data.school as { name: string; studentCode: string }, data.cards, appUrl()), `tarjeta-${fileName(data.cards[0].name)}`);
    } catch (error) {
      return sendError(res, error, 'Error al generar la tarjeta');
    }
  },

  // POST /schools/:schoolId/years/:yearId/students/:studentId/access/reset — restablecer su PIN (administración o tutor)
  async resetPin(req: Request, res: Response) {
    try {
      const { schoolId } = req.params;
      if (!(await requireSchoolRole(req, res, schoolId, SCHOOL_MEMBER_ROLES))) return;
      const yearId = idSchema.parse(req.params.yearId);
      const studentId = idSchema.parse(req.params.studentId);
      const data = await schoolAccessService.resetPin(schoolId, yearId, studentId, req.user!.id);
      await auditRequest(req, {
        action: 'student.access_reset',
        schoolId,
        target: { type: 'school_student', id: studentId },
        metadata: { via: 'school', hadPin: data.hadPin },
      });
      // El código va en la tarjeta impresa: no se devuelve en claro, solo se avisa que hay una nueva.
      res.json({ success: true, data: { hadPin: data.hadPin }, message: data.hadPin ? 'PIN restablecido: imprime su tarjeta nueva' : 'Tarjeta nueva lista' });
    } catch (error) {
      return sendError(res, error, 'Error al restablecer el PIN');
    }
  },
};
