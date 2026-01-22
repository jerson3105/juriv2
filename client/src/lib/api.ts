import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Crear instancia de axios
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

const runTokenRefresh = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await axios.post(`${API_URL}/auth/refresh`, {
      refreshToken,
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
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
    const isAuthRoute = typeof originalRequest?.url === 'string' && originalRequest.url.includes('/auth/');

    // Si el token expiró, intentar refrescarlo
    if (
      status === 401 &&
      !isAuthRoute &&
      !originalRequest._retry &&
      (code === 'TOKEN_EXPIRED' || message === 'Token de acceso no proporcionado' || message === 'Token inválido')
    ) {
      originalRequest._retry = true;

      try {
        const { accessToken } = await runTokenRefresh();

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Si falla el refresh, limpiar tokens y redirigir a login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
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
    googleData: {
      email: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string | null;
    };
    role: 'TEACHER' | 'STUDENT' | 'PARENT';
  }) => api.post<ApiResponse<AuthData>>('/auth/google/complete-registration', data),
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
