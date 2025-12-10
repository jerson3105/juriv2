import api from './api';

export interface Clan {
  id: string;
  name: string;
  color: string;
  emblem: string;
  motto: string | null;
  totalXp: number;
  totalGp: number;
  wins: number;
  losses: number;
  maxMembers: number;
  isActive: boolean;
  createdAt: string;
}

export interface ClanMember {
  id: string;
  characterName: string | null;
  level: number;
  xp: number;
  avatarGender: 'MALE' | 'FEMALE';
  characterClass: 'GUARDIAN' | 'ARCANE' | 'EXPLORER' | 'ALCHEMIST';
  firstName: string;
  lastName: string;
}

export interface ClanWithMembers extends Clan {
  members: ClanMember[];
  memberCount: number;
}

export interface ClanRanking {
  id: string;
  name: string;
  color: string;
  emblem: string;
  totalXp: number;
  wins: number;
  losses: number;
  rank: number;
}

export interface ClanLog {
  id: string;
  action: string;
  xpAmount: number;
  gpAmount: number;
  reason: string | null;
  createdAt: string;
  studentId: string | null;
  studentName: string | null;
}

export interface StudentClanInfo {
  clan: {
    id: string;
    name: string;
    color: string;
    emblem: string;
    motto: string | null;
    totalXp: number;
    wins: number;
    losses: number;
    rank: number;
  };
  members: Array<{
    id: string;
    characterName: string | null;
    level: number;
    xp: number;
    characterClass: string;
  }>;
  myContribution: number;
}

export interface CreateClanData {
  name: string;
  color?: string;
  emblem?: string;
  motto?: string;
  maxMembers?: number;
}

export interface UpdateClanData {
  name?: string;
  color?: string;
  emblem?: string;
  motto?: string;
  maxMembers?: number;
  isActive?: boolean;
}

// Emblemas disponibles con sus iconos
export const CLAN_EMBLEMS: Record<string, string> = {
  shield: '🛡️',
  sword: '⚔️',
  crown: '👑',
  dragon: '🐉',
  phoenix: '🔥',
  wolf: '🐺',
  eagle: '🦅',
  lion: '🦁',
  star: '⭐',
  flame: '🔥',
  lightning: '⚡',
  moon: '🌙',
  sun: '☀️',
  tree: '🌳',
  mountain: '⛰️',
  wave: '🌊',
};

export const clanApi = {
  // Obtener opciones disponibles
  getOptions: async (): Promise<{ emblems: string[]; colors: string[] }> => {
    const response = await api.get('/clans/options');
    return response.data.data;
  },

  // Obtener todos los clanes de una clase
  getClassroomClans: async (classroomId: string): Promise<ClanWithMembers[]> => {
    const response = await api.get(`/clans/classroom/${classroomId}`);
    return response.data.data;
  },

  // Obtener un clan específico
  getClan: async (clanId: string): Promise<Clan> => {
    const response = await api.get(`/clans/${clanId}`);
    return response.data.data;
  },

  // Crear un nuevo clan
  createClan: async (classroomId: string, data: CreateClanData): Promise<Clan> => {
    const response = await api.post(`/clans/classroom/${classroomId}`, data);
    return response.data.data;
  },

  // Actualizar un clan
  updateClan: async (clanId: string, data: UpdateClanData): Promise<Clan> => {
    const response = await api.put(`/clans/${clanId}`, data);
    return response.data.data;
  },

  // Eliminar un clan
  deleteClan: async (clanId: string): Promise<void> => {
    await api.delete(`/clans/${clanId}`);
  },

  // Asignar estudiante a un clan
  assignStudent: async (clanId: string, studentId: string): Promise<Clan> => {
    const response = await api.post(`/clans/${clanId}/members`, { studentId });
    return response.data.data;
  },

  // Quitar estudiante de un clan
  removeStudent: async (studentId: string): Promise<void> => {
    await api.delete(`/clans/members/${studentId}`);
  },

  // Asignar estudiantes aleatoriamente
  assignRandomly: async (classroomId: string): Promise<{ assigned: number; clans: number }> => {
    const response = await api.post(`/clans/classroom/${classroomId}/assign-random`);
    return response.data.data;
  },

  // Obtener ranking de clanes
  getRanking: async (classroomId: string): Promise<ClanRanking[]> => {
    const response = await api.get(`/clans/classroom/${classroomId}/ranking`);
    return response.data.data;
  },

  // Obtener historial de un clan
  getClanHistory: async (clanId: string, limit = 50): Promise<ClanLog[]> => {
    const response = await api.get(`/clans/${clanId}/history`, { params: { limit } });
    return response.data.data;
  },

  // Obtener información del clan de un estudiante
  getStudentClanInfo: async (studentId: string): Promise<StudentClanInfo | null> => {
    const response = await api.get(`/clans/student/${studentId}/info`);
    return response.data.data;
  },
};
