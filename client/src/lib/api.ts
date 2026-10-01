import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { APP_HEADERS, refreshSession } from './session';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Crear instancia de axios
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    ...APP_HEADERS,
  },
  withCredentials: true,
});

// El access token vive solo en memoria (el refresh va en una cookie httpOnly).
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Rutas que no deben disparar una renovación (son las que dan o cierran la sesión).
const NO_REFRESH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/student-code/verify',
  '/auth/join-code/verify',
  '/auth/student-code/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/google',
  '/auth/google/complete-registration',
  '/auth/google/exchange-code',
];
// La sesión terminó en el servidor (cerrada, robada o vencida): no se intenta renovar.
const SESSION_ENDED = new Set(['SESSION_REVOKED', 'SESSION_REUSED', 'SESSION_EXPIRED', 'REFRESH_INVALID']);

let endingSession = false;
const endSession = () => {
  if (endingSession) return;
  endingSession = true;
  void useAuthStore.getState().endSession('error=session_expired');
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.code as string | undefined;
    const message = error.response?.data?.message as string | undefined;
    const isAuthRoute = NO_REFRESH_ROUTES.some((route) => originalRequest?.url?.includes(route));

    if (status !== 401 || isAuthRoute || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }
    if (code && SESSION_ENDED.has(code)) {
      if (useAuthStore.getState().isAuthenticated) endSession();
      return Promise.reject(error);
    }
    const renewable = code === 'TOKEN_EXPIRED' || message === 'Token expirado' || message === 'Token de acceso no proporcionado' || message === 'Token inválido';
    if (!renewable) return Promise.reject(error);

    originalRequest._retry = true;
    const token = await refreshSession();
    if (!token) {
      if (useAuthStore.getState().isAuthenticated) endSession();
      return Promise.reject(error);
    }
    delete originalRequest.headers?.Authorization;
    return api(originalRequest);
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

  /** Puerta /unirse: código de clase o personal, sin sesión. */
  verifyJoinCode: (code: string) =>
    api.post<ApiResponse<
      (| { type: 'classroom'; classroomName: string; teacherName: string | null; open: boolean }
      | { type: 'student'; studentName: string | null; classroomName: string | null; alreadyLinked: boolean })
      & { teacherVerified?: boolean; message?: string }
    >>('/auth/join-code/verify', { code }),

  verifyStudentCode: (code: string) =>
    api.post<ApiResponse<{
      studentName: string | null;
      classroomName: string | null;
      alreadyLinked: boolean;
    }>>('/auth/student-code/verify', { code }),

  registerStudentWithCode: (data: {
    code: string;
    email: string;
    password: string;
    avatarGender: 'MALE' | 'FEMALE';
  }) => api.post<ApiResponse<AuthData>>('/auth/student-code/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<AuthData>>('/auth/login', data),

  /** Cierra la sesión de este dispositivo (la cookie la identifica). */
  logout: () => api.post<ApiResponse<null>>('/auth/logout'),


  getMe: () => api.get<ApiResponse<User>>('/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put<ApiResponse<null>>('/auth/change-password', data),

  completeGoogleRegistration: (data: {
    code?: string;
    role: 'TEACHER' | 'STUDENT' | 'PARENT';
  }) => api.post<ApiResponse<AuthData>>('/auth/google/complete-registration', data),

  exchangeGoogleCode: (code?: string) =>
    api.post<ApiResponse<{ accessToken: string }>>(
      '/auth/google/exchange-code',
      code ? { code } : {}
    ),

  /** ¿Esta cuenta de docente puede pasar a estudiante? (sin alumnos reales ni escuela) */
  getStudentSwitch: () =>
    api.get<ApiResponse<{ eligible: boolean; reason?: string }>>('/auth/switch-to-student'),

  /** "Soy estudiante, me equivoqué": cambia la cuenta y devuelve una sesión nueva. */
  switchToStudent: () => api.post<ApiResponse<AuthData>>('/auth/switch-to-student'),
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
  /** El refresh no viaja en el cuerpo: va en una cookie httpOnly. */
  accessToken: string;
}

export default api;
