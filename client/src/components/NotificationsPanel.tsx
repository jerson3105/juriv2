import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check, CheckCheck, Clock, XCircle } from 'lucide-react';
import { shopApi, type Notification } from '../lib/shopApi';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsPanel = ({ isOpen, onClose }: NotificationsPanelProps) => {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => shopApi.getNotifications(),
    enabled: isOpen,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  const markReadMutation = useMutation({
    mutationFn: shopApi.markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: shopApi.markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      toast.success('Todas las notificaciones marcadas como leídas');
    },
  });

  const approveUsageMutation = useMutation({
    mutationFn: (usageId: string) => shopApi.reviewUsage(usageId, 'APPROVED'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['pending-usages'] });
      toast.success('Uso de item aprobado');
    },
    onError: () => toast.error('Error al aprobar uso'),
  });

  const rejectUsageMutation = useMutation({
    mutationFn: (usageId: string) => shopApi.reviewUsage(usageId, 'REJECTED'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['pending-usages'] });
      toast.success('Uso de item rechazado');
    },
    onError: () => toast.error('Error al rechazar uso'),
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Bell className="text-indigo-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Notificaciones
              </h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={16} />
                  Marcar todas
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Lista de notificaciones */}
          <div className="overflow-y-auto h-[calc(100%-80px)]">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Bell size={48} className="mb-4 opacity-50" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markReadMutation.mutate(notification.id)}
                    onApproveUsage={(usageId) => {
                      approveUsageMutation.mutate(usageId);
                      markReadMutation.mutate(notification.id);
                    }}
                    onRejectUsage={(usageId) => {
                      rejectUsageMutation.mutate(usageId);
                      markReadMutation.mutate(notification.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Item de notificación individual
const NotificationItem = ({
  notification,
  onMarkRead,
  onApproveUsage,
  onRejectUsage,
}: {
  notification: Notification;
  onMarkRead: () => void;
  onApproveUsage?: (usageId: string) => void;
  onRejectUsage?: (usageId: string) => void;
}) => {
  const { user } = useAuthStore();
  const isTeacher = user?.role === 'TEACHER';
  
  const getIcon = () => {
    switch (notification.type) {
      case 'ITEM_USED':
        return '🧪';
      case 'GIFT_RECEIVED':
        return '🎁';
      case 'BATTLE_STARTED':
        return '⚔️';
      case 'LEVEL_UP':
        return '🎉';
      default:
        return '📢';
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} días`;
  };

  // Obtener usageId del data de la notificación
  const getUsageId = () => {
    if (!notification.data) return null;
    
    try {
      let data = notification.data;
      
      // Si es string, parsearlo (puede estar doblemente serializado)
      if (typeof data === 'string') {
        data = JSON.parse(data);
        // Verificar si sigue siendo string (doble serialización)
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
      }
      
      return (data as any)?.usageId || null;
    } catch {
      return null;
    }
  };

  const usageId = getUsageId();
  const showItemActions = notification.type === 'ITEM_USED' && isTeacher && usageId && !notification.isRead;

  return (
    <div
      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
        !notification.isRead ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {notification.title}
            </h3>
            {!notification.isRead && (
              <span className="w-2 h-2 bg-indigo-500 rounded-full" />
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <Clock size={12} />
            <span>{timeAgo(notification.createdAt)}</span>
          </div>
          
          {/* Botones de aprobar/rechazar para ITEM_USED */}
          {showItemActions && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onApproveUsage?.(usageId)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Check size={14} />
                Aprobar
              </button>
              <button
                onClick={() => onRejectUsage?.(usageId)}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
              >
                <XCircle size={14} />
                Rechazar
              </button>
            </div>
          )}
        </div>
        {!notification.isRead && !showItemActions && (
          <button
            onClick={onMarkRead}
            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded"
            title="Marcar como leída"
          >
            <Check size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

// Botón de notificaciones para el header
export const NotificationsBell = ({ onClick }: { onClick: () => void }) => {
  const { data: count = 0 } = useQuery({
    queryKey: ['unread-count'],
    queryFn: shopApi.getUnreadCount,
    refetchInterval: 30000,
  });

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
    >
      <Bell size={20} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
};
