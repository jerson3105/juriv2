import api from './api';

export type CharacterClass = 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
export type PointType = 'XP' | 'HP' | 'GP';
export type AvatarGender = 'MALE' | 'FEMALE';

export interface StudentProfile {
  id: string;
  userId: string;
  classroomId: string;
  characterName: string | null;
  characterClass: CharacterClass;
  characterClassId?: string | null;
  avatarGender: AvatarGender;
  avatarUrl: string | null;
  level: number;
  xp: number;
  hp: number;
  gp: number;
  teamId: string | null;
  isActive: boolean;
  displayName?: string; // Nombre real para mostrar
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  classroom?: {
    id: string;
    name: string;
    code: string;
    clansEnabled?: boolean;
    scrollsEnabled?: boolean;
    scrollsOpen?: boolean;
    scrollsRequireApproval?: boolean;
    useCompetencies?: boolean;
    curriculumAreaId?: string;
    gradeScaleType?: string;
    classAssignmentMode?: string;
  };
}

export interface JoinClassData {
  code: string;
  characterName: string;
  characterClass: string;
  characterClassId?: string;
  avatarGender?: AvatarGender;
}

export interface UpdatePointsData {
  pointType: PointType;
  amount: number;
  reason: string;
  competencyId?: string;
}

export interface UpdatePointsResult {
  student: StudentProfile;
  leveledUp: boolean;
  newLevel?: number;
  studentName: string;
}

export interface PointLog {
  id: string;
  studentId: string;
  pointType: PointType;
  action: 'ADD' | 'REMOVE';
  amount: number;
  reason: string;
  givenBy: string;
  createdAt: string;
}

export interface StudentStats {
  summary: {
    totalXpGained: number;
    totalXpLost: number;
    netXp: number;
    totalGpGained: number;
    totalGpSpent: number;
    totalHpLost: number;
    totalHpRecovered: number;
    xpThisWeek: number;
    xpThisMonth: number;
    totalActions: number;
    streak: number;
  };
  strengths: Array<{ id: string; name: string; count: number; isPositive: boolean }>;
  areasToImprove: Array<{ id: string; name: string; count: number; isPositive: boolean }>;
  activityByDay: number[];
  recentHistory: Array<{
    id: string;
    type: PointType;
    action: 'ADD' | 'REMOVE';
    amount: number;
    reason: string;
    date: string;
    xpAmount?: number;
    gpAmount?: number;
    hpAmount?: number;
  }>;
}

export const CHARACTER_CLASSES = {
  GUARDIAN: {
    name: 'Guardián',
    description: 'Protector del equipo, resistente y leal',
    icon: '🛡️',
    color: 'blue',
  },
  ARCANE: {
    name: 'Arcano',
    description: 'Maestro del conocimiento y la magia',
    icon: '🔮',
    color: 'violet',
  },
  EXPLORER: {
    name: 'Explorador',
    description: 'Aventurero ágil y curioso',
    icon: '🧭',
    color: 'green',
  },
  ALCHEMIST: {
    name: 'Alquimista',
    description: 'Creador de pociones y artefactos',
    icon: '⚗️',
    color: 'orange',
  },
};

export const studentApi = {
  // Verificar código (detecta si es clase o estudiante)
  verifyCode: async (code: string): Promise<{
    type: 'classroom' | 'student';
    classroomName?: string;
    classroomCode?: string;
    isActive?: boolean;
    studentName?: string | null;
    alreadyLinked?: boolean;
  }> => {
    const response = await api.post('/students/verify-code', { code });
    return response.data.data;
  },

  // Unirse a una clase
  joinClass: async (data: JoinClassData): Promise<{ profileId: string; classroom: { id: string; name: string; code: string } }> => {
    const response = await api.post('/students/join', data);
    return response.data.data;
  },

  // Obtener mis clases como estudiante
  getMyClasses: async (): Promise<(StudentProfile & { classroom: { id: string; name: string; code: string; clansEnabled?: boolean; scrollsEnabled?: boolean; scrollsOpen?: boolean; scrollsRequireApproval?: boolean; useCompetencies?: boolean; themeConfig?: { colors?: { primary?: string; secondary?: string; accent?: string; background?: string; sidebar?: string }; particles?: { type?: string; color?: string; speed?: string; density?: string }; decorations?: Array<{ type: string; position: string; asset: string }>; banner?: { emoji?: string; title?: string } } | null } })[]> => {
    const response = await api.get('/students/my-classes');
    return response.data.data;
  },

  // Obtener mi perfil en una clase
  getMyProfile: async (classroomId: string): Promise<StudentProfile> => {
    const response = await api.get(`/students/profile/${classroomId}`);
    return response.data.data;
  },

  // Actualizar mi perfil
  updateProfile: async (classroomId: string, data: { characterName?: string; avatarUrl?: string }): Promise<StudentProfile> => {
    const response = await api.put(`/students/profile/${classroomId}`, data);
    return response.data.data;
  },

  // Para profesores: obtener estudiante
  getStudent: async (studentId: string): Promise<StudentProfile> => {
    const response = await api.get(`/students/${studentId}`);
    return response.data.data;
  },

  // Para profesores: modificar puntos
  updatePoints: async (studentId: string, data: UpdatePointsData): Promise<UpdatePointsResult> => {
    const response = await api.post(`/students/${studentId}/points`, data);
    return response.data.data;
  },

  // Obtener historial de puntos
  getPointHistory: async (studentId: string): Promise<PointLog[]> => {
    const response = await api.get(`/students/${studentId}/history`);
    return response.data.data;
  },

  // Crear estudiante demo para onboarding
  createDemoStudent: async (classroomId: string): Promise<StudentProfile> => {
    const response = await api.post(`/students/demo/${classroomId}`);
    return response.data.data;
  },

  // Eliminar estudiante demo
  deleteDemoStudent: async (classroomId: string): Promise<void> => {
    await api.delete(`/students/demo/${classroomId}`);
  },

  // Verificar si existe estudiante demo
  hasDemoStudent: async (classroomId: string): Promise<boolean> => {
    const response = await api.get(`/students/demo/${classroomId}/check`);
    return response.data.data.hasDemo;
  },

  // Obtener estadísticas detalladas del estudiante
  getStudentStats: async (studentId: string): Promise<StudentStats> => {
    const response = await api.get(`/students/stats/${studentId}`);
    return response.data.data;
  },

  // Retirar estudiante de la clase
  removeFromClass: async (studentId: string): Promise<{ success: boolean; studentName: string }> => {
    const response = await api.delete(`/students/${studentId}/remove-from-class`);
    return response.data.data;
  },

};
