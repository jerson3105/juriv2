import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { studentProfiles } from '../db/schema.js';
import { parentService } from '../services/parent.service.js';
import { schoolReportPublishService } from '../services/schoolReportPublish.service.js';
import { AppError } from '../utils/errors.js';

/**
 * Las libretas publicadas por el colegio, para quien la recibe: el estudiante (las suyas, en «Mis calificaciones») y su
 * familia (las de su hijo o hija, en su página). Solo la última versión de cada bimestre; el PDF sale de la copia congelada.
 */

const idSchema = z.string().uuid();
const fileName = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'libreta';

const sendError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) return res.status(404).json({ success: false, message: 'Libreta no encontrada' });
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

const sendPdf = (res: Response, pdf: Buffer, name: string) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="libreta-${fileName(name)}.pdf"`);
  // Datos de un menor: sin caché intermedia.
  res.setHeader('Cache-Control', 'no-store');
  res.send(pdf);
};

/** El estudiante del padrón de un perfil, si la familia tiene un vínculo activo con él. */
const childStudent = async (req: Request, res: Response) => {
  const profile = await parentService.getParentProfile(req.user!.id);
  if (!profile) {
    res.status(404).json({ success: false, message: 'Perfil de familia no encontrado' });
    return null;
  }
  const studentProfileId = idSchema.parse(req.params.studentId);
  if (!(await parentService.hasActiveLink(profile.id, studentProfileId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a este estudiante' });
    return null;
  }
  const [row] = await db.select({ studentId: studentProfiles.schoolStudentId }).from(studentProfiles).where(eq(studentProfiles.id, studentProfileId));
  return { studentId: row?.studentId ?? null };
};

export const reportCardFamilyController = {
  // GET /students/me/report-cards — sus libretas publicadas
  async mine(req: Request, res: Response) {
    try {
      const ids = await schoolReportPublishService.studentsOfUser(req.user!.id);
      const lists = await Promise.all(ids.map((id) => schoolReportPublishService.listForStudent(id)));
      res.json({ success: true, data: lists.flat() });
    } catch (error) {
      return sendError(res, error, 'Error al obtener tus libretas');
    }
  },

  // GET /students/me/report-cards/:publicationId/pdf
  async minePdf(req: Request, res: Response) {
    try {
      const publicationId = idSchema.parse(req.params.publicationId);
      const ids = await schoolReportPublishService.studentsOfUser(req.user!.id);
      const { pdf, name } = await schoolReportPublishService.pdf(publicationId, ids);
      sendPdf(res, pdf, name);
    } catch (error) {
      return sendError(res, error, 'Error al descargar tu libreta');
    }
  },

  // GET /parent/child/:studentId/report-cards — las libretas publicadas de su hijo o hija (studentId = su perfil en la clase)
  async child(req: Request, res: Response) {
    try {
      const child = await childStudent(req, res);
      if (!child) return;
      res.json({ success: true, data: child.studentId ? await schoolReportPublishService.listForStudent(child.studentId) : [] });
    } catch (error) {
      return sendError(res, error, 'Error al obtener las libretas');
    }
  },

  // GET /parent/child/:studentId/report-cards/:publicationId/pdf
  async childPdf(req: Request, res: Response) {
    try {
      const child = await childStudent(req, res);
      if (!child) return;
      const publicationId = idSchema.parse(req.params.publicationId);
      const { pdf, name } = await schoolReportPublishService.pdf(publicationId, child.studentId ? [child.studentId] : []);
      sendPdf(res, pdf, name);
    } catch (error) {
      return sendError(res, error, 'Error al descargar la libreta');
    }
  },
};
