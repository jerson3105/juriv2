import { Request, Response } from 'express';
import { announcementService } from '../services/announcement.service.js';

class AnnouncementController {

  async create(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const teacherId = req.user!.id;
      const { message } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ message: 'El mensaje es requerido' });
      }

      const announcement = await announcementService.createAnnouncement(classroomId, teacherId, message);
      res.status(201).json(announcement);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al crear aviso';
      const status = msg.includes('no encontrada') || msg.includes('permiso') ? 403 : 500;
      res.status(status).json({ message: msg });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

      const result = await announcementService.getAnnouncements(classroomId, page, limit);
      res.json(result);
    } catch (error) {
      console.error('Error getting announcements:', error);
      res.status(500).json({ message: 'Error al obtener avisos' });
    }
  }
  async parentStats(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const stats = await announcementService.getParentStats(classroomId);
      res.json(stats);
    } catch (error) {
      console.error('Error getting parent stats:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas de padres' });
    }
  }

  async families(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const result = await announcementService.getFamilies(classroomId);
      res.json(result);
    } catch (error) {
      console.error('Error getting families:', error);
      res.status(500).json({ message: 'Error al obtener familias' });
    }
  }

  async markRead(req: Request, res: Response) {
    try {
      const classroomId = req.params.id;
      const userId = req.user!.id;
      await announcementService.markAnnouncementsAsRead(classroomId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking announcements as read:', error);
      res.status(500).json({ message: 'Error al marcar avisos como leídos' });
    }
  }
}

export const announcementController = new AnnouncementController();
