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
  
  // Configuración de clases de personaje
  classAssignmentMode: 'STUDENT_CHOICE' | 'TEACHER_ASSIGNS';
  
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
  competencyIndicatorStartPeriod?: string | null;
  
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
  characterClassId?: string | null;
  avatarGender: 'MALE' | 'FEMALE';
  displayName?: string | null;
  linkCode?: string | null;
  linkedEmail?: string | null;
  level: number;
  xp: number;
  hp: number;
  gp: number;
  realName: string | null;
  realLastName: string | null;
  isActive?: boolean;
  isDemo?: boolean;
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

export type AIClassroomFeatureKey =
  | 'students'
  | 'behaviors'
  | 'rankings'
  | 'grades'
  | 'settings'
  | 'badges'
  | 'shop'
  | 'clans'
  | 'attendance'
  | 'collectibles'
  | 'storytelling'
  | 'expedition'
  | 'question_bank'
  | 'activities';

export type AIClassroomModuleAction = 'AUTO_CREATE' | 'ENABLE_ON_CREATE' | 'READY_AFTER_CREATE' | 'LOCKED';

export interface AIClassroomBlueprintModule {
  featureKey: AIClassroomFeatureKey;
  title: string;
  shortDescription: string;
  state: 'AVAILABLE' | 'LOCKED';
  actionType: AIClassroomModuleAction;
  configurable: boolean;
  autoCreateSupported: boolean;
  recommended: boolean;
  reason: string;
}

export interface AIClassroomBlueprint {
  introMessage: string;
  classroom: {
    name: string;
    description: string;
    subject: string;
    gradeLevel: string;
    educationLevel: '' | 'PRIMARIA' | 'SECUNDARIA';
    useCompetencies: boolean;
    curriculumAreaName: string;
    gradeScaleType: 'PERU_LETTERS' | 'PERU_VIGESIMAL' | 'CENTESIMAL' | 'USA_LETTERS' | 'CUSTOM';
    objective: string;
  };
  settings: {
    allowNegativePoints: boolean;
    showReasonToStudent: boolean;
    notifyOnPoints: boolean;
    classAssignmentMode: 'STUDENT_CHOICE' | 'TEACHER_ASSIGNS';
    showCharacterName: boolean;
    requirePurchaseApproval: boolean;
  };
  generationPlan: {
    behaviors: {
      description: string;
      count: number;
      pointMode: 'COMBINED' | 'XP_ONLY' | 'HP_ONLY' | 'GP_ONLY';
      includePositive: boolean;
      includeNegative: boolean;
    };
    badges: {
      description: string;
      count: number;
      assignmentMode: 'MANUAL' | 'AUTOMATIC' | 'BOTH';
    };
    shop: {
      description: string;
      count: number;
    };
    questions: {
      questionBankName: string;
      description: string;
      count: number;
      questionTypes: string[];
    };
  };
  modules: AIClassroomBlueprintModule[];
  unlockedFeatures: AIClassroomFeatureKey[];
  lockedFeatures: AIClassroomFeatureKey[];
  onboarding: {
    isExperienced: boolean;
    level: string;
  };
}

export interface GenerateAIContentRequest {
  section: 'behaviors' | 'badges' | 'shop' | 'questions';
  context: string;
  description?: string;
  count?: number;
  pointMode?: 'COMBINED' | 'XP_ONLY' | 'HP_ONLY' | 'GP_ONLY';
  includePositive?: boolean;
  includeNegative?: boolean;
  assignmentMode?: 'MANUAL' | 'AUTOMATIC' | 'BOTH';
  questionTypes?: string[];
  competencies?: Array<{ id: string; name: string }>;
  behaviors?: string[];
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

export interface ClassroomCompetency {
  classroomCompetencyId: string;
  id: string;
  sourceType: 'OFFICIAL' | 'CUSTOM_CLASSROOM';
  name: string;
  shortName: string | null;
  description: string | null;
  areaId: string;
  areaName: string;
  areaShortName: string | null;
  weight: number;
  isActive: boolean;
  isBase: boolean;
  isCustom: boolean;
  canEdit: boolean;
  canDelete: boolean;
  deleteBlockReason?: 'CONFIG_ASSOCIATED' | 'HISTORICAL_RECORDS' | 'CONFIG_AND_HISTORICAL_RECORDS' | null;
  indicators: ClassroomCompetencyIndicator[];
  createdAt: string;
}

export interface ClassroomCompetencyIndicator {
  id: string;
  classroomCompetencyId: string;
  classroomId: string;
  competencyId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomClassroomCompetencyData {
  name: string;
  shortName?: string | null;
  description?: string | null;
}

export interface UpdateCustomClassroomCompetencyData {
  name?: string;
  shortName?: string | null;
  description?: string | null;
}

export interface CreateClassroomCompetencyIndicatorData {
  name: string;
  description?: string | null;
}

export interface UpdateClassroomCompetencyIndicatorData {
  name?: string;
  description?: string | null;
}

export interface TransferCompetencyIndicatorsData {
  mode: 'IMPORT' | 'EXPORT';
  sourceClassroomId?: string;
  targetClassroomIds?: string[];
  competencyIds?: string[];
  copyMissingCustomCompetencies?: boolean;
}

export interface TransferCompetencyIndicatorsTargetSummary {
  classroomId: string;
  classroomName: string;
  createdCompetencies: number;
  createdIndicators: number;
  skippedExistingIndicators: number;
  skippedUnavailableCompetencies: number;
}

export interface TransferCompetencyIndicatorsResult {
  mode: 'IMPORT' | 'EXPORT';
  sourceClassroom: {
    id: string;
    name: string;
  };
  selectedCompetencyCount: number;
  selectedTargetCount: number;
  processedTargetCount: number;
  createdCompetencies: number;
  createdIndicators: number;
  skippedExistingIndicators: number;
  skippedUnavailableCompetencies: number;
  failedTargets: Array<{
    classroomId: string;
    classroomName: string;
    message: string;
  }>;
  targetSummaries: TransferCompetencyIndicatorsTargetSummary[];
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
  
  // Clases de personaje
  classAssignmentMode?: 'STUDENT_CHOICE' | 'TEACHER_ASSIGNS';
  
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

  // Generar el plan maestro de Jiro para una nueva clase
  generateAIClassroomBlueprint: async (prompt: string): Promise<AIClassroomBlueprint> => {
    const response = await api.post('/classrooms/generate-ai-blueprint', { prompt });
    return response.data.data;
  },

  // Generar contenido IA por módulo usando el contexto de la clase
  generateAIContent: async (data: GenerateAIContentRequest): Promise<any> => {
    const response = await api.post('/classrooms/generate-ai-content', data);
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

  // Obtener competencias habilitadas del aula
  getCompetencies: async (id: string): Promise<ClassroomCompetency[]> => {
    const response = await api.get(`/classrooms/${id}/competencies`);
    return response.data.data;
  },

  // Agregar competencias al aula
  addCompetencies: async (id: string, competencyIds: string[]): Promise<{ created: number; totalEnabled: number }> => {
    const response = await api.post(`/classrooms/${id}/competencies`, { competencyIds });
    return response.data.data;
  },

  // Retirar competencia oficial adicional del aula
  removeCompetency: async (id: string, competencyId: string): Promise<void> => {
    await api.delete(`/classrooms/${id}/competencies/${competencyId}`);
  },

  // Crear competencia personalizada del aula
  createCustomCompetency: async (id: string, data: CreateCustomClassroomCompetencyData): Promise<ClassroomCompetency> => {
    const response = await api.post(`/classrooms/${id}/competencies/custom`, data);
    return response.data.data;
  },

  // Actualizar competencia personalizada del aula
  updateCustomCompetency: async (
    id: string,
    competencyId: string,
    data: UpdateCustomClassroomCompetencyData,
  ): Promise<ClassroomCompetency> => {
    const response = await api.patch(`/classrooms/${id}/competencies/custom/${competencyId}`, data);
    return response.data.data;
  },

  // Eliminar competencia personalizada del aula
  deleteCustomCompetency: async (id: string, competencyId: string): Promise<void> => {
    await api.delete(`/classrooms/${id}/competencies/custom/${competencyId}`);
  },

  // Crear destreza para una competencia del aula
  createCompetencyIndicator: async (
    id: string,
    competencyId: string,
    data: CreateClassroomCompetencyIndicatorData,
  ): Promise<ClassroomCompetencyIndicator> => {
    const response = await api.post(`/classrooms/${id}/competencies/${competencyId}/indicators`, data);
    return response.data.data;
  },

  // Actualizar destreza de una competencia del aula
  updateCompetencyIndicator: async (
    id: string,
    competencyId: string,
    indicatorId: string,
    data: UpdateClassroomCompetencyIndicatorData,
  ): Promise<ClassroomCompetencyIndicator> => {
    const response = await api.patch(`/classrooms/${id}/competencies/${competencyId}/indicators/${indicatorId}`, data);
    return response.data.data;
  },

  // Eliminar destreza de una competencia del aula
  deleteCompetencyIndicator: async (id: string, competencyId: string, indicatorId: string): Promise<void> => {
    await api.delete(`/classrooms/${id}/competencies/${competencyId}/indicators/${indicatorId}`);
  },

  // Importar o exportar destrezas entre clases del profesor
  transferCompetencyIndicators: async (
    id: string,
    data: TransferCompetencyIndicatorsData,
  ): Promise<TransferCompetencyIndicatorsResult> => {
    const response = await api.post(`/classrooms/${id}/competency-indicators/transfer`, data);
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
