import api from './api';

export interface Classroom {
  id: string;
  name: string;
  description: string | null;
  code: string;
  teacherId: string;
  gradeLevel: string | null;
  isActive: boolean;
  bannerUrl: string | null;
  
  // Configuración de puntos
  defaultXp: number;
  defaultHp: number;
  defaultGp: number;
  maxHp: number;
  xpPerLevel: number;
  allowNegativeHp: boolean;
  
  // Configuración de comportamientos
  allowNegativePoints: boolean;
  showReasonToStudent: boolean;
  notifyOnPoints: boolean;
  
  // Configuración de tienda
  shopEnabled: boolean;
  requirePurchaseApproval: boolean;
  dailyPurchaseLimit: number | null;
  
  // Configuración de visualización
  showCharacterName: boolean;
  
  // Configuración de clanes
  clansEnabled: boolean;
  clanXpPercentage: number;
  clanBattlesEnabled: boolean;
  clanGpRewardEnabled: boolean;
  
  // Configuración de racha de login
  loginStreakEnabled: boolean;
  loginStreakConfig: {
    dailyXp: number;
    milestones: Array<{
      day: number;
      xp: number;
      gp: number;
      randomItem: boolean;
    }>;
    resetOnMiss: boolean;
    graceDays: number;
  } | null;
  
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  characterName: string | null;
  avatarUrl: string | null;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  avatarGender: 'MALE' | 'FEMALE';
  level: number;
  xp: number;
  hp: number;
  gp: number;
  realName: string | null;
  realLastName: string | null;
}

export interface CreateClassroomData {
  name: string;
  description?: string;
  gradeLevel?: string;
}

export interface UpdateClassroomSettings {
  // General
  name?: string;
  description?: string;
  bannerUrl?: string | null;
  gradeLevel?: string | null;
  isActive?: boolean;
  
  // Puntos
  defaultXp?: number;
  defaultHp?: number;
  defaultGp?: number;
  maxHp?: number;
  xpPerLevel?: number;
  allowNegativeHp?: boolean;
  
  // Comportamientos
  allowNegativePoints?: boolean;
  showReasonToStudent?: boolean;
  notifyOnPoints?: boolean;
  
  // Tienda
  shopEnabled?: boolean;
  requirePurchaseApproval?: boolean;
  dailyPurchaseLimit?: number | null;
  
  // Visualización
  showCharacterName?: boolean;
  
  // Clanes
  clansEnabled?: boolean;
  clanXpPercentage?: number;
  clanBattlesEnabled?: boolean;
  clanGpRewardEnabled?: boolean;
  
  // Racha de login
  loginStreakEnabled?: boolean;
  loginStreakConfig?: {
    dailyXp: number;
    milestones: Array<{
      day: number;
      xp: number;
      gp: number;
      randomItem: boolean;
    }>;
    resetOnMiss: boolean;
    graceDays: number;
  };
}

export interface JoinClassroomData {
  code: string;
  characterName: string;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
}

export const classroomApi = {
  // Obtener mis clases (profesor)
  getMyClassrooms: async (): Promise<Classroom[]> => {
    const response = await api.get('/classrooms/my');
    return response.data.data;
  },

  // Crear clase
  create: async (data: CreateClassroomData): Promise<Classroom> => {
    const response = await api.post('/classrooms', data);
    return response.data.data;
  },

  // Obtener clase por ID
  getById: async (id: string): Promise<Classroom & { students: Student[] }> => {
    const response = await api.get(`/classrooms/${id}`);
    return response.data.data;
  },

  // Actualizar clase
  update: async (id: string, data: UpdateClassroomSettings): Promise<Classroom> => {
    const response = await api.put(`/classrooms/${id}`, data);
    return response.data.data;
  },

  // Eliminar clase
  delete: async (id: string): Promise<void> => {
    await api.delete(`/classrooms/${id}`);
  },

  // Resetear puntos de todos los estudiantes
  resetAllPoints: async (id: string): Promise<void> => {
    await api.post(`/classrooms/${id}/reset-points`);
  },

  // Unirse a clase (estudiante)
  join: async (data: JoinClassroomData): Promise<{ classroom: Classroom; profileId: string }> => {
    const response = await api.post('/classrooms/join', data);
    return response.data.data;
  },
};
