import api from './api';

export type BattleStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'VICTORY' | 'DEFEAT';
export type QuestionType = 'TEXT' | 'IMAGE';
export type BattleQuestionType = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';

export interface MatchingPair {
  left: string;
  right: string;
}

export interface Boss {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  bossName: string;
  bossHp: number;
  currentHp: number;
  bossImageUrl: string | null;
  xpReward: number;
  gpReward: number;
  status: BattleStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BattleQuestion {
  id: string;
  battleId: string;
  questionType: QuestionType;
  battleQuestionType: BattleQuestionType; // Tipo de pregunta: V/F, única, múltiple, unir
  question: string;
  imageUrl: string | null;
  options: string[];
  correctIndex: number;
  correctIndices?: number[]; // Para MULTIPLE_CHOICE
  pairs?: MatchingPair[]; // Para MATCHING
  damage: number;
  hpPenalty: number; // HP que pierden los que fallan
  timeLimit: number;
  orderIndex: number;
}

export interface BattleParticipant {
  id: string;
  studentId: string;
  totalDamage: number;
  correctAnswers: number;
  wrongAnswers: number;
  characterName: string | null;
  avatarUrl: string | null;
}

export interface BattleState extends Boss {
  questions: BattleQuestion[];
  participants: BattleParticipant[];
  hpPercentage: number;
}

export interface BattleResult {
  id: string;
  studentId: string;
  score: number;
  damageDealt: number;
  xpEarned: number;
  gpEarned: number;
  characterName: string | null;
  avatarUrl: string | null;
}

export interface AnswerResult {
  success: boolean;
  isCorrect?: boolean;
  damage?: number;
  correctIndex?: number;
  message?: string;
}

// Configuración de dificultad
export const DIFFICULTY_CONFIG = {
  EASY: { label: 'Fácil', hp: 500, color: 'text-green-600', bgColor: 'bg-green-100' },
  MEDIUM: { label: 'Normal', hp: 1000, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  HARD: { label: 'Difícil', hp: 2000, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  LEGENDARY: { label: 'Legendario', hp: 5000, color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

export const battleApi = {
  // ==================== BOSS CRUD ====================

  createBoss: async (data: {
    classroomId: string;
    name: string;
    description?: string;
    bossName: string;
    bossHp: number;
    bossImageUrl?: string;
    xpReward?: number;
    gpReward?: number;
  }): Promise<Boss> => {
    const { data: boss } = await api.post('/battles/bosses', data);
    return boss;
  },

  getBossesByClassroom: async (classroomId: string): Promise<Boss[]> => {
    const { data } = await api.get(`/battles/classroom/${classroomId}/bosses`);
    return data;
  },

  // Obtener batallas activas para un estudiante
  getActiveBattlesForStudent: async (studentId: string): Promise<Boss[]> => {
    const { data } = await api.get(`/battles/student/${studentId}/active`);
    return data;
  },

  getBossById: async (id: string): Promise<BattleState> => {
    const { data } = await api.get(`/battles/bosses/${id}`);
    return data;
  },

  updateBoss: async (id: string, data: Partial<{
    name: string;
    description: string;
    bossName: string;
    bossHp: number;
    bossImageUrl: string;
    xpReward: number;
    gpReward: number;
  }>): Promise<Boss> => {
    const { data: boss } = await api.put(`/battles/bosses/${id}`, data);
    return boss;
  },

  deleteBoss: async (id: string): Promise<void> => {
    await api.delete(`/battles/bosses/${id}`);
  },

  duplicateBoss: async (id: string): Promise<Boss> => {
    const { data } = await api.post(`/battles/bosses/${id}/duplicate`);
    return data;
  },

  // ==================== PREGUNTAS ====================

  addQuestion: async (battleId: string, data: {
    questionType?: QuestionType;
    battleQuestionType?: BattleQuestionType;
    question: string;
    imageUrl?: string;
    options?: string[];
    correctIndex?: number;
    correctIndices?: number[];
    pairs?: MatchingPair[];
    damage?: number;
    timeLimit?: number;
  }): Promise<BattleQuestion> => {
    const { data: question } = await api.post(`/battles/bosses/${battleId}/questions`, data);
    return question;
  },

  getQuestions: async (battleId: string): Promise<BattleQuestion[]> => {
    const { data } = await api.get(`/battles/bosses/${battleId}/questions`);
    // Asegurar que options sea un array
    return data.map((q: any) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : 
               (typeof q.options === 'string' ? JSON.parse(q.options) : [])
    }));
  },

  updateQuestion: async (id: string, data: Partial<{
    questionType: QuestionType;
    battleQuestionType: BattleQuestionType;
    question: string;
    imageUrl: string;
    options: string[];
    correctIndex: number;
    correctIndices: number[];
    pairs: MatchingPair[];
    damage: number;
    timeLimit: number;
  }>): Promise<BattleQuestion> => {
    const { data: question } = await api.put(`/battles/questions/${id}`, data);
    return question;
  },

  deleteQuestion: async (id: string): Promise<void> => {
    await api.delete(`/battles/questions/${id}`);
  },

  reorderQuestions: async (battleId: string, questionIds: string[]): Promise<void> => {
    await api.put(`/battles/bosses/${battleId}/questions/reorder`, { questionIds });
  },

  // ==================== BATALLA EN VIVO ====================

  startBattle: async (bossId: string, studentIds: string[]): Promise<BattleState> => {
    const { data } = await api.post(`/battles/bosses/${bossId}/start`, { studentIds });
    return data;
  },

  getBattleState: async (bossId: string): Promise<BattleState> => {
    const { data } = await api.get(`/battles/bosses/${bossId}/state`);
    // Asegurar que las opciones de cada pregunta sean arrays
    if (data?.questions) {
      data.questions = data.questions.map((q: any) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : 
                 (typeof q.options === 'string' ? JSON.parse(q.options) : [])
      }));
    }
    return data;
  },

  submitAnswer: async (bossId: string, studentId: string, data: {
    questionId: string;
    selectedIndex: number;
    timeSpent: number;
  }): Promise<AnswerResult> => {
    const { data: result } = await api.post(`/battles/bosses/${bossId}/student/${studentId}/answer`, data);
    return result;
  },

  endBattle: async (bossId: string, status: 'VICTORY' | 'DEFEAT' | 'COMPLETED'): Promise<BattleState> => {
    const { data } = await api.post(`/battles/bosses/${bossId}/end`, { status });
    return data;
  },

  getBattleResults: async (bossId: string): Promise<BattleResult[]> => {
    const { data } = await api.get(`/battles/bosses/${bossId}/results`);
    return data;
  },

  // Aplicar daño manualmente (modo presencial)
  applyManualDamage: async (
    bossId: string, 
    damage: number, 
    studentIds: string[],
    studentPenalty?: { wrongStudentIds: string[]; hpDamage: number }
  ): Promise<void> => {
    await api.post(`/battles/bosses/${bossId}/manual-damage`, { 
      damage, 
      studentIds,
      wrongStudentIds: studentPenalty?.wrongStudentIds,
      hpDamage: studentPenalty?.hpDamage,
    });
  },
};
