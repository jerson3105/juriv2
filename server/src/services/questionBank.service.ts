import { db } from '../db/index.js';
import { classrooms, questionBanks, questions, type BankQuestionType, type QuestionDifficulty } from '../db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
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

type QuestionRow = typeof questions.$inferSelect;

interface ParsedQuestion extends Omit<QuestionRow, 'options' | 'correctAnswer' | 'pairs'> {
  options: QuestionOption[] | null;
  correctAnswer: boolean | null;
  pairs: MatchingPair[] | null;
}

const DEFAULT_BANK_COLOR = '#6366f1';
const DEFAULT_BANK_ICON = 'book';
const MAX_RANDOM_QUESTIONS = 100;

class QuestionBankService {
  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  private normalizeText(value: string): string {
    return value.trim();
  }

  private parseJsonValue<T>(value: unknown): T | null {
    if (value === null || value === undefined) {
      return null;
    }

    let current: unknown = value;
    while (typeof current === 'string') {
      try {
        current = JSON.parse(current);
      } catch {
        break;
      }
    }

    return current as T;
  }

  private parseBooleanValue(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }

    return null;
  }

  private sanitizeOptions(options?: QuestionOption[] | null): QuestionOption[] | null {
    if (!options) {
      return null;
    }

    const sanitized = options
      .map((option) => ({
        text: this.normalizeText(option.text),
        isCorrect: !!option.isCorrect,
      }))
      .filter((option) => option.text.length > 0);

    return sanitized.length > 0 ? sanitized : null;
  }

  private sanitizePairs(pairs?: MatchingPair[] | null): MatchingPair[] | null {
    if (!pairs) {
      return null;
    }

    const sanitized = pairs
      .map((pair) => ({
        left: this.normalizeText(pair.left),
        right: this.normalizeText(pair.right),
      }))
      .filter((pair) => pair.left.length > 0 && pair.right.length > 0);

    return sanitized.length > 0 ? sanitized : null;
  }

  private normalizeQuestionRow(question: QuestionRow): ParsedQuestion {
    const parsedOptions = this.parseJsonValue<unknown>(question.options);
    const parsedPairs = this.parseJsonValue<unknown>(question.pairs);
    const parsedCorrectAnswer = this.parseJsonValue<unknown>(question.correctAnswer);

    return {
      ...question,
      options: Array.isArray(parsedOptions) ? (parsedOptions as QuestionOption[]) : null,
      pairs: Array.isArray(parsedPairs) ? (parsedPairs as MatchingPair[]) : null,
      correctAnswer: this.parseBooleanValue(parsedCorrectAnswer),
    };
  }

  private validateQuestionData(data: {
    type: BankQuestionType;
    questionText: string;
    options?: QuestionOption[] | null;
    correctAnswer?: boolean | null;
    pairs?: MatchingPair[] | null;
  }) {
    const questionText = this.normalizeText(data.questionText);
    if (!questionText) {
      throw new Error('El texto de la pregunta es requerido');
    }

    switch (data.type) {
      case 'TRUE_FALSE':
        if (typeof data.correctAnswer !== 'boolean') {
          throw new Error('TRUE_FALSE requiere correctAnswer (boolean)');
        }
        break;
      case 'SINGLE_CHOICE': {
        if (!data.options || data.options.length < 2) {
          throw new Error('SINGLE_CHOICE requiere al menos 2 opciones');
        }
        if (data.options.filter((o) => o.isCorrect).length !== 1) {
          throw new Error('SINGLE_CHOICE debe tener exactamente 1 respuesta correcta');
        }
        break;
      }
      case 'MULTIPLE_CHOICE': {
        if (!data.options || data.options.length < 2) {
          throw new Error('MULTIPLE_CHOICE requiere al menos 2 opciones');
        }
        if (data.options.filter((o) => o.isCorrect).length < 1) {
          throw new Error('MULTIPLE_CHOICE debe tener al menos 1 respuesta correcta');
        }
        break;
      }
      case 'MATCHING':
        if (!data.pairs || data.pairs.length < 2) {
          throw new Error('MATCHING requiere al menos 2 pares');
        }
        break;
    }
  }

  async getClassroomIdByBank(bankId: string): Promise<string | null> {
    const [bank] = await db
      .select({ classroomId: questionBanks.classroomId })
      .from(questionBanks)
      .where(eq(questionBanks.id, bankId));

    return bank?.classroomId ?? null;
  }

  async getClassroomIdByQuestion(questionId: string): Promise<string | null> {
    const [question] = await db
      .select({ classroomId: questionBanks.classroomId })
      .from(questions)
      .innerJoin(questionBanks, eq(questions.bankId, questionBanks.id))
      .where(eq(questions.id, questionId));

    return question?.classroomId ?? null;
  }

  async verifyTeacherOwnsClassroom(teacherId: string, classroomId: string): Promise<boolean> {
    const [classroom] = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(
        and(
          eq(classrooms.id, classroomId),
          eq(classrooms.teacherId, teacherId)
        )
      );

    return !!classroom;
  }

  private async getQuestionByIdRaw(questionId: string): Promise<QuestionRow | null> {
    const [question] = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.id, questionId),
          eq(questions.isActive, true)
        )
      );

    return question ?? null;
  }

  // ==================== BANCOS ====================

  async getBanksByClassroom(classroomId: string) {
    const banks = await db
      .select()
      .from(questionBanks)
      .where(
        and(
          eq(questionBanks.classroomId, classroomId),
          eq(questionBanks.isActive, true)
        )
      )
      .orderBy(questionBanks.createdAt);

    if (banks.length === 0) {
      return [];
    }

    const bankIds = banks.map((bank) => bank.id);
    const questionCounts = await db
      .select({
        bankId: questions.bankId,
        count: sql<number>`count(*)`,
      })
      .from(questions)
      .where(
        and(
          inArray(questions.bankId, bankIds),
          eq(questions.isActive, true)
        )
      )
      .groupBy(questions.bankId);

    const countByBank = new Map(questionCounts.map((row) => [row.bankId, Number(row.count)]));

    return banks.map((bank) => ({
      ...bank,
      questionCount: countByBank.get(bank.id) || 0,
    }));
  }

  async getBankById(bankId: string) {
    const bank = await db
      .select()
      .from(questionBanks)
      .where(
        and(
          eq(questionBanks.id, bankId),
          eq(questionBanks.isActive, true)
        )
      )
      .limit(1);

    if (!bank[0]) return null;

    const bankQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.bankId, bankId),
          eq(questions.isActive, true)
        )
      )
      .orderBy(questions.createdAt);

    return {
      ...bank[0],
      questions: bankQuestions.map((question) => this.normalizeQuestionRow(question)),
    };
  }

  async createBank(data: CreateBankData) {
    const id = uuidv4();
    const now = new Date();

    const normalizedName = this.normalizeText(data.name);
    if (!normalizedName) {
      throw new Error('El nombre del banco es requerido');
    }

    const normalizedDescription = data.description ? this.normalizeText(data.description) : null;

    const color = data.color ? this.normalizeText(data.color) : DEFAULT_BANK_COLOR;
    if (!this.isValidHexColor(color)) {
      throw new Error('Color de banco inválido');
    }

    const icon = data.icon ? this.normalizeText(data.icon) : DEFAULT_BANK_ICON;
    if (!icon) {
      throw new Error('Ícono de banco inválido');
    }

    await db.transaction(async (tx) => {
      const [classroom] = await tx
        .select({ id: classrooms.id })
        .from(classrooms)
        .where(eq(classrooms.id, data.classroomId));

      if (!classroom) {
        throw new Error('Clase no encontrada');
      }

      const [existingBank] = await tx
        .select({ id: questionBanks.id })
        .from(questionBanks)
        .where(
          and(
            eq(questionBanks.classroomId, data.classroomId),
            eq(questionBanks.isActive, true),
            sql`LOWER(${questionBanks.name}) = ${normalizedName.toLowerCase()}`
          )
        );

      if (existingBank) {
        throw new Error('Ya existe un banco activo con ese nombre');
      }

      await tx.insert(questionBanks).values({
        id,
        classroomId: data.classroomId,
        name: normalizedName,
        description: normalizedDescription,
        color,
        icon,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    return this.getBankById(id);
  }

  async updateBank(bankId: string, data: UpdateBankData) {
    const now = new Date();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (typeof data.name !== 'undefined') {
      const normalizedName = this.normalizeText(data.name);
      if (!normalizedName) {
        throw new Error('El nombre del banco es requerido');
      }
      updateData.name = normalizedName;
    }

    if (typeof data.description !== 'undefined') {
      const normalizedDescription = this.normalizeText(data.description);
      updateData.description = normalizedDescription || null;
    }

    if (typeof data.color !== 'undefined') {
      if (!this.isValidHexColor(data.color)) {
        throw new Error('Color de banco inválido');
      }
      updateData.color = data.color;
    }

    if (typeof data.icon !== 'undefined') {
      const normalizedIcon = this.normalizeText(data.icon);
      if (!normalizedIcon) {
        throw new Error('Ícono de banco inválido');
      }
      updateData.icon = normalizedIcon;
    }

    if (typeof data.isActive !== 'undefined') {
      updateData.isActive = data.isActive;
    }

    await db.transaction(async (tx) => {
      const [bank] = await tx
        .select()
        .from(questionBanks)
        .where(eq(questionBanks.id, bankId));

      if (!bank) {
        throw new Error('Banco no encontrado');
      }

      if (typeof updateData.name === 'string') {
        const [existingBank] = await tx
          .select({ id: questionBanks.id })
          .from(questionBanks)
          .where(
            and(
              eq(questionBanks.classroomId, bank.classroomId),
              eq(questionBanks.isActive, true),
              sql`LOWER(${questionBanks.name}) = ${String(updateData.name).toLowerCase()}`
            )
          );

        if (existingBank && existingBank.id !== bankId) {
          throw new Error('Ya existe un banco activo con ese nombre');
        }
      }

      await tx
        .update(questionBanks)
        .set(updateData)
        .where(eq(questionBanks.id, bankId));

      if (updateData.isActive === false) {
        await tx
          .update(questions)
          .set({ isActive: false, updatedAt: now })
          .where(eq(questions.bankId, bankId));
      }
    });

    const [updatedBank] = await db
      .select()
      .from(questionBanks)
      .where(eq(questionBanks.id, bankId));

    if (!updatedBank) {
      return null;
    }

    if (!updatedBank.isActive) {
      return {
        ...updatedBank,
        questions: [],
      };
    }

    return this.getBankById(bankId);
  }

  async deleteBank(bankId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [bank] = await tx
        .select({ id: questionBanks.id })
        .from(questionBanks)
        .where(
          and(
            eq(questionBanks.id, bankId),
            eq(questionBanks.isActive, true)
          )
        );

      if (!bank) {
        throw new Error('Banco no encontrado');
      }

      await tx
        .update(questions)
        .set({ isActive: false, updatedAt: now })
        .where(eq(questions.bankId, bankId));

      await tx
        .update(questionBanks)
        .set({ isActive: false, updatedAt: now })
        .where(eq(questionBanks.id, bankId));
    });
  }

  // ==================== PREGUNTAS ====================

  async getQuestionsByBank(bankId: string) {
    const bankQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.bankId, bankId),
          eq(questions.isActive, true)
        )
      )
      .orderBy(questions.createdAt);

    return bankQuestions.map((question) => this.normalizeQuestionRow(question));
  }

  async getQuestionById(questionId: string) {
    const question = await this.getQuestionByIdRaw(questionId);
    if (!question) {
      return null;
    }

    return this.normalizeQuestionRow(question);
  }

  async createQuestion(data: CreateQuestionData) {
    const id = uuidv4();
    const now = new Date();

    const sanitizedOptions = this.sanitizeOptions(data.options);
    const sanitizedPairs = this.sanitizePairs(data.pairs);
    const normalizedCorrectAnswer = this.parseBooleanValue(data.correctAnswer);
    const normalizedQuestionText = this.normalizeText(data.questionText);
    const normalizedExplanation = data.explanation ? this.normalizeText(data.explanation) : null;

    this.validateQuestionData({
      type: data.type,
      questionText: normalizedQuestionText,
      options: sanitizedOptions,
      correctAnswer: normalizedCorrectAnswer,
      pairs: sanitizedPairs,
    });

    await db.transaction(async (tx) => {
      const [bank] = await tx
        .select({ id: questionBanks.id })
        .from(questionBanks)
        .where(
          and(
            eq(questionBanks.id, data.bankId),
            eq(questionBanks.isActive, true)
          )
        );

      if (!bank) {
        throw new Error('Banco no encontrado');
      }

      await tx.insert(questions).values({
        id,
        bankId: data.bankId,
        type: data.type,
        difficulty: data.difficulty || 'MEDIUM',
        points: data.points || 10,
        questionText: normalizedQuestionText,
        imageUrl: data.imageUrl || null,
        options: data.type === 'SINGLE_CHOICE' || data.type === 'MULTIPLE_CHOICE' ? sanitizedOptions : null,
        correctAnswer: data.type === 'TRUE_FALSE' ? normalizedCorrectAnswer : null,
        pairs: data.type === 'MATCHING' ? sanitizedPairs : null,
        explanation: normalizedExplanation,
        timeLimitSeconds: data.timeLimitSeconds || 30,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await tx
        .update(questionBanks)
        .set({ updatedAt: now })
        .where(eq(questionBanks.id, data.bankId));
    });

    return this.getQuestionById(id);
  }

  async updateQuestion(questionId: string, data: UpdateQuestionData) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [existingQuestion] = await tx
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.id, questionId),
            eq(questions.isActive, true)
          )
        );

      if (!existingQuestion) {
        throw new Error('Pregunta no encontrada');
      }

      const [bank] = await tx
        .select({ id: questionBanks.id, isActive: questionBanks.isActive })
        .from(questionBanks)
        .where(eq(questionBanks.id, existingQuestion.bankId));

      if (!bank || !bank.isActive) {
        throw new Error('Banco no encontrado');
      }

      const currentQuestion = this.normalizeQuestionRow(existingQuestion);
      const resolvedType = data.type ?? currentQuestion.type;
      const resolvedQuestionText = data.questionText !== undefined
        ? this.normalizeText(data.questionText)
        : currentQuestion.questionText;
      const resolvedOptions = data.options !== undefined
        ? this.sanitizeOptions(data.options)
        : currentQuestion.options;
      const resolvedCorrectAnswer = data.correctAnswer !== undefined
        ? this.parseBooleanValue(data.correctAnswer)
        : currentQuestion.correctAnswer;
      const resolvedPairs = data.pairs !== undefined
        ? this.sanitizePairs(data.pairs)
        : currentQuestion.pairs;

      this.validateQuestionData({
        type: resolvedType,
        questionText: resolvedQuestionText,
        options: resolvedOptions,
        correctAnswer: resolvedCorrectAnswer,
        pairs: resolvedPairs,
      });

      const updateData: Record<string, unknown> = {
        type: resolvedType,
        questionText: resolvedQuestionText,
        options: null,
        correctAnswer: null,
        pairs: null,
        updatedAt: now,
      };

      if (typeof data.difficulty !== 'undefined') updateData.difficulty = data.difficulty;
      if (typeof data.points !== 'undefined') updateData.points = data.points;
      if (typeof data.imageUrl !== 'undefined') updateData.imageUrl = data.imageUrl || null;
      if (typeof data.explanation !== 'undefined') {
        updateData.explanation = data.explanation ? this.normalizeText(data.explanation) : null;
      }
      if (typeof data.timeLimitSeconds !== 'undefined') updateData.timeLimitSeconds = data.timeLimitSeconds;
      if (typeof data.isActive !== 'undefined') updateData.isActive = data.isActive;

      if (resolvedType === 'TRUE_FALSE') {
        updateData.correctAnswer = resolvedCorrectAnswer;
      }

      if (resolvedType === 'SINGLE_CHOICE' || resolvedType === 'MULTIPLE_CHOICE') {
        updateData.options = resolvedOptions;
      }

      if (resolvedType === 'MATCHING') {
        updateData.pairs = resolvedPairs;
      }

      await tx
        .update(questions)
        .set(updateData)
        .where(eq(questions.id, questionId));

      await tx
        .update(questionBanks)
        .set({ updatedAt: now })
        .where(eq(questionBanks.id, existingQuestion.bankId));
    });

    const [updatedQuestion] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));

    if (!updatedQuestion) {
      return null;
    }

    return this.normalizeQuestionRow(updatedQuestion);
  }

  async deleteQuestion(questionId: string) {
    const now = new Date();

    await db.transaction(async (tx) => {
      const [question] = await tx
        .select({ id: questions.id, bankId: questions.bankId })
        .from(questions)
        .where(
          and(
            eq(questions.id, questionId),
            eq(questions.isActive, true)
          )
        );

      if (!question) {
        throw new Error('Pregunta no encontrada');
      }

      await tx
        .update(questions)
        .set({ isActive: false, updatedAt: now })
        .where(eq(questions.id, questionId));

      await tx
        .update(questionBanks)
        .set({ updatedAt: now })
        .where(eq(questionBanks.id, question.bankId));
    });
  }

  // ==================== UTILIDADES ====================

  async getRandomQuestions(bankId: string, count: number, difficulty?: QuestionDifficulty) {
    const safeCount = Number.isFinite(count)
      ? Math.max(1, Math.min(MAX_RANDOM_QUESTIONS, Math.floor(count)))
      : 10;

    if (difficulty && !['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
      throw new Error('Dificultad inválida');
    }

    const [bank] = await db
      .select({ id: questionBanks.id })
      .from(questionBanks)
      .where(
        and(
          eq(questionBanks.id, bankId),
          eq(questionBanks.isActive, true)
        )
      );

    if (!bank) {
      throw new Error('Banco no encontrado');
    }

    const conditions = [
      eq(questions.bankId, bankId),
      eq(questions.isActive, true),
    ];

    if (difficulty) {
      conditions.push(eq(questions.difficulty, difficulty));
    }

    const randomQuestions = await db
      .select()
      .from(questions)
      .where(and(...conditions))
      .orderBy(sql`RAND()`)
      .limit(safeCount);

    return randomQuestions.map((question) => this.normalizeQuestionRow(question));
  }

  async getQuestionStats(bankId: string) {
    const [bank] = await db
      .select({ id: questionBanks.id })
      .from(questionBanks)
      .where(
        and(
          eq(questionBanks.id, bankId),
          eq(questionBanks.isActive, true)
        )
      );

    if (!bank) {
      throw new Error('Banco no encontrado');
    }

    const baseConditions = and(
      eq(questions.bankId, bankId),
      eq(questions.isActive, true)
    );

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(baseConditions);

    const byTypeRows = await db
      .select({
        type: questions.type,
        count: sql<number>`count(*)`,
      })
      .from(questions)
      .where(baseConditions)
      .groupBy(questions.type);

    const byDifficultyRows = await db
      .select({
        difficulty: questions.difficulty,
        count: sql<number>`count(*)`,
      })
      .from(questions)
      .where(baseConditions)
      .groupBy(questions.difficulty);

    const stats = {
      total: Number(totalRow?.count || 0),
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

    byTypeRows.forEach((row) => {
      stats.byType[row.type as keyof typeof stats.byType] = Number(row.count || 0);
    });

    byDifficultyRows.forEach((row) => {
      stats.byDifficulty[row.difficulty as keyof typeof stats.byDifficulty] = Number(row.count || 0);
    });

    return stats;
  }

  // Verificar respuesta
  checkAnswer(question: unknown, userAnswer: unknown): { correct: boolean; correctAnswer: unknown } {
    const normalizedQuestion = this.normalizeQuestionRow(question as QuestionRow);
    const type = normalizedQuestion.type;

    switch (type) {
      case 'TRUE_FALSE': {
        if (typeof normalizedQuestion.correctAnswer !== 'boolean') {
          return { correct: false, correctAnswer: null };
        }

        const userBoolean = this.parseBooleanValue(userAnswer);
        return {
          correct: userBoolean === normalizedQuestion.correctAnswer,
          correctAnswer: normalizedQuestion.correctAnswer,
        };
      }

      case 'SINGLE_CHOICE': {
        const options = normalizedQuestion.options || [];
        const correctIndex = options.findIndex((option) => option.isCorrect);
        if (correctIndex < 0) {
          return { correct: false, correctAnswer: null };
        }

        const answerIndex = typeof userAnswer === 'number' ? userAnswer : Number(userAnswer);
        const isValidAnswer = Number.isInteger(answerIndex);
        return {
          correct: isValidAnswer && answerIndex === correctIndex,
          correctAnswer: correctIndex,
        };
      }

      case 'MULTIPLE_CHOICE': {
        const options = normalizedQuestion.options || [];
        const correctIndices = options
          .map((option, index) => (option.isCorrect ? index : -1))
          .filter((index) => index !== -1)
          .sort((a, b) => a - b);

        const userIndices = Array.isArray(userAnswer)
          ? [...new Set(userAnswer
              .map((value) => Number(value))
              .filter((value) => Number.isInteger(value)))]
              .sort((a, b) => a - b)
          : [];

        const correct =
          userIndices.length === correctIndices.length &&
          userIndices.every((value, index) => value === correctIndices[index]);

        return { correct, correctAnswer: correctIndices };
      }

      case 'MATCHING': {
        const pairs = normalizedQuestion.pairs || [];
        const correctMapping = pairs.map((_, index) => index);

        const userMapping = Array.isArray(userAnswer)
          ? userAnswer.map((value) => Number(value))
          : [];

        const correct =
          userMapping.length === correctMapping.length &&
          userMapping.every((value, index) => value === correctMapping[index]);

        return { correct, correctAnswer: correctMapping };
      }

      default:
        return { correct: false, correctAnswer: null };
    }
  }

  // ==================== EXPORTAR BANCOS ====================

  async exportBanks(bankIds: string[], targetClassroomIds: string[], teacherId: string) {
    if (bankIds.length === 0 || targetClassroomIds.length === 0) {
      throw new Error('Se requieren bancos y clases destino');
    }

    // 1. Obtener bancos fuente con sus preguntas
    const sourceBanks = await db
      .select()
      .from(questionBanks)
      .where(
        and(
          inArray(questionBanks.id, bankIds),
          eq(questionBanks.isActive, true)
        )
      );

    if (sourceBanks.length === 0) {
      throw new Error('No se encontraron bancos válidos');
    }

    // 2. Verificar que todos los bancos pertenecen a clases del profesor
    const sourceClassroomIds = [...new Set(sourceBanks.map(b => b.classroomId))];
    const sourceClassrooms = await db
      .select({ id: classrooms.id, teacherId: classrooms.teacherId })
      .from(classrooms)
      .where(inArray(classrooms.id, sourceClassroomIds));

    for (const sc of sourceClassrooms) {
      if (sc.teacherId !== teacherId) {
        throw new Error('No tienes permiso para exportar estos bancos');
      }
    }

    // 3. Obtener clases destino y verificar propiedad
    const targetResults = await db
      .select({ id: classrooms.id, teacherId: classrooms.teacherId })
      .from(classrooms)
      .where(
        and(
          inArray(classrooms.id, targetClassroomIds),
          eq(classrooms.teacherId, teacherId)
        )
      );

    if (targetResults.length === 0) {
      throw new Error('No se encontraron clases destino válidas');
    }

    // Excluir clases origen
    const validTargets = targetResults.filter(c => !sourceClassroomIds.includes(c.id));
    if (validTargets.length === 0) {
      throw new Error('No puedes exportar a la misma clase origen');
    }

    // 4. Obtener todas las preguntas de los bancos fuente
    const sourceQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          inArray(questions.bankId, bankIds),
          eq(questions.isActive, true)
        )
      );

    const questionsByBank = new Map<string, typeof sourceQuestions>();
    for (const q of sourceQuestions) {
      if (!questionsByBank.has(q.bankId)) {
        questionsByBank.set(q.bankId, []);
      }
      questionsByBank.get(q.bankId)!.push(q);
    }

    // 5. Clonar bancos y preguntas para cada clase destino
    const now = new Date();
    let totalBanksCreated = 0;
    let totalQuestionsCreated = 0;

    for (const target of validTargets) {
      // Obtener nombres existentes en el destino para evitar duplicados
      const existingBanks = await db
        .select({ name: questionBanks.name })
        .from(questionBanks)
        .where(
          and(
            eq(questionBanks.classroomId, target.id),
            eq(questionBanks.isActive, true)
          )
        );
      const existingNames = new Set(existingBanks.map(b => b.name.toLowerCase()));

      for (const bank of sourceBanks) {
        // Generar nombre único
        let bankName = bank.name;
        if (existingNames.has(bankName.toLowerCase())) {
          let suffix = 2;
          while (existingNames.has(`${bank.name} (${suffix})`.toLowerCase())) {
            suffix++;
          }
          bankName = `${bank.name} (${suffix})`;
        }
        existingNames.add(bankName.toLowerCase());

        const newBankId = uuidv4();

        await db.insert(questionBanks).values({
          id: newBankId,
          classroomId: target.id,
          name: bankName,
          description: bank.description,
          color: bank.color,
          icon: bank.icon,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        totalBanksCreated++;

        // Clonar preguntas del banco
        const bankQuestions = questionsByBank.get(bank.id) || [];
        const CHUNK_SIZE = 50;
        for (let i = 0; i < bankQuestions.length; i += CHUNK_SIZE) {
          const chunk = bankQuestions.slice(i, i + CHUNK_SIZE);
          await db.insert(questions).values(
            chunk.map(q => ({
              id: uuidv4(),
              bankId: newBankId,
              type: q.type,
              difficulty: q.difficulty,
              points: q.points,
              questionText: q.questionText,
              imageUrl: q.imageUrl,
              options: q.options,
              correctAnswer: q.correctAnswer,
              pairs: q.pairs,
              explanation: q.explanation,
              timeLimitSeconds: q.timeLimitSeconds,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            }))
          );
          totalQuestionsCreated += chunk.length;
        }
      }
    }

    return {
      exportedBanks: totalBanksCreated,
      exportedQuestions: totalQuestionsCreated,
      targetClassrooms: validTargets.length,
    };
  }
}

export const questionBankService = new QuestionBankService();
