import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../lib/api';
import type { User, AuthData } from '../lib/api';
import { clearSessionData } from '../lib/sessionCleanup';

type ApiError = { response?: { status?: number; data?: { message?: string } } };

interface AuthState {
  user: User | null;
  /** Solo en memoria: el refresh vive en una cookie httpOnly y nunca se guarda en el navegador. */
  accessToken: string | null;
  isAuthenticated: boolean;
  /** 'checking' = recuperando la sesión desde la cookie al abrir la app. */
  sessionStatus: 'checking' | 'ready';
  isLoading: boolean;
  error: string | null;

  // Acciones
  /** Devuelve `totpChallenge` si la cuenta pide el código de verificación (aún sin sesión). */
  login: (email: string, password: string) => Promise<{ totpChallenge?: string }>;
  loginTotp: (challenge: string, code: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'TEACHER' | 'STUDENT' | 'PARENT';
  }) => Promise<void>;
  /** `afterClear`: corre tras limpiar el navegador y antes de ir al login (p. ej. guardar a dónde volver). */
  logout: (afterClear?: () => void) => Promise<void>;
  /** La sesión terminó (revocada o vencida): limpiar sin llamar al servidor. */
  endSession: (reason?: string, afterClear?: () => void) => Promise<void>;
  fetchUser: () => Promise<void>;
  clearError: () => void;
  setAuth: (data: AuthData) => void;
  setAccessToken: (accessToken: string) => void;
  setSessionStatus: (status: 'checking' | 'ready') => void;
  updateUser: (data: Partial<User>) => void;
}

// Cargado al usarse: session.ts importa este store.
const notifyToken = (token: string) => {
  void import('../lib/session').then(({ onAccessToken }) => onAccessToken(token));
};
const stopRefresh = () => {
  void import('../lib/session').then(({ stopProactiveRefresh }) => stopProactiveRefresh());
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      sessionStatus: 'ready',
      isLoading: false,
      error: null,

      setAuth: (data: AuthData) => {
        // Otra persona (o la misma con otro rol) entra en este navegador sin cerrar la sesión anterior
        // (p. ej. un alumno en /unirse en la computadora del docente): nada de la anterior queda a la
        // vista. La parte síncrona (caché y almacenamiento) se limpia antes de guardar la nueva.
        const previous = get().user;
        if (previous && (previous.id !== data.user.id || previous.role !== data.user.role)) {
          void clearSessionData();
        }
        set({
          user: data.user,
          accessToken: data.accessToken,
          isAuthenticated: true,
          sessionStatus: 'ready',
          error: null,
        });
        notifyToken(data.accessToken);
      },

      setAccessToken: (accessToken: string) => {
        set({ accessToken });
        notifyToken(accessToken);
      },

      setSessionStatus: (sessionStatus) => set({ sessionStatus }),

      updateUser: (data: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...data } });
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login({ email, password });
          const data = response.data.data;
          if (data && 'totpRequired' in data) return { totpChallenge: data.challenge };
          if (response.data.success && data) {
            get().setAuth(data);
          }
          return {};
        } catch (error) {
          const message = (error as ApiError).response?.data?.message || 'Error al iniciar sesión';
          set({ error: message });
          throw new Error(message);
        } finally {
          set({ isLoading: false });
        }
      },

      loginTotp: async (challenge: string, code: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.loginTotp({ challenge, code });
          if (response.data.success && response.data.data) {
            get().setAuth(response.data.data);
          }
        } catch (error) {
          const message = (error as ApiError).response?.data?.message || 'No se pudo revisar el código';
          set({ error: message });
          throw new Error(message);
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(data);
          if (response.data.success && response.data.data) {
            get().setAuth(response.data.data);
          }
        } catch (error) {
          const message = (error as ApiError).response?.data?.message || 'Error al registrarse';
          set({ error: message });
          throw new Error(message);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async (afterClear) => {
        try {
          // El servidor cierra la sesión de este dispositivo (cookie) y borra la cookie.
          await authApi.logout();
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
        } finally {
          await get().endSession('salida=1', afterClear);
        }
      },

      endSession: async (reason = 'error=session_expired', afterClear) => {
        stopRefresh();
        set({ user: null, accessToken: null, isAuthenticated: false, sessionStatus: 'ready', error: null });
        await clearSessionData();
        afterClear?.();
        // Recarga completa: no queda nada del usuario anterior en memoria.
        window.location.replace(`/login?${reason}`);
      },

      fetchUser: async () => {
        const { accessToken } = get();
        if (!accessToken) return;

        set({ isLoading: true });
        try {
          const response = await authApi.getMe();
          if (response.data.success && response.data.data) {
            set({ user: response.data.data, isAuthenticated: true });
          }
        } catch (error) {
          // El interceptor de api.ts renueva la sesión o la cierra si ya no sirve.
          console.error('[fetchUser]', (error as ApiError).response?.status);
        } finally {
          set({ isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      version: 1,
      // Nunca se guardan tokens en el navegador.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Versión anterior: guardaba tokens. Se descartan (el refresh viejo se canjea una vez).
      migrate: (persisted) => {
        const old = (persisted ?? {}) as { user?: User | null; isAuthenticated?: boolean };
        return { user: old.user ?? null, isAuthenticated: !!old.isAuthenticated } as AuthState;
      },
    }
  )
);
