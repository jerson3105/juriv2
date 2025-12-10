import { Request, Response } from 'express';
import { historyService } from '../services/history.service.js';

class HistoryController {
  async getClassroomHistory(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const { limit, offset, type, studentId } = req.query;

      const result = await historyService.getClassroomHistory(classroomId, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        type: type as 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'BADGE' | 'ALL' | undefined,
        studentId: studentId as string | undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error getting classroom history:', error);
      res.status(500).json({ message: 'Error al obtener historial' });
    }
  }

  async getClassroomStats(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;

      const stats = await historyService.getClassroomStats(classroomId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting classroom stats:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
  }
}

export const historyController = new HistoryController();
