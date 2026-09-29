import api from './api';

export interface RankingDeltas {
  since: string;
  students: { id: string; xp: number; gp: number }[];
  clans: { id: string; xp: number }[];
  // XP neto por alumno y minuto desde `since` (solo si se pide la línea de tiempo).
  timeline?: { id: string; m: number; xp: number }[];
}

export const rankingDeltasKey = (classroomId: string, since: string, timeline = false) =>
  ['ranking-deltas', classroomId, since, timeline] as const;

export const rankingApi = {
  // Lo ganado por cada alumno y clan desde `since` (ISO, inicio del periodo en la hora del profesor).
  getDeltas: async (classroomId: string, since: string, timeline = false): Promise<RankingDeltas> => {
    const response = await api.get(`/classrooms/${classroomId}/rankings`, {
      params: { since, ...(timeline ? { timeline: '1' } : {}) },
    });
    return response.data.data;
  },
};
