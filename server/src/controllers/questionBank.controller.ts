import { Request, Response } from 'express';
import { questionBankService } from '../services/questionBank.service.js';
import { z } from 'zod';
import { isAIRateLimitError } from '../utils/aiClient.js';
import { generateDrafts } from '../services/questionAi.service.js';
import { classroomService } from '../services/classroom.service.js';
import { generateIntoBank } from '../services/observatorioAi.service.js';
import { AppError } from '../utils/errors.js';
import { requireClassroomTeacher } from '../utils/access.js';

const questionTypeSchema = z.enum(['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING']);
const questionDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);

const booleanLikeSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return value;
}, z.boolean());

// Schemas de validacion
const createBankSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().trim().min(1).max(50).optional(),
});

const updateBankSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().trim().min(1).max(50).optional(),
  isActive: booleanLikeSchema.optional(),
});

const questionOptionSchema = z.object({
  text: z.string().trim().min(1).max(500),
  isCorrect: booleanLikeSchema,
});

const matchingPairSchema = z.object({
  left: z.string().trim().min(1).max(500),
  right: z.string().trim().min(1).max(500),
});

const createQuestionSchema = z.object({
  type: questionTypeSchema,
  difficulty: questionDifficultySchema.nullable().optional(),
  points: z.number().min(1).max(100).optional(),
  questionText: z.string().trim().min(1).max(2000),
  imageUrl: z.string().url().optional(),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: booleanLikeSchema.optional(),
  pairs: z.array(matchingPairSchema).optional(),
  explanation: z.string().trim().max(2000).optional(),
  timeLimitSeconds: z.number().min(5).max(300).optional(),
});

const updateQuestionSchema = z.object({
  type: questionTypeSchema.optional(),
  difficulty: questionDifficultySchema.nullable().optional(),
  points: z.number().min(1).max(100).optional(),
  questionText: z.string().trim().min(1).max(2000).optional(),
  imageUrl: z.string().url().nullable().optional(),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: booleanLikeSchema.optional(),
  pairs: z.array(matchingPairSchema).optional(),
  explanation: z.string().trim().max(2000).nullable().optional(),
  timeLimitSeconds: z.number().min(5).max(300).optional(),
  isActive: booleanLikeSchema.optional(),
});

// Observatorio: generar con IA y guardar directo en un banco de la clase.
const generateIntoBankSchema = z.object({
  topic: z.string().trim().min(2, 'Escribe el tema').max(200),
  quantity: z.coerce.number().int().min(3).max(15),
  kind: z.enum(['TRUE_FALSE', 'SINGLE_CHOICE', 'ERROR_STEPS']),
  bankId: z.string().uuid().optional().nullable(),
});

// IA con vista previa: borradores que el docente revisa antes de guardar.
const aiKindSchema = z.enum(['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'MATCHING', 'ERROR_STEPS']);
const aiDraftsSchema = z.object({
  topic: z.string().trim().min(2, 'Escribe el tema').max(300),
  quantity: z.coerce.number().int().min(1).max(20),
  kinds: z.array(aiKindSchema).min(1, 'Elige al menos un tipo').max(5),
  difficulty: questionDifficultySchema.nullable().optional(),
  level: z.string().trim().max(100).optional().nullable(),
});
// Multipart (PDF): los campos llegan como texto.
const aiDraftsPdfSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(20),
  kinds: z.preprocess((v) => (typeof v === 'string' ? JSON.parse(v) : v), z.array(aiKindSchema).min(1, 'Elige al menos un tipo').max(5)),
  difficulty: z.preprocess((v) => (v === '' || v === 'null' ? null : v), questionDifficultySchema.nullable().optional()),
  level: z.string().trim().max(100).optional().nullable(),
});
const batchSchema = z.object({
  questions: z.array(createQuestionSchema).min(1, 'No hay preguntas para guardar').max(50, 'Máximo 50 preguntas por vez'),
  aiGenerated: z.boolean().optional(),
});
const duplicateSchema = z.object({ targetClassroomId: z.string().uuid() });

const handleValidationError = (res: Response, error: z.ZodError) => {
  return res.status(400).json({
    success: false,
    message: error.errors[0]?.message && !error.errors[0].message.startsWith('Invalid') ? error.errors[0].message : 'Revisa los datos del formulario',
    errors: error.errors,
  });
};

const handleControllerError = (res: Response, error: unknown, fallbackMessage: string) => {
  console.error(fallbackMessage, error);

  const inheritedStatusCode = error instanceof AppError
    ? error.statusCode
    : (typeof error === 'object' && error !== null && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : undefined);

  let message = error instanceof Error ? error.message : fallbackMessage;
  const normalizedMessage = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let statusCode = inheritedStatusCode || 500;
  if (statusCode === 429 || isAIRateLimitError(error)) {
    statusCode = 429;
    message = 'La IA está temporalmente saturada. Intenta nuevamente en unos minutos o reduce la cantidad de preguntas.';
  } else if (normalizedMessage.includes('no encontrado')) {
    statusCode = 404;
  } else if (normalizedMessage.includes('sin acceso') || normalizedMessage.includes('no autorizado')) {
    statusCode = 403;
  } else if (normalizedMessage.includes('ya existe')) {
    statusCode = 409;
  } else if (
    normalizedMessage.includes('inval') ||
    normalizedMessage.includes('requiere') ||
    normalizedMessage.includes('debe') ||
    normalizedMessage.includes('al menos') ||
    normalizedMessage.includes('exactamente')
  ) {
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? fallbackMessage : message,
  });
};

// Acceso de profesor a la clase: ver utils/access.ts (requireClassroomTeacher).
const ensureTeacherClassroomAccess = requireClassroomTeacher;

const ensureTeacherBankAccess = async (
  req: Request,
  res: Response,
  bankId: string
): Promise<boolean> => {
  const teacherId = req.user?.id;
  if (!teacherId) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  const classroomId = await questionBankService.getClassroomIdByBank(bankId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Banco no encontrado' });
    return false;
  }

  const hasAccess = await questionBankService.verifyTeacherOwnsClassroom(teacherId, classroomId);
  if (!hasAccess) {
    res.status(403).json({ success: false, message: 'Sin acceso a este banco' });
    return false;
  }

  return true;
};

const ensureTeacherQuestionAccess = async (
  req: Request,
  res: Response,
  questionId: string
): Promise<boolean> => {
  const teacherId = req.user?.id;
  if (!teacherId) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  const classroomId = await questionBankService.getClassroomIdByQuestion(questionId);
  if (!classroomId) {
    res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
    return false;
  }

  const hasAccess = await questionBankService.verifyTeacherOwnsClassroom(teacherId, classroomId);
  if (!hasAccess) {
    res.status(403).json({ success: false, message: 'Sin acceso a esta pregunta' });
    return false;
  }

  return true;
};

class QuestionBankController {
  // ==================== BANCOS ====================

  async getBanks(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) {
        return;
      }

      const banks = await questionBankService.getBanksByClassroom(classroomId);
      res.json({ success: true, data: banks });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener bancos de preguntas');
    }
  }

  // GET /question-banks/mine: bancos de todas las clases del profesor
  async getMyBanks(req: Request, res: Response) {
    try {
      const banks = await questionBankService.getBanksForTeacher(req.user!.id);
      res.json({ success: true, data: banks });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener bancos de preguntas');
    }
  }

  async getBank(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) {
        return;
      }

      const bank = await questionBankService.getBankById(bankId);

      if (!bank) {
        return res.status(404).json({ success: false, message: 'Banco no encontrado' });
      }

      res.json({ success: true, data: bank });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener banco');
    }
  }

  async createBank(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) {
        return;
      }

      const validation = createBankSchema.safeParse(req.body);

      if (!validation.success) {
        return handleValidationError(res, validation.error);
      }

      const bank = await questionBankService.createBank({
        classroomId,
        ...validation.data,
      });

      res.status(201).json({ success: true, data: bank });
    } catch (error) {
      handleControllerError(res, error, 'Error al crear banco');
    }
  }

  async updateBank(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) {
        return;
      }

      const validation = updateBankSchema.safeParse(req.body);

      if (!validation.success) {
        return handleValidationError(res, validation.error);
      }

      const bank = await questionBankService.updateBank(bankId, validation.data);

      if (!bank) {
        return res.status(404).json({ success: false, message: 'Banco no encontrado' });
      }

      res.json({ success: true, data: bank });
    } catch (error) {
      handleControllerError(res, error, 'Error al actualizar banco');
    }
  }

  async deleteBank(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) {
        return;
      }

      await questionBankService.deleteBank(bankId);
      res.json({ success: true, message: 'Banco eliminado' });
    } catch (error) {
      handleControllerError(res, error, 'Error al eliminar banco');
    }
  }

  // ==================== PREGUNTAS ====================

  async getQuestions(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) {
        return;
      }

      const questions = await questionBankService.getQuestionsByBank(bankId);
      res.json({ success: true, data: questions });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener preguntas');
    }
  }

  async getQuestion(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      if (!(await ensureTeacherQuestionAccess(req, res, questionId))) {
        return;
      }

      const question = await questionBankService.getQuestionById(questionId);

      if (!question) {
        return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
      }

      res.json({ success: true, data: question });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener pregunta');
    }
  }

  async createQuestion(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) {
        return;
      }

      const validation = createQuestionSchema.safeParse(req.body);

      if (!validation.success) {
        return handleValidationError(res, validation.error);
      }

      const question = await questionBankService.createQuestion({
        bankId,
        ...validation.data,
      });

      res.status(201).json({ success: true, data: question });
    } catch (error) {
      handleControllerError(res, error, 'Error al crear pregunta');
    }
  }

  async updateQuestion(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      if (!(await ensureTeacherQuestionAccess(req, res, questionId))) {
        return;
      }

      const validation = updateQuestionSchema.safeParse(req.body);

      if (!validation.success) {
        return handleValidationError(res, validation.error);
      }

      const question = await questionBankService.updateQuestion(questionId, validation.data);

      if (!question) {
        return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
      }

      res.json({ success: true, data: question });
    } catch (error) {
      handleControllerError(res, error, 'Error al actualizar pregunta');
    }
  }

  async deleteQuestion(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      if (!(await ensureTeacherQuestionAccess(req, res, questionId))) {
        return;
      }

      await questionBankService.deleteQuestion(questionId);
      res.json({ success: true, message: 'Pregunta eliminada' });
    } catch (error) {
      handleControllerError(res, error, 'Error al eliminar pregunta');
    }
  }

  // ==================== GENERACIÓN CON IA (VISTA PREVIA) ====================

  // POST /question-banks/classroom/:classroomId/ai-drafts { topic, quantity, kinds, difficulty?, level? }
  async aiDrafts(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) return;
      const validation = aiDraftsSchema.safeParse(req.body);
      if (!validation.success) return handleValidationError(res, validation.error);
      const classroom = await classroomService.getById(classroomId);
      const drafts = await generateDrafts({
        kinds: validation.data.kinds, quantity: validation.data.quantity, topic: validation.data.topic,
        difficulty: validation.data.difficulty ?? null, gradeLevel: classroom?.gradeLevel, levelOverride: validation.data.level,
      });
      res.json({ success: true, data: drafts });
    } catch (error) {
      handleControllerError(res, error, 'No se pudieron generar las preguntas');
    }
  }

  // POST /question-banks/classroom/:classroomId/ai-drafts/pdf (multipart: pdf, quantity, kinds, difficulty?, level?)
  async aiDraftsFromPdf(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) return;
      if (!req.file) return res.status(400).json({ success: false, message: 'Sube un archivo PDF' });
      const validation = aiDraftsPdfSchema.safeParse(req.body);
      if (!validation.success) return handleValidationError(res, validation.error);
      const classroom = await classroomService.getById(classroomId);
      const drafts = await generateDrafts({
        kinds: validation.data.kinds, quantity: validation.data.quantity, pdf: req.file.buffer,
        difficulty: validation.data.difficulty ?? null, gradeLevel: classroom?.gradeLevel, levelOverride: validation.data.level,
      });
      res.json({ success: true, data: drafts });
    } catch (error) {
      handleControllerError(res, error, 'No se pudieron generar preguntas desde el PDF');
    }
  }

  // POST /question-banks/classroom/:classroomId/generate-into-bank
  async generateIntoBank(req: Request, res: Response) {
    try {
      const { classroomId } = req.params;
      if (!(await ensureTeacherClassroomAccess(req, res, classroomId))) return;
      const validation = generateIntoBankSchema.safeParse(req.body);
      if (!validation.success) return handleValidationError(res, validation.error);
      const data = await generateIntoBank({ classroomId, ...validation.data });
      res.status(201).json({ success: true, data });
    } catch (error) {
      handleControllerError(res, error, 'No se pudieron generar las preguntas');
    }
  }

  // ==================== LOTE, REVISIÓN, DESHACER Y DUPLICAR ====================

  // POST /question-banks/bank/:bankId/questions/batch { questions, aiGenerated? }
  async createQuestionsBatch(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) return;
      const validation = batchSchema.safeParse(req.body);
      if (!validation.success) return handleValidationError(res, validation.error);
      const result = await questionBankService.createQuestionsBatch(bankId, validation.data.questions, !!validation.data.aiGenerated);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      handleControllerError(res, error, 'No se pudieron guardar las preguntas');
    }
  }

  // POST /question-banks/question/:questionId/review
  async reviewQuestion(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      if (!(await ensureTeacherQuestionAccess(req, res, questionId))) return;
      res.json({ success: true, data: await questionBankService.markReviewed(questionId) });
    } catch (error) {
      handleControllerError(res, error, 'No se pudo marcar como revisada');
    }
  }

  // POST /question-banks/bank/:bankId/review-all
  async reviewBank(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) return;
      res.json({ success: true, data: await questionBankService.reviewAll(bankId) });
    } catch (error) {
      handleControllerError(res, error, 'No se pudo aprobar el banco');
    }
  }

  // POST /question-banks/question/:questionId/restore (Deshacer)
  async restoreQuestion(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      if (!(await ensureTeacherQuestionAccess(req, res, questionId))) return;
      res.json({ success: true, data: await questionBankService.restoreQuestion(questionId) });
    } catch (error) {
      handleControllerError(res, error, 'No se pudo restaurar la pregunta');
    }
  }

  // POST /question-banks/bank/:bankId/restore (Deshacer)
  async restoreBank(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) return;
      res.json({ success: true, data: await questionBankService.restoreBank(bankId) });
    } catch (error) {
      handleControllerError(res, error, 'No se pudo restaurar el banco');
    }
  }

  // POST /question-banks/bank/:bankId/duplicate { targetClassroomId }
  async duplicateBank(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) return;
      const validation = duplicateSchema.safeParse(req.body);
      if (!validation.success) return handleValidationError(res, validation.error);
      const data = await questionBankService.duplicateBank(bankId, validation.data.targetClassroomId, req.user!.id);
      res.status(201).json({ success: true, data });
    } catch (error) {
      handleControllerError(res, error, 'No se pudo duplicar el banco');
    }
  }
}

export const questionBankController = new QuestionBankController();
