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
    grades: Record<string, { score: number; label: string }>;
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
  usesCompetencies: boolean;
  summary: string;
  strengths: string[];
  areasToImprove: string[];
  recommendations: string[];
  predictions: string;
  parentTips: string[];
  stats: {
    positiveActions: number;
    negativeActions: number;
    totalXP: number;
    totalActivities: number;
    badges: number;
  };
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

  // Obtener informe IA del estudiante
  getAIReport: async (studentId: string): Promise<AIStudentReport> => {
    const response = await api.get(`/parent/child/${studentId}/ai-report`);
    return response.data;
  },
};

export default parentApi;
