import { api } from './api';

/** Pendientes y cifras del panel (inicio y contadores del menú), cada una separada por lo que cuenta. */
export interface AdminOverview {
  users: { total: number; admins: number; teachers: number; students: number; parents: number; inactive: number };
  teachers: { verified: number; unverified: number; pendingRequests: number; unverifiedWithClasses: number };
  classrooms: { active: number; archived: number };
  avatarItems: { published: number; drafts: number; retired: number; holes: { slot: string; gender: 'MALE' | 'FEMALE' }[] };
  schools: { verified: number; unverified: number; pendingVerifications: number };
  bugReports: { pending: number; inProgress: number; criticalPending: number };
  expeditionMaps: { active: number; hidden: number };
}

export const adminOverviewKey = ['admin-overview'] as const;

export type AssignableRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type UserRole = AssignableRole | 'PARENT';

export interface AdminUser {
  id: string;
  /** null en las cuentas con PIN (su correo es sintético: entran con el PIN de su clase). */
  email: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  provider: 'LOCAL' | 'GOOGLE' | 'PIN';
  isActive: boolean;
  teacherStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | null;
  createdAt: string;
  lastLoginAt: string | null;
  /** Docentes: clases activas. */
  classes: number | null;
  /** Alumnos: clases en las que está. */
  enrolledIn: number | null;
}

export interface AdminUserFilters {
  q?: string;
  role?: UserRole;
  status?: 'active' | 'inactive';
  page: number;
}

export interface AdminUserPage {
  users: AdminUser[];
  counts: Partial<Record<UserRole, number>>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const adminUsersKey = (filters: AdminUserFilters) => ['admin-users', filters] as const;

export interface AdminClassroom {
  id: string;
  name: string;
  /** Sirve para unirse: la pantalla lo muestra oculto hasta pedirlo. */
  code: string;
  gradeLevel: string | null;
  isActive: boolean;
  createdAt: string;
  schoolName: string | null;
  /** Alumnos activos (sin el de demostración). */
  students: number;
  /** Último punto dado en los últimos 90 días (null = sin puntos en ese tiempo). */
  lastPointAt: string | null;
  pointsThisWeek: number;
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
    points?: { thisWeek: number; studentsThisWeek: number };
  };
  students: AdminClassroomStudent[];
  activities: {
    timed: AdminClassroomActivity[];
    expeditions: AdminClassroomActivity[];
  };
  questionBanks: AdminQuestionBank[];
}

export const adminApi = {
  async getOverview(): Promise<AdminOverview> {
    const response = await api.get('/admin/overview');
    return response.data.data;
  },

  /** Búsqueda, filtros y páginas en el servidor. */
  async getUsers(filters: AdminUserFilters): Promise<AdminUserPage> {
    const params = Object.fromEntries(Object.entries({ ...filters, limit: 25 }).filter(([, value]) => value !== undefined && value !== ''));
    const response = await api.get('/admin/users', { params });
    return response.data.data;
  },

  async createTeacher(data: { email: string; firstName: string; lastName: string; password: string }): Promise<{ id: string }> {
    const response = await api.post('/admin/users/teacher', data);
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
