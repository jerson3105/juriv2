import { api } from './api';

export interface AdminStats {
  users: {
    total: number;
    teachers: number;
    students: number;
    admins: number;
  };
  classrooms: number;
  avatarItems: number;
  studentProfiles: number;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  provider: string;
  createdAt: string;
}

export interface AdminAvatarItem {
  id: string;
  name: string;
  description: string | null;
  gender: 'MALE' | 'FEMALE';
  slot: string;
  imagePath: string;
  layerOrder: number;
  basePrice: number;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClassroom {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AdminClassroomStudent {
  id: string;
  characterName: string | null;
  displayName: string | null;
  level: number;
  xp: number;
  gp: number;
  hp: number;
  avatarGender: 'MALE' | 'FEMALE';
  isActive: boolean;
  createdAt: string;
}

export interface AdminClassroomActivity {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  mode?: string;
  type?: string;
}

export interface AdminQuestionBank {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
}

export interface AdminClassroomDetails {
  classroom: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    teacher: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      createdAt: string;
    };
  };
  teacherClassroomsCount: number;
  stats: {
    students: {
      total: number;
      active: number;
      inactive: number;
    };
    questionBanks: number;
    activities: {
      total: number;
      byType: {
        timer: number;
        tournament: number;
        expedition: number;
      };
      completed: number;
    };
    lastActivity: string | null;
  };
  students: AdminClassroomStudent[];
  activities: {
    timed: AdminClassroomActivity[];
    tournaments: AdminClassroomActivity[];
    expeditions: AdminClassroomActivity[];
  };
  questionBanks: AdminQuestionBank[];
}

export const adminApi = {
  // Dashboard
  async getStats(): Promise<AdminStats> {
    const response = await api.get('/admin/stats');
    return response.data.data;
  },

  // Users
  async getUsers(page = 1, limit = 20): Promise<{ users: AdminUser[]; pagination: any }> {
    const response = await api.get(`/admin/users?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  async updateUserRole(userId: string, role: string): Promise<void> {
    await api.patch(`/admin/users/${userId}/role`, { role });
  },

  // Avatar Items
  async getAvatarItems(filters?: { gender?: string; slot?: string }): Promise<AdminAvatarItem[]> {
    const params = new URLSearchParams();
    if (filters?.gender) params.append('gender', filters.gender);
    if (filters?.slot) params.append('slot', filters.slot);
    const response = await api.get(`/admin/avatar-items?${params.toString()}`);
    return response.data.data;
  },

  async createAvatarItem(formData: FormData): Promise<AdminAvatarItem> {
    const response = await api.post('/admin/avatar-items', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async updateAvatarItem(itemId: string, data: Partial<AdminAvatarItem>): Promise<AdminAvatarItem> {
    const response = await api.patch(`/admin/avatar-items/${itemId}`, data);
    return response.data.data;
  },

  async deleteAvatarItem(itemId: string): Promise<void> {
    await api.delete(`/admin/avatar-items/${itemId}`);
  },

  // Classrooms
  async getClassrooms(): Promise<AdminClassroom[]> {
    const response = await api.get('/admin/classrooms');
    return response.data.data;
  },

  async getClassroomDetails(classroomId: string): Promise<AdminClassroomDetails> {
    const response = await api.get(`/admin/classrooms/${classroomId}/details`);
    return response.data.data;
  },
};
