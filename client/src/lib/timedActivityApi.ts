import api from './api';

// Types
export type TimedActivityMode = 'STOPWATCH' | 'TIMER' | 'BOMB' | 'BOMB_RANDOM';
export type TimedActivityStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface TimedActivity {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  mode: TimedActivityMode;
  status: TimedActivityStatus;
  timeLimitSeconds: number | null;
  bombMinSeconds: number | null;
  bombMaxSeconds: number | null;
  actualBombTime: number | null;
  behaviorId: string | null;
  basePoints: number;
  pointType: string;
  useMultipliers: boolean;
  multiplier50: number;
  multiplier75: number;
  negativeBehaviorId: string | null;
  bombPenaltyPoints: number;
  bombPenaltyType: string;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  elapsedSeconds: number;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  results?: TimedActivityResult[];
  behavior?: any;
  negativeBehavior?: any;
}

export interface TimedActivityResult {
  id: string;
  studentProfileId: string;
  completedAt: string | null;
  elapsedSeconds: number | null;
  multiplierApplied: number;
  pointsAwarded: number;
  wasExploded: boolean;
  penaltyApplied: number;
  student?: {
    id: string;
    characterName: string | null;
    displayName: string | null;
    characterClass: string;
    avatarGender: string;
  };
}

export interface CreateTimedActivityDto {
  name: string;
  description?: string;
  mode: TimedActivityMode;
  timeLimitSeconds?: number;
  bombMinSeconds?: number;
  bombMaxSeconds?: number;
  behaviorId?: string;
  basePoints?: number;
  pointType?: 'XP' | 'HP' | 'GP';
  useMultipliers?: boolean;
  multiplier50?: number;
  multiplier75?: number;
  negativeBehaviorId?: string;
  bombPenaltyPoints?: number;
  bombPenaltyType?: 'XP' | 'HP' | 'GP';
}

export interface MarkStudentCompleteResult {
  resultId: string;
  multiplier: number;
  pointsAwarded: number;
}

export interface MarkStudentExplodedResult {
  resultId: string;
  penaltyApplied: number;
}

// Mode labels and icons
export const MODE_CONFIG: Record<TimedActivityMode, { label: string; icon: string; color: string; description: string }> = {
  STOPWATCH: {
    label: 'Cronómetro',
    icon: '⏱️',
    color: 'blue',
    description: 'Mide cuánto tiempo tardan los estudiantes',
  },
  TIMER: {
    label: 'Temporizador',
    icon: '⏳',
    color: 'amber',
    description: 'Cuenta regresiva con tiempo límite',
  },
  BOMB: {
    label: 'Bomba (Manual)',
    icon: '💣',
    color: 'red',
    description: 'El profesor marca manualmente quién completó',
  },
  BOMB_RANDOM: {
    label: 'Bomba (Aleatorio)',
    icon: '🎲',
    color: 'pink',
    description: 'Turnos aleatorios - la bomba pasa de estudiante en estudiante',
  },
};

export const STATUS_CONFIG: Record<TimedActivityStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'gray' },
  ACTIVE: { label: 'En curso', color: 'green' },
  PAUSED: { label: 'Pausada', color: 'amber' },
  COMPLETED: { label: 'Completada', color: 'blue' },
};

// API functions
export const timedActivityApi = {
  // CRUD
  create: async (classroomId: string, data: CreateTimedActivityDto): Promise<TimedActivity> => {
    const response = await api.post(`/timed-activities/classroom/${classroomId}`, data);
    return response.data;
  },

  getByClassroom: async (classroomId: string): Promise<TimedActivity[]> => {
    const response = await api.get(`/timed-activities/classroom/${classroomId}`);
    return response.data;
  },

  getById: async (id: string): Promise<TimedActivity> => {
    const response = await api.get(`/timed-activities/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateTimedActivityDto>): Promise<TimedActivity> => {
    const response = await api.put(`/timed-activities/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/timed-activities/${id}`);
  },

  // Control
  start: async (id: string): Promise<TimedActivity> => {
    const response = await api.post(`/timed-activities/${id}/start`);
    return response.data;
  },

  pause: async (id: string, elapsedSeconds: number): Promise<TimedActivity> => {
    const response = await api.post(`/timed-activities/${id}/pause`, { elapsedSeconds });
    return response.data;
  },

  resume: async (id: string): Promise<TimedActivity> => {
    const response = await api.post(`/timed-activities/${id}/resume`);
    return response.data;
  },

  complete: async (id: string, elapsedSeconds: number): Promise<TimedActivity> => {
    const response = await api.post(`/timed-activities/${id}/complete`, { elapsedSeconds });
    return response.data;
  },

  reset: async (id: string): Promise<TimedActivity> => {
    const response = await api.post(`/timed-activities/${id}/reset`);
    return response.data;
  },

  // Student actions
  markStudentComplete: async (
    activityId: string,
    studentProfileId: string,
    elapsedSeconds: number
  ): Promise<MarkStudentCompleteResult> => {
    const response = await api.post(`/timed-activities/${activityId}/mark-complete`, {
      studentProfileId,
      elapsedSeconds,
    });
    return response.data;
  },

  markStudentExploded: async (
    activityId: string,
    studentProfileId: string
  ): Promise<MarkStudentExplodedResult> => {
    const response = await api.post(`/timed-activities/${activityId}/mark-exploded`, {
      studentProfileId,
    });
    return response.data;
  },

  // Get active activity
  getActiveActivity: async (classroomId: string): Promise<TimedActivity | null> => {
    const response = await api.get(`/timed-activities/classroom/${classroomId}/active`);
    return response.data;
  },
};
