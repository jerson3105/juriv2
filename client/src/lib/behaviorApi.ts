import api from './api';

export type PointType = 'XP' | 'HP' | 'GP';

export interface Behavior {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  pointType: PointType;
  pointValue: number;
  xpValue: number;
  hpValue: number;
  gpValue: number;
  isPositive: boolean;
  icon: string | null;
  isActive: boolean;
  createdAt: string;
  competencyId: string | null;
}

export interface CreateBehaviorData {
  classroomId: string;
  name: string;
  description?: string;
  pointType: PointType;
  pointValue: number;
  xpValue?: number;
  hpValue?: number;
  gpValue?: number;
  isPositive: boolean;
  icon?: string;
  competencyId?: string;
}

export interface ApplyBehaviorData {
  behaviorId: string;
  studentIds: string[];
}

export interface LevelUpInfo {
  studentId: string;
  studentName: string;
  newLevel: number;
}

export interface AwardedBadgeInfo {
  studentId: string;
  badges: string[];
}

export interface ApplyResult {
  behavior: Behavior;
  studentsAffected: number;
  results: { studentId: string; studentName: string; newValue: number; leveledUp?: boolean; newLevel?: number }[];
  levelUps: LevelUpInfo[];
  awardedBadges?: AwardedBadgeInfo[];
}

export const behaviorApi = {
  // Crear comportamiento
  create: async (data: CreateBehaviorData): Promise<Behavior> => {
    const response = await api.post('/behaviors', data);
    return response.data.data;
  },

  // Obtener todos los comportamientos de una clase
  getByClassroom: async (classroomId: string): Promise<Behavior[]> => {
    const response = await api.get(`/behaviors/classroom/${classroomId}`);
    return response.data.data;
  },

  // Obtener comportamientos positivos
  getPositive: async (classroomId: string): Promise<Behavior[]> => {
    const response = await api.get(`/behaviors/classroom/${classroomId}/positive`);
    return response.data.data;
  },

  // Obtener comportamientos negativos
  getNegative: async (classroomId: string): Promise<Behavior[]> => {
    const response = await api.get(`/behaviors/classroom/${classroomId}/negative`);
    return response.data.data;
  },

  // Actualizar comportamiento
  update: async (id: string, data: Partial<CreateBehaviorData>): Promise<Behavior> => {
    const response = await api.put(`/behaviors/${id}`, data);
    return response.data.data;
  },

  // Eliminar comportamiento
  delete: async (id: string): Promise<void> => {
    await api.delete(`/behaviors/${id}`);
  },

  // Aplicar comportamiento a estudiantes
  apply: async (data: ApplyBehaviorData): Promise<ApplyResult> => {
    const response = await api.post('/behaviors/apply', data);
    return response.data.data;
  },

  // Generar comportamientos con IA
  generateWithAI: async (data: {
    description: string;
    level: string;
    count?: number;
    includePositive?: boolean;
    includeNegative?: boolean;
    pointMode?: 'COMBINED' | 'XP_ONLY' | 'HP_ONLY' | 'GP_ONLY';
    competencies?: { id: string; name: string }[];
  }): Promise<{ behaviors: GeneratedBehavior[]; prompt: string }> => {
    const response = await api.post('/behaviors/generate-ai', data);
    return response.data.data;
  },
};

export interface GeneratedBehavior {
  name: string;
  description: string;
  isPositive: boolean;
  xpValue: number;
  hpValue: number;
  gpValue: number;
  icon: string;
  competencyId?: string;
}
