import api from './api';

// ==================== TYPES ====================

export type TournamentType = 'BRACKET' | 'LEAGUE' | 'QUICKFIRE';
export type TournamentStatus = 'DRAFT' | 'READY' | 'ACTIVE' | 'PAUSED' | 'FINISHED';
export type TournamentParticipantType = 'INDIVIDUAL' | 'CLAN';
export type TournamentMatchStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BYE';

export interface Tournament {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  icon: string;
  type: TournamentType;
  participantType: TournamentParticipantType;
  questionBankIds: string[];
  maxParticipants: number;
  timePerQuestion: number;
  questionsPerMatch: number;
  pointsPerCorrect: number;
  bonusTimePoints: number;
  rewardXpFirst: number;
  rewardXpSecond: number;
  rewardXpThird: number;
  rewardGpFirst: number;
  rewardGpSecond: number;
  rewardGpThird: number;
  rewardXpParticipation: number;
  status: TournamentStatus;
  currentRound: number;
  totalRounds: number;
  firstPlaceId: string | null;
  secondPlaceId: string | null;
  thirdPlaceId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentParticipant {
  id: string;
  tournamentId: string;
  studentProfileId: string | null;
  clanId: string | null;
  seed: number;
  totalPoints: number;
  matchesWon: number;
  matchesLost: number;
  questionsCorrect: number;
  questionsTotal: number;
  isEliminated: boolean;
  eliminatedInRound: number | null;
  finalPosition: number | null;
  joinedAt: string;
  updatedAt: string;
  // Populated fields
  student?: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    avatarGender?: 'MALE' | 'FEMALE' | null;
    characterClass: string | null;
    level: number;
    xp?: number;
  } | null;
  clan?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  bracketPosition: string | null;
  participant1Id: string | null;
  participant2Id: string | null;
  participant1Score: number;
  participant2Score: number;
  questionIds: string[] | null;
  currentQuestionIndex: number;
  winnerId: string | null;
  status: TournamentMatchStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentAnswer {
  id: string;
  matchId: string;
  participantId: string;
  questionId: string;
  answer: string | null;
  isCorrect: boolean;
  pointsEarned: number;
  timeSpent: number | null;
  answeredAt: string;
}

export interface TournamentWithDetails extends Tournament {
  participants?: TournamentParticipant[];
  matches?: TournamentMatch[];
  questionBanks?: { id: string; name: string; questionCount: number }[];
}

export interface MatchWithDetails extends TournamentMatch {
  participant1?: TournamentParticipant;
  participant2?: TournamentParticipant;
  currentQuestion?: {
    id: string;
    question: string;
    questionType: string;
    options: any;
    correctAnswer: string;
    imageUrl?: string | null;
  } | null;
  answers?: TournamentAnswer[];
}

export interface CreateTournamentData {
  name: string;
  description?: string;
  icon?: string;
  type: TournamentType;
  participantType: TournamentParticipantType;
  questionBankIds: string[];
  maxParticipants?: number;
  timePerQuestion?: number;
  questionsPerMatch?: number;
  pointsPerCorrect?: number;
  bonusTimePoints?: number;
  rewardXpFirst?: number;
  rewardXpSecond?: number;
  rewardXpThird?: number;
  rewardGpFirst?: number;
  rewardGpSecond?: number;
  rewardGpThird?: number;
  rewardXpParticipation?: number;
}

export interface UpdateTournamentData extends Partial<CreateTournamentData> {
  status?: TournamentStatus;
}

export interface AnswerResult {
  isCorrect: boolean;
  pointsEarned: number;
  answer: TournamentAnswer;
}

// ==================== API ====================

export const tournamentApi = {
  // Torneos
  getTournaments: async (classroomId: string): Promise<Tournament[]> => {
    const response = await api.get(`/tournaments/classroom/${classroomId}`);
    return response.data;
  },

  getTournament: async (tournamentId: string): Promise<TournamentWithDetails> => {
    const response = await api.get(`/tournaments/${tournamentId}`);
    return response.data;
  },

  createTournament: async (classroomId: string, data: CreateTournamentData): Promise<Tournament> => {
    const response = await api.post(`/tournaments/classroom/${classroomId}`, data);
    return response.data;
  },

  updateTournament: async (tournamentId: string, data: UpdateTournamentData): Promise<Tournament> => {
    const response = await api.put(`/tournaments/${tournamentId}`, data);
    return response.data;
  },

  deleteTournament: async (tournamentId: string): Promise<void> => {
    await api.delete(`/tournaments/${tournamentId}`);
  },

  // Participantes
  addParticipant: async (
    tournamentId: string,
    participantId: string,
    isIndividual: boolean = true
  ): Promise<TournamentParticipant> => {
    const response = await api.post(`/tournaments/${tournamentId}/participants`, {
      participantId,
      isIndividual,
    });
    return response.data;
  },

  addMultipleParticipants: async (
    tournamentId: string,
    participantIds: string[],
    isIndividual: boolean = true
  ): Promise<TournamentParticipant[]> => {
    const response = await api.post(`/tournaments/${tournamentId}/participants/bulk`, {
      participantIds,
      isIndividual,
    });
    return response.data;
  },

  removeParticipant: async (participantId: string): Promise<void> => {
    await api.delete(`/tournaments/participants/${participantId}`);
  },

  shuffleParticipants: async (tournamentId: string): Promise<TournamentParticipant[]> => {
    const response = await api.post(`/tournaments/${tournamentId}/shuffle`);
    return response.data;
  },

  // Bracket
  generateBracket: async (tournamentId: string): Promise<TournamentMatch[]> => {
    const response = await api.post(`/tournaments/${tournamentId}/bracket`);
    return response.data;
  },

  // Matches
  getMatch: async (matchId: string): Promise<MatchWithDetails> => {
    const response = await api.get(`/tournaments/matches/${matchId}`);
    return response.data;
  },

  startMatch: async (matchId: string): Promise<MatchWithDetails> => {
    const response = await api.post(`/tournaments/matches/${matchId}/start`);
    return response.data;
  },

  submitAnswer: async (
    matchId: string,
    participantId: string,
    answer: string,
    timeSpent: number
  ): Promise<AnswerResult> => {
    const response = await api.post(`/tournaments/matches/${matchId}/answer`, {
      participantId,
      answer,
      timeSpent,
    });
    return response.data;
  },

  nextQuestion: async (matchId: string): Promise<MatchWithDetails | { completed: true }> => {
    const response = await api.post(`/tournaments/matches/${matchId}/next`);
    return response.data;
  },

  completeMatch: async (matchId: string): Promise<MatchWithDetails> => {
    const response = await api.post(`/tournaments/matches/${matchId}/complete`);
    return response.data;
  },
};

// ==================== CONSTANTS ====================

export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  BRACKET: 'Eliminación',
  LEAGUE: 'Liga',
  QUICKFIRE: 'Relámpago',
};

export const TOURNAMENT_TYPE_DESCRIPTIONS: Record<TournamentType, string> = {
  BRACKET: 'Formato de llaves eliminatorias. El ganador avanza, el perdedor queda eliminado.',
  LEAGUE: 'Todos contra todos. Se acumulan puntos por cada victoria.',
  QUICKFIRE: 'Rondas rápidas con preguntas aleatorias. El que más puntos acumule gana.',
};

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  DRAFT: 'Borrador',
  READY: 'Listo',
  ACTIVE: 'En curso',
  PAUSED: 'Pausado',
  FINISHED: 'Finalizado',
};

export const TOURNAMENT_STATUS_COLORS: Record<TournamentStatus, string> = {
  DRAFT: 'gray',
  READY: 'blue',
  ACTIVE: 'green',
  PAUSED: 'amber',
  FINISHED: 'purple',
};

export const PARTICIPANT_TYPE_LABELS: Record<TournamentParticipantType, string> = {
  INDIVIDUAL: 'Individual',
  CLAN: 'Por Clanes',
};

export const MATCH_STATUS_LABELS: Record<TournamentMatchStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  BYE: 'Pase libre',
};

export const BRACKET_SIZES = [4, 8, 16, 32];

export const TOURNAMENT_ICONS = [
  '🏆', '⚔️', '🎯', '🏅', '👑', '🌟', '💎', '🔥',
  '⚡', '🎮', '🎲', '🏰', '🗡️', '🛡️', '🎪', '🎭',
];

export default tournamentApi;
