import { useState, useRef, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MessageCircle,
  Users,
  Wifi,
  Lock,
  Unlock,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { chatApi, type ChatMessage, type ChatSettings } from '../../lib/chatApi';
import { announcementApi, type ParentStats } from '../../lib/announcementApi';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';
import type { Classroom } from '../../lib/classroomApi';
import toast from 'react-hot-toast';

const GROUP_THRESHOLD_MS = 5 * 60 * 1000;

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatDayLabel(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function isInSameGroup(a: ChatMessage, b: ChatMessage) {
  if (a.senderId !== b.senderId) return false;
  if (!isSameDay(a.createdAt, b.createdAt)) return false;
  const diff = Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return diff < GROUP_THRESHOLD_MS;
}

export const ClassroomChatPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['chat-messages', classroom.id],
    queryFn: () => chatApi.getMessages(classroom.id),
    refetchInterval: 30000,
  });

  const { data: settings } = useQuery<ChatSettings>({
    queryKey: ['chat-settings', classroom.id],
    queryFn: () => chatApi.getSettings(classroom.id),
  });

  const { data: parentStats } = useQuery<ParentStats>({
    queryKey: ['parent-stats', classroom.id],
    queryFn: () => announcementApi.parentStats(classroom.id),
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => chatApi.sendMessage(classroom.id, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', classroom.id] });
      setInput('');
      setShouldAutoScroll(true);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Error al enviar mensaje');
    },
    onSettled: () => setIsSending(false),
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) => chatApi.deleteMessage(classroom.id, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', classroom.id] });
      setDeleteConfirm(null);
      toast.success('Mensaje eliminado');
    },
  });

  const toggleChatMutation = useMutation({
    mutationFn: (isOpen: boolean) => chatApi.updateSettings(classroom.id, isOpen),
    onSuccess: (data) => {
      queryClient.setQueryData(['chat-settings', classroom.id], data);
      toast.success(data.isOpen ? 'Chat abierto' : 'Chat cerrado');
    },
  });

  // Socket.io real-time
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join-chat', classroom.id);

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.classroomId !== classroom.id) return;
      queryClient.setQueryData<ChatMessage[]>(['chat-messages', classroom.id], (old = []) => {
        if (old.some(m => m.id === msg.id)) return old;
        return [...old, msg];
      });
      setShouldAutoScroll(true);
    };

    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      queryClient.setQueryData<ChatMessage[]>(['chat-messages', classroom.id], (old = []) =>
        old.map(m => m.id === messageId ? { ...m, message: null, isDeleted: true } : m)
      );
    };

    const handleStatusChanged = (newSettings: ChatSettings) => {
      queryClient.setQueryData(['chat-settings', classroom.id], newSettings);
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:message_deleted', handleMessageDeleted);
    socket.on('chat:status_changed', handleStatusChanged);

    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:message_deleted', handleMessageDeleted);
      socket.off('chat:status_changed', handleStatusChanged);
      socket.emit('leave-chat', classroom.id);
    };
  }, [classroom.id, queryClient]);

  // Auto-scroll
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldAutoScroll]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    sendMutation.mutate(trimmed);
  }, [input, isSending, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOpen = settings?.isOpen !== false;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[800px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800 dark:text-white">Chat grupal con padres</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Los padres registrados pueden escribir y leer los mensajes del grupo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {parentStats && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full">
              <Users size={14} />
              <span>{parentStats.registeredParents} de {parentStats.totalStudents} registrados</span>
              <span className="text-gray-300">·</span>
              <Wifi size={12} className="text-emerald-500" />
              <span>{parentStats.connectedParents} conectados</span>
            </div>
          )}
          <button
            onClick={() => toggleChatMutation.mutate(!isOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isOpen
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800'
                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800'
            }`}
          >
            {isOpen ? <Lock size={14} /> : <Unlock size={14} />}
            {isOpen ? 'Cerrar chat' : 'Abrir chat'}
          </button>
        </div>
      </div>

      {/* Chat closed banner */}
      {!isOpen && (
        <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            El chat está cerrado. Los padres no pueden escribir en este momento.
          </span>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-gray-900 space-y-1"
        onScroll={() => {
          const el = scrollContainerRef.current;
          if (el) {
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            setShouldAutoScroll(atBottom);
          }
        }}
      >
        {loadingMessages ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aún no hay mensajes</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Escribe el primer mensaje para iniciar la conversación con los padres
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const next = idx < messages.length - 1 ? messages[idx + 1] : null;
            const showDateSep = !prev || !isSameDay(prev.createdAt, msg.createdAt);
            const isGroupedWithPrev = prev && isInSameGroup(prev, msg);
            const isGroupedWithNext = next && isInSameGroup(msg, next);
            const isTeacher = msg.senderRole === 'TEACHER';
            const isOwnMessage = msg.senderId === user?.id;

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-2">
                      {formatDayLabel(msg.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>
                )}

                <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isGroupedWithPrev ? 'mt-0.5' : 'mt-3'}`}>
                  <div className={`group relative max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    {/* Sender name — only for first in group */}
                    {!isGroupedWithPrev && !isOwnMessage && (
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                          isTeacher ? 'bg-indigo-500' : 'bg-emerald-500'
                        }`}>
                          {msg.senderName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {msg.senderName}
                          {msg.childName && (
                            <span className="text-gray-400 dark:text-gray-500 font-normal"> — padre de {msg.childName}</span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className={`relative px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                      msg.isDeleted
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 italic border border-gray-200 dark:border-gray-700'
                        : isOwnMessage
                          ? 'bg-indigo-600 text-white'
                          : isTeacher
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 border border-indigo-200 dark:border-indigo-800'
                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                    } ${
                      isOwnMessage
                        ? isGroupedWithPrev ? 'rounded-tr-md' : ''
                        : isGroupedWithPrev ? 'rounded-tl-md' : ''
                    }`}>
                      {msg.isDeleted ? (
                        <span>Mensaje eliminado por el profesor</span>
                      ) : (
                        <span className="whitespace-pre-wrap break-words">{msg.message}</span>
                      )}

                      {/* Delete button (teacher hover) */}
                      {!msg.isDeleted && !isOwnMessage && (
                        <button
                          onClick={() => setDeleteConfirm(msg.id)}
                          className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                          title="Eliminar mensaje"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Timestamp — only for last in group */}
                    {!isGroupedWithNext && (
                      <div className={`text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                        {formatTime(msg.createdAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !isOpen
                  ? 'El chat está cerrado. Abrilo para que los padres puedan escribir.'
                  : 'Escribe un mensaje para el grupo...'
              }
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400 max-h-32"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">
          Presiona Enter para enviar · Shift+Enter para salto de línea
        </p>
      </div>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-gray-800 dark:text-white mb-2">¿Eliminar este mensaje?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Esta acción no se puede deshacer. El mensaje será reemplazado por "Mensaje eliminado por el profesor".
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
