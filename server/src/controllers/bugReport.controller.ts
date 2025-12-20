import { Request, Response } from 'express';
import { bugReportService } from '../services/bugReport.service.js';

export const bugReportController = {
  // Crear nuevo reporte (profesores)
  async createReport(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
      }

      const { title, description, category, priority, currentUrl, browserInfo, screenshotUrl } = req.body;

      if (!title || !description) {
        return res.status(400).json({ 
          success: false, 
          message: 'Título y descripción son requeridos' 
        });
      }

      const report = await bugReportService.createReport(userId, {
        title,
        description,
        category,
        priority,
        currentUrl,
        browserInfo,
        screenshotUrl,
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
      const { status, priority, category, page, limit } = req.query;

      const result = await bugReportService.getAllReports({
        status: status as any,
        priority: priority as any,
        category: category as any,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

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
      const { notes } = req.body;

      const report = await bugReportService.updateAdminNotes(reportId, notes || '');

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
