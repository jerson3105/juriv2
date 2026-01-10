import type { Request, Response } from 'express';
import { behaviorService } from '../services/behavior.service.js';
import { z } from 'zod';

const createBehaviorSchema = z.object({
  classroomId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  pointType: z.enum(['XP', 'HP', 'GP']),
  pointValue: z.number().int().min(0),
  xpValue: z.number().int().min(0).optional(),
  hpValue: z.number().int().min(0).optional(),
  gpValue: z.number().int().min(0).optional(),
  isPositive: z.boolean(),
  icon: z.string().max(50).optional(),
  competencyId: z.string().optional(),
});

const updateBehaviorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  pointType: z.enum(['XP', 'HP', 'GP']).optional(),
  pointValue: z.number().int().min(0).optional(),
  xpValue: z.number().int().min(0).optional(),
  hpValue: z.number().int().min(0).optional(),
  gpValue: z.number().int().min(0).optional(),
  isPositive: z.boolean().optional(),
  icon: z.string().max(50).optional(),
  competencyId: z.string().nullable().optional(),
});

const applyBehaviorSchema = z.object({
  behaviorId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1),
});

export class BehaviorController {
  // Crear comportamiento
  async create(req: Request, res: Response) {
    try {
      const data = createBehaviorSchema.parse(req.body);
      const behavior = await behaviorService.create(data);

      res.status(201).json({
        success: true,
        message: 'Comportamiento creado',
        data: behavior,
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
        message: 'Error al crear comportamiento',
      });
    }
  }

  // Obtener comportamientos de una clase
  async getByClassroom(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const behaviors = await behaviorService.getByClassroom(classroomId);

      res.json({
        success: true,
        data: behaviors,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener comportamientos',
      });
    }
  }

  // Obtener comportamientos positivos
  async getPositive(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const behaviors = await behaviorService.getPositive(classroomId);

      res.json({
        success: true,
        data: behaviors,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener comportamientos',
      });
    }
  }

  // Obtener comportamientos negativos
  async getNegative(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const behaviors = await behaviorService.getNegative(classroomId);

      res.json({
        success: true,
        data: behaviors,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener comportamientos',
      });
    }
  }

  // Actualizar comportamiento
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = updateBehaviorSchema.parse(req.body);
      const behavior = await behaviorService.update(id, data);

      res.json({
        success: true,
        message: 'Comportamiento actualizado',
        data: behavior,
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
        message: 'Error al actualizar comportamiento',
      });
    }
  }

  // Eliminar comportamiento
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await behaviorService.delete(id);

      res.json({
        success: true,
        message: 'Comportamiento eliminado',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al eliminar comportamiento',
      });
    }
  }

  // Aplicar comportamiento a estudiantes
  async apply(req: Request, res: Response) {
    try {
      const data = applyBehaviorSchema.parse(req.body);
      const result = await behaviorService.applyToStudents({
        ...data,
        teacherId: req.user!.id,
      });

      res.json({
        success: true,
        message: `${result.behavior.name} aplicado a ${result.studentsAffected} estudiante(s)`,
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
        message: 'Error al aplicar comportamiento',
      });
    }
  }
}

export const behaviorController = new BehaviorController();
