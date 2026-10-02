import api from './api';
import type { BadgeRarity } from './badgeApi';

export type CharacterClass = 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
export type PointType = 'XP' | 'HP' | 'GP';
export type AvatarGender = 'MALE' | 'FEMALE';

export interface StudentProfile {
  id: string;
  userId: string | null;
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
  isDemo?: boolean;
  displayName?: string | null;
  linkCode?: string | null;
  classroomRank?: number | null;
  classroomStudentCount?: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
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
  competencyIndicatorId?: string;
}

export interface UpdatePointsResult {
  student: StudentProfile;
  leveledUp: boolean;
  newLevel?: number;
  fromLevel?: number;
  studentName: string;
  /** Sumar HP a quien descansa no hace nada (solo su misión de recuperación). */
  restingIgnored?: boolean;
}

export interface StudentCelebrations {
  fromLevel: number | null;
  toLevel: number | null;
  badges: { id: string; name: string; description: string | null; icon: string; customImage: string | null; rarity: BadgeRarity; unlockedAt: string }[];
  until: string;
}

/** Una línea de "Lo nuevo": puntos agrupados por motivo (reason null si la clase no muestra motivos). */
export interface StudentNewsLine {
  pointType: 'XP' | 'HP' | 'GP';
  amount: number;
  count: number;
  reason: string | null;
}

export interface StudentNews {
  /** Corte anterior; null = primera visita ("Lo que ya ganaste en esta clase"). */
  since: string | null;
  /** Instante de esta foto: se envía al marcarla como vista. */
  until: string;
  everEarned: boolean;
  totals: { xp: number; gp: number };
  gains: StudentNewsLine[];
  losses: StudentNewsLine[];
  badges: { id: string; name: string; icon: string; customImage: string | null; rewardXp: number; rewardGp: number }[];
  level: { from: number; to: number } | null;
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

// «Mi progreso» del alumno (GET /students/profiles/:id/progress). Sin reversiones; nombres solo si la clase muestra motivos.
export type ProgressPeriod = 'bimester' | 'all';
export type ProgressHistoryType = 'ALL' | 'XP' | 'GP' | 'HP';

export interface StudentProgress {
  /** canSplit: la clase tiene un corte real de bimestre (si no, solo hay «todo»). */
  period: { kind: ProgressPeriod; canSplit: boolean; bimester: number | null; from: string | null };
  /** Tiene algún registro válido en la clase (en cualquier periodo). */
  hasAny: boolean;
  totals: { xpGained: number; gpGained: number; gpSpent: number; hpLost: number; hpRecovered: number };
  behaviors: {
    namesVisible: boolean;
    positiveTimes: number;
    negativeTimes: number;
    strengths: { name: string; times: number }[];
    toImprove: { name: string; times: number }[];
  };
  /** XP ganado por semana (lunes) o por mes, en la hora del alumno; start = AAAA-MM-DD. */
  series: { bucket: 'week' | 'month'; points: { start: string; xp: number }[]; truncated: boolean };
  badges: { count: number; latest: { name: string; at: string } | null };
}

export interface ProgressHistoryItem {
  id: string;
  at: string;
  kind: 'behavior' | 'badge' | 'shop' | 'other';
  /** Solo en comportamientos. */
  positive: boolean | null;
  /** null si la clase no muestra motivos (las insignias y compras propias siempre traen texto). */
  label: string | null;
  xp: number;
  gp: number;
  hp: number;
}

export interface ProgressHistoryPage {
  items: ProgressHistoryItem[];
  nextCursor: string | null;
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

export type SummaryPeriod = 'bimester' | 'all';

// Resumen del alumno para el perfil del profesor (agregado en el servidor por periodo).
export interface StudentSummary {
  period: { kind: SummaryPeriod; label: string; from: string | null };
  points: { xpGained: number; xpLost: number; hpGained: number; hpLost: number; gpGained: number; gpLost: number };
  events: { positive: number; negative: number };
  topBehaviors: { name: string; positive: boolean; times: number }[];
  timeline: { bucket: 'day' | 'week'; points: { date: string; xp: number; hp: number; gp: number }[] };
  attendance: { present: number; late: number; absent: number; excused: number; total: number; consecutiveAbsences: number };
  badges: number;
  purchases: { count: number; spent: number };
  rank: { position: number; total: number };
  clan: { id: string; name: string; emblem: string; contributedXp: number } | null;
  collectibles: { owned: number; total: number };
  lastActivityAt: string | null;
  maxHp: number;
}

export const studentApi = {
  // Verificar código (detecta si es clase o estudiante)
  // Celebraciones pendientes del alumno (desde su última visita) y marcarlas como vistas
  getCelebrations: async (profileId: string): Promise<StudentCelebrations> => {
    const response = await api.get(`/students/profiles/${profileId}/celebrations`);
    return response.data.data;
  },

  markCelebrationsSeen: async (profileId: string, until: string): Promise<void> => {
    await api.post(`/students/profiles/${profileId}/celebrations/seen`, { until });
  },

  // "Lo nuevo" del inicio: lo ganado en esta clase desde la última visita, y marcarlo como visto
  getNews: async (profileId: string): Promise<StudentNews> => {
    const response = await api.get(`/students/profiles/${profileId}/news`);
    return response.data.data;
  },

  markNewsSeen: async (profileId: string, until: string): Promise<void> => {
    await api.post(`/students/profiles/${profileId}/news/seen`, { until });
  },

  verifyCode: async (code: string): Promise<{
    type: 'classroom' | 'student';
    classroomName?: string;
    classroomCode?: string;
    isActive?: boolean;
    acceptingStudents?: boolean;
    studentName?: string | null;
    alreadyLinked?: boolean;
    /** false = el docente aún no verificó su cuenta: no se puede unir con cuenta todavía. */
    teacherVerified?: boolean;
  }> => {
    const response = await api.post('/students/verify-code', { code });
    return response.data.data;
  },

  // Unirse a una clase
  joinClass: async (data: JoinClassData): Promise<{ profileId: string; classroom: { id: string; name: string; code: string } }> => {
    const response = await api.post('/students/join', data);
    return response.data.data;
  },

  /** Clase con lista: el alumno con cuenta toca su nombre y su cuenta queda vinculada a ese perfil. */
  joinRoster: async (data: { code: string; studentId: string; characterName?: string; avatarGender?: AvatarGender }): Promise<{ profileId: string; classroom: { id: string; name: string } }> => {
    const response = await api.post('/students/join-roster', data);
    return response.data.data;
  },

  // Obtener mis clases como estudiante
  // shopSummary: premios a la venta en la clase y premios propios o pedidos (el menú «Tienda» se ve si hay alguno).
  getMyClasses: async (): Promise<(StudentProfile & { shopGoalItemId?: string | null; shopSummary?: { items: number; owned: number }; classroom: { id: string; name: string; code: string; shopEnabled?: boolean; clansEnabled?: boolean; scrollsEnabled?: boolean; scrollsOpen?: boolean; scrollsRequireApproval?: boolean; useCompetencies?: boolean; hasActiveStory?: boolean; themeConfig?: { colors?: { primary?: string; secondary?: string; accent?: string; background?: string; sidebar?: string }; particles?: { type?: string; color?: string; speed?: string; density?: string }; decorations?: Array<{ type: string; position: string; asset: string }>; banner?: { emoji?: string; title?: string } } | null } })[]> => {
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

  // Para profesores: actualizar datos del perfil del aula
  updateStudent: async (studentId: string, data: { displayName?: string; characterName?: string }): Promise<StudentProfile> => {
    const response = await api.patch(`/students/${studentId}`, data);
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

  // «Mi progreso»: tz para agrupar por semana o mes en la hora del alumno.
  getMyProgress: async (profileId: string, period: ProgressPeriod): Promise<StudentProgress> => {
    const response = await api.get(`/students/profiles/${profileId}/progress`, {
      params: { period, tz: new Date().getTimezoneOffset() },
    });
    return response.data.data;
  },

  getMyProgressHistory: async (
    profileId: string,
    { period, type, cursor }: { period: ProgressPeriod; type: ProgressHistoryType; cursor: string | null },
  ): Promise<ProgressHistoryPage> => {
    const response = await api.get(`/students/profiles/${profileId}/progress/history`, {
      params: { period, type, ...(cursor ? { cursor } : {}) },
    });
    return response.data.data;
  },

  // Retirar estudiante de la clase
  removeFromClass: async (studentId: string): Promise<{ success: boolean; studentName: string }> => {
    const response = await api.delete(`/students/${studentId}/remove-from-class`);
    return response.data.data;
  },

  // tz: desfase del navegador para agrupar la actividad por día local.
  getSummary: async (classroomId: string, studentId: string, period: SummaryPeriod): Promise<StudentSummary> => {
    const response = await api.get(`/classrooms/${classroomId}/students/${studentId}/summary`, {
      params: { period, tz: new Date().getTimezoneOffset() },
    });
    return response.data.data;
  },

};
