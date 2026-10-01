import api from './api';

// Types
export type BankQuestionType = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
/** Tipos que la IA puede generar (ERROR_STEPS = "El Error de Jiro", se guarda como opción única). */
export type AiKind = BankQuestionType | 'ERROR_STEPS';

export interface QuestionOption {
  text: string;
  isCorrect: boolean;
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface QuestionBank {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  isActive: boolean;
  questionCount?: number;
  createdAt: string;
  updatedAt: string;
  questions?: Question[];
}

export interface BankStats {
  /** Se juegan con tarjetas en el Observatorio (V/F u opción única de 2 a 4 opciones). */
  projectable: number;
  trueFalse: number;
  /** Ejercicios de "El Error de Jiro". */
  errorExercises: number;
  /** Generadas con IA y aún sin aprobar. */
  unreviewed: number;
  withExplanation: number;
  byDifficulty: Record<QuestionDifficulty | 'NONE', number>;
}

/** Banco de la biblioteca del docente (todas sus clases, también archivadas). */
export interface TeacherBank {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  classroomId: string;
  classroomName: string;
  classroomArchived: boolean;
  updatedAt: string;
  questionCount: number;
  countsByType: Record<BankQuestionType, number>;
  stats: BankStats;
}

export interface Question {
  id: string;
  bankId: string;
  type: BankQuestionType;
  /** null = sin definir. */
  difficulty: QuestionDifficulty | null;
  points: number;
  questionText: string;
  imageUrl: string | null;
  options: QuestionOption[] | string | null;
  correctAnswer: boolean | string | null;
  pairs: MatchingPair[] | string | null;
  explanation: string | null;
  timeLimitSeconds: number;
  aiGenerated: boolean;
  /** null = generada con IA y "por revisar". */
  reviewedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateBankData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

export interface CreateQuestionData {
  type: BankQuestionType;
  difficulty?: QuestionDifficulty | null;
  points?: number;
  questionText: string;
  imageUrl?: string;
  options?: QuestionOption[];
  correctAnswer?: boolean;
  pairs?: MatchingPair[];
  explanation?: string;
  timeLimitSeconds?: number;
}

export interface UpdateQuestionData {
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

/** Borrador de la IA: se revisa en la vista previa antes de guardarlo. */
export interface DraftQuestion {
  type: BankQuestionType;
  questionText: string;
  options?: QuestionOption[];
  correctAnswer?: boolean;
  pairs?: MatchingPair[];
  explanation: string;
  difficulty: QuestionDifficulty | null;
}

export interface AiDraftsInput {
  quantity: number;
  kinds: AiKind[];
  difficulty?: QuestionDifficulty | null;
  /** Solo si la clase no tiene nivel configurado. */
  level?: string | null;
}

// Constants
export const QUESTION_TYPE_LABELS: Record<BankQuestionType, string> = {
  TRUE_FALSE: 'Verdadero o falso',
  SINGLE_CHOICE: 'Selección única',
  MULTIPLE_CHOICE: 'Selección múltiple',
  MATCHING: 'Unir pares',
};

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Media',
  HARD: 'Difícil',
};

export const BANK_ICONS = [
  { id: 'book', emoji: '📚', label: 'Libro' },
  { id: 'math', emoji: '🔢', label: 'Matemáticas' },
  { id: 'science', emoji: '🔬', label: 'Ciencias' },
  { id: 'language', emoji: '📝', label: 'Lenguaje' },
  { id: 'history', emoji: '🏛️', label: 'Historia' },
  { id: 'geography', emoji: '🌍', label: 'Geografía' },
  { id: 'art', emoji: '🎨', label: 'Arte' },
  { id: 'music', emoji: '🎵', label: 'Música' },
  { id: 'sports', emoji: '⚽', label: 'Deportes' },
  { id: 'tech', emoji: '💻', label: 'Tecnología' },
  { id: 'brain', emoji: '🧠', label: 'Lógica' },
  { id: 'star', emoji: '⭐', label: 'General' },
];

// Igual que BANK_PALETTE en el servidor (cada banco nuevo toma un color libre).
export const BANK_COLORS = [
  { value: '#6366f1', label: 'Índigo' },
  { value: '#8b5cf6', label: 'Violeta' },
  { value: '#ec4899', label: 'Rosado' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#f97316', label: 'Naranja' },
  { value: '#eab308', label: 'Amarillo' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#14b8a6', label: 'Turquesa' },
  { value: '#06b6d4', label: 'Celeste' },
  { value: '#3b82f6', label: 'Azul' },
];

// API
export const questionBankApi = {
  // ==================== BANCOS ====================

  getBanks: async (classroomId: string): Promise<QuestionBank[]> => {
    const response = await api.get(`/question-banks/classroom/${classroomId}`);
    return response.data.data;
  },

  /** Biblioteca: bancos de todas las clases del docente (también archivadas), con sus estadísticas. */
  getMyBanks: async (): Promise<TeacherBank[]> => {
    const response = await api.get('/question-banks/mine');
    return response.data.data;
  },

  getBank: async (bankId: string): Promise<QuestionBank> => {
    const response = await api.get(`/question-banks/bank/${bankId}`);
    return response.data.data;
  },

  createBank: async (classroomId: string, data: CreateBankData): Promise<QuestionBank> => {
    const response = await api.post(`/question-banks/classroom/${classroomId}`, data);
    return response.data.data;
  },

  updateBank: async (bankId: string, data: UpdateBankData): Promise<QuestionBank> => {
    const response = await api.put(`/question-banks/bank/${bankId}`, data);
    return response.data.data;
  },

  deleteBank: async (bankId: string): Promise<void> => {
    await api.delete(`/question-banks/bank/${bankId}`);
  },

  /** Deshacer el borrado (vuelven también sus preguntas). */
  restoreBank: async (bankId: string): Promise<QuestionBank> => {
    const response = await api.post(`/question-banks/bank/${bankId}/restore`);
    return response.data.data;
  },

  /** Versión independiente del banco en la clase elegida (puede ser la misma). */
  duplicateBank: async (bankId: string, targetClassroomId: string): Promise<{ id: string; name: string; classroomId: string; questions: number }> => {
    const response = await api.post(`/question-banks/bank/${bankId}/duplicate`, { targetClassroomId });
    return response.data.data;
  },

  /** Aprueba todo lo que la IA dejó "por revisar" en el banco. */
  reviewBank: async (bankId: string): Promise<{ reviewed: number }> => {
    const response = await api.post(`/question-banks/bank/${bankId}/review-all`);
    return response.data.data;
  },

  // ==================== PREGUNTAS ====================

  getQuestions: async (bankId: string): Promise<Question[]> => {
    const response = await api.get(`/question-banks/bank/${bankId}/questions`);
    return response.data.data;
  },

  createQuestion: async (bankId: string, data: CreateQuestionData): Promise<Question> => {
    const response = await api.post(`/question-banks/bank/${bankId}/questions`, data);
    return response.data.data;
  },

  /** Varias a la vez en una transacción (vista previa de la IA). */
  createQuestionsBatch: async (bankId: string, questions: CreateQuestionData[], aiGenerated: boolean): Promise<{ created: number; ids: string[] }> => {
    const response = await api.post(`/question-banks/bank/${bankId}/questions/batch`, { questions, aiGenerated });
    return response.data.data;
  },

  updateQuestion: async (questionId: string, data: UpdateQuestionData): Promise<Question> => {
    const response = await api.put(`/question-banks/question/${questionId}`, data);
    return response.data.data;
  },

  deleteQuestion: async (questionId: string): Promise<void> => {
    await api.delete(`/question-banks/question/${questionId}`);
  },

  restoreQuestion: async (questionId: string): Promise<Question> => {
    const response = await api.post(`/question-banks/question/${questionId}/restore`);
    return response.data.data;
  },

  reviewQuestion: async (questionId: string): Promise<Question> => {
    const response = await api.post(`/question-banks/question/${questionId}/review`);
    return response.data.data;
  },

  // ==================== IA ====================

  /** Borradores por tema (nivel de la clase). No guarda nada. */
  aiDrafts: async (classroomId: string, data: AiDraftsInput & { topic: string }): Promise<DraftQuestion[]> => {
    const response = await api.post(`/question-banks/classroom/${classroomId}/ai-drafts`, data);
    return response.data.data;
  },

  /** Borradores desde un PDF. No guarda nada. */
  aiDraftsFromPdf: async (classroomId: string, file: File, data: AiDraftsInput): Promise<DraftQuestion[]> => {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('quantity', String(data.quantity));
    formData.append('kinds', JSON.stringify(data.kinds));
    if (data.difficulty) formData.append('difficulty', data.difficulty);
    if (data.level) formData.append('level', data.level);
    const response = await api.post(`/question-banks/classroom/${classroomId}/ai-drafts/pdf`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  /** Observatorio: genera con IA y guarda directo en un banco de la clase (quedan "por revisar"). */
  generateIntoBank: async (classroomId: string, data: { topic: string; quantity: number; kind: 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'ERROR_STEPS'; bankId?: string | null }): Promise<{ bankId: string; bankName: string; created: number }> => {
    const response = await api.post(`/question-banks/classroom/${classroomId}/generate-into-bank`, data);
    return response.data.data;
  },
};

// Helper para parsear JSON que puede estar doblemente serializado
const safeJsonParse = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try {
    let parsed: unknown = JSON.parse(value);
    // Si sigue siendo string, intentar parsear de nuevo (doble serialización)
    while (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        break;
      }
    }
    return parsed;
  } catch {
    return value;
  }
};

// Helper para parsear opciones/pares de JSON string
export const parseQuestionData = (question: Question) => {
  const options = safeJsonParse(question.options);
  const correctAnswer = safeJsonParse(question.correctAnswer);
  const pairs = safeJsonParse(question.pairs);
  return {
    ...question,
    options: Array.isArray(options) ? (options as QuestionOption[]) : null,
    correctAnswer: correctAnswer as boolean | string | null,
    pairs: Array.isArray(pairs) ? (pairs as MatchingPair[]) : null,
  };
};

// Helper para obtener el emoji del banco
export const getBankEmoji = (iconId: string): string => {
  return BANK_ICONS.find((i) => i.id === iconId)?.emoji || '📚';
};
