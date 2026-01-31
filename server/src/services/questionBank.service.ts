import { db } from '../db/index.js';
import { questionBanks, questions, type BankQuestionType, type QuestionDifficulty } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Interfaces
interface CreateBankData {
  classroomId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface UpdateBankData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

interface QuestionOption {
  text: string;
  isCorrect: boolean;
}

interface MatchingPair {
  left: string;
  right: string;
}

interface CreateQuestionData {
  bankId: string;
  type: BankQuestionType;
  difficulty?: QuestionDifficulty;
  points?: number;
  questionText: string;
  imageUrl?: string;
  options?: QuestionOption[];
  correctAnswer?: boolean;
  pairs?: MatchingPair[];
  explanation?: string;
  timeLimitSeconds?: number;
}

interface UpdateQuestionData {
  type?: BankQuestionType;
  difficulty?: QuestionDifficulty;
  points?: number;
  questionText?: string;
  imageUrl?: string | null;
  options?: QuestionOption[];
  correctAnswer?: boolean;
  pairs?: MatchingPair[];
  explanation?: string | null;
  timeLimitSeconds?: number;
  isActive?: boolean;
}

class QuestionBankService {
  // ==================== BANCOS ====================

  async getBanksByClassroom(classroomId: string) {
    // Obtener bancos
    const banks = await db.select()
      .from(questionBanks)
      .where(and(
        eq(questionBanks.classroomId, classroomId),
        eq(questionBanks.isActive, true)
      ))
      .orderBy(questionBanks.createdAt);

    // Contar preguntas por banco
    const banksWithCount = await Promise.all(
      banks.map(async (bank) => {
        const bankQuestions = await db.select()
          .from(questions)
          .where(and(
            eq(questions.bankId, bank.id),
            eq(questions.isActive, true)
          ));
        return {
          ...bank,
          questionCount: bankQuestions.length,
        };
      })
    );

    return banksWithCount;
  }

  async getBankById(bankId: string) {
    // Obtener banco
    const bank = await db.select()
      .from(questionBanks)
      .where(eq(questionBanks.id, bankId))
      .limit(1);

    if (!bank[0]) return null;

    // Obtener preguntas del banco
    const bankQuestions = await db.select()
      .from(questions)
      .where(and(
        eq(questions.bankId, bankId),
        eq(questions.isActive, true)
      ))
      .orderBy(questions.createdAt);

    return {
      ...bank[0],
      questions: bankQuestions,
    };
  }

  async createBank(data: CreateBankData) {
    const id = uuidv4();
    const now = new Date();

    await db.insert(questionBanks).values({
      id,
      classroomId: data.classroomId,
      name: data.name,
      description: data.description || null,
      color: data.color || '#6366f1',
      icon: data.icon || 'book',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return this.getBankById(id);
  }

  async updateBank(bankId: string, data: UpdateBankData) {
    await db.update(questionBanks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(questionBanks.id, bankId));

    return this.getBankById(bankId);
  }

  async deleteBank(bankId: string) {
    // Soft delete - marcar como inactivo
    await db.update(questionBanks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(questionBanks.id, bankId));
  }

  // ==================== PREGUNTAS ====================

  async getQuestionsByBank(bankId: string) {
    return db.select()
      .from(questions)
      .where(and(
        eq(questions.bankId, bankId),
        eq(questions.isActive, true)
      ))
      .orderBy(questions.createdAt);
  }

  async getQuestionById(questionId: string) {
    const result = await db.select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    return result[0] || null;
  }

  async createQuestion(data: CreateQuestionData) {
    const id = uuidv4();
    const now = new Date();

    // Validar datos según el tipo
    this.validateQuestionData(data);

    // Normalizar correctAnswer a booleano para TRUE_FALSE
    let normalizedCorrectAnswer: any = data.correctAnswer;
    if (data.type === 'TRUE_FALSE' && normalizedCorrectAnswer !== undefined) {
      if (typeof normalizedCorrectAnswer === 'string') {
        normalizedCorrectAnswer = (normalizedCorrectAnswer as string).toLowerCase() === 'true';
      }
    }

    await db.insert(questions).values({
      id,
      bankId: data.bankId,
      type: data.type,
      difficulty: data.difficulty || 'MEDIUM',
      points: data.points || 10,
      questionText: data.questionText,
      imageUrl: data.imageUrl || null,
      options: data.options ? JSON.stringify(data.options) : null,
      correctAnswer: normalizedCorrectAnswer !== undefined ? JSON.stringify(normalizedCorrectAnswer) : null,
      pairs: data.pairs ? JSON.stringify(data.pairs) : null,
      explanation: data.explanation || null,
      timeLimitSeconds: data.timeLimitSeconds || 30,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Actualizar fecha del banco
    await db.update(questionBanks)
      .set({ updatedAt: now })
      .where(eq(questionBanks.id, data.bankId));

    return this.getQuestionById(id);
  }

  async updateQuestion(questionId: string, data: UpdateQuestionData) {
    const question = await this.getQuestionById(questionId);
    if (!question) throw new Error('Pregunta no encontrada');

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.type !== undefined) updateData.type = data.type;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.points !== undefined) updateData.points = data.points;
    if (data.questionText !== undefined) updateData.questionText = data.questionText;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.options !== undefined) updateData.options = JSON.stringify(data.options);
    if (data.correctAnswer !== undefined) {
      // Normalizar correctAnswer a booleano para TRUE_FALSE
      let normalizedCA: any = data.correctAnswer;
      const questionType = data.type || question.type;
      if (questionType === 'TRUE_FALSE' && typeof normalizedCA === 'string') {
        normalizedCA = (normalizedCA as string).toLowerCase() === 'true';
      }
      updateData.correctAnswer = JSON.stringify(normalizedCA);
    }
    if (data.pairs !== undefined) updateData.pairs = JSON.stringify(data.pairs);
    if (data.explanation !== undefined) updateData.explanation = data.explanation;
    if (data.timeLimitSeconds !== undefined) updateData.timeLimitSeconds = data.timeLimitSeconds;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    await db.update(questions)
      .set(updateData)
      .where(eq(questions.id, questionId));

    // Actualizar fecha del banco
    await db.update(questionBanks)
      .set({ updatedAt: new Date() })
      .where(eq(questionBanks.id, question.bankId));

    return this.getQuestionById(questionId);
  }

  async deleteQuestion(questionId: string) {
    const question = await this.getQuestionById(questionId);
    if (!question) throw new Error('Pregunta no encontrada');

    // Soft delete
    await db.update(questions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(questions.id, questionId));

    // Actualizar fecha del banco
    await db.update(questionBanks)
      .set({ updatedAt: new Date() })
      .where(eq(questionBanks.id, question.bankId));
  }

  // ==================== UTILIDADES ====================

  async getRandomQuestions(bankId: string, count: number, difficulty?: QuestionDifficulty) {
    const conditions = [
      eq(questions.bankId, bankId),
      eq(questions.isActive, true),
    ];

    if (difficulty) {
      conditions.push(eq(questions.difficulty, difficulty));
    }

    const allQuestions = await db.select()
      .from(questions)
      .where(and(...conditions));

    // Mezclar y tomar N preguntas
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  async getQuestionStats(bankId: string) {
    const bankQuestions = await db.select()
      .from(questions)
      .where(and(
        eq(questions.bankId, bankId),
        eq(questions.isActive, true)
      ));

    const stats = {
      total: bankQuestions.length,
      byType: {
        TRUE_FALSE: 0,
        SINGLE_CHOICE: 0,
        MULTIPLE_CHOICE: 0,
        MATCHING: 0,
      },
      byDifficulty: {
        EASY: 0,
        MEDIUM: 0,
        HARD: 0,
      },
    };

    bankQuestions.forEach(q => {
      stats.byType[q.type as keyof typeof stats.byType]++;
      stats.byDifficulty[q.difficulty as keyof typeof stats.byDifficulty]++;
    });

    return stats;
  }

  private validateQuestionData(data: CreateQuestionData) {
    switch (data.type) {
      case 'TRUE_FALSE':
        if (data.correctAnswer === undefined) {
          throw new Error('TRUE_FALSE requiere correctAnswer (boolean)');
        }
        break;
      case 'SINGLE_CHOICE':
        if (!data.options || data.options.length < 2) {
          throw new Error('SINGLE_CHOICE requiere al menos 2 opciones');
        }
        if (data.options.filter(o => o.isCorrect).length !== 1) {
          throw new Error('SINGLE_CHOICE debe tener exactamente 1 respuesta correcta');
        }
        break;
      case 'MULTIPLE_CHOICE':
        if (!data.options || data.options.length < 2) {
          throw new Error('MULTIPLE_CHOICE requiere al menos 2 opciones');
        }
        if (data.options.filter(o => o.isCorrect).length < 1) {
          throw new Error('MULTIPLE_CHOICE debe tener al menos 1 respuesta correcta');
        }
        break;
      case 'MATCHING':
        if (!data.pairs || data.pairs.length < 2) {
          throw new Error('MATCHING requiere al menos 2 pares');
        }
        break;
    }
  }

  // Verificar respuesta
  checkAnswer(question: any, userAnswer: any): { correct: boolean; correctAnswer: any } {
    const type = question.type as BankQuestionType;
    
    switch (type) {
      case 'TRUE_FALSE': {
        const correct = JSON.parse(question.correctAnswer);
        return { correct: userAnswer === correct, correctAnswer: correct };
      }
      case 'SINGLE_CHOICE': {
        const options = typeof question.options === 'string' 
          ? JSON.parse(question.options) 
          : question.options;
        const correctIndex = options.findIndex((o: QuestionOption) => o.isCorrect);
        return { correct: userAnswer === correctIndex, correctAnswer: correctIndex };
      }
      case 'MULTIPLE_CHOICE': {
        const options = typeof question.options === 'string' 
          ? JSON.parse(question.options) 
          : question.options;
        const correctIndices = options
          .map((o: QuestionOption, i: number) => o.isCorrect ? i : -1)
          .filter((i: number) => i !== -1);
        const userIndices = Array.isArray(userAnswer) ? userAnswer.sort() : [];
        const correct = JSON.stringify(userIndices) === JSON.stringify(correctIndices.sort());
        return { correct, correctAnswer: correctIndices };
      }
      case 'MATCHING': {
        const pairs = typeof question.pairs === 'string' 
          ? JSON.parse(question.pairs) 
          : question.pairs;
        // userAnswer debería ser un array de índices que mapean left[i] -> right[userAnswer[i]]
        const correctMapping = pairs.map((_: MatchingPair, i: number) => i);
        const correct = JSON.stringify(userAnswer) === JSON.stringify(correctMapping);
        return { correct, correctAnswer: correctMapping };
      }
      default:
        return { correct: false, correctAnswer: null };
    }
  }
}

export const questionBankService = new QuestionBankService();
