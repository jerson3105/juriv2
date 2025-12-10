import type { Request, Response } from 'express';
import { classroomService } from '../services/classroom.service.js';
import { z } from 'zod';

const createClassroomSchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  gradeLevel: z.string().max(20).optional(),
});

const updateClassroomSchema = z.object({
  // General
  name: z.string().min(2).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  gradeLevel: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
  
  // Puntos
  defaultXp: z.number().int().min(0).optional(),
  defaultHp: z.number().int().min(0).optional(),
  defaultGp: z.number().int().min(0).optional(),
  maxHp: z.number().int().min(1).optional(),
  xpPerLevel: z.number().int().min(1).optional(),
  allowNegativeHp: z.boolean().optional(),
  
  // Comportamientos
  allowNegativePoints: z.boolean().optional(),
  showReasonToStudent: z.boolean().optional(),
  notifyOnPoints: z.boolean().optional(),
  
  // Tienda
  shopEnabled: z.boolean().optional(),
  requirePurchaseApproval: z.boolean().optional(),
  dailyPurchaseLimit: z.number().int().min(0).optional().nullable(),
  
  // Visualización
  showCharacterName: z.boolean().optional(),
  
  // Clanes
  clansEnabled: z.boolean().optional(),
  clanXpPercentage: z.number().int().min(0).max(100).optional(),
  clanBattlesEnabled: z.boolean().optional(),
  clanGpRewardEnabled: z.boolean().optional(),
  
  // Racha de login
  loginStreakEnabled: z.boolean().optional(),
  loginStreakConfig: z.object({
    dailyXp: z.number().int().min(0).default(5),
    milestones: z.array(z.object({
      day: z.number().int().min(1),
      xp: z.number().int().min(0),
      gp: z.number().int().min(0),
      randomItem: z.boolean(),
    })).default([]),
    resetOnMiss: z.boolean().default(true),
    graceDays: z.number().int().min(0).max(7).default(0),
  }).optional().nullable(),
});

const joinClassroomSchema = z.object({
  code: z.string().length(6),
  characterName: z.string().min(2).max(100),
  characterClass: z.enum(['GUARDIAN', 'ARCANE', 'EXPLORER', 'ALCHEMIST']),
});

export class ClassroomController {
  async create(req: Request, res: Response) {
    try {
      const data = createClassroomSchema.parse(req.body);
      const classroom = await classroomService.create({
        ...data,
        teacherId: req.user!.id,
      });

      res.status(201).json({
        success: true,
        message: 'Clase creada exitosamente',
        data: classroom,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al crear la clase',
      });
    }
  }

  async getMyClassrooms(req: Request, res: Response) {
    try {
      const classrooms = await classroomService.getByTeacher(req.user!.id);
      res.json({
        success: true,
        data: classrooms,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener las clases',
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const classroom = await classroomService.getById(id);
      
      if (!classroom) {
        return res.status(404).json({
          success: false,
          message: 'Clase no encontrada',
        });
      }

      // Verificar que el usuario tenga acceso a esta clase
      // Si es una clase de escuela (B2B), verificar permisos de escuela
      if (classroom.schoolId) {
        const { schoolService } = await import('../services/school.service.js');
        const member = await schoolService.getMemberByUserId(classroom.schoolId, userId);
        if (!member) {
          return res.status(403).json({
            success: false,
            message: 'No tienes acceso a esta clase',
          });
        }
        // Si es profesor (no admin), verificar que sea el profesor asignado
        const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
        if (!isAdmin && classroom.teacherId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes acceso a esta clase',
          });
        }
      } else {
        // Clase B2C: solo el profesor dueño puede acceder
        if (classroom.teacherId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'No tienes acceso a esta clase',
          });
        }
      }

      const students = await classroomService.getStudents(id);

      res.json({
        success: true,
        data: { ...classroom, students },
      });
    } catch (error) {
      console.error('Error getting classroom:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener la clase',
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = updateClassroomSchema.parse(req.body);
      const classroom = await classroomService.update(id, req.user!.id, data);

      res.json({
        success: true,
        message: 'Clase actualizada',
        data: classroom,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      if (error instanceof Error && error.message === 'No autorizado') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para editar esta clase',
        });
      }
      console.error('Error updating classroom:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar la clase',
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await classroomService.delete(id, req.user!.id);

      res.json({
        success: true,
        message: 'Clase eliminada',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'No autorizado') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar esta clase',
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al eliminar la clase',
      });
    }
  }

  async resetAllPoints(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await classroomService.resetAllPoints(id, req.user!.id);

      res.json({
        success: true,
        message: 'Puntos de todos los estudiantes reseteados',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'No autorizado') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para esta acción',
        });
      }
      console.error('Error resetting points:', error);
      res.status(500).json({
        success: false,
        message: 'Error al resetear puntos',
      });
    }
  }

  async join(req: Request, res: Response) {
    try {
      const data = joinClassroomSchema.parse(req.body);
      const result = await classroomService.joinByCode(
        data.code,
        req.user!.id,
        data.characterName,
        data.characterClass
      );

      res.status(201).json({
        success: true,
        message: `Te has unido a ${result.classroom.name}`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        message: 'Error al unirse a la clase',
      });
    }
  }
}

export const classroomController = new ClassroomController();
