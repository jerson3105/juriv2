import api from './api';
import type { AwardedBadgeInfo, LevelUpInfo } from './behaviorApi';

// Observatorio de Jiro: partidas de las actividades de clase (reanudar, Bitácora y recompensa).
export type ActivityType = 'DESCANSO' | 'ESTRELLAS' | 'CONQUISTA' | 'CORREO' | 'ERROR';
export type SelfAssessment = 'GREEN' | 'YELLOW' | 'RED';
export type ActivityStatus = 'ACTIVE' | 'FINISHED' | 'ABANDONED';

export interface ActivityReward {
  behaviorId: string | null;
  behaviorName: string | null;
  xp: number;
  gp: number;
  studentIds: string[];
}

export interface ActivitySession<S = Record<string, unknown>, R = Record<string, unknown>> {
  id: string;
  classroomId: string;
  activityType: ActivityType;
  status: ActivityStatus;
  title: string | null;
  result: R | null;
  selfAssessment: SelfAssessment | null;
  reward: ActivityReward | null;
  rewardedAt: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  state?: S | null;
}

export interface ActivityOverview {
  /** Última partida terminada sin recompensa (12 h). */
  unrewarded: ActivitySession | null;
  lastByType: { activityType: ActivityType; lastPlayedAt: string | null; plays: number }[];
  active: ActivitySession[];
}

export interface ChapterProgress {
  title: string;
  completionType: 'XP_GOAL' | 'DONATION';
  target: number;
  before: number;
  after: number;
}

export interface ActivityRewardResult {
  session: ActivitySession;
  levelUps: LevelUpInfo[];
  awardedBadges: AwardedBadgeInfo[];
  restingSkipped: number;
  studentsAffected: number;
  chapter: ChapterProgress | null;
}

export type RewardInput = { studentIds: string[] } & ({ behaviorId: string } | { xp: number; gp: number });

export interface AlbumEntry {
  sessionId: string;
  constellationId: string;
  customName: string | null;
  finishedAt: string | null;
}

export const activityKeys = {
  overview: (classroomId: string) => ['activities-overview', classroomId] as const,
  album: (classroomId: string) => ['activities-album', classroomId] as const,
};

export const activityApi = {
  overview: async (classroomId: string): Promise<ActivityOverview> => {
    const response = await api.get(`/activities/classroom/${classroomId}/overview`);
    return response.data.data;
  },

  /** Cielo de Jiro: constelaciones completadas en el Descanso. */
  album: async (classroomId: string): Promise<AlbumEntry[]> => {
    const response = await api.get(`/activities/classroom/${classroomId}/album`);
    return response.data.data;
  },

  renameConstellation: async (sessionId: string, name: string | null): Promise<ActivitySession> => {
    const response = await api.put(`/activities/sessions/${sessionId}/name`, { name });
    return response.data.data;
  },

  create: async <S>(classroomId: string, activityType: ActivityType, data: { title?: string | null; state?: S } = {}): Promise<ActivitySession<S>> => {
    const response = await api.post(`/activities/classroom/${classroomId}/sessions`, { activityType, ...data });
    return response.data.data;
  },

  get: async <S>(sessionId: string): Promise<ActivitySession<S>> => {
    const response = await api.get(`/activities/sessions/${sessionId}`);
    return response.data.data;
  },

  saveState: async <S>(sessionId: string, state: S): Promise<void> => {
    await api.put(`/activities/sessions/${sessionId}/state`, { state });
  },

  finish: async <S, R>(sessionId: string, result: R, state?: S): Promise<ActivitySession<S, R>> => {
    const response = await api.post(`/activities/sessions/${sessionId}/finish`, { result, state });
    return response.data.data;
  },

  abandon: async (sessionId: string): Promise<void> => {
    await api.post(`/activities/sessions/${sessionId}/abandon`);
  },

  setSelfAssessment: async (sessionId: string, value: SelfAssessment | null): Promise<ActivitySession> => {
    const response = await api.put(`/activities/sessions/${sessionId}/self-assessment`, { value });
    return response.data.data;
  },

  /** Recompensa a los presentes: una vez por partida (409 si ya se entregó). */
  reward: async (sessionId: string, input: RewardInput): Promise<ActivityRewardResult> => {
    const response = await api.post(`/activities/sessions/${sessionId}/reward`, input);
    return response.data.data;
  },

  undoReward: async (sessionId: string): Promise<{ session: ActivitySession; reverted: number; message: string; badgesReverted: number }> => {
    const response = await api.delete(`/activities/sessions/${sessionId}/reward`);
    return response.data.data;
  },
};
