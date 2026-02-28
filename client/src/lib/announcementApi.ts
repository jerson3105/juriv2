import { api } from './api';

export interface Announcement {
  id: string;
  classroomId: string;
  teacherId: string;
  teacherName: string;
  message: string;
  createdAt: string;
}

export interface AnnouncementsResponse {
  announcements: Announcement[];
  total: number;
  page: number;
  limit: number;
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
};
