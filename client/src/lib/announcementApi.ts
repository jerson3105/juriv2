import { api } from './api';

export interface Announcement {
  id: string;
  classroomId: string;
  teacherId: string;
  teacherName: string;
  message: string;
  createdAt: string;
  readCount: number;
  totalParents: number;
}

export interface AnnouncementsResponse {
  announcements: Announcement[];
  total: number;
  page: number;
  limit: number;
}

export interface ParentStats {
  registeredParents: number;
  totalStudents: number;
  connectedParents: number;
}

export interface FamilyInfo {
  studentId: string;
  studentName: string;
  isRegistered: boolean;
  parentName: string | null;
  parentRelationship: string | null;
  parentLinkCode: string | null;
  isConnected: boolean;
}

export interface FamiliesResponse {
  families: FamilyInfo[];
  registered: number;
  total: number;
}

export const announcementApi = {
  create: async (classroomId: string, message: string): Promise<Announcement> => {
    const { data } = await api.post(`/classrooms/${classroomId}/announcements`, { message });
    return data;
  },

  list: async (classroomId: string, page: number = 1, limit: number = 50): Promise<AnnouncementsResponse> => {
    const { data } = await api.get(`/classrooms/${classroomId}/announcements`, {
      params: { page, limit },
    });
    return data;
  },

  parentStats: async (classroomId: string): Promise<ParentStats> => {
    const { data } = await api.get(`/classrooms/${classroomId}/announcements/parent-stats`);
    return data;
  },

  markRead: async (classroomId: string): Promise<void> => {
    await api.post(`/classrooms/${classroomId}/announcements/mark-read`);
  },

  families: async (classroomId: string): Promise<FamiliesResponse> => {
    const { data } = await api.get(`/classrooms/${classroomId}/announcements/families`);
    return data;
  },
};
