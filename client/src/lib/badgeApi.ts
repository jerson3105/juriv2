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
  schoolBadgeId: string | null;
  competencyId?: string | null;
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

/** Progreso hacia una automática (ficha del alumno del profe). */
export interface BadgeProgress {
  badge: Pick<Badge, 'id' | 'name' | 'icon' | 'customImage' | 'rarity'>;
  currentValue: number;
  targetValue: number;
  percentage: number;
}

// ---------- «Mis insignias» del alumno (GET /badges/student/:id/view) ----------

export type BadgeAwardOrigin = 'TEACHER' | 'AUTO' | 'STORY' | 'ALBUM';

interface StudentBadgeBase {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  customImage: string | null;
  rarity: BadgeRarity;
  /** Competencia que reconoce (su nombre). */
  competency: string | null;
  /** Las manuales de la clase se pueden ganar más de una vez. */
  cumulative: boolean;
}

export interface BadgeProgressInfo {
  current: number;
  target: number;
  unit: 'times' | 'xp' | 'level' | 'purchases';
  /** Las de comportamientos cuentan desde que se creó la insignia. */
  since: string | null;
  level?: number;
}

export interface EarnedBadge extends StudentBadgeBase {
  isSecret: boolean;
  /** Ya no se entrega (archivada), pero lo ganado se queda. */
  archived: boolean;
  /** Cómo se gana sola («al recibir «Participación» 5 veces»), si tiene condición. */
  condition: string | null;
  count: number;
  lastAt: string;
  /** Cada vez que la ganó, la más reciente primero. */
  awards: { at: string; origin: BadgeAwardOrigin; reason: string | null; xp: number; gp: number }[];
}

export interface BadgeToEarn extends StudentBadgeBase {
  /** AUTO = se gana sola; TEACHER = te la da tu profe; BOTH = sola o tu profe. */
  kind: 'AUTO' | 'TEACHER' | 'BOTH';
  condition: string | null;
  progress: BadgeProgressInfo | null;
  /** Hacia abajo y nunca 100 sin ganarla. */
  percent: number | null;
  reward: { xp: number; gp: number };
}

export interface StudentBadgeView {
  classroomName: string;
  gradeLevel: string | null;
  xpPerLevel: number;
  earned: EarnedBadge[];
  toEarn: BadgeToEarn[];
  /** Secretas que aún puede descubrir (solo cuántas). */
  secrets: number;
  near: { id: string; name: string; percent: number; progress: BadgeProgressInfo } | null;
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
  competencyId?: string | null;
}

export interface GeneratedBadge {
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  assignmentMode: BadgeAssignment;
  unlockCondition: BadgeCondition | null;
  rewardXp: number;
  rewardGp: number;
  isSecret: boolean;
  competencyId?: string;
}

export interface ClassroomAwardsBreakdown {
  summary: {
    totalAwards: number;
    totalStudentsInClassroom: number;
    totalStudentsWithAwards: number;
    totalBadgesAwarded: number;
    mostAwardedBadge: { id: string; name: string; icon: string | null; count: number } | null;
  };
  recentAwards: Array<{
    studentProfileId: string;
    studentName: string;
    badgeId: string;
    badgeName: string;
    badgeIcon: string | null;
    awardedAt: string;
    awardReason: string | null;
  }>;
  byBadge: Array<{
    badgeId: string;
    badgeName: string;
    badgeIcon: string | null;
    rarity: BadgeRarity;
    assignmentMode: BadgeAssignment;
    totalAwards: number;
    uniqueStudents: number;
    lastAwardedAt: string;
    winners: Array<{
      studentProfileId: string;
      studentName: string;
      characterName: string | null;
      realName: string | null;
      realLastName: string | null;
      level: number;
      avatarGender: string;
      awardCount: number;
      lastAwardedAt: string;
      lastAwardReason: string | null;
    }>;
  }>;
  byStudent: Array<{
    studentProfileId: string;
    studentName: string;
    characterName: string | null;
    realName: string | null;
    realLastName: string | null;
    level: number;
    avatarGender: string;
    totalAwards: number;
    uniqueBadges: number;
    lastAwardedAt: string;
    badges: Array<{
      badgeId: string;
      badgeName: string;
      badgeIcon: string | null;
      rarity: BadgeRarity;
      assignmentMode: BadgeAssignment;
      awardCount: number;
      lastAwardedAt: string;
    }>;
  }>;
}

// URL de una imagen propia de insignia (se sirve junto a la API, p. ej. /api/badges/x.png).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const badgeImageUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${API_URL}${path}`);

export interface BadgeAwardCount {
  studentProfileId: string;
  badgeId: string;
  count: number;
  lastStudentBadgeId: string;
  lastAwardedAt: string;
}

export interface BulkAwardResult {
  awarded: { studentProfileId: string; studentBadgeId: string }[];
  failed: { studentProfileId: string; message: string }[];
}

export const RARITY_LABELS = {
  COMMON: 'Común',
  RARE: 'Rara',
  EPIC: 'Épica',
  LEGENDARY: 'Legendaria',
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

  // Archivar insignia (los alumnos conservan las que ganaron)
  deleteBadge: async (badgeId: string): Promise<void> => {
    await api.delete(`/badges/${badgeId}`);
  },

  // Restaurar insignia archivada
  restoreBadge: async (badgeId: string): Promise<void> => {
    await api.post(`/badges/${badgeId}/restore`);
  },

  // Veces que cada alumno tiene cada insignia
  getAwardCounts: async (classroomId: string): Promise<BadgeAwardCount[]> => {
    const response = await api.get(`/badges/classroom/${classroomId}/award-counts`);
    return response.data;
  },

  // Otorgar a varios alumnos a la vez (devuelve lo otorgado y lo que falló)
  awardBulk: async (badgeId: string, studentProfileIds: string[], reason?: string): Promise<BulkAwardResult> => {
    try {
      const response = await api.post('/badges/award-bulk', { badgeId, studentProfileIds, reason: reason || undefined });
      return response.data;
    } catch (error) {
      // 400 con cuerpo de resultado: nadie la recibió, pero se sabe por qué.
      const data = (error as { response?: { data?: BulkAwardResult } }).response?.data;
      if (data && Array.isArray(data.failed)) return data;
      throw error;
    }
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

  // Progreso hacia las automáticas (ficha del alumno del profe)
  getStudentProgress: async (studentProfileId: string, classroomId: string): Promise<BadgeProgress[]> => {
    const response = await api.get(`/badges/student/${studentProfileId}/progress/${classroomId}`);
    return response.data;
  },

  // «Mis insignias» del alumno: lo ganado, lo que puede ganar y cómo, y cuántas secretas hay
  getStudentView: async (studentProfileId: string): Promise<StudentBadgeView> => {
    const response = await api.get(`/badges/student/${studentProfileId}/view`);
    return response.data.data;
  },

  // Motivos que el profe ya usó con esta insignia (motivos rápidos al otorgarla)
  getRecentReasons: async (badgeId: string): Promise<string[]> => {
    const response = await api.get(`/badges/${badgeId}/recent-reasons`);
    return response.data.data;
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

  // Obtener desglose de otorgamientos (ganadores)
  getClassroomAwardsBreakdown: async (
    classroomId: string,
    params?: {
      search?: string;
      rarity?: BadgeRarity;
      assignmentMode?: BadgeAssignment;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ClassroomAwardsBreakdown> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.rarity) searchParams.set('rarity', params.rarity);
    if (params?.assignmentMode) searchParams.set('assignmentMode', params.assignmentMode);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);

    const query = searchParams.toString();
    const endpoint = query
      ? `/badges/classroom/${classroomId}/awards-breakdown?${query}`
      : `/badges/classroom/${classroomId}/awards-breakdown`;

    const response = await api.get(endpoint);
    return response.data;
  },

  // Generar insignias con IA
  generateWithAI: async (data: {
    description: string;
    level: string;
    count?: number;
    assignmentMode?: 'MANUAL' | 'AUTOMATIC' | 'BOTH';
    rarities?: ('COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY')[];
    includeSecret?: boolean;
    classroomId?: string;
    competencies?: { id: string; name: string }[];
  }): Promise<{ badges: GeneratedBadge[]; prompt: string }> => {
    const response = await api.post('/badges/generate-ai', data);
    return response.data.data;
  },
};
