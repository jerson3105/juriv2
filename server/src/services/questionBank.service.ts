import { db } from '../db/index.js';
import { classrooms, questionBanks, questions, type BankQuestionType, type QuestionDifficulty } from '../db/schema.js';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { teacherOwnsClassroom, assertClassroomWritable } from '../utils/access.js';
import { bingoKeysOf } from '../utils/bingo.js';

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
  difficulty?: QuestionDifficulty | null;
  /** Generada con IA: nace "por revisar". */
  aiGenerated?: boolean;
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
  difficulty?: QuestionDifficulty | null;
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
const MAX_BATCH = 50;
// Paleta de bancos (igual que BANK_COLORS en el cliente): cada banco nuevo toma un color libre.
const BANK_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];
// Igual que ERROR_PREFIX (questionAi.service) y que el Observatorio en el cliente.
const ERROR_PREFIX = '¿En qué paso está el error?';

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
          throw new Error('Verdadero o falso: elige cuál es la respuesta correcta');
        }
        break;
      case 'SINGLE_CHOICE': {
        if (!data.options || data.options.length < 2) {
          throw new Error('Selección única: agrega al menos 2 opciones');
        }
        if (data.options.filter((o) => o.isCorrect).length !== 1) {
          throw new Error('Selección única: marca exactamente 1 opción correcta');
        }
        break;
      }
      case 'MULTIPLE_CHOICE': {
        if (!data.options || data.options.length < 2) {
          throw new Error('Selección múltiple: agrega al menos 2 opciones');
        }
        if (data.options.filter((o) => o.isCorrect).length < 1) {
          throw new Error('Selección múltiple: marca al menos 1 opción correcta');
        }
        break;
      }
      case 'MATCHING':
        if (!data.pairs || data.pairs.length < 2) {
          throw new Error('Unir pares: agrega al menos 2 pares');
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
    return teacherOwnsClassroom(teacherId, classroomId);
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

  /**
   * Biblioteca del docente: bancos activos de TODAS sus clases (también archivadas), con su
   * calidad y para qué actividades del Observatorio sirven. Se usan desde cualquier clase sin copiar.
   */
  async getBanksForTeacher(teacherId: string) {
    const banks = await db
      .select({
        id: questionBanks.id,
        name: questionBanks.name,
        description: questionBanks.description,
        icon: questionBanks.icon,
        color: questionBanks.color,
        classroomId: questionBanks.classroomId,
        classroomName: classrooms.name,
        classroomArchived: sql<number>`${classrooms.isActive} = 0`,
        updatedAt: questionBanks.updatedAt,
      })
      .from(questionBanks)
      .innerJoin(classrooms, eq(classrooms.id, questionBanks.classroomId))
      .where(and(eq(classrooms.teacherId, teacherId), eq(questionBanks.isActive, true)))
      .orderBy(desc(questionBanks.updatedAt));
    if (banks.length === 0) return [];

    const rows = await db
      .select({
        bankId: questions.bankId, type: questions.type, difficulty: questions.difficulty, questionText: questions.questionText,
        options: questions.options, pairs: questions.pairs, correctAnswer: questions.correctAnswer, explanation: questions.explanation, aiGenerated: questions.aiGenerated, reviewedAt: questions.reviewedAt,
      })
      .from(questions)
      .where(and(inArray(questions.bankId, banks.map((b) => b.id)), eq(questions.isActive, true)));

    return banks.map((bank) => {
      const byType: Record<BankQuestionType, number> = { TRUE_FALSE: 0, SINGLE_CHOICE: 0, MULTIPLE_CHOICE: 0, MATCHING: 0 };
      const byDifficulty = { EASY: 0, MEDIUM: 0, HARD: 0, NONE: 0 };
      let projectable = 0;
      let trueFalse = 0;
      let errorExercises = 0;
      let unreviewed = 0;
      let withExplanation = 0;
      // Respuestas distintas que caben en un cartón del Bingo (la misma regla que su mazo).
      const bingoKeys = new Set<string>();
      for (const row of rows) {
        if (row.bankId !== bank.id) continue;
        byType[row.type as BankQuestionType] += 1;
        byDifficulty[(row.difficulty ?? 'NONE') as keyof typeof byDifficulty] += 1;
        if (row.aiGenerated && !row.reviewedAt) unreviewed += 1;
        if (row.explanation && row.explanation.trim()) withExplanation += 1;
        if (this.isProjectable(row)) {
          projectable += 1;
          if (row.type === 'TRUE_FALSE') trueFalse += 1;
          if (row.questionText.startsWith(ERROR_PREFIX)) errorExercises += 1;
        }
        const options = this.parseJsonValue<{ text?: unknown; isCorrect?: unknown }[]>(row.options);
        const pairs = this.parseJsonValue<{ left?: unknown; right?: unknown }[]>(row.pairs);
        for (const key of bingoKeysOf({ type: row.type, questionText: row.questionText, options, pairs })) bingoKeys.add(key);
      }
      const total = Object.values(byType).reduce((a, b) => a + b, 0);
      return {
        ...bank,
        classroomArchived: Number(bank.classroomArchived) === 1,
        questionCount: total,
        countsByType: byType,
        stats: { projectable, trueFalse, errorExercises, bingoAnswers: bingoKeys.size, unreviewed, withExplanation, byDifficulty },
      };
    });
  }

  /**
   * Se puede jugar con tarjetas en el Observatorio: V/F, u opción única con 2 a 4 opciones y UNA
   * correcta. Misma regla que answerOf (client/src/components/observatorio/questionHelpers.ts).
   */
  private isProjectable(row: { type: string; options: unknown; correctAnswer: unknown }) {
    if (row.type === 'TRUE_FALSE') return this.parseBooleanValue(this.parseJsonValue(row.correctAnswer)) !== null;
    if (row.type !== 'SINGLE_CHOICE') return false;
    const options = this.parseJsonValue<QuestionOption[]>(row.options);
    if (!Array.isArray(options) || options.length < 2 || options.length > 4) return false;
    return options.filter((o) => o.isCorrect).length === 1;
  }

  /** Color del primer tono de la paleta que el docente aún no usa (si están todos, el menos usado). */
  async pickBankColor(classroomId: string) {
    const used = await db
      .select({ color: questionBanks.color })
      .from(questionBanks)
      .innerJoin(classrooms, eq(classrooms.id, questionBanks.classroomId))
      .where(and(
        eq(questionBanks.isActive, true),
        sql`${classrooms.teacherId} = (SELECT teacher_id FROM classrooms WHERE id = ${classroomId})`,
      ));
    const counts = new Map(BANK_PALETTE.map((c) => [c, 0]));
    for (const row of used) if (counts.has(row.color)) counts.set(row.color, (counts.get(row.color) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
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

    const color = data.color ? this.normalizeText(data.color) : await this.pickBankColor(data.classroomId);
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
        difficulty: data.difficulty ?? null,
        points: data.points || 10,
        questionText: normalizedQuestionText,
        imageUrl: data.imageUrl || null,
        options: data.type === 'SINGLE_CHOICE' || data.type === 'MULTIPLE_CHOICE' ? sanitizedOptions : null,
        correctAnswer: data.type === 'TRUE_FALSE' ? normalizedCorrectAnswer : null,
        pairs: data.type === 'MATCHING' ? sanitizedPairs : null,
        explanation: normalizedExplanation,
        timeLimitSeconds: data.timeLimitSeconds || 30,
        aiGenerated: !!data.aiGenerated,
        reviewedAt: data.aiGenerated ? null : now,
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
        // Editar una pregunta cuenta como revisarla.
        reviewedAt: now,
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

  // ==================== LOTE, REVISIÓN, DESHACER Y DUPLICAR ====================

  /** Guarda varias preguntas en una sola transacción (vista previa de la IA). Todo o nada. */
  async createQuestionsBatch(bankId: string, items: Omit<CreateQuestionData, 'bankId'>[], aiGenerated: boolean) {
    if (items.length === 0) throw new Error('No hay preguntas para guardar');
    if (items.length > MAX_BATCH) throw new Error(`Máximo ${MAX_BATCH} preguntas por vez`);
    const now = new Date();
    const rows = items.map((data, index) => {
      const options = this.sanitizeOptions(data.options);
      const pairs = this.sanitizePairs(data.pairs);
      const correctAnswer = this.parseBooleanValue(data.correctAnswer);
      const questionText = this.normalizeText(data.questionText);
      try {
        this.validateQuestionData({ type: data.type, questionText, options, correctAnswer, pairs });
      } catch (error) {
        throw new Error(`Pregunta ${index + 1}: ${(error as Error).message}`);
      }
      return {
        id: uuidv4(),
        bankId,
        type: data.type,
        difficulty: data.difficulty ?? null,
        points: data.points || 10,
        questionText,
        imageUrl: data.imageUrl || null,
        options: data.type === 'SINGLE_CHOICE' || data.type === 'MULTIPLE_CHOICE' ? options : null,
        correctAnswer: data.type === 'TRUE_FALSE' ? correctAnswer : null,
        pairs: data.type === 'MATCHING' ? pairs : null,
        explanation: data.explanation ? this.normalizeText(data.explanation) : null,
        timeLimitSeconds: data.timeLimitSeconds || 30,
        aiGenerated,
        reviewedAt: aiGenerated ? null : now,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
    });
    await db.transaction(async (tx) => {
      const [bank] = await tx.select({ id: questionBanks.id }).from(questionBanks)
        .where(and(eq(questionBanks.id, bankId), eq(questionBanks.isActive, true)));
      if (!bank) throw new Error('Banco no encontrado');
      await tx.insert(questions).values(rows);
      await tx.update(questionBanks).set({ updatedAt: now }).where(eq(questionBanks.id, bankId));
    });
    return { created: rows.length, ids: rows.map((r) => r.id) };
  }

  /** Aprueba una pregunta generada con IA. */
  async markReviewed(questionId: string) {
    await db.update(questions).set({ reviewedAt: new Date() })
      .where(and(eq(questions.id, questionId), eq(questions.isActive, true)));
    return this.getQuestionById(questionId);
  }

  /** Aprueba todas las preguntas pendientes de un banco. */
  async reviewAll(bankId: string) {
    const result = await db.update(questions).set({ reviewedAt: new Date() })
      .where(and(eq(questions.bankId, bankId), eq(questions.isActive, true), sql`${questions.reviewedAt} IS NULL`));
    const header = Array.isArray(result) ? result[0] : result;
    return { reviewed: Number((header as { affectedRows?: number })?.affectedRows ?? 0) };
  }

  /** Deshacer el borrado de una pregunta (el borrado es suave). */
  async restoreQuestion(questionId: string) {
    const [question] = await db.select({ bankId: questions.bankId }).from(questions).where(eq(questions.id, questionId));
    if (!question) throw new Error('Pregunta no encontrada');
    const [bank] = await db.select({ isActive: questionBanks.isActive }).from(questionBanks).where(eq(questionBanks.id, question.bankId));
    if (!bank?.isActive) throw new Error('El banco ya no existe');
    const now = new Date();
    await db.update(questions).set({ isActive: true, updatedAt: now }).where(eq(questions.id, questionId));
    await db.update(questionBanks).set({ updatedAt: now }).where(eq(questionBanks.id, question.bankId));
    return this.getQuestionById(questionId);
  }

  /** Deshacer el borrado de un banco: vuelven también las preguntas que se apagaron con él. */
  async restoreBank(bankId: string) {
    const [bank] = await db.select().from(questionBanks).where(eq(questionBanks.id, bankId));
    if (!bank) throw new Error('Banco no encontrado');
    if (bank.isActive) return this.getBankById(bankId);
    const now = new Date();
    await db.transaction(async (tx) => {
      // deleteBank apaga banco y preguntas con el mismo instante.
      await tx.update(questions).set({ isActive: true, updatedAt: now })
        .where(and(eq(questions.bankId, bankId), eq(questions.isActive, false), eq(questions.updatedAt, bank.updatedAt)));
      await tx.update(questionBanks).set({ isActive: true, updatedAt: now }).where(eq(questionBanks.id, bankId));
    });
    return this.getBankById(bankId);
  }

  /**
   * Duplicar: versión independiente del banco (para adaptarla) en la clase del docente que elija,
   * incluso la misma. Con la biblioteca ya no hace falta copiar para usar un banco en otra clase.
   */
  async duplicateBank(bankId: string, targetClassroomId: string, teacherId: string) {
    const [source] = await db.select().from(questionBanks).where(and(eq(questionBanks.id, bankId), eq(questionBanks.isActive, true)));
    if (!source) throw new Error('Banco no encontrado');
    await assertClassroomWritable(targetClassroomId);
    if (!(await teacherOwnsClassroom(teacherId, source.classroomId)) || !(await teacherOwnsClassroom(teacherId, targetClassroomId))) {
      throw new Error('Sin acceso a esa clase');
    }
    const existing = await db.select({ name: questionBanks.name }).from(questionBanks)
      .where(and(eq(questionBanks.classroomId, targetClassroomId), eq(questionBanks.isActive, true)));
    const taken = new Set(existing.map((b) => b.name.toLowerCase()));
    // En otra clase conserva el nombre; "(copia)" solo si ya existe uno igual allí.
    let name = taken.has(source.name.toLowerCase()) ? `${source.name} (copia)`.slice(0, 100) : source.name;
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${source.name} (copia ${n})`.slice(0, 100);

    const sourceQuestions = await db.select().from(questions).where(and(eq(questions.bankId, bankId), eq(questions.isActive, true)));
    const now = new Date();
    const newBankId = uuidv4();
    await db.transaction(async (tx) => {
      await tx.insert(questionBanks).values({
        id: newBankId, classroomId: targetClassroomId, name, description: source.description,
        color: await this.pickBankColor(targetClassroomId), icon: source.icon, isActive: true, createdAt: now, updatedAt: now,
      });
      for (let i = 0; i < sourceQuestions.length; i += MAX_BATCH) {
        await tx.insert(questions).values(sourceQuestions.slice(i, i + MAX_BATCH).map((q) => ({
          ...q, id: uuidv4(), bankId: newBankId, createdAt: now, updatedAt: now,
        })));
      }
    });
    return { id: newBankId, name, classroomId: targetClassroomId, questions: sourceQuestions.length };
  }
}

export const questionBankService = new QuestionBankService();
