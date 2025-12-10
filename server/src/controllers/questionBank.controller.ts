import { Request, Response } from 'express';
import { questionBankService } from '../services/questionBank.service.js';
import { z } from 'zod';

// Schemas de validación
const createBankSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

const updateBankSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
});

const questionOptionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const matchingPairSchema = z.object({
  left: z.string().min(1),
  right: z.string().min(1),
});

const createQuestionSchema = z.object({
  type: z.enum(['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  points: z.number().min(1).max(100).optional(),
  questionText: z.string().min(1),
  imageUrl: z.string().url().optional(),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.boolean().optional(),
  pairs: z.array(matchingPairSchema).optional(),
  explanation: z.string().optional(),
  timeLimitSeconds: z.number().min(5).max(300).optional(),
});

const updateQuestionSchema = z.object({
  type: z.enum(['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING']).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  points: z.number().min(1).max(100).optional(),
  questionText: z.string().min(1).optional(),
  imageUrl: z.string().url().nullable().optional(),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.boolean().optional(),
  pairs: z.array(matchingPairSchema).optional(),
  explanation: z.string().nullable().optional(),
  timeLimitSeconds: z.number().min(5).max(300).optional(),
  isActive: z.boolean().optional(),
});

class QuestionBankController {
  // ==================== BANCOS ====================

  async getBanks(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const banks = await questionBankService.getBanksByClassroom(classroomId);
      res.json({ success: true, data: banks });
    } catch (error) {
      console.error('Error getting banks:', error);
      res.status(500).json({ success: false, message: 'Error al obtener bancos de preguntas' });
    }
  }

  async getBank(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      const bank = await questionBankService.getBankById(bankId);
      
      if (!bank) {
        return res.status(404).json({ success: false, message: 'Banco no encontrado' });
      }

      res.json({ success: true, data: bank });
    } catch (error) {
      console.error('Error getting bank:', error);
      res.status(500).json({ success: false, message: 'Error al obtener banco' });
    }
  }

  async createBank(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      const validation = createBankSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Datos inválidos',
          errors: validation.error.errors 
        });
      }

      const bank = await questionBankService.createBank({
        classroomId,
        ...validation.data,
      });

      res.status(201).json({ success: true, data: bank });
    } catch (error) {
      console.error('Error creating bank:', error);
      res.status(500).json({ success: false, message: 'Error al crear banco' });
    }
  }

  async updateBank(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      const validation = updateBankSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Datos inválidos',
          errors: validation.error.errors 
        });
      }

      const bank = await questionBankService.updateBank(bankId, validation.data);
      res.json({ success: true, data: bank });
    } catch (error) {
      console.error('Error updating bank:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar banco' });
    }
  }

  async deleteBank(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      await questionBankService.deleteBank(bankId);
      res.json({ success: true, message: 'Banco eliminado' });
    } catch (error) {
      console.error('Error deleting bank:', error);
      res.status(500).json({ success: false, message: 'Error al eliminar banco' });
    }
  }

  // ==================== PREGUNTAS ====================

  async getQuestions(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      const questions = await questionBankService.getQuestionsByBank(bankId);
      res.json({ success: true, data: questions });
    } catch (error) {
      console.error('Error getting questions:', error);
      res.status(500).json({ success: false, message: 'Error al obtener preguntas' });
    }
  }

  async getQuestion(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      const question = await questionBankService.getQuestionById(questionId);
      
      if (!question) {
        return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
      }

      res.json({ success: true, data: question });
    } catch (error) {
      console.error('Error getting question:', error);
      res.status(500).json({ success: false, message: 'Error al obtener pregunta' });
    }
  }

  async createQuestion(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      const validation = createQuestionSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Datos inválidos',
          errors: validation.error.errors 
        });
      }

      const question = await questionBankService.createQuestion({
        bankId,
        ...validation.data,
      });

      res.status(201).json({ success: true, data: question });
    } catch (error: any) {
      console.error('Error creating question:', error);
      res.status(400).json({ success: false, message: error.message || 'Error al crear pregunta' });
    }
  }

  async updateQuestion(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      const validation = updateQuestionSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Datos inválidos',
          errors: validation.error.errors 
        });
      }

      const question = await questionBankService.updateQuestion(questionId, validation.data);
      res.json({ success: true, data: question });
    } catch (error: any) {
      console.error('Error updating question:', error);
      res.status(400).json({ success: false, message: error.message || 'Error al actualizar pregunta' });
    }
  }

  async deleteQuestion(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      await questionBankService.deleteQuestion(questionId);
      res.json({ success: true, message: 'Pregunta eliminada' });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ success: false, message: 'Error al eliminar pregunta' });
    }
  }

  // ==================== UTILIDADES ====================

  async getRandomQuestions(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      const { count = 10, difficulty } = req.query;
      
      const questions = await questionBankService.getRandomQuestions(
        bankId,
        Number(count),
        difficulty as any
      );

      res.json({ success: true, data: questions });
    } catch (error) {
      console.error('Error getting random questions:', error);
      res.status(500).json({ success: false, message: 'Error al obtener preguntas aleatorias' });
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      const stats = await questionBankService.getQuestionStats(bankId);
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
    }
  }

  async checkAnswer(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      const { answer } = req.body;

      const question = await questionBankService.getQuestionById(questionId);
      if (!question) {
        return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
      }

      const result = questionBankService.checkAnswer(question, answer);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error checking answer:', error);
      res.status(500).json({ success: false, message: 'Error al verificar respuesta' });
    }
  }
}

export const questionBankController = new QuestionBankController();
