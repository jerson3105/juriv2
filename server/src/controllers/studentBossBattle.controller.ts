import { Request, Response } from 'express';
import { studentBossBattleService } from '../services/studentBossBattle.service.js';

export const studentBossBattleController = {
  // ==================== Endpoints para profesor ====================

  // Crear batalla
  async create(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const battle = await studentBossBattleService.create(classroomId, req.body);
      res.status(201).json({ success: true, data: battle });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Obtener batallas de una clase
  async getByClassroom(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      console.log('[StudentBossBattle] getByClassroom:', classroomId);
      const battles = await studentBossBattleService.getByClassroom(classroomId);
      res.json({ success: true, data: battles });
    } catch (error: any) {
      console.error('[StudentBossBattle] Error getByClassroom:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Obtener batalla por ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const battle = await studentBossBattleService.getById(id);
      if (!battle) {
        return res.status(404).json({ success: false, error: 'Batalla no encontrada' });
      }
      res.json({ success: true, data: battle });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Actualizar batalla
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const battle = await studentBossBattleService.update(id, req.body);
      res.json({ success: true, data: battle });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Eliminar batalla
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await studentBossBattleService.delete(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Activar batalla
  async activate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const battle = await studentBossBattleService.activate(id);
      res.json({ success: true, data: battle });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // ==================== Endpoints para estudiante ====================

  // Obtener batallas disponibles para el estudiante
  async getAvailableForStudent(req: Request, res: Response) {
    try {
      const { classroomId, studentProfileId } = req.params;
      const battles = await studentBossBattleService.getAvailableForStudent(classroomId, studentProfileId);
      res.json({ success: true, data: battles });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Iniciar intento de batalla
  async startAttempt(req: Request, res: Response) {
    try {
      const { battleId, studentProfileId } = req.params;
      const result = await studentBossBattleService.startAttempt(battleId, studentProfileId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  // Responder pregunta
  async answerQuestion(req: Request, res: Response) {
    try {
      const { battleId, studentProfileId } = req.params;
      const { questionId, answer } = req.body;
      const result = await studentBossBattleService.answerQuestion({
        battleId,
        studentProfileId,
        questionId,
        answer,
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  // Finalizar intento
  async finishAttempt(req: Request, res: Response) {
    try {
      const { battleId, studentProfileId } = req.params;
      const result = await studentBossBattleService.finishAttempt(battleId, studentProfileId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  // Obtener estado actual de la batalla (para polling)
  async getBattleStatus(req: Request, res: Response) {
    try {
      const { battleId } = req.params;
      const status = await studentBossBattleService.getBattleStatus(battleId);
      res.json({ success: true, data: status });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
