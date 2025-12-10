import { Request, Response } from 'express';
import { clanService, CLAN_EMBLEMS, CLAN_COLORS } from '../services/clan.service.js';
import { z } from 'zod';

const createClanSchema = z.object({
  name: z.string().min(2).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  emblem: z.string().optional(),
  motto: z.string().max(255).optional(),
  maxMembers: z.number().min(2).max(50).optional(),
});

const updateClanSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  emblem: z.string().optional(),
  motto: z.string().max(255).optional(),
  maxMembers: z.number().min(2).max(50).optional(),
  isActive: z.boolean().optional(),
});

const assignStudentSchema = z.object({
  studentId: z.string().uuid(),
});

class ClanController {
  // Obtener opciones disponibles (emblemas y colores)
  async getOptions(_req: Request, res: Response) {
    res.json({
      success: true,
      data: {
        emblems: CLAN_EMBLEMS,
        colors: CLAN_COLORS,
      },
    });
  }

  // Obtener todos los clanes de una clase
  async getClassroomClans(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const clans = await clanService.getClassroomClans(classroomId);

      res.json({
        success: true,
        data: clans,
      });
    } catch (error) {
      console.error('Error getting clans:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener clanes',
      });
    }
  }

  // Obtener un clan específico
  async getClan(req: Request, res: Response) {
    try {
      const { clanId } = req.params;
      const clan = await clanService.getClanById(clanId);

      if (!clan) {
        return res.status(404).json({
          success: false,
          message: 'Clan no encontrado',
        });
      }

      res.json({
        success: true,
        data: clan,
      });
    } catch (error) {
      console.error('Error getting clan:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener clan',
      });
    }
  }

  // Crear un nuevo clan
  async createClan(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const data = createClanSchema.parse(req.body);

      const clan = await clanService.createClan({
        classroomId,
        ...data,
      });

      res.status(201).json({
        success: true,
        message: 'Clan creado exitosamente',
        data: clan,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      console.error('Error creating clan:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear clan',
      });
    }
  }

  // Actualizar un clan
  async updateClan(req: Request, res: Response) {
    try {
      const { clanId } = req.params;
      const data = updateClanSchema.parse(req.body);

      const clan = await clanService.updateClan(clanId, data);

      res.json({
        success: true,
        message: 'Clan actualizado',
        data: clan,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors: error.errors,
        });
      }
      console.error('Error updating clan:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar clan',
      });
    }
  }

  // Eliminar un clan
  async deleteClan(req: Request, res: Response) {
    try {
      const { clanId } = req.params;
      await clanService.deleteClan(clanId);

      res.json({
        success: true,
        message: 'Clan eliminado',
      });
    } catch (error) {
      console.error('Error deleting clan:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar clan',
      });
    }
  }

  // Asignar estudiante a un clan
  async assignStudent(req: Request, res: Response) {
    try {
      const { clanId } = req.params;
      const { studentId } = assignStudentSchema.parse(req.body);

      const clan = await clanService.assignStudentToClan(studentId, clanId);

      res.json({
        success: true,
        message: 'Estudiante asignado al clan',
        data: clan,
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
      console.error('Error assigning student:', error);
      res.status(500).json({
        success: false,
        message: 'Error al asignar estudiante',
      });
    }
  }

  // Quitar estudiante de un clan
  async removeStudent(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      await clanService.removeStudentFromClan(studentId);

      res.json({
        success: true,
        message: 'Estudiante removido del clan',
      });
    } catch (error) {
      console.error('Error removing student:', error);
      res.status(500).json({
        success: false,
        message: 'Error al remover estudiante',
      });
    }
  }

  // Asignar estudiantes aleatoriamente
  async assignRandomly(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const result = await clanService.assignStudentsRandomly(classroomId);

      res.json({
        success: true,
        message: `${result.assigned} estudiantes asignados a ${result.clans} clanes`,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      console.error('Error assigning randomly:', error);
      res.status(500).json({
        success: false,
        message: 'Error al asignar estudiantes',
      });
    }
  }

  // Obtener ranking de clanes
  async getRanking(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const ranking = await clanService.getClanRanking(classroomId);

      res.json({
        success: true,
        data: ranking,
      });
    } catch (error) {
      console.error('Error getting ranking:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener ranking',
      });
    }
  }

  // Obtener historial de un clan
  async getClanHistory(req: Request, res: Response) {
    try {
      const { clanId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await clanService.getClanHistory(clanId, limit);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error getting clan history:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener historial',
      });
    }
  }

  // Obtener información del clan de un estudiante
  async getStudentClanInfo(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const info = await clanService.getStudentClanInfo(studentId);

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      console.error('Error getting student clan info:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener información del clan',
      });
    }
  }
}

export const clanController = new ClanController();
