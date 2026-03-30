import { Request, Response } from 'express';
import { questionBankService } from '../services/questionBank.service.js';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

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
  difficulty: questionDifficultySchema.optional(),
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
  difficulty: questionDifficultySchema.optional(),
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

const randomQuestionsQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(100).default(10),
  difficulty: questionDifficultySchema.optional(),
});

const generateWithAISchema = z.object({
  topic: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().int().min(1).max(50),
  level: z.string().trim().min(1).max(100),
  questionTypes: z.array(questionTypeSchema).min(1).max(4).optional(),
  difficulty: questionDifficultySchema.optional(),
});

const generateFromPDFSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(50),
  level: z.string().trim().min(1).max(100),
  questionTypes: z.preprocess(
    (val) => typeof val === 'string' ? JSON.parse(val) : val,
    z.array(questionTypeSchema).min(1).max(4).optional()
  ),
  difficulty: z.preprocess(
    (val) => val === '' ? undefined : val,
    questionDifficultySchema.optional()
  ),
});

const DEFAULT_AI_TYPES: Array<z.infer<typeof questionTypeSchema>> = [
  'TRUE_FALSE',
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'MATCHING',
];

const handleValidationError = (res: Response, error: z.ZodError) => {
  return res.status(400).json({
    success: false,
    message: 'Datos invalidos',
    errors: error.errors,
  });
};

const handleControllerError = (res: Response, error: unknown, fallbackMessage: string) => {
  console.error(fallbackMessage, error);

  const message = error instanceof Error ? error.message : fallbackMessage;
  const normalizedMessage = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let statusCode = 500;
  if (normalizedMessage.includes('no encontrado')) {
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

const ensureTeacherClassroomAccess = async (
  req: Request,
  res: Response,
  classroomId: string
): Promise<boolean> => {
  const teacherId = req.user?.id;
  if (!teacherId) {
    res.status(401).json({ success: false, message: 'No autenticado' });
    return false;
  }

  const hasAccess = await questionBankService.verifyTeacherOwnsClassroom(teacherId, classroomId);
  if (!hasAccess) {
    res.status(403).json({ success: false, message: 'Sin acceso a este salon' });
    return false;
  }

  return true;
};

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

  // ==================== UTILIDADES ====================

  async getRandomQuestions(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) {
        return;
      }

      const validation = randomQuestionsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return handleValidationError(res, validation.error);
      }

      const questions = await questionBankService.getRandomQuestions(
        bankId,
        validation.data.count,
        validation.data.difficulty
      );

      res.json({ success: true, data: questions });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener preguntas aleatorias');
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const { bankId } = req.params;
      if (!(await ensureTeacherBankAccess(req, res, bankId))) {
        return;
      }

      const stats = await questionBankService.getQuestionStats(bankId);
      res.json({ success: true, data: stats });
    } catch (error) {
      handleControllerError(res, error, 'Error al obtener estadisticas');
    }
  }

  async checkAnswer(req: Request, res: Response) {
    try {
      const { questionId } = req.params;
      const { answer } = req.body;

      if (!(await ensureTeacherQuestionAccess(req, res, questionId))) {
        return;
      }

      const question = await questionBankService.getQuestionById(questionId);
      if (!question) {
        return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
      }

      const result = questionBankService.checkAnswer(question, answer);
      res.json({ success: true, data: result });
    } catch (error) {
      handleControllerError(res, error, 'Error al verificar respuesta');
    }
  }

  // ==================== GENERACIÓN CON IA ====================

  async generateWithAI(req: Request, res: Response) {
    try {
      const validation = generateWithAISchema.safeParse(req.body);
      if (!validation.success) {
        return handleValidationError(res, validation.error);
      }

      const { topic, quantity, level, questionTypes, difficulty } = validation.data;

      // Configurar tipos de preguntas a generar
      const types = questionTypes && questionTypes.length > 0
        ? questionTypes 
        : DEFAULT_AI_TYPES;

      const typesDescription = types.map((t) => {
        switch(t) {
          case 'TRUE_FALSE': return 'Verdadero/Falso (TRUE_FALSE)';
          case 'SINGLE_CHOICE': return 'Selección única (SINGLE_CHOICE)';
          case 'MULTIPLE_CHOICE': return 'Selección múltiple (MULTIPLE_CHOICE)';
          case 'MATCHING': return 'Relacionar pares (MATCHING)';
          default: return t;
        }
      }).join(', ');

      const difficultyText = difficulty || 'variada (EASY, MEDIUM, HARD)';

      // Construir el prompt
      const prompt = `Genera exactamente ${quantity} preguntas sobre "${topic}" para estudiantes de ${level}.

REGLAS ESTRICTAS:
1. Genera ÚNICAMENTE los siguientes tipos de preguntas: ${typesDescription}
2. Dificultad: ${difficultyText}
3. Responde SOLO con el CSV, sin explicaciones adicionales
4. Usa EXACTAMENTE este formato CSV:

type,difficulty,points,questionText,options,correctAnswer,pairs,explanation,timeLimitSeconds

EJEMPLOS POR TIPO:
- TRUE_FALSE: TRUE_FALSE,EASY,10,"La Tierra es el tercer planeta del sistema solar",,true,,"La Tierra orbita al Sol en la tercera posición",20
- SINGLE_CHOICE: SINGLE_CHOICE,MEDIUM,15,"¿Cuál es la capital de Francia?","[{""text"":""Londres"",""isCorrect"":false},{""text"":""París"",""isCorrect"":true},{""text"":""Madrid"",""isCorrect"":false},{""text"":""Roma"",""isCorrect"":false}]",,,"París es la capital y ciudad más poblada de Francia",30
- MULTIPLE_CHOICE: MULTIPLE_CHOICE,HARD,20,"¿Cuáles son números primos?","[{""text"":""2"",""isCorrect"":true},{""text"":""4"",""isCorrect"":false},{""text"":""7"",""isCorrect"":true},{""text"":""9"",""isCorrect"":false}]",,,"2 y 7 son primos porque solo son divisibles por 1 y ellos mismos",45
- MATCHING: MATCHING,MEDIUM,25,"Relaciona cada país con su capital",,,"[{""left"":""España"",""right"":""Madrid""},{""left"":""Italia"",""right"":""Roma""},{""left"":""Alemania"",""right"":""Berlín""}]","Las capitales son las ciudades principales de cada país",40

IMPORTANTE:
- Cada fila DEBE tener EXACTAMENTE 9 columnas separadas por comas (type,difficulty,points,questionText,options,correctAnswer,pairs,explanation,timeLimitSeconds)
- La columna "explanation" es OBLIGATORIA en TODAS las preguntas. NUNCA la dejes vacía. Siempre incluye una explicación educativa de al menos 10 palabras que ayude al estudiante a entender la respuesta
- Las comillas dentro del JSON deben ser dobles ("")
- Para SINGLE_CHOICE solo una opción debe tener isCorrect:true
- Para MULTIPLE_CHOICE puede haber múltiples opciones correctas
- Para MATCHING genera al menos 3 pares
- Varía la dificultad si no se especifica una única
- Los puntos deben ser: EASY=10, MEDIUM=15-20, HARD=25-30

Genera ${quantity} preguntas variadas y educativas:`;

      // Inicializar cliente de Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'API Key de Gemini no configurada'
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      let csvText = (response.text || '').trim();

      if (!csvText) {
        return res.status(500).json({
          success: false,
          message: 'La IA no genero contenido'
        });
      }

      // Limpiar bloques markdown que Gemini a veces agrega
      csvText = csvText.replace(/^```(?:csv|CSV)?\s*\n?/gm, '').replace(/```\s*$/gm, '').trim();

      res.json({
        success: true,
        data: {
          csv: csvText,
          prompt: prompt
        }
      });

    } catch (error) {
      handleControllerError(res, error, 'Error al generar preguntas con IA');
    }
  }

  // ==================== GENERACIÓN DESDE PDF ====================

  async generateFromPDF(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se proporcionó un archivo PDF'
        });
      }

      const validation = generateFromPDFSchema.safeParse(req.body);
      if (!validation.success) {
        return handleValidationError(res, validation.error);
      }

      const { quantity, level, questionTypes, difficulty } = validation.data;

      // Configurar tipos de preguntas a generar
      const types = questionTypes && questionTypes.length > 0
        ? questionTypes
        : DEFAULT_AI_TYPES;

      const typesDescription = types.map((t) => {
        switch(t) {
          case 'TRUE_FALSE': return 'Verdadero/Falso (TRUE_FALSE)';
          case 'SINGLE_CHOICE': return 'Selección única (SINGLE_CHOICE)';
          case 'MULTIPLE_CHOICE': return 'Selección múltiple (MULTIPLE_CHOICE)';
          case 'MATCHING': return 'Relacionar pares (MATCHING)';
          default: return t;
        }
      }).join(', ');

      const difficultyText = difficulty || 'variada (EASY, MEDIUM, HARD)';

      // Construir el prompt
      const prompt = `Analiza el contenido del documento PDF adjunto y genera exactamente ${quantity} preguntas basadas en su contenido para estudiantes de ${level}.

REGLAS ESTRICTAS:
1. Las preguntas DEBEN estar basadas en el contenido del documento
2. Genera ÚNICAMENTE los siguientes tipos de preguntas: ${typesDescription}
3. Dificultad: ${difficultyText}
4. Responde SOLO con el CSV, sin explicaciones adicionales
5. Usa EXACTAMENTE este formato CSV:

type,difficulty,points,questionText,options,correctAnswer,pairs,explanation,timeLimitSeconds

EJEMPLOS POR TIPO:
- TRUE_FALSE: TRUE_FALSE,EASY,10,"La Tierra es el tercer planeta del sistema solar",,true,,"La Tierra orbita al Sol en la tercera posición",20
- SINGLE_CHOICE: SINGLE_CHOICE,MEDIUM,15,"¿Cuál es la capital de Francia?","[{""text"":""Londres"",""isCorrect"":false},{""text"":""París"",""isCorrect"":true},{""text"":""Madrid"",""isCorrect"":false},{""text"":""Roma"",""isCorrect"":false}]",,,"París es la capital y ciudad más poblada de Francia",30
- MULTIPLE_CHOICE: MULTIPLE_CHOICE,HARD,20,"¿Cuáles son números primos?","[{""text"":""2"",""isCorrect"":true},{""text"":""4"",""isCorrect"":false},{""text"":""7"",""isCorrect"":true},{""text"":""9"",""isCorrect"":false}]",,,"2 y 7 son primos porque solo son divisibles por 1 y ellos mismos",45
- MATCHING: MATCHING,MEDIUM,25,"Relaciona cada país con su capital",,,"[{""left"":""España"",""right"":""Madrid""},{""left"":""Italia"",""right"":""Roma""},{""left"":""Alemania"",""right"":""Berlín""}]","Las capitales son las ciudades principales de cada país",40

IMPORTANTE:
- Cada fila DEBE tener EXACTAMENTE 9 columnas separadas por comas (type,difficulty,points,questionText,options,correctAnswer,pairs,explanation,timeLimitSeconds)
- La columna "explanation" es OBLIGATORIA en TODAS las preguntas. NUNCA la dejes vacía. Siempre incluye una explicación educativa de al menos 10 palabras que ayude al estudiante a entender la respuesta
- Las comillas dentro del JSON deben ser dobles ("")
- Para SINGLE_CHOICE solo una opción debe tener isCorrect:true
- Para MULTIPLE_CHOICE puede haber múltiples opciones correctas
- Para MATCHING genera al menos 3 pares
- Varía la dificultad si no se especifica una única
- Los puntos deben ser: EASY=10, MEDIUM=15-20, HARD=25-30

Genera ${quantity} preguntas variadas y educativas basadas en el documento:`;

      // Inicializar cliente de Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: 'API Key de Gemini no configurada'
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      // Convertir el buffer del PDF a base64 para enviar como inlineData
      const pdfBase64 = req.file.buffer.toString('base64');

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
      });

      let csvText = (response.text || '').trim();

      if (!csvText) {
        return res.status(500).json({
          success: false,
          message: 'La IA no generó contenido a partir del PDF'
        });
      }

      // Limpiar bloques markdown que Gemini a veces agrega
      csvText = csvText.replace(/^```(?:csv|CSV)?\s*\n?/gm, '').replace(/```\s*$/gm, '').trim();

      res.json({
        success: true,
        data: {
          csv: csvText,
          prompt: prompt
        }
      });

    } catch (error) {
      handleControllerError(res, error, 'Error al generar preguntas desde PDF');
    }
  }

  // Exportar bancos a otras clases
  async exportBanks(req: Request, res: Response) {
    try {
      const schema = z.object({
        bankIds: z.array(z.string()).min(1, 'Selecciona al menos un banco'),
        targetClassroomIds: z.array(z.string()).min(1, 'Selecciona al menos una clase destino'),
      });
      const data = schema.parse(req.body);
      const result = await questionBankService.exportBanks(
        data.bankIds,
        data.targetClassroomIds,
        req.user!.id,
      );

      res.json({
        success: true,
        message: `${result.exportedBanks} banco(s) exportado(s) a ${result.targetClassrooms} clase(s)`,
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
        message: 'Error al exportar bancos de preguntas',
      });
    }
  }
}

export const questionBankController = new QuestionBankController();
