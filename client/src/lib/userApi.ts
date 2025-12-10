import { api } from './api';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'TEACHER' | 'STUDENT' | 'ADMIN';
  avatarUrl: string | null;
  provider: string;
  notifyBadges: boolean;
  notifyLevelUp: boolean;
  createdAt: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateNotificationsData {
  notifyBadges?: boolean;
  notifyLevelUp?: boolean;
}

export const userApi = {
  // Obtener perfil actual
  getProfile: async (): Promise<UserProfile> => {
    const response = await api.get('/auth/me');
    return response.data.data;
  },

  // Actualizar perfil
  updateProfile: async (data: UpdateProfileData): Promise<UserProfile> => {
    const response = await api.put('/auth/profile', data);
    return response.data.data;
  },

  // Cambiar contraseña
  changePassword: async (data: ChangePasswordData): Promise<void> => {
    await api.put('/auth/change-password', data);
  },

  // Subir foto de perfil
  uploadAvatar: async (file: File): Promise<UserProfile> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.post('/auth/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  // Actualizar preferencias de notificaciones
  updateNotifications: async (data: UpdateNotificationsData): Promise<UserProfile> => {
    const response = await api.put('/auth/notifications', data);
    return response.data.data;
  },
};
