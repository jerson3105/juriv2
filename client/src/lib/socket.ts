import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket | null {
  const token = useAuthStore.getState().accessToken;
  if (!token) return null;

  // Already connected
  if (socket?.connected) return socket;

  // Disconnect stale socket if any
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    // Función: cada reconexión usa el token vigente (vive en memoria y se renueva).
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  // On auth errors, stop auto-reconnect — let the session refresh handle it.
  // updateSocketToken() will be called after a successful refresh to reconnect.
  socket.on('connect_error', (error) => {
    const msg = error.message || '';
    if (msg.includes('jwt expired') || msg.includes('401') || msg.includes('Token') || msg.includes('Authentication')) {
      console.warn('[socket] Auth error, pausing reconnect — waiting for token refresh:', msg);
      if (socket?.io.opts.reconnection) socket.io.opts.reconnection = false;
    }
  });

  // El servidor cierra el socket si su token venció sin renovarse: renovar y volver a conectar.
  socket.on('auth:expired', () => {
    void import('./session').then(async ({ refreshSession }) => {
      const fresh = await refreshSession();
      if (fresh && socket && !socket.connected) socket.connect();
    });
  });

  return socket;
}

/**
 * Token nuevo: si el socket está conectado se renueva sin reconectar (no pierde sus salas);
 * si no, se vuelve a conectar con él.
 */
export function updateSocketToken(token: string): void {
  if (!socket) return;
  socket.io.opts.reconnection = true;
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
  }
}
