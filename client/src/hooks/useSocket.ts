import { useCallback, useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, watchSocket } from '../lib/socket';

const subscribe = (onChange: () => void) => watchSocket(() => onChange());

/** El socket de la sesión (o null): cambia solo al iniciar o cerrar sesión. */
export function useSocket(): Socket | null {
  return useSyncExternalStore(subscribe, getSocket, () => null);
}

/** ¿Hay conexión en vivo? Sirve para recargar por intervalo solo mientras el socket está caído. */
export function useSocketConnected(): boolean {
  const socket = useSocket();
  const subscribeConnection = useCallback((onChange: () => void) => {
    if (!socket) return () => {};
    socket.on('connect', onChange);
    socket.on('disconnect', onChange);
    return () => {
      socket.off('connect', onChange);
      socket.off('disconnect', onChange);
    };
  }, [socket]);
  return useSyncExternalStore(subscribeConnection, () => !!socket?.connected, () => false);
}
