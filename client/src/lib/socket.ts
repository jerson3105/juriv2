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
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  // On auth errors, stop auto-reconnect — let axios interceptor handle the refresh.
  // updateSocketToken() will be called after a successful refresh to reconnect.
  socket.on('connect_error', (error) => {
    const msg = error.message || '';
    if (msg.includes('jwt expired') || msg.includes('401') || msg.includes('Token')) {
      console.warn('[socket] Auth error, pausing reconnect — waiting for token refresh:', msg);
      socket?.io.opts.reconnection && (socket.io.opts.reconnection = false);
    }
  });

  return socket;
}

export function updateSocketToken(token: string): void {
  if (!socket) return;

  // Re-enable reconnection and set new token
  socket.io.opts.reconnection = true;
  socket.auth = { token };

  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
