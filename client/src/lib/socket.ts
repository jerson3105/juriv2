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

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
