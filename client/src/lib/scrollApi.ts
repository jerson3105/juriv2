import api from './api';

// Types
export type ScrollCategory = 'CONGRATULATION' | 'THANKS' | 'MOTIVATION' | 'TEAMWORK' | 'FRIENDSHIP' | 'ACHIEVEMENT' | 'CUSTOM';
export type ScrollStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ScrollRecipientType = 'STUDENT' | 'MULTIPLE' | 'CLAN' | 'CLASS' | 'TEACHER';

export interface ScrollAuthor {
  id: string;
  characterName: string | null;
  avatarUrl: string | null;
  displayName: string | null;
}

export interface ScrollRecipient {
  id: string;
  characterName: string | null;
  displayName: string | null;
}

export interface ScrollClan {
  id: string;
  name: string;
}

export interface ScrollReaction {
  type: string;
  count: number;
  hasReacted: boolean;
}

export interface Scroll {
  id: string;
  classroomId: string;
  authorId: string;
  message: string;
  imageUrl: string | null;
  category: ScrollCategory;
  recipientType: ScrollRecipientType;
  recipientIds: string[] | null;
  status: ScrollStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  author: ScrollAuthor;
  recipients?: ScrollRecipient[];
  clan?: ScrollClan;
  reactions: ScrollReaction[];
  totalReactions: number;
}

export interface CreateScrollDto {
  authorId: string;
  message: string;
  imageUrl?: string;
  category: ScrollCategory;
  recipientType: ScrollRecipientType;
  recipientIds?: string[];
}

export interface ScrollStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byCategory: Record<string, number>;
}

export interface ScrollFilters {
  category?: ScrollCategory;
  startDate?: string;
  endDate?: string;
  studentProfileId?: string;
}

// Configuración de categorías
export const SCROLL_CATEGORIES: Record<ScrollCategory, { label: string; emoji: string; color: string; borderColor: string }> = {
  CONGRATULATION: { 
    label: 'Felicitación', 
    emoji: '🎉', 
    color: 'from-yellow-400 to-orange-500',
    borderColor: 'border-yellow-400'
  },
  THANKS: { 
    label: 'Agradecimiento', 
    emoji: '🙏', 
    color: 'from-pink-400 to-rose-500',
    borderColor: 'border-pink-400'
  },
  MOTIVATION: { 
    label: 'Motivación', 
    emoji: '💪', 
    color: 'from-blue-400 to-indigo-500',
    borderColor: 'border-blue-400'
  },
  TEAMWORK: { 
    label: 'Trabajo en equipo', 
    emoji: '🤝', 
    color: 'from-green-400 to-emerald-500',
    borderColor: 'border-green-400'
  },
  FRIENDSHIP: { 
    label: 'Amistad', 
    emoji: '💜', 
    color: 'from-purple-400 to-violet-500',
    borderColor: 'border-purple-400'
  },
  ACHIEVEMENT: { 
    label: 'Logro', 
    emoji: '🏆', 
    color: 'from-amber-400 to-yellow-500',
    borderColor: 'border-amber-400'
  },
  CUSTOM: { 
    label: 'Personalizado', 
    emoji: '✨', 
    color: 'from-gray-400 to-slate-500',
    borderColor: 'border-gray-400'
  },
};

// Tipos de reacciones disponibles
export const REACTION_TYPES = [
  { type: 'heart', emoji: '❤️', label: 'Me encanta' },
  { type: 'star', emoji: '⭐', label: 'Increíble' },
  { type: 'fire', emoji: '🔥', label: 'Genial' },
  { type: 'clap', emoji: '👏', label: 'Aplausos' },
  { type: 'smile', emoji: '😊', label: 'Me alegra' },
];

// API Functions
export const scrollApi = {
  // Obtener pergaminos aprobados del mural
  getApproved: async (classroomId: string, filters?: ScrollFilters): Promise<Scroll[]> => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.studentProfileId) params.append('studentProfileId', filters.studentProfileId);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/scrolls/classroom/${classroomId}${query}`);
    return response.data;
  },

  // Crear un nuevo pergamino
  create: async (classroomId: string, data: CreateScrollDto): Promise<Scroll> => {
    const response = await api.post(`/scrolls/classroom/${classroomId}`, data);
    return response.data;
  },

  // Obtener pergaminos pendientes (profesor)
  getPending: async (classroomId: string): Promise<Scroll[]> => {
    const response = await api.get(`/scrolls/classroom/${classroomId}/pending`);
    return response.data;
  },

  // Aprobar pergamino (profesor)
  approve: async (scrollId: string): Promise<Scroll> => {
    const response = await api.post(`/scrolls/${scrollId}/approve`);
    return response.data;
  },

  // Rechazar pergamino (profesor)
  reject: async (scrollId: string, reason: string): Promise<Scroll> => {
    const response = await api.post(`/scrolls/${scrollId}/reject`, { reason });
    return response.data;
  },

  // Toggle reacción
  toggleReaction: async (scrollId: string, studentProfileId: string, reactionType: string): Promise<void> => {
    await api.post(`/scrolls/${scrollId}/reaction`, { studentProfileId, reactionType });
  },

  // Eliminar pergamino
  delete: async (scrollId: string): Promise<void> => {
    await api.delete(`/scrolls/${scrollId}`);
  },

  // Obtener pergaminos del estudiante
  getByStudent: async (studentProfileId: string): Promise<Scroll[]> => {
    const response = await api.get(`/scrolls/student/${studentProfileId}`);
    return response.data;
  },

  // Obtener estadísticas (profesor)
  getStats: async (classroomId: string): Promise<ScrollStats> => {
    const response = await api.get(`/scrolls/classroom/${classroomId}/stats`);
    return response.data;
  },

  // Abrir/cerrar mural (profesor)
  toggleOpen: async (classroomId: string, isOpen: boolean): Promise<void> => {
    await api.post(`/scrolls/classroom/${classroomId}/toggle`, { isOpen });
  },

  // Actualizar configuración (profesor)
  updateConfig: async (classroomId: string, config: {
    enabled?: boolean;
    maxPerDay?: number;
    requireApproval?: boolean;
  }): Promise<void> => {
    await api.put(`/scrolls/classroom/${classroomId}/config`, config);
  },
};
