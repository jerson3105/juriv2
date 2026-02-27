import api from './api';

// Tipos
export interface ParentProfile {
  id: string;
  userId: string;
  phone: string | null;
  relationship: 'FATHER' | 'MOTHER' | 'TUTOR' | 'GUARDIAN';
  notifyByEmail: boolean;
  notifyWeeklySummary: boolean;
  notifyAlerts: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChildSummary {
  studentProfileId: string;
  studentName: string;
  classroomId: string;
  classroomName: string;
  teacherName: string;
  gradeLevel: string | null;
  averageGrade: string | null;
  averageScore: number | null;
  lastActivityDate: string | null;
  alertCount: number;
  linkStatus: string;
}

export interface ChildDetail {
  studentProfile: {
    id: string;
    displayName: string | null;
    characterName: string | null;
    level: number;
    createdAt: string;
  };
  classroom: {
    id: string;
    name: string;
    teacherName: string;
    gradeLevel: string | null;
  };
  currentBimester: string;
  grades: Array<{
    competencyId: string;
    competencyName: string;
    score: number;
    gradeLabel: string;
  }>;
  recentActivity: ActivityLogItem[];
  alerts: Array<{
    type: string;
    message: string;
    date: string;
  }>;
}

export interface ActivityLogItem {
  type: 'BEHAVIOR' | 'ACTIVITY' | 'BADGE';
  description: string;
  date: string;
  isPositive: boolean;
  details?: string;
}

export interface ChildGrades {
  studentName: string;
  classroomName: string;
  currentPeriod: string;
  competencies: Array<{
    id: string;
    name: string;
    grades: Record<string, { score: number; label: string; activities?: Array<{ type: string; name: string; score: number; weight: number }>; activitiesCount?: number }>;
  }>;
}

export interface RegisterParentData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  relationship: 'FATHER' | 'MOTHER' | 'TUTOR' | 'GUARDIAN';
}

export interface UpdatePreferencesData {
  phone?: string;
  relationship?: 'FATHER' | 'MOTHER' | 'TUTOR' | 'GUARDIAN';
  notifyByEmail?: boolean;
  notifyWeeklySummary?: boolean;
  notifyAlerts?: boolean;
}

export interface AIStudentReport {
  studentName: string;
  classroomName: string;
  generatedAt: string;
  expiresAt: string;
  cached: boolean;
  summary: string;
  behaviorAnalysis: string;
  strengths: string[];
  areasToImprove: string[];
  recommendations: string[];
  predictions: string;
  parentTips: string[];
  weeklyHighlights: string[];
  stats: {
    positiveActions: number;
    negativeActions: number;
    totalXP: number;
    badges: number;
    attendanceRate: number;
    averageGrade: string | null;
    loginStreak: number;
  };
}

export interface ChildReport {
  studentName: string;
  classroomName: string;
  teacherName: string;
  gradeLevel: string | null;
  currentBimester: string;
  generatedAt: string;

  profile: {
    level: number;
    xp: number;
    hp: number;
    maxHp: number;
    gp: number;
    characterClass: string;
  };

  behaviors: {
    totalPositive: number;
    totalNegative: number;
    recentPositive: number;
    recentNegative: number;
    topPositive: Array<{ name: string; description: string | null; icon: string | null; count: number; totalXp: number }>;
    topNegative: Array<{ name: string; description: string | null; icon: string | null; count: number }>;
    weeklyPattern: Array<{ day: string; count: number }>;
    xpByWeek: Array<{ weekLabel: string; xp: number }>;
  };

  badges: {
    total: number;
    list: Array<{
      name: string;
      description: string;
      icon: string;
      rarity: string;
      category: string;
      unlockedAt: string;
      reason: string | null;
    }>;
  };

  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number | null;
    recent: Array<{ date: string; status: string }>;
  };

  grades: {
    list: Array<{ competencyName: string; score: number; gradeLabel: string }>;
    average: number | null;
    averageLabel: string | null;
  };

  shop: {
    totalSpent: number;
    purchaseCount: number;
    currentGp: number;
    recentPurchases: Array<{ itemName: string; category: string | null; price: number; date: string }>;
  };

  loginStreak: {
    current: number;
    longest: number;
    totalLogins: number;
    lastLogin: string | null;
  } | null;

  timedActivities: {
    total: number;
    totalPoints: number;
    exploded: number;
    recent: Array<{ name: string; points: number; seconds: number | null; date: string }>;
  };

  clan: {
    name: string;
    totalXp: number;
    wins: number;
    losses: number;
  } | null;
}

// API Functions
export const parentApi = {
  // Registrar nuevo padre
  register: async (data: RegisterParentData) => {
    const response = await api.post('/parent/register', data);
    return response.data;
  },

  // Obtener perfil del padre
  getProfile: async (): Promise<ParentProfile> => {
    const response = await api.get('/parent/profile');
    return response.data;
  },

  // Vincular hijo con código
  linkChild: async (linkCode: string) => {
    const response = await api.post('/parent/link', { linkCode });
    return response.data;
  },

  // Obtener lista de hijos
  getChildren: async (): Promise<ChildSummary[]> => {
    const response = await api.get('/parent/children');
    return response.data;
  },

  // Obtener detalle de un hijo
  getChildDetail: async (studentId: string): Promise<ChildDetail> => {
    const response = await api.get(`/parent/child/${studentId}`);
    return response.data;
  },

  // Obtener calificaciones de un hijo
  getChildGrades: async (studentId: string, period?: string): Promise<ChildGrades> => {
    const params = period ? { period } : {};
    const response = await api.get(`/parent/child/${studentId}/grades`, { params });
    return response.data;
  },

  // Obtener historial de actividad de un hijo
  getChildActivity: async (
    studentId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ActivityLogItem[]> => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await api.get(`/parent/child/${studentId}/activity`, { params });
    return response.data;
  },

  // Desvincular hijo
  unlinkChild: async (studentId: string) => {
    const response = await api.delete(`/parent/child/${studentId}`);
    return response.data;
  },

  // Actualizar preferencias
  updatePreferences: async (data: UpdatePreferencesData) => {
    const response = await api.put('/parent/preferences', data);
    return response.data;
  },

  // Generar código de vinculación (para profesor)
  generateParentLinkCode: async (studentId: string): Promise<{ code: string }> => {
    const response = await api.post(`/parent/generate-code/${studentId}`);
    return response.data;
  },

  // Generar códigos de vinculación masivos para folletos de padres (para profesor)
  generateBulkParentLinkCodes: async (classroomId: string): Promise<{
    students: { id: string; name: string; parentLinkCode: string }[];
    classroomName: string;
    classroomCode: string;
  }> => {
    const response = await api.post(`/parent/generate-codes-bulk/${classroomId}`);
    return response.data.data;
  },

  // Obtener reporte completo de un hijo
  getChildReport: async (studentId: string): Promise<ChildReport> => {
    const response = await api.get(`/parent/child/${studentId}/report`);
    return response.data;
  },

  // Obtener informe IA del estudiante (con cache 24h)
  getAIReport: async (studentId: string): Promise<AIStudentReport> => {
    const response = await api.get(`/parent/child/${studentId}/ai-report`);
    return response.data.data;
  },

  // Regenerar informe IA (forzar nueva generación)
  regenerateAIReport: async (studentId: string): Promise<AIStudentReport> => {
    const response = await api.post(`/parent/child/${studentId}/ai-report/regenerate`);
    return response.data.data;
  },
};

export default parentApi;
