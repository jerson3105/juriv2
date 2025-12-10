import { Request, Response } from 'express';
import { z } from 'zod';
import { battleService } from '../services/battle.service.js';

// Schemas de validación
const createBossSchema = z.object({
  classroomId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  bossName: z.string().min(1).max(255),
  bossHp: z.number().int().min(100).max(10000),
  bossImageUrl: z.string().optional(),
  xpReward: z.number().int().min(0).optional(),
  gpReward: z.number().int().min(0).optional(),
});

const updateBossSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  bossName: z.string().min(1).max(255).optional(),
  bossHp: z.number().int().min(100).max(10000).optional(),
  bossImageUrl: z.string().optional(),
  xpReward: z.number().int().min(0).optional(),
  gpReward: z.number().int().min(0).optional(),
});

const addQuestionSchema = z.object({
  questionType: z.enum(['TEXT', 'IMAGE']).optional(),
  battleQuestionType: z.enum(['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING']).optional(),
  question: z.string().min(1),
  imageUrl: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().int().min(0).optional(),
  correctIndices: z.array(z.number().int().min(0)).optional(),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })).optional(),
  damage: z.number().int().min(1).optional(),
  hpPenalty: z.number().int().min(0).optional(),
  timeLimit: z.number().int().min(5).max(120).optional(),
});

const updateQuestionSchema = z.object({
  questionType: z.enum(['TEXT', 'IMAGE']).optional(),
  battleQuestionType: z.enum(['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING']).optional(),
  question: z.string().min(1).optional(),
  imageUrl: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().int().min(0).optional(),
  correctIndices: z.array(z.number().int().min(0)).optional(),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })).optional(),
  damage: z.number().int().min(1).optional(),
  hpPenalty: z.number().int().min(0).optional(),
  timeLimit: z.number().int().min(5).max(120).optional(),
});

const startBattleSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1),
});

const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedIndex: z.number().int().min(0),
  timeSpent: z.number().int().min(0),
});

class BattleController {
  // ==================== BOSS CRUD ====================

  async createBoss(req: Request, res: Response) {
    try {
      const data = createBossSchema.parse(req.body);
      const boss = await battleService.createBoss(data);
      res.status(201).json(boss);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error creating boss:', error);
      res.status(500).json({ message: 'Error al crear boss' });
    }
  }

  async getBossesByClassroom(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const bosses = await battleService.getBossesByClassroom(classroomId);
      res.json(bosses);
    } catch (error) {
      console.error('Error getting bosses:', error);
      res.status(500).json({ message: 'Error al obtener bosses' });
    }
  }

  // Obtener batallas activas para un estudiante
  async getActiveBattlesForStudent(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      const battles = await battleService.getActiveBattlesForStudent(studentId);
      res.json(battles);
    } catch (error) {
      console.error('Error getting active battles:', error);
      res.status(500).json({ message: 'Error al obtener batallas activas' });
    }
  }

  async getBossById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const boss = await battleService.getBattleState(id);
      if (!boss) {
        return res.status(404).json({ message: 'Boss no encontrado' });
      }
      res.json(boss);
    } catch (error) {
      console.error('Error getting boss:', error);
      res.status(500).json({ message: 'Error al obtener boss' });
    }
  }

  async updateBoss(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = updateBossSchema.parse(req.body);
      const boss = await battleService.updateBoss(id, data);
      res.json(boss);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error updating boss:', error);
      res.status(500).json({ message: 'Error al actualizar boss' });
    }
  }

  async deleteBoss(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await battleService.deleteBoss(id);
      res.json({ message: 'Boss eliminado' });
    } catch (error) {
      console.error('Error deleting boss:', error);
      res.status(500).json({ message: 'Error al eliminar boss' });
    }
  }

  async duplicateBoss(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const boss = await battleService.duplicateBoss(id);
      res.status(201).json(boss);
    } catch (error) {
      console.error('Error duplicating boss:', error);
      res.status(500).json({ message: 'Error al duplicar boss' });
    }
  }

  // ==================== PREGUNTAS ====================

  async addQuestion(req: Request, res: Response) {
    try {
      const { battleId } = req.params;
      const data = addQuestionSchema.parse(req.body);
      
      // Validar según el tipo de pregunta
      if (data.battleQuestionType === 'MATCHING') {
        if (!data.pairs || data.pairs.length < 2) {
          return res.status(400).json({ message: 'Se necesitan al menos 2 pares para preguntas de unir' });
        }
      } else if (data.battleQuestionType !== 'TRUE_FALSE') {
        // Para SINGLE_CHOICE y MULTIPLE_CHOICE
        if (!data.options || data.options.length < 2) {
          return res.status(400).json({ message: 'Se necesitan al menos 2 opciones' });
        }
        if (data.correctIndex !== undefined && data.correctIndex >= data.options.length) {
          return res.status(400).json({ message: 'Índice de respuesta correcta inválido' });
        }
      }

      const question = await battleService.addQuestion({ ...data, battleId });
      res.status(201).json(question);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error adding question:', error);
      res.status(500).json({ message: 'Error al agregar pregunta' });
    }
  }

  async getQuestions(req: Request, res: Response) {
    try {
      const { battleId } = req.params;
      const questions = await battleService.getQuestionsByBattle(battleId);
      res.json(questions);
    } catch (error) {
      console.error('Error getting questions:', error);
      res.status(500).json({ message: 'Error al obtener preguntas' });
    }
  }

  async updateQuestion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = updateQuestionSchema.parse(req.body);
      
      // Validar correctIndex si se proporcionan options
      if (data.options && data.correctIndex !== undefined && data.correctIndex >= data.options.length) {
        return res.status(400).json({ message: 'Índice de respuesta correcta inválido' });
      }

      const question = await battleService.updateQuestion(id, data);
      res.json(question);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error updating question:', error);
      res.status(500).json({ message: 'Error al actualizar pregunta' });
    }
  }

  async deleteQuestion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await battleService.deleteQuestion(id);
      res.json({ message: 'Pregunta eliminada' });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ message: 'Error al eliminar pregunta' });
    }
  }

  async reorderQuestions(req: Request, res: Response) {
    try {
      const { battleId } = req.params;
      const { questionIds } = req.body;
      
      if (!Array.isArray(questionIds)) {
        return res.status(400).json({ message: 'questionIds debe ser un array' });
      }

      await battleService.reorderQuestions(battleId, questionIds);
      res.json({ message: 'Preguntas reordenadas' });
    } catch (error) {
      console.error('Error reordering questions:', error);
      res.status(500).json({ message: 'Error al reordenar preguntas' });
    }
  }

  // ==================== BATALLA EN VIVO ====================

  async startBattle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { studentIds } = startBattleSchema.parse(req.body);
      
      const battle = await battleService.startBattle(id, studentIds);
      res.json(battle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error starting battle:', error);
      res.status(500).json({ message: 'Error al iniciar batalla' });
    }
  }

  async getBattleState(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const state = await battleService.getBattleState(id);
      if (!state) {
        return res.status(404).json({ message: 'Batalla no encontrada' });
      }
      res.json(state);
    } catch (error) {
      console.error('Error getting battle state:', error);
      res.status(500).json({ message: 'Error al obtener estado de batalla' });
    }
  }

  async submitAnswer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { studentId } = req.params;
      const data = submitAnswerSchema.parse(req.body);
      
      const result = await battleService.submitAnswer({
        battleId: id,
        studentId,
        ...data,
      });

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      }
      console.error('Error submitting answer:', error);
      res.status(500).json({ message: 'Error al enviar respuesta' });
    }
  }

  async endBattle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['VICTORY', 'DEFEAT', 'COMPLETED'].includes(status)) {
        return res.status(400).json({ message: 'Estado inválido' });
      }

      const battle = await battleService.endBattle(id, status);
      res.json(battle);
    } catch (error) {
      console.error('Error ending battle:', error);
      res.status(500).json({ message: 'Error al finalizar batalla' });
    }
  }

  async getBattleResults(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const results = await battleService.getBattleResults(id);
      res.json(results);
    } catch (error) {
      console.error('Error getting battle results:', error);
      res.status(500).json({ message: 'Error al obtener resultados' });
    }
  }

  // Aplicar daño manualmente (modo presencial)
  async applyManualDamage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { damage, studentIds, wrongStudentIds, hpDamage } = req.body;
      
      if (damage === undefined || !studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({ message: 'Datos inválidos' });
      }

      const result = await battleService.applyManualDamage(
        id, 
        damage, 
        studentIds,
        wrongStudentIds,
        hpDamage
      );
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error applying manual damage:', error);
      res.status(500).json({ message: 'Error al aplicar daño' });
    }
  }
}

export const battleController = new BattleController();
