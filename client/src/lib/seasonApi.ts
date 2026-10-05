import api from './api';
import type { BadgeRarity } from './badgeApi';

// Una insignia de la temporada; una acumulable trae sus veces.
export interface SeasonBadge {
  id: string;
  name: string;
  icon: string;
  customImage: string | null;
  rarity: BadgeRarity;
  times: number;
}

// Un álbum donde reunió alguna carta.
export interface SeasonAlbum {
  id: string;
  name: string;
  coverImage: string | null;
  owned: number;
  total: number;
  completed: boolean;
}

export interface SeasonClass {
  classroomId: string;
  name: string;
  level: number;
  badges: SeasonBadge[];
  albums: SeasonAlbum[];
  cards: number;
}

// Un año escolar cerrado con las clases que tuvo el estudiante (sin puestos ni oro).
export interface Season {
  yearId: string;
  year: string;
  school: string;
  classes: SeasonClass[];
}

// La temporada de una clase para el modo «Temporada» de la gala.
export interface ClassSeasonStudent {
  id: string;
  level: number;
  badgeCount: number;
  badges: SeasonBadge[];
  cards: number;
  albumsCompleted: number;
  perfectAttendance: boolean;
}

export interface ClassSeason {
  stats: { students: number; xp: number; badges: number; cards: number; albumsCompleted: number; attendanceDays: number };
  students: ClassSeasonStudent[];
}

export const mySeasonsKey = ['my-seasons'] as const;
export const classSeasonKey = (classroomId: string) => ['class-season', classroomId] as const;

export const seasonApi = {
  // «Mis temporadas»: las clases del estudiante en años escolares cerrados.
  mine: async (): Promise<Season[]> => {
    const response = await api.get('/students/me/seasons');
    return response.data.data;
  },

  // Para la gala de la clase (su docente).
  classroom: async (classroomId: string): Promise<ClassSeason> => {
    const response = await api.get(`/classrooms/${classroomId}/rankings/season`);
    return response.data.data;
  },
};
