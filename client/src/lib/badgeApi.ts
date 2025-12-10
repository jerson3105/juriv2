import api from './api';

// Tipos
export interface BadgeCondition {
  type: string;
  value?: number;
  count?: number;
  behaviorId?: string;
  category?: 'positive' | 'negative';
  period?: string;
  conditions?: BadgeCondition[];
  operator?: 'AND' | 'OR';
}

export type BadgeScope = 'SYSTEM' | 'CLASSROOM';
export type BadgeCategory = 'PROGRESS' | 'PARTICIPATION' | 'SOCIAL' | 'SHOP' | 'SPECIAL' | 'SECRET' | 'CUSTOM';
export type BadgeRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type BadgeAssignment = 'AUTOMATIC' | 'MANUAL' | 'BOTH';

export interface Badge {
  id: string;
  scope: BadgeScope;
  classroomId: string | null;
  createdBy: string | null;
  name: string;
  description: string;
  icon: string;
  customImage: string | null;
  category: BadgeCategory;
  rarity: BadgeRarity;
  assignmentMode: BadgeAssignment;
  unlockCondition: BadgeCondition | null;
  rewardXp: number;
  rewardGp: number;
  maxAwards: number | null;
  isSecret: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentBadge {
  id: string;
  studentProfileId: string;
  badgeId: string;
  unlockedAt: string;
  awardedBy: string | null;
  awardReason: string | null;
  isDisplayed: boolean;
  badge: Badge;
}

export interface BadgeProgress {
  badge: Badge;
  currentValue: number;
  targetValue: number;
  percentage: number;
}

export interface CreateBadgeDto {
  name: string;
  description: string;
  icon: string;
  customImage?: string | null;
  category?: BadgeCategory;
  rarity?: BadgeRarity;
  assignmentMode: BadgeAssignment;
  unlockCondition?: BadgeCondition | null;
  rewardXp?: number;
  rewardGp?: number;
  isSecret?: boolean;
}

// Colores por rareza
export const RARITY_COLORS = {
  COMMON: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    border: 'border-gray-300 dark:border-gray-600',
    text: 'text-gray-600 dark:text-gray-300',
    gradient: 'from-gray-400 to-gray-500',
  },
  RARE: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-400 to-blue-600',
  },
  EPIC: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    border: 'border-purple-300 dark:border-purple-700',
    text: 'text-purple-600 dark:text-purple-400',
    gradient: 'from-purple-400 to-purple-600',
  },
  LEGENDARY: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-600 dark:text-amber-400',
    gradient: 'from-amber-400 to-yellow-500',
  },
};

export const RARITY_LABELS = {
  COMMON: 'Común',
  RARE: 'Raro',
  EPIC: 'Épico',
  LEGENDARY: 'Legendario',
};

export const CATEGORY_LABELS = {
  PROGRESS: 'Progreso',
  PARTICIPATION: 'Participación',
  SOCIAL: 'Social',
  SHOP: 'Tienda',
  SPECIAL: 'Especial',
  SECRET: 'Secreto',
  CUSTOM: 'Personalizado',
};

// API
export const badgeApi = {
  // Obtener insignias de una clase
  getClassroomBadges: async (classroomId: string): Promise<Badge[]> => {
    const response = await api.get(`/badges/classroom/${classroomId}`);
    return response.data;
  },

  // Crear insignia personalizada
  createBadge: async (classroomId: string, data: CreateBadgeDto): Promise<Badge> => {
    const response = await api.post(`/badges/classroom/${classroomId}`, data);
    return response.data;
  },

  // Actualizar insignia
  updateBadge: async (badgeId: string, data: Partial<CreateBadgeDto>): Promise<void> => {
    await api.put(`/badges/${badgeId}`, data);
  },

  // Eliminar insignia
  deleteBadge: async (badgeId: string): Promise<void> => {
    await api.delete(`/badges/${badgeId}`);
  },

  // Obtener insignias de un estudiante
  getStudentBadges: async (studentProfileId: string): Promise<StudentBadge[]> => {
    const response = await api.get(`/badges/student/${studentProfileId}`);
    return response.data;
  },

  // Obtener insignias mostradas en perfil
  getDisplayedBadges: async (studentProfileId: string): Promise<StudentBadge[]> => {
    const response = await api.get(`/badges/student/${studentProfileId}/displayed`);
    return response.data;
  },

  // Actualizar insignias mostradas
  setDisplayedBadges: async (studentProfileId: string, badgeIds: string[]): Promise<void> => {
    await api.put(`/badges/student/${studentProfileId}/displayed`, { badgeIds });
  },

  // Obtener progreso hacia insignias
  getStudentProgress: async (studentProfileId: string, classroomId: string): Promise<BadgeProgress[]> => {
    const response = await api.get(`/badges/student/${studentProfileId}/progress/${classroomId}`);
    return response.data;
  },

  // Otorgar insignia manualmente
  awardBadge: async (studentProfileId: string, badgeId: string, reason?: string): Promise<StudentBadge> => {
    const response = await api.post('/badges/award', { studentProfileId, badgeId, reason });
    return response.data;
  },

  // Revocar insignia
  revokeBadge: async (studentProfileId: string, badgeId: string): Promise<void> => {
    await api.delete(`/badges/revoke/${studentProfileId}/${badgeId}`);
  },

  // Subir imagen de insignia
  uploadBadgeImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/badges/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.imageUrl;
  },

  // Obtener estadísticas de insignias de una clase
  getClassroomStats: async (classroomId: string): Promise<{
    totalBadges: number;
    totalAwarded: number;
    studentsWithBadges: number;
    totalStudents: number;
    mostAwardedBadge: { name: string; icon: string; count: number } | null;
    recentAwards: { studentName: string; badgeName: string; badgeIcon: string; awardedAt: string }[];
    badgeDistribution: { name: string; icon: string; count: number }[];
  }> => {
    const response = await api.get(`/badges/classroom/${classroomId}/stats`);
    return response.data;
  },
};
