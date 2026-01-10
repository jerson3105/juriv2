import api from './api';

// Types
export type StudentBossBattleStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'VICTORY' | 'DEFEAT';

export interface StudentBossBattle {
  id: string;
  classroomId: string;
  bossName: string;
  bossImageUrl: string | null;
  bossMaxHp: number;
  bossCurrentHp: number;
  questionBankId: string;
  questionsPerAttempt: number;
  damagePerCorrect: number;
  damageToStudentOnWrong: number;
  maxAttempts: number;
  xpPerCorrectAnswer: number;
  gpPerCorrectAnswer: number;
  bonusXpOnVictory: number;
  bonusGpOnVictory: number;
  status: StudentBossBattleStatus;
  startDate: string | null;
  endDate: string | null;
  competencyId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  // Populated
  participants?: StudentBossBattleParticipant[];
  questionBank?: { id: string; name: string };
  participantCount?: number;
  activeBattlers?: number;
}

export interface StudentBossBattleParticipant {
  id: string;
  battleId: string;
  studentProfileId: string;
  totalDamageDealt: number;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  attemptsUsed: number;
  xpEarned: number;
  gpEarned: number;
  isCurrentlyBattling: boolean;
  lastBattleAt: string | null;
  createdAt: string;
  student?: {
    id: string;
    characterName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    characterClass: string;
    level: number;
  };
}

export interface BattleQuestion {
  id: string;
  type: 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';
  questionText: string;
  imageUrl: string | null;
  options: { text: string; isCorrect?: boolean }[] | null;
  pairs: { left: string; right?: string }[] | null;
  timeLimitSeconds: number | null;
  points: number;
}

export interface CreateBattleDto {
  bossName: string;
  bossImageUrl?: string;
  bossMaxHp: number;
  questionBankId: string;
  questionsPerAttempt?: number;
  damagePerCorrect?: number;
  damageToStudentOnWrong?: number;
  maxAttempts?: number;
  xpPerCorrectAnswer?: number;
  gpPerCorrectAnswer?: number;
  bonusXpOnVictory?: number;
  bonusGpOnVictory?: number;
  startDate?: string | null;
  endDate?: string | null;
  startImmediately?: boolean;
  competencyId?: string;
}

export interface AvailableBattle extends StudentBossBattle {
  participation: StudentBossBattleParticipant | null;
  canParticipate: boolean;
  hasParticipated: boolean;
  attemptsRemaining: number;
  activeBattlers: number;
  hpPercentage: number;
}

export interface StartAttemptResult {
  attemptId: string;
  questions: BattleQuestion[];
  bossCurrentHp: number;
  bossMaxHp: number;
}

export interface AnswerResult {
  isCorrect: boolean;
  correctAnswer: any;
  explanation: string | null;
  damageDealt: number;
  damageReceived: number;
  bossCurrentHp: number;
  xpEarned: number;
  gpEarned: number;
  battleEnded: boolean;
  victory: boolean;
}

export interface BattleStatus {
  bossCurrentHp: number;
  bossMaxHp: number;
  status: string;
  activeBattlers: {
    id: string;
    characterName: string | null;
    avatarUrl: string | null;
    characterClass: string;
    totalDamageDealt: number;
  }[];
}

// Status config
export const STATUS_CONFIG: Record<StudentBossBattleStatus, { label: string; color: string; icon: string }> = {
  DRAFT: { label: 'Borrador', color: 'gray', icon: '📝' },
  SCHEDULED: { label: 'Programada', color: 'blue', icon: '📅' },
  ACTIVE: { label: 'En curso', color: 'green', icon: '⚔️' },
  COMPLETED: { label: 'Completada', color: 'purple', icon: '✅' },
  VICTORY: { label: 'Victoria', color: 'emerald', icon: '🏆' },
  DEFEAT: { label: 'Derrota', color: 'red', icon: '💀' },
};

// API functions
export const studentBossBattleApi = {
  // ==================== Para profesor ====================

  // Crear batalla
  create: async (classroomId: string, data: CreateBattleDto): Promise<StudentBossBattle> => {
    const response = await api.post(`/student-boss-battles/classroom/${classroomId}`, data);
    return response.data.data;
  },

  // Obtener batallas de una clase
  getByClassroom: async (classroomId: string): Promise<StudentBossBattle[]> => {
    const response = await api.get(`/student-boss-battles/classroom/${classroomId}`);
    return response.data.data;
  },

  // Obtener batalla por ID
  getById: async (id: string): Promise<StudentBossBattle> => {
    const response = await api.get(`/student-boss-battles/${id}`);
    return response.data.data;
  },

  // Actualizar batalla
  update: async (id: string, data: Partial<CreateBattleDto>): Promise<StudentBossBattle> => {
    const response = await api.put(`/student-boss-battles/${id}`, data);
    return response.data.data;
  },

  // Eliminar batalla
  delete: async (id: string): Promise<void> => {
    await api.delete(`/student-boss-battles/${id}`);
  },

  // Activar batalla
  activate: async (id: string): Promise<StudentBossBattle> => {
    const response = await api.post(`/student-boss-battles/${id}/activate`);
    return response.data.data;
  },

  // ==================== Para estudiante ====================

  // Obtener batallas disponibles
  getAvailableForStudent: async (classroomId: string, studentProfileId: string): Promise<AvailableBattle[]> => {
    const response = await api.get(`/student-boss-battles/student/${classroomId}/${studentProfileId}/available`);
    return response.data.data;
  },

  // Iniciar intento
  startAttempt: async (battleId: string, studentProfileId: string): Promise<StartAttemptResult> => {
    const response = await api.post(`/student-boss-battles/battle/${battleId}/student/${studentProfileId}/start`);
    return response.data.data;
  },

  // Responder pregunta
  answerQuestion: async (
    battleId: string,
    studentProfileId: string,
    questionId: string,
    answer: any
  ): Promise<AnswerResult> => {
    const response = await api.post(`/student-boss-battles/battle/${battleId}/student/${studentProfileId}/answer`, {
      questionId,
      answer,
    });
    return response.data.data;
  },

  // Finalizar intento
  finishAttempt: async (battleId: string, studentProfileId: string): Promise<{ summary: any; bonusAwarded: boolean }> => {
    const response = await api.post(`/student-boss-battles/battle/${battleId}/student/${studentProfileId}/finish`);
    return response.data.data;
  },

  // Obtener estado actual (polling)
  getBattleStatus: async (battleId: string): Promise<BattleStatus> => {
    const response = await api.get(`/student-boss-battles/battle/${battleId}/status`);
    return response.data.data;
  },
};
