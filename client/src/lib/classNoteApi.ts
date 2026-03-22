import { api } from './api';

export interface ClassNote {
  id: string;
  classroomId: string;
  teacherId: string;
  content: string;
  category: 'task' | 'review' | 'material' | 'other';
  isCompleted: boolean;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
}

export const classNoteApi = {
  create: async (classroomId: string, content: string, category: string, dueDate?: string | null): Promise<ClassNote> => {
    const { data } = await api.post(`/classrooms/${classroomId}/notes`, { content, category, dueDate });
    return data;
  },

  list: async (classroomId: string): Promise<ClassNote[]> => {
    const { data } = await api.get(`/classrooms/${classroomId}/notes`);
    return data;
  },

  toggleComplete: async (classroomId: string, noteId: string): Promise<ClassNote> => {
    const { data } = await api.patch(`/classrooms/${classroomId}/notes/${noteId}/toggle`);
    return data;
  },

  remove: async (classroomId: string, noteId: string): Promise<void> => {
    await api.delete(`/classrooms/${classroomId}/notes/${noteId}`);
  },

  pendingCount: async (classroomId: string): Promise<number> => {
    const { data } = await api.get(`/classrooms/${classroomId}/notes/pending-count`);
    return data.count;
  },
};
