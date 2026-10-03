import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');

// Una sola instancia por sesión: las páginas guardan la referencia al montar, así que reemplazarla
// (antes pasaba si el token cambiaba durante una reconexión) las dejaba escuchando un socket muerto.
let socket: Socket | null = null;
const watchers = new Set<(socket: Socket | null) => void>();

export function getSocket(): Socket | null {
  return socket;
}

/** Avisa cuando el socket se crea (al iniciar sesión) o se destruye (al cerrarla). */
export function watchSocket(watcher: (socket: Socket | null) => void): () => void {
  watchers.add(watcher);
  return () => { watchers.delete(watcher); };
}

const isAuthError = (message: string) =>
  message.includes('jwt expired') || message.includes('401') || message.includes('Token') || message.includes('Authentication');

export function connectSocket(): Socket | null {
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;

  if (socket) {
    // La misma instancia: si se cayó y ya no reintenta, que vuelva a conectar.
    if (!socket.connected && !socket.active) socket.connect();
    return socket;
  }

  const created = io(SOCKET_URL, {
    // Función: cada reconexión usa el token vigente (vive en memoria y se renueva).
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    transports: ['websocket', 'polling'],
    // Sin tope de intentos: tras un corte largo (wifi del colegio) vuelve solo, espaciando hasta 30 s.
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  // Error de autenticación: pausar los reintentos hasta que la sesión se renueve
  // (updateSocketToken los reactiva). Con `io.opts.reconnection = false` no se pausaba nada.
  created.on('connect_error', (error) => {
    const message = error.message || '';
    if (isAuthError(message)) {
      console.warn('[socket] Sesión vencida: espera a renovar el token para reconectar.', message);
      created.io.reconnection(false);
    }
  });

  // El servidor cierra el socket si su token venció sin renovarse: renovar y volver a conectar.
  created.on('auth:expired', () => {
    void import('./session').then(async ({ refreshSession }) => {
      const fresh = await refreshSession();
      if (fresh && socket === created && !created.connected) created.connect();
    });
  });

  socket = created;
  watchers.forEach((watcher) => watcher(created));
  return created;
}

/**
 * Token nuevo: si el socket está conectado se renueva sin reconectar (no pierde sus salas);
 * si no, se vuelve a conectar con él.
 */
export function updateSocketToken(token: string): void {
  if (!socket) return;
  socket.io.reconnection(true);
  if (socket.connected) {
    socket.emit('auth:refresh', token);
  } else {
    socket.connect();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    watchers.forEach((watcher) => watcher(null));
  }
}
