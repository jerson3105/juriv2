import api from './api';

export interface ActivityLogEntry {
  id: string;
  type: 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'LEVEL_UP' | 'BADGE' | 'ATTENDANCE';
  timestamp: string;
  studentId: string;
  studentName: string | null;
  studentClass: string;
  isReverted?: boolean;
  details: {
    pointType?: string;
    action?: string;
    amount?: number;
    reason?: string;
    itemName?: string;
    itemIcon?: string;
    totalPrice?: number;
    newLevel?: number;
    fromLevel?: number;
    /** Origen de una subida de nivel (BEHAVIOR, POINTS, ATTENDANCE…). */
    levelSource?: string;
    badgeName?: string;
    badgeIcon?: string;
    // Puntos combinados (cuando un comportamiento tiene XP+HP+GP)
    xpAmount?: number;
    hpAmount?: number;
    gpAmount?: number;
    multiplier?: number;
    // Asistencia
    attendanceStatus?: string;
    attendanceDate?: string;
  };
}

export interface ClassroomStats {
  totalXpGiven: number;
  totalXpRemoved: number;
  totalPurchases: number;
  totalItemsUsed: number;
  topStudents: { id: string; name: string; xp: number }[];
  topPositiveBehaviors: { name: string; icon: string | null; count: number }[];
  topNegativeBehaviors: { name: string; icon: string | null; count: number }[];
}

export interface HistoryResponse {
  logs: ActivityLogEntry[];
  total: number;
}

export type FeedType = 'ALL' | 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'BADGE' | 'ATTENDANCE' | 'LEVEL_UP';

/** Entrada del registro por cursor: clave estable, lote (misma acción a varios alumnos) y autor. */
export interface FeedEntry extends ActivityLogEntry {
  key: string;
  batchKey?: string;
  behaviorIcon?: string | null;
  /** null = automático; ausente = no aplica (compras, asistencia). */
  actor?: { id: string; name: string } | null;
}

export interface FeedPage {
  entries: FeedEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Periodo: "bimester" lo resuelve el servidor; si no, [from, to) en ISO. */
export interface PeriodParams {
  studentId?: string;
  period?: 'bimester';
  from?: string;
  to?: string;
}

export interface HistorySummary {
  xpGiven: number;
  xpRemoved: number;
  purchases: number;
  badges: number;
  itemsUsed: number;
}

const periodQuery = (params: PeriodParams & Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.append(key, String(value));
  });
  return query.toString();
};

export const historyApi = {
  getFeed: async (classroomId: string, params: PeriodParams & { type?: FeedType; cursor?: string | null; limit?: number }): Promise<FeedPage> => {
    const { cursor, ...rest } = params;
    const response = await api.get(`/history/classroom/${classroomId}/feed?${periodQuery({ ...rest, cursor: cursor ?? undefined })}`);
    return response.data.data;
  },

  getSummary: async (classroomId: string, params: PeriodParams): Promise<HistorySummary> => {
    const response = await api.get(`/history/classroom/${classroomId}/summary?${periodQuery({ ...params })}`);
    return response.data.data;
  },

  revertBatch: async (classroomId: string, entryIds: string[]): Promise<{ message: string; reverted: number; skipped: number }> => {
    const response = await api.post(`/history/classroom/${classroomId}/revert-batch`, { entryIds });
    return { message: response.data.message, ...response.data.data };
  },

  getClassroomHistory: async (
    classroomId: string,
    options?: {
      limit?: number;
      offset?: number;
      type?: 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'BADGE' | 'ATTENDANCE' | 'ALL';
      studentId?: string;
    }
  ): Promise<HistoryResponse> => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.type) params.append('type', options.type);
    if (options?.studentId) params.append('studentId', options.studentId);

    const response = await api.get(`/history/classroom/${classroomId}?${params.toString()}`);
    return response.data.data;
  },

  getClassroomStats: async (classroomId: string): Promise<ClassroomStats> => {
    const response = await api.get(`/history/classroom/${classroomId}/stats`);
    return response.data.data;
  },

  revertEntry: async (entryType: 'POINTS' | 'BADGE' | 'ATTENDANCE', entryId: string): Promise<{ message: string }> => {
    const response = await api.post(`/history/revert/${entryType}/${entryId}`);
    return response.data;
  },
};
