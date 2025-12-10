import { Request, Response } from 'express';
import { loginStreakService } from '../services/loginStreak.service.js';
import { db } from '../db/index.js';
import { studentProfiles } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const loginStreakController = {
  // Registrar login y obtener recompensas
  async recordLogin(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { classroomId } = req.params;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }

      // Obtener perfil del estudiante
      const [profile] = await db
        .select()
        .from(studentProfiles)
        .where(and(
          eq(studentProfiles.userId, userId),
          eq(studentProfiles.classroomId, classroomId)
        ));

      if (!profile) {
        return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
      }

      const result = await loginStreakService.recordLogin(profile.id, classroomId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error recording login:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Error al registrar login' 
      });
    }
  },

  // Obtener estado de la racha
  async getStreakStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { classroomId } = req.params;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
      }

      // Obtener perfil del estudiante
      const [profile] = await db
        .select()
        .from(studentProfiles)
        .where(and(
          eq(studentProfiles.userId, userId),
          eq(studentProfiles.classroomId, classroomId)
        ));

      if (!profile) {
        return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
      }

      const status = await loginStreakService.getStreakStatus(profile.id, classroomId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      console.error('Error getting streak status:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Error al obtener estado de racha' 
      });
    }
  },
};
