import { Request, Response } from 'express';
import { timedActivityService } from '../services/timedActivity.service.js';

export const timedActivityController = {
  // Crear actividad
  async create(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const activity = await timedActivityService.create({
        classroomId,
        ...req.body,
      });
      res.status(201).json(activity);
    } catch (error) {
      console.error('Error creating timed activity:', error);
      res.status(500).json({ error: 'Error al crear actividad' });
    }
  },

  // Obtener actividades de una clase
  async getByClassroom(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const activities = await timedActivityService.getByClassroom(classroomId);
      res.json(activities);
    } catch (error) {
      console.error('Error getting timed activities:', error);
      res.status(500).json({ error: 'Error al obtener actividades' });
    }
  },

  // Obtener una actividad por ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const activity = await timedActivityService.getById(id);
      if (!activity) {
        return res.status(404).json({ error: 'Actividad no encontrada' });
      }
      res.json(activity);
    } catch (error) {
      console.error('Error getting timed activity:', error);
      res.status(500).json({ error: 'Error al obtener actividad' });
    }
  },

  // Actualizar actividad
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const activity = await timedActivityService.update(id, req.body);
      if (!activity) {
        return res.status(404).json({ error: 'Actividad no encontrada' });
      }
      res.json(activity);
    } catch (error) {
      console.error('Error updating timed activity:', error);
      res.status(500).json({ error: 'Error al actualizar actividad' });
    }
  },

  // Eliminar actividad
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await timedActivityService.delete(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting timed activity:', error);
      res.status(500).json({ error: 'Error al eliminar actividad' });
    }
  },

  // Iniciar actividad
  async start(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const activity = await timedActivityService.start(id);
      if (!activity) {
        return res.status(404).json({ error: 'Actividad no encontrada' });
      }
      res.json(activity);
    } catch (error) {
      console.error('Error starting timed activity:', error);
      res.status(500).json({ error: 'Error al iniciar actividad' });
    }
  },

  // Pausar actividad
  async pause(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { elapsedSeconds } = req.body;
      const activity = await timedActivityService.pause(id, elapsedSeconds);
      if (!activity) {
        return res.status(404).json({ error: 'Actividad no encontrada' });
      }
      res.json(activity);
    } catch (error) {
      console.error('Error pausing timed activity:', error);
      res.status(500).json({ error: 'Error al pausar actividad' });
    }
  },

  // Reanudar actividad
  async resume(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const activity = await timedActivityService.resume(id);
      if (!activity) {
        return res.status(404).json({ error: 'Actividad no encontrada' });
      }
      res.json(activity);
    } catch (error) {
      console.error('Error resuming timed activity:', error);
      res.status(500).json({ error: 'Error al reanudar actividad' });
    }
  },

  // Completar actividad
  async complete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { elapsedSeconds } = req.body;
      const activity = await timedActivityService.complete(id, elapsedSeconds);
      if (!activity) {
        return res.status(404).json({ error: 'Actividad no encontrada' });
      }
      res.json(activity);
    } catch (error) {
      console.error('Error completing timed activity:', error);
      res.status(500).json({ error: 'Error al completar actividad' });
    }
  },

  // Reiniciar actividad
  async reset(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const activity = await timedActivityService.reset(id);
      if (!activity) {
        return res.status(404).json({ error: 'Actividad no encontrada' });
      }
      res.json(activity);
    } catch (error) {
      console.error('Error resetting timed activity:', error);
      res.status(500).json({ error: 'Error al reiniciar actividad' });
    }
  },

  // Marcar estudiante como completado
  async markStudentComplete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { studentProfileId, elapsedSeconds } = req.body;
      const result = await timedActivityService.markStudentComplete({
        activityId: id,
        studentProfileId,
        elapsedSeconds,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error marking student complete:', error);
      res.status(500).json({ error: error.message || 'Error al marcar estudiante' });
    }
  },

  // Marcar estudiante como explotado (modo BOMB)
  async markStudentExploded(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { studentProfileId } = req.body;
      const result = await timedActivityService.markStudentExploded({
        activityId: id,
        studentProfileId,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error marking student exploded:', error);
      res.status(500).json({ error: error.message || 'Error al marcar explosión' });
    }
  },

  // Obtener actividad activa de una clase
  async getActiveActivity(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const activity = await timedActivityService.getActiveActivity(classroomId);
      res.json(activity);
    } catch (error) {
      console.error('Error getting active activity:', error);
      res.status(500).json({ error: 'Error al obtener actividad activa' });
    }
  },
};
