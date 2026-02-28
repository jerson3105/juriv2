import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { shopApi } from '../lib/shopApi';

interface NotificationContextValue {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  setUnreadCount: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { isAuthenticated, accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const initialFetchDone = useRef(false);

  // Initial fetch of unread count on mount (once)
  useEffect(() => {
    if (!isAuthenticated || initialFetchDone.current) return;
    initialFetchDone.current = true;

    shopApi.getUnreadCount().then(count => {
      setUnreadCount(count);
    }).catch(() => {
      // Silently fail — will be updated by socket
    });
  }, [isAuthenticated]);

  // Socket connection + listener
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket();
      setUnreadCount(0);
      initialFetchDone.current = false;
      return;
    }

    const socket = connectSocket();
    if (!socket) return;

    const handleUnreadCount = (data: { count: number }) => {
      setUnreadCount(data.count);
    };

    socket.on('notification:unread_count', handleUnreadCount);

    // Refetch on reconnect in case we missed events
    const handleConnect = () => {
      shopApi.getUnreadCount().then(count => setUnreadCount(count)).catch(() => {});
    };
    socket.on('connect', handleConnect);

    return () => {
      socket.off('notification:unread_count', handleUnreadCount);
      socket.off('connect', handleConnect);
    };
  }, [isAuthenticated, accessToken]);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  // Optimistic update helper — also invalidates notification list queries
  const setUnreadCountOptimistic = useCallback((count: number) => {
    setUnreadCount(count);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount: setUnreadCountOptimistic }}>
      {children}
    </NotificationContext.Provider>
  );
}
