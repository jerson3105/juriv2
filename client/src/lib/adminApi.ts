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

export type AssignableRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AssignableRole | 'PARENT';
  provider: string;
  isActive: boolean;
  createdAt: string;
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
        expedition: number;
      };
      completed: number;
    };
    lastActivity: string | null;
  };
  students: AdminClassroomStudent[];
  activities: {
    timed: AdminClassroomActivity[];
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
  async getUsers(page = 1, limit = 20): Promise<{ users: AdminUser[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const response = await api.get(`/admin/users?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  /** Dar el rol de administrador pide la contraseña de quien lo da (`currentPassword`). */
  async updateUserRole(userId: string, role: AssignableRole, currentPassword?: string): Promise<void> {
    await api.patch(`/admin/users/${userId}/role`, { role, ...(currentPassword ? { currentPassword } : {}) });
  },

  async updateUserStatus(userId: string, isActive: boolean): Promise<void> {
    await api.patch(`/admin/users/${userId}/status`, { isActive });
  },

  // Las prendas del avatar están en adminAvatarItemsApi.

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
