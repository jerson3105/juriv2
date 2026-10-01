import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { updateSocketToken } from './socket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/** Cabecera propia de la app: el servidor solo acepta la cookie de sesión con ella (protección CSRF). */
export const APP_HEADERS = { 'X-Juried-Client': '1' } as const;

// Clientes anteriores guardaban el refresh en localStorage: se canjea una vez por la cookie.
const LEGACY_KEYS = ['accessToken', 'refreshToken'];

let refreshing: Promise<string | null> | null = null;
let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

/** Datos del access token, sin verificar (solo para programar la renovación y comparar el usuario). */
const tokenClaims = (token: string): { exp?: number; userId?: string; role?: string } | null => {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
};

const tokenExpiry = (token: string): number | null => {
  const exp = tokenClaims(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
};

/**
 * La cookie es de otra persona: en este navegador alguien entró con otra cuenta (p. ej. otro alumno
 * en otra pestaña de la computadora del colegio). Se carga su usuario, se limpia lo del anterior
 * (setAuth) y se recarga la app para que no quede nada en memoria. Si no se puede, se cierra la sesión.
 */
const switchToCookieUser = async (token: string): Promise<string | null> => {
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      withCredentials: true,
      headers: { ...APP_HEADERS, Authorization: `Bearer ${token}` },
    });
    const user = response.data?.data;
    if (!user?.id) throw new Error('Sin usuario');
    useAuthStore.getState().setAuth({ user, accessToken: token });
    window.location.reload();
    return token;
  } catch {
    await useAuthStore.getState().endSession('error=session_changed');
    return null;
  }
};

/** Renueva el token un minuto antes de que venza (también el del socket, sin reconectar). */
export const scheduleProactiveRefresh = (token: string) => {
  if (proactiveTimer) clearTimeout(proactiveTimer);
  const exp = tokenExpiry(token);
  if (!exp) return;
  proactiveTimer = setTimeout(() => { void refreshSession(); }, Math.max(5_000, exp - Date.now() - 60_000));
};

export const stopProactiveRefresh = () => {
  if (proactiveTimer) clearTimeout(proactiveTimer);
  proactiveTimer = null;
};

/**
 * Pide un access token nuevo con la cookie httpOnly (una sola petición aunque la pidan varios a la
 * vez). Devuelve null si la sesión terminó.
 */
export const refreshSession = (): Promise<string | null> => {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    let legacy: string | null = null;
    try {
      legacy = localStorage.getItem('refreshToken');
    } catch {
      legacy = null;
    }
    try {
      const response = await axios.post(
        `${API_URL}/auth/refresh`,
        legacy ? { refreshToken: legacy } : {},
        { withCredentials: true, headers: APP_HEADERS },
      );
      const token: string | undefined = response.data?.data?.accessToken;
      if (!token) return null;
      // La sesión guardada en este navegador debe ser la de la cookie (misma persona y rol).
      const stored = useAuthStore.getState().user;
      const claims = tokenClaims(token);
      if (stored && claims?.userId && (claims.userId !== stored.id || (claims.role && claims.role !== stored.role))) {
        return await switchToCookieUser(token);
      }
      useAuthStore.getState().setAccessToken(token);
      return token;
    } catch {
      return null;
    } finally {
      if (legacy) {
        try {
          LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
        } catch {
          // Sin almacenamiento.
        }
      }
      refreshing = null;
    }
  })();
  return refreshing;
};

/** Al recibir un token (login, refresh): avisar al socket y programar la próxima renovación. */
export const onAccessToken = (token: string) => {
  updateSocketToken(token);
  scheduleProactiveRefresh(token);
};
