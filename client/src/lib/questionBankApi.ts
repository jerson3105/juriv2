import api from './api';

// Types
export type BankQuestionType = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

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

export interface Question {
  id: string;
  bankId: string;
  type: BankQuestionType;
  difficulty: QuestionDifficulty;
  points: number;
  questionText: string;
  imageUrl: string | null;
  options: QuestionOption[] | string | null;
  correctAnswer: boolean | string | null;
  pairs: MatchingPair[] | string | null;
  explanation: string | null;
  timeLimitSeconds: number;
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

export interface UpdateQuestionData {
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

export interface QuestionStats {
  total: number;
  byType: {
    TRUE_FALSE: number;
    SINGLE_CHOICE: number;
    MULTIPLE_CHOICE: number;
    MATCHING: number;
  };
  byDifficulty: {
    EASY: number;
    MEDIUM: number;
    HARD: number;
  };
}

// Constants
export const QUESTION_TYPE_LABELS: Record<BankQuestionType, string> = {
  TRUE_FALSE: 'Verdadero o Falso',
  SINGLE_CHOICE: 'Selección única',
  MULTIPLE_CHOICE: 'Selección múltiple',
  MATCHING: 'Unir pares',
};

export const QUESTION_TYPE_ICONS: Record<BankQuestionType, string> = {
  TRUE_FALSE: '✓✗',
  SINGLE_CHOICE: '○',
  MULTIPLE_CHOICE: '☑',
  MATCHING: '↔',
};

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Media',
  HARD: 'Difícil',
};

export const DIFFICULTY_COLORS: Record<QuestionDifficulty, string> = {
  EASY: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HARD: 'bg-red-100 text-red-700',
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

export const BANK_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

// API
export const questionBankApi = {
  // ==================== BANCOS ====================
  
  getBanks: async (classroomId: string): Promise<QuestionBank[]> => {
    const response = await api.get(`/question-banks/classroom/${classroomId}`);
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

  // ==================== PREGUNTAS ====================

  getQuestions: async (bankId: string): Promise<Question[]> => {
    const response = await api.get(`/question-banks/bank/${bankId}/questions`);
    return response.data.data;
  },

  getQuestion: async (questionId: string): Promise<Question> => {
    const response = await api.get(`/question-banks/question/${questionId}`);
    return response.data.data;
  },

  createQuestion: async (bankId: string, data: CreateQuestionData): Promise<Question> => {
    const response = await api.post(`/question-banks/bank/${bankId}/questions`, data);
    return response.data.data;
  },

  updateQuestion: async (questionId: string, data: UpdateQuestionData): Promise<Question> => {
    const response = await api.put(`/question-banks/question/${questionId}`, data);
    return response.data.data;
  },

  deleteQuestion: async (questionId: string): Promise<void> => {
    await api.delete(`/question-banks/question/${questionId}`);
  },

  // ==================== UTILIDADES ====================

  getRandomQuestions: async (bankId: string, count: number, difficulty?: QuestionDifficulty): Promise<Question[]> => {
    const params = new URLSearchParams({ count: count.toString() });
    if (difficulty) params.append('difficulty', difficulty);
    const response = await api.get(`/question-banks/bank/${bankId}/random?${params}`);
    return response.data.data;
  },

  getStats: async (bankId: string): Promise<QuestionStats> => {
    const response = await api.get(`/question-banks/bank/${bankId}/stats`);
    return response.data.data;
  },

  checkAnswer: async (questionId: string, answer: any): Promise<{ correct: boolean; correctAnswer: any }> => {
    const response = await api.post(`/question-banks/question/${questionId}/check`, { answer });
    return response.data.data;
  },
};

// Helper para parsear JSON que puede estar doblemente serializado
const safeJsonParse = (value: any): any => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  
  try {
    let parsed = JSON.parse(value);
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
    options: Array.isArray(options) ? options : null,
    correctAnswer: correctAnswer,
    pairs: Array.isArray(pairs) ? pairs : null,
  };
};

// Helper para obtener el emoji del banco
export const getBankEmoji = (iconId: string): string => {
  return BANK_ICONS.find(i => i.id === iconId)?.emoji || '📚';
};
