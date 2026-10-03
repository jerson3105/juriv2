import { Request, Response } from 'express';
import { z } from 'zod';
import { bugReportService } from '../services/bugReport.service.js';

const CATEGORIES = ['UI', 'FUNCTIONALITY', 'PERFORMANCE', 'DATA', 'OTHER'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const STATUSES = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

// Enlaces que el admin abrirá: solo http(s).
const httpUrl = z.string().trim().max(2048).refine((value) => value === '' || /^https?:\/\//i.test(value), 'URL inválida');

const createReportSchema = z.object({
  title: z.string().trim().min(3, 'Escribe un título').max(200, 'El título es muy largo'),
  description: z.string().trim().min(5, 'Cuéntanos qué pasó').max(5000, 'La descripción es muy larga (máx. 5.000 caracteres)'),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  currentUrl: httpUrl.nullable().optional(),
  screenshotUrl: httpUrl.nullable().optional(),
  // Datos del navegador: un objeto o su JSON; se guardan solo valores simples y cortos.
  browserInfo: z.union([z.string().max(4000), z.record(z.unknown())]).nullable().optional(),
});

const listReportsSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const notesSchema = z.object({ notes: z.string().max(5000, 'Las notas son muy largas (máx. 5.000 caracteres)').optional() });

/**
 * Deja browserInfo como un objeto plano de valores simples (texto corto, números, sí/no), máx. 20 claves:
 * un objeto anidado hacía caer el panel del admin al pintarlo.
 */
const normalizeBrowserInfo = (value: unknown): string | undefined => {
  let source: unknown = value;
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value);
    } catch {
      return JSON.stringify({ texto: value.slice(0, 500) });
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(source as Record<string, unknown>).slice(0, 20)) {
    if (typeof raw === 'string') clean[key.slice(0, 40)] = raw.slice(0, 300);
    else if (typeof raw === 'number' && Number.isFinite(raw)) clean[key.slice(0, 40)] = raw;
    else if (typeof raw === 'boolean') clean[key.slice(0, 40)] = raw;
  }
  return Object.keys(clean).length ? JSON.stringify(clean).slice(0, 4000) : undefined;
};

export const bugReportController = {
  // Crear nuevo reporte (profesores)
  async createReport(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const parsed = createReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
      }
      const { title, description, category, priority, currentUrl, browserInfo, screenshotUrl } = parsed.data;

      const report = await bugReportService.createReport(userId, {
        title,
        description,
        category,
        priority,
        currentUrl: currentUrl || undefined,
        browserInfo: normalizeBrowserInfo(browserInfo),
        screenshotUrl: screenshotUrl || undefined,
      });

      res.status(201).json({
        success: true,
        message: 'Reporte creado exitosamente',
        data: report,
      });
    } catch (error) {
      console.error('Error creating bug report:', error);
      res.status(500).json({ success: false, message: 'Error al crear reporte' });
    }
  },

  // Obtener mis reportes (profesores)
  async getMyReports(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const reports = await bugReportService.getUserReports(userId);

      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      console.error('Error getting user reports:', error);
      res.status(500).json({ success: false, message: 'Error al obtener reportes' });
    }
  },

  // Obtener todos los reportes (admin)
  async getAllReports(req: Request, res: Response) {
    try {
      const query = listReportsSchema.safeParse(req.query);
      if (!query.success) return res.status(400).json({ success: false, message: 'Filtros inválidos' });
      const result = await bugReportService.getAllReports(query.data);

      res.json({
        success: true,
        data: result.reports,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error('Error getting all reports:', error);
      res.status(500).json({ success: false, message: 'Error al obtener reportes' });
    }
  },

  // Obtener reporte por ID (admin)
  async getReportById(req: Request, res: Response) {
    try {
      const { reportId } = req.params;

      const report = await bugReportService.getReportById(reportId);

      if (!report) {
        return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
      }

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Error getting report:', error);
      res.status(500).json({ success: false, message: 'Error al obtener reporte' });
    }
  },

  // Obtener estadísticas (admin)
  async getStats(req: Request, res: Response) {
    try {
      const stats = await bugReportService.getStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting bug report stats:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
    }
  },

  // Actualizar estado (admin)
  async updateStatus(req: Request, res: Response) {
    try {
      const { reportId } = req.params;
      const { status } = req.body;
      const adminId = req.user?.id;

      if (!status) {
        return res.status(400).json({ success: false, message: 'Estado requerido' });
      }

      const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Estado inválido' });
      }

      const report = await bugReportService.updateStatus(reportId, status, adminId);

      res.json({
        success: true,
        message: 'Estado actualizado',
        data: report,
      });
    } catch (error) {
      console.error('Error updating report status:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar estado' });
    }
  },

  // Actualizar notas de admin
  async updateNotes(req: Request, res: Response) {
    try {
      const { reportId } = req.params;
      const parsed = notesSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Notas inválidas' });

      const report = await bugReportService.updateAdminNotes(reportId, parsed.data.notes ?? '');

      res.json({
        success: true,
        message: 'Notas actualizadas',
        data: report,
      });
    } catch (error) {
      console.error('Error updating report notes:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar notas' });
    }
  },
};
