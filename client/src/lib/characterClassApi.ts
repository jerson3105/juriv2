import api from './api';

export interface CharacterClassData {
  id: string;
  classroomId: string;
  name: string;
  key: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCharacterClassData {
  name: string;
  key: string;
  description?: string;
  icon: string;
  color: string;
}

export interface UpdateCharacterClassData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export const characterClassApi = {
  list: async (classroomId: string): Promise<CharacterClassData[]> => {
    const response = await api.get(`/classrooms/${classroomId}/character-classes`);
    return response.data.data;
  },

  listActive: async (classroomId: string): Promise<CharacterClassData[]> => {
    const response = await api.get(`/classrooms/${classroomId}/character-classes/active`);
    return response.data.data;
  },

  create: async (classroomId: string, data: CreateCharacterClassData): Promise<CharacterClassData> => {
    const response = await api.post(`/classrooms/${classroomId}/character-classes`, data);
    return response.data.data;
  },

  update: async (classroomId: string, id: string, data: UpdateCharacterClassData): Promise<CharacterClassData> => {
    const response = await api.put(`/classrooms/${classroomId}/character-classes/${id}`, data);
    return response.data.data;
  },

  remove: async (classroomId: string, id: string): Promise<void> => {
    await api.delete(`/classrooms/${classroomId}/character-classes/${id}`);
  },

  reorder: async (classroomId: string, orderedIds: string[]): Promise<void> => {
    await api.post(`/classrooms/${classroomId}/character-classes/reorder`, { orderedIds });
  },

  assign: async (classroomId: string, studentId: string, characterClassId: string | null): Promise<void> => {
    await api.post(`/classrooms/${classroomId}/character-classes/assign`, { studentId, characterClassId });
  },

  bulkAssign: async (classroomId: string, studentIds: string[], characterClassId: string | null): Promise<void> => {
    await api.post(`/classrooms/${classroomId}/character-classes/bulk-assign`, { studentIds, characterClassId });
  },

  studentChoose: async (classroomId: string, characterClassId: string): Promise<void> => {
    await api.post(`/classrooms/${classroomId}/character-classes/choose`, { characterClassId });
  },

  seedDefaults: async (classroomId: string): Promise<CharacterClassData[]> => {
    const response = await api.post(`/classrooms/${classroomId}/character-classes/seed`);
    return response.data.data;
  },

  listByCode: async (code: string): Promise<{ classroomId: string; assignmentMode: string; classes: CharacterClassData[] }> => {
    const response = await api.get(`/classrooms/code/${code}/character-classes`);
    return response.data.data;
  },
};
