import api from './api';

// ==================== TIPOS ====================

export type MissionType = 'DAILY' | 'WEEKLY' | 'SPECIAL';
export type MissionCategory = 'PARTICIPATION' | 'PROGRESS' | 'SOCIAL' | 'SHOP' | 'BATTLE' | 'STREAK' | 'CUSTOM';
export type MissionStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CLAIMED';

export interface Mission {
  id: string;
  classroomId: string;
  name: string;
  description: string;
  icon: string;
  type: MissionType;
  category: MissionCategory;
  objectiveType: string;
  objectiveTarget: number;
  objectiveConfig: any;
  rewardXp: number;
  rewardGp: number;
  rewardHp: number;
  attachmentUrl: string | null;
  attachmentName: string | null;
  isRepeatable: boolean;
  maxCompletions: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentMission {
  id: string;
  studentProfileId: string;
  missionId: string;
  status: MissionStatus;
  currentProgress: number;
  targetProgress: number;
  assignedAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  claimedAt: string | null;
  mission: Mission;
}

export interface StudentStreak {
  currentStreak: number;
  longestStreak: number;
  lastCompletedAt: string | null;
  streakStartedAt: string | null;
  claimedMilestones: number[];
}

export interface StreakMilestone {
  days: number;
  xp: number;
  gp: number;
}

export interface CreateMissionDto {
  name: string;
  description: string;
  icon?: string;
  type: MissionType;
  category: MissionCategory;
  objectiveType: string;
  objectiveTarget: number;
  objectiveConfig?: any;
  rewardXp?: number;
  rewardGp?: number;
  rewardHp?: number;
  attachmentUrl?: string;
  attachmentName?: string;
  isRepeatable?: boolean;
  maxCompletions?: number;
  autoAssign?: boolean;
  autoExpire?: boolean;
}

export interface GeneratedMission {
  name: string;
  description: string;
  icon: string;
  type: MissionType;
  category: MissionCategory;
  objectiveType: string;
  objectiveTarget: number;
  rewardXp: number;
  rewardGp: number;
  isRepeatable: boolean;
}

export interface MissionAssignment {
  id: string;
  studentProfileId: string;
  studentName: string;
  status: MissionStatus;
  currentProgress: number;
  targetProgress: number;
  completedAt: string | null;
  claimedAt: string | null;
}

export interface MissionStats {
  totalMissions: number;
  activeMissions: number;
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
  topStudents: { studentId: string; name: string; completed: number }[];
}

// ==================== CONSTANTES ====================

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  SPECIAL: 'Especial',
};

export const MISSION_CATEGORY_LABELS: Record<MissionCategory, string> = {
  PARTICIPATION: 'Participación',
  PROGRESS: 'Progreso',
  SOCIAL: 'Social',
  SHOP: 'Tienda',
  BATTLE: 'Batallas',
  STREAK: 'Racha',
  CUSTOM: 'Personalizada',
};

export const OBJECTIVE_TYPE_LABELS: Record<string, string> = {
  EARN_XP: 'Ganar XP',
  EARN_GP: 'Ganar Oro',
  ATTEND_CLASS: 'Asistir a clase',
  COMPLETE_BATTLE: 'Completar batalla',
  MAKE_PURCHASE: 'Hacer compra',
  GIVE_GIFT: 'Dar regalo',
  REACH_LEVEL: 'Alcanzar nivel',
  COMPLETE_MISSIONS: 'Completar misiones',
  MAINTAIN_STREAK: 'Mantener racha',
  CUSTOM: 'Personalizado',
};

export const MISSION_ICONS = [
  '🎯', '⚔️', '📚', '🏆', '⭐', '💎', '🔥', '🌟',
  '🎮', '🎲', '🎁', '💰', '🛒', '👥', '🤝', '📈',
  '🏅', '🎖️', '🌈', '✨', '💪', '🧠', '📝', '🎓',
];

export const MISSION_TYPE_COLORS: Record<MissionType, { bg: string; text: string; border: string }> = {
  DAILY: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-700',
  },
  WEEKLY: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
  },
  SPECIAL: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-300 dark:border-purple-700',
  },
};

// ==================== API ====================

export const missionApi = {
  // ==================== CRUD (Profesor) ====================

  // Obtener misiones de una clase
  getClassroomMissions: async (classroomId: string, type?: MissionType): Promise<Mission[]> => {
    const params = type ? `?type=${type}` : '';
    const response = await api.get(`/missions/classroom/${classroomId}${params}`);
    return response.data;
  },

  // Crear misión
  createMission: async (classroomId: string, data: CreateMissionDto): Promise<Mission> => {
    const response = await api.post(`/missions/classroom/${classroomId}`, data);
    return response.data;
  },

  // Obtener una misión
  getMission: async (missionId: string): Promise<Mission> => {
    const response = await api.get(`/missions/${missionId}`);
    return response.data;
  },

  // Actualizar misión
  updateMission: async (missionId: string, data: Partial<CreateMissionDto> & { isActive?: boolean }): Promise<Mission> => {
    const response = await api.put(`/missions/${missionId}`, data);
    return response.data;
  },

  // Eliminar misión
  deleteMission: async (missionId: string): Promise<void> => {
    await api.delete(`/missions/${missionId}`);
  },

  // ==================== ASIGNACIÓN (Profesor) ====================

  // Asignar misión a estudiantes específicos
  assignMission: async (missionId: string, studentProfileIds: string[], expiresAt?: string): Promise<StudentMission[]> => {
    const response = await api.post('/missions/assign', {
      missionId,
      studentProfileIds,
      expiresAt,
    });
    return response.data;
  },

  // Asignar misión a todos los estudiantes
  assignMissionToAll: async (classroomId: string, missionId: string, expiresAt?: string): Promise<{ assigned: number }> => {
    const response = await api.post(`/missions/classroom/${classroomId}/assign/${missionId}`, {
      expiresAt,
    });
    return response.data;
  },

  // Obtener estudiantes asignados a una misión (solo IDs)
  getAssignedStudents: async (missionId: string): Promise<{ studentIds: string[] }> => {
    const response = await api.get(`/missions/assigned/${missionId}`);
    return response.data;
  },

  // Obtener detalles de asignaciones de una misión
  getMissionAssignments: async (missionId: string): Promise<MissionAssignment[]> => {
    const response = await api.get(`/missions/assignments/${missionId}`);
    return response.data;
  },

  // ==================== MISIONES DEL ESTUDIANTE ====================

  // Obtener mis misiones (estudiante)
  getMyMissions: async (classroomId: string): Promise<StudentMission[]> => {
    const response = await api.get(`/missions/my/${classroomId}`);
    return response.data;
  },

  // Obtener misiones de un estudiante (profesor)
  getStudentMissions: async (studentProfileId: string, status?: MissionStatus): Promise<StudentMission[]> => {
    const params = status ? `?status=${status}` : '';
    const response = await api.get(`/missions/student/${studentProfileId}${params}`);
    return response.data;
  },

  // Reclamar recompensa
  claimReward: async (studentMissionId: string): Promise<{ xp: number; gp: number; hp: number }> => {
    const response = await api.post(`/missions/claim/${studentMissionId}`);
    return response.data;
  },

  // Actualizar progreso manualmente (para misiones CUSTOM)
  updateProgressManually: async (studentMissionId: string, progress: number): Promise<any> => {
    const response = await api.put(`/missions/progress/${studentMissionId}`, { progress });
    return response.data;
  },

  // ==================== RACHAS ====================

  // Obtener mi racha (estudiante)
  getMyStreak: async (classroomId: string): Promise<{ streak: StudentStreak; milestones: StreakMilestone[] }> => {
    const response = await api.get(`/missions/streak/my/${classroomId}`);
    return response.data;
  },

  // Obtener racha de un estudiante (profesor)
  getStudentStreak: async (studentProfileId: string, classroomId: string): Promise<{ streak: StudentStreak; milestones: StreakMilestone[] }> => {
    const response = await api.get(`/missions/streak/${studentProfileId}/${classroomId}`);
    return response.data;
  },

  // Reclamar recompensa de racha
  claimStreakReward: async (classroomId: string, milestone: number): Promise<{ xp: number; gp: number }> => {
    const response = await api.post(`/missions/streak/claim/${classroomId}`, { milestone });
    return response.data;
  },

  // ==================== ESTADÍSTICAS ====================

  // Obtener estadísticas de misiones
  getStats: async (classroomId: string): Promise<MissionStats> => {
    const response = await api.get(`/missions/stats/${classroomId}`);
    return response.data;
  },

  // ==================== UPLOAD ====================

  // Subir archivo adjunto (máximo 5MB)
  uploadFile: async (file: File): Promise<{ url: string; name: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/missions/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Generar misiones con IA
  generateWithAI: async (data: {
    description: string;
    level: string;
    count?: number;
    types?: MissionType[];
    categories?: MissionCategory[];
  }): Promise<{ missions: GeneratedMission[]; prompt: string }> => {
    const response = await api.post('/missions/generate-ai', data);
    return response.data.data;
  },
};
