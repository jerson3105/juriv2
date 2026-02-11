import api from './api';

export interface ActivityLogEntry {
  id: string;
  type: 'POINTS' | 'PURCHASE' | 'ITEM_USED' | 'LEVEL_UP' | 'BADGE' | 'ATTENDANCE';
  timestamp: string;
  studentId: string;
  studentName: string | null;
  studentClass: string;
  details: {
    pointType?: string;
    action?: string;
    amount?: number;
    reason?: string;
    itemName?: string;
    itemIcon?: string;
    totalPrice?: number;
    newLevel?: number;
    badgeName?: string;
    badgeIcon?: string;
    // Puntos combinados (cuando un comportamiento tiene XP+HP+GP)
    xpAmount?: number;
    hpAmount?: number;
    gpAmount?: number;
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

export const historyApi = {
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
};
