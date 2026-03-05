import { api } from './api';

export interface ChatMessage {
  id: string;
  classroomId: string;
  senderId: string;
  senderRole: 'TEACHER' | 'PARENT';
  senderName: string;
  childName: string | null;
  message: string | null;
  isDeleted: boolean;
  createdAt: string;
}

export interface ChatSettings {
  classroomId: string;
  isOpen: boolean;
  closedAt: string | null;
  closedBy: string | null;
}

export const chatApi = {
  getMessages: async (classroomId: string, limit: number = 50, before?: string): Promise<ChatMessage[]> => {
    const params: Record<string, string> = { limit: String(limit) };
    if (before) params.before = before;
    const { data } = await api.get(`/classrooms/${classroomId}/chat`, { params });
    return data.data;
  },

  sendMessage: async (classroomId: string, message: string): Promise<ChatMessage> => {
    const { data } = await api.post(`/classrooms/${classroomId}/chat`, { message });
    return data.data;
  },

  deleteMessage: async (classroomId: string, messageId: string): Promise<void> => {
    await api.delete(`/classrooms/${classroomId}/chat/${messageId}`);
  },

  getSettings: async (classroomId: string): Promise<ChatSettings> => {
    const { data } = await api.get(`/classrooms/${classroomId}/chat/settings`);
    return data.data;
  },

  updateSettings: async (classroomId: string, isOpen: boolean): Promise<ChatSettings> => {
    const { data } = await api.patch(`/classrooms/${classroomId}/chat/settings`, { isOpen });
    return data.data;
  },
};
