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
  
  // Configuración de Pergaminos del Aula
  scrollsEnabled: boolean;
  
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
  
  // Configuración de competencias
  useCompetencies: boolean;
  curriculumAreaId: string | null;
  gradeScaleType: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM' | null;
  gradeScaleConfig: {
    ranges: Array<{
      label: string;
      minPercent: number;
      maxPercent: number;
      xpReward: number;
      gpReward: number;
    }>;
  } | null;
  
  // Escuela
  schoolId: string | null;

  // Tema visual (storytelling)
  themeConfig: {
    colors?: { primary?: string; secondary?: string; accent?: string; background?: string; sidebar?: string };
    particles?: { type?: string; color?: string; speed?: string; density?: string };
    decorations?: Array<{ type: string; position: string; asset: string }>;
    banner?: { emoji?: string; title?: string };
  } | null;
  themeSource: string | null;
  
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
  teamId?: string | null;
  clanName?: string | null;
  clanColor?: string | null;
  clanEmblem?: string | null;
  clanMotto?: string | null;
}

export interface CreateClassroomData {
  name: string;
  description?: string;
  gradeLevel?: string;
  useCompetencies?: boolean;
  curriculumAreaId?: string | null;
  gradeScaleType?: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM' | null;
  schoolId?: string | null;
}

export interface CurriculumCompetency {
  id: string;
  areaId: string;
  name: string;
  shortName: string | null;
  description: string | null;
  displayOrder: number;
}

export interface CurriculumArea {
  id: string;
  countryCode: string;
  educationLevel: string | null;
  name: string;
  shortName: string | null;
  displayOrder: number;
  competencies: CurriculumCompetency[];
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
  // Competencias
  useCompetencies?: boolean;
  curriculumAreaId?: string | null;
  gradeScaleType?: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM' | null;
}

export interface ResetOptions {
  points?: boolean;
  history?: boolean;
  purchases?: boolean;
  badges?: boolean;
  attendance?: boolean;
  streaks?: boolean;
  clans?: boolean;
  scrolls?: boolean;
  powerUsages?: boolean;
}

export interface JoinClassroomData {
  code: string;
  characterName: string;
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
}

export const classroomApi = {
  // Obtener áreas curriculares
  getCurriculumAreas: async (countryCode: string = 'PE', level?: string): Promise<CurriculumArea[]> => {
    const params = new URLSearchParams({ country: countryCode });
    if (level) params.append('level', level);
    const response = await api.get(`/classrooms/curriculum-areas?${params.toString()}`);
    return response.data.data;
  },

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

  // Reseteo selectivo del aula
  resetClassroomSelective: async (id: string, options: ResetOptions): Promise<{ cleaned: string[] }> => {
    const response = await api.post(`/classrooms/${id}/reset-selective`, options);
    return response.data.data;
  },

  // Sincronizar competencias del classroom con el área curricular
  syncCompetencies: async (id: string): Promise<{ created: number; total: number }> => {
    const response = await api.post(`/classrooms/${id}/sync-competencies`);
    return response.data.data;
  },

  // Unirse a clase (estudiante)
  join: async (data: JoinClassroomData): Promise<{ classroom: Classroom; profileId: string }> => {
    const response = await api.post('/classrooms/join', data);
    return response.data.data;
  },

  // Obtener cantidades de elementos clonables
  getCloneableCounts: async (classroomId: string): Promise<{
    behaviors: number;
    badges: number;
    shopItems: number;
    questionBanks: number;
  }> => {
    const response = await api.get(`/classrooms/${classroomId}/cloneable-counts`);
    return response.data.data;
  },

  // Clonar aula
  clone: async (
    classroomId: string, 
    options: {
      name: string;
      description?: string;
      copyBehaviors: boolean;
      copyBadges: boolean;
      copyShopItems: boolean;
      copyQuestionBanks: boolean;
      schoolId?: string | null;
    }
  ): Promise<{ 
    classroom: Classroom; 
    copied: { behaviors: number; badges: number; shopItems: boolean; questionBanks: number } 
  }> => {
    const response = await api.post(`/classrooms/${classroomId}/clone`, options);
    return response.data.data;
  },
};
