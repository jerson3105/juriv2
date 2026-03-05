import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { updateSocketToken } from './socket';
import { queryClient } from './queryClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Crear instancia de axios
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let isRefreshing = false;
let isLoggingOut = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
};

const clearClientAuthSession = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  console.error('[clearClientAuthSession] Limpiando sesión desde interceptor — stack:', new Error().stack);

  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('refreshToken');
  window.localStorage.removeItem('auth-storage');
};

// Interceptor para añadir token de autenticación
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores y refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const status = error.response?.status;
    const code = error.response?.data?.code;
    const message = error.response?.data?.message as string | undefined;
    const noRefreshRoutes = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
      '/auth/google',
      '/auth/google/callback',
      '/auth/google/complete-registration',
      '/auth/google/exchange-code',
    ];
    const isAuthRoute = noRefreshRoutes.some(route => originalRequest?.url?.includes(route));

    // Si el token expiró, intentar refrescarlo
    if (
      status === 401 &&
      !isAuthRoute &&
      !originalRequest._retry &&
      (code === 'TOKEN_EXPIRED' || message === 'Token expirado' || message === 'Token de acceso no proporcionado' || message === 'Token inválido')
    ) {
      originalRequest._retry = true;

      // Si ya hay un refresh en curso, encolar este request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => {
          delete originalRequest.headers?.Authorization;
          return api(originalRequest);
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        // Write to localStorage FIRST — the request interceptor reads from here.
        // Then update Zustand state (which also triggers persist to auth-storage).
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        useAuthStore.getState().setTokens(accessToken, newRefreshToken);
        updateSocketToken(accessToken);

        processQueue(null, accessToken);

        // Invalidar queries para que refresquen con el token nuevo
        queryClient.invalidateQueries();

        // Don't set header here — let the request interceptor read
        // the fresh token from localStorage (already saved above).
        delete originalRequest.headers?.Authorization;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);

        // Solo el primer caller ejecuta limpieza y redirect
        if (!isLoggingOut) {
          isLoggingOut = true;
          clearClientAuthSession();
          window.location.replace('/login');
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Tipos de respuesta
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{ path: string[]; message: string }>;
}

// Funciones de autenticación
export const authApi = {
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'TEACHER' | 'STUDENT' | 'PARENT';
  }) => api.post<ApiResponse<AuthData>>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<AuthData>>('/auth/login', data),

  logout: (refreshToken: string) =>
    api.post<ApiResponse<null>>('/auth/logout', { refreshToken }),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/refresh', { refreshToken }),

  getMe: () => api.get<ApiResponse<User>>('/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put<ApiResponse<null>>('/auth/change-password', data),

  completeGoogleRegistration: (data: {
    code?: string;
    role: 'TEACHER' | 'STUDENT' | 'PARENT';
  }) => api.post<ApiResponse<AuthData>>('/auth/google/complete-registration', data),

  exchangeGoogleCode: (code?: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      '/auth/google/exchange-code',
      code ? { code } : {}
    ),
};

// Tipos
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
  avatarUrl: string | null;
  provider: 'LOCAL' | 'GOOGLE';
  createdAt: string;
}

export interface AuthData {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export default api;
