import api from './api';

// ==================== TYPES ====================

export type ExpeditionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ExpeditionPinType = 'INTRO' | 'OBJECTIVE' | 'FINAL';
export type ExpeditionProgressStatus = 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'COMPLETED';

export interface Expedition {
  id: string;
  classroomId: string;
  name: string;
  description: string | null;
  mapImageUrl: string;
  status: ExpeditionStatus;
  autoProgress: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pins?: ExpeditionPin[];
  connections?: ExpeditionConnection[];
}

export interface ExpeditionPin {
  id: string;
  expeditionId: string;
  pinType: ExpeditionPinType;
  positionX: number;
  positionY: number;
  name: string;
  storyContent: string | null;
  storyFiles: string[] | null;
  taskName: string | null;
  taskContent: string | null;
  taskFiles: string[] | null;
  requiresSubmission: boolean;
  dueDate: string | null;
  rewardXp: number;
  rewardGp: number;
  earlySubmissionEnabled: boolean;
  earlySubmissionDate: string | null;
  earlyBonusXp: number;
  earlyBonusGp: number;
  autoProgress: boolean | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpeditionConnection {
  id: string;
  expeditionId: string;
  fromPinId: string;
  toPinId: string;
  onSuccess: boolean | null; // true = ✅, false = ❌, null = lineal
  createdAt: string;
}

export interface ExpeditionStudentProgress {
  id: string;
  expeditionId: string;
  studentProfileId: string;
  isCompleted: boolean;
  completedAt: string | null;
  currentPinId: string | null;
  startedAt: string;
  updatedAt: string;
  pinProgress?: ExpeditionPinProgress[];
  submissions?: ExpeditionSubmission[];
}

export interface ExpeditionPinProgress {
  id: string;
  expeditionId: string;
  pinId: string;
  studentProfileId: string;
  status: ExpeditionProgressStatus;
  teacherDecision: boolean | null;
  teacherDecisionAt: string | null;
  unlockedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    characterName: string | null;
    avatarUrl: string | null;
    user?: {
      displayName: string;
    };
  };
}

export interface ExpeditionSubmission {
  id: string;
  expeditionId: string;
  pinId: string;
  studentProfileId: string;
  files: string[];
  comment: string | null;
  isEarlySubmission: boolean;
  submittedAt: string;
  student?: {
    id: string;
    characterName: string | null;
    avatarUrl: string | null;
  };
}

// ==================== CREATE DTOs ====================

export interface CreateExpeditionDto {
  classroomId: string;
  name: string;
  description?: string;
  mapImageUrl: string;
}

export interface CreatePinDto {
  pinType: ExpeditionPinType;
  positionX: number;
  positionY: number;
  name: string;
  storyContent?: string;
  storyFiles?: string[];
  taskName?: string;
  taskContent?: string;
  taskFiles?: string[];
  requiresSubmission?: boolean;
  dueDate?: string;
  rewardXp?: number;
  rewardGp?: number;
  earlySubmissionEnabled?: boolean;
  earlySubmissionDate?: string;
  earlyBonusXp?: number;
  earlyBonusGp?: number;
  autoProgress?: boolean;
}

export interface UpdatePinDto extends Partial<CreatePinDto> {}

export interface CreateConnectionDto {
  fromPinId: string;
  toPinId: string;
  onSuccess?: boolean | null;
}

export interface CreateSubmissionDto {
  studentProfileId: string;
  files: string[];
  comment?: string;
}

export interface TeacherDecisionDto {
  studentProfileId: string;
  passed: boolean;
}

// ==================== MAPAS PREDEFINIDOS ====================

export const EXPEDITION_MAPS = [
  { id: 'map1', name: 'Isla Aventura', url: '/expedition-maps/island-adventure.jpg' },
];

// ==================== API FUNCTIONS ====================

export const expeditionApi = {
  // ==================== EXPEDITION CRUD ====================
  
  // Crear expedición
  create: async (data: CreateExpeditionDto): Promise<Expedition> => {
    const response = await api.post('/expeditions', data);
    return response.data;
  },
  
  // Obtener expedición por ID
  getById: async (id: string): Promise<Expedition> => {
    const response = await api.get(`/expeditions/${id}`);
    return response.data;
  },
  
  // Obtener expediciones de un classroom
  getByClassroom: async (classroomId: string, status?: ExpeditionStatus): Promise<Expedition[]> => {
    const params = status ? { status } : {};
    const response = await api.get(`/expeditions/classroom/${classroomId}`, { params });
    return response.data;
  },
  
  // Actualizar expedición
  update: async (id: string, data: Partial<CreateExpeditionDto & { autoProgress?: boolean }>): Promise<Expedition> => {
    const response = await api.put(`/expeditions/${id}`, data);
    return response.data;
  },
  
  // Publicar expedición
  publish: async (id: string): Promise<Expedition> => {
    const response = await api.post(`/expeditions/${id}/publish`);
    return response.data;
  },
  
  // Archivar expedición
  archive: async (id: string): Promise<Expedition> => {
    const response = await api.post(`/expeditions/${id}/archive`);
    return response.data;
  },
  
  // Eliminar expedición
  delete: async (id: string): Promise<void> => {
    await api.delete(`/expeditions/${id}`);
  },
  
  // ==================== PINS ====================
  
  // Crear pin
  createPin: async (expeditionId: string, data: CreatePinDto): Promise<ExpeditionPin> => {
    const response = await api.post(`/expeditions/${expeditionId}/pins`, data);
    return response.data;
  },
  
  // Obtener pin
  getPin: async (pinId: string): Promise<ExpeditionPin> => {
    const response = await api.get(`/expeditions/pins/${pinId}`);
    return response.data;
  },
  
  // Actualizar pin
  updatePin: async (pinId: string, data: UpdatePinDto): Promise<ExpeditionPin> => {
    const response = await api.put(`/expeditions/pins/${pinId}`, data);
    return response.data;
  },
  
  // Eliminar pin
  deletePin: async (pinId: string): Promise<void> => {
    await api.delete(`/expeditions/pins/${pinId}`);
  },
  
  // ==================== CONNECTIONS ====================
  
  // Crear conexión
  createConnection: async (expeditionId: string, data: CreateConnectionDto): Promise<ExpeditionConnection> => {
    const response = await api.post(`/expeditions/${expeditionId}/connections`, data);
    return response.data;
  },
  
  // Actualizar conexión
  updateConnection: async (connectionId: string, onSuccess: boolean | null): Promise<ExpeditionConnection> => {
    const response = await api.put(`/expeditions/connections/${connectionId}`, { onSuccess });
    return response.data;
  },
  
  // Eliminar conexión
  deleteConnection: async (connectionId: string): Promise<void> => {
    await api.delete(`/expeditions/connections/${connectionId}`);
  },
  
  // ==================== PROGRESS (TEACHER) ====================
  
  // Obtener progreso de todos los estudiantes en un pin
  getPinProgress: async (pinId: string): Promise<ExpeditionPinProgress[]> => {
    const response = await api.get(`/expeditions/pins/${pinId}/progress`);
    return response.data;
  },
  
  // Establecer decisión del profesor
  setTeacherDecision: async (pinId: string, data: TeacherDecisionDto): Promise<ExpeditionPinProgress> => {
    const response = await api.post(`/expeditions/pins/${pinId}/decision`, data);
    return response.data;
  },
  
  // Establecer decisiones en bulk
  setTeacherDecisionBulk: async (pinId: string, decisions: TeacherDecisionDto[]): Promise<ExpeditionPinProgress[]> => {
    const response = await api.post(`/expeditions/pins/${pinId}/decisions`, { decisions });
    return response.data;
  },
  
  // Obtener entregas de un pin
  getPinSubmissions: async (pinId: string): Promise<ExpeditionSubmission[]> => {
    const response = await api.get(`/expeditions/pins/${pinId}/submissions`);
    return response.data;
  },
  
  // ==================== STUDENT ROUTES ====================
  
  // Obtener expediciones del estudiante
  getStudentExpeditions: async (classroomId: string, studentProfileId: string): Promise<(Expedition & { studentProgress: ExpeditionStudentProgress })[]> => {
    const response = await api.get(`/expeditions/student/${classroomId}/${studentProfileId}`);
    return response.data;
  },
  
  // Obtener detalle de expedición para estudiante
  getStudentExpeditionDetail: async (expeditionId: string, studentProfileId: string): Promise<Expedition & { studentProgress: ExpeditionStudentProgress }> => {
    const response = await api.get(`/expeditions/student/${expeditionId}/detail/${studentProfileId}`);
    return response.data;
  },
  
  // Obtener progreso del estudiante
  getStudentProgress: async (expeditionId: string, studentProfileId: string): Promise<ExpeditionStudentProgress> => {
    const response = await api.get(`/expeditions/${expeditionId}/progress/${studentProfileId}`);
    return response.data;
  },
  
  // Crear entrega de tarea
  createSubmission: async (expeditionId: string, pinId: string, data: CreateSubmissionDto): Promise<ExpeditionSubmission> => {
    const response = await api.post(`/expeditions/${expeditionId}/pins/${pinId}/submit`, data);
    return response.data;
  },

  // Completar un pin (estudiante avanza al siguiente)
  completePin: async (pinId: string, studentProfileId: string): Promise<ExpeditionPinProgress> => {
    const response = await api.post(`/expeditions/pins/${pinId}/complete`, { studentProfileId });
    return response.data;
  },
};

// ==================== PIN TYPE CONFIG ====================

export const PIN_TYPE_CONFIG: Record<ExpeditionPinType, { label: string; icon: string; color: string }> = {
  INTRO: { label: 'Introducción', icon: '🏠', color: 'from-green-500 to-emerald-500' },
  OBJECTIVE: { label: 'Objetivo', icon: '📍', color: 'from-blue-500 to-indigo-500' },
  FINAL: { label: 'Final', icon: '🏁', color: 'from-amber-500 to-orange-500' },
};

export const PROGRESS_STATUS_CONFIG: Record<ExpeditionProgressStatus, { label: string; color: string; bgColor: string }> = {
  LOCKED: { label: 'Bloqueado', color: 'text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  UNLOCKED: { label: 'Desbloqueado', color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  IN_PROGRESS: { label: 'En progreso', color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  PASSED: { label: 'Aprobado', color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  FAILED: { label: 'No aprobado', color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  COMPLETED: { label: 'Completado', color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
};

export default expeditionApi;
