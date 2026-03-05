import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  MessageCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { chatApi, type ChatMessage, type ChatSettings } from '../../lib/chatApi';
import { useAuthStore } from '../../store/authStore';
import { useSelectedClassroom } from '../../contexts/SelectedClassroomContext';
import { getSocket } from '../../lib/socket';
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
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < GROUP_THRESHOLD_MS;
}

export default function ParentGroupChatPage() {
  const { classroomId: paramClassroomId } = useParams<{ classroomId: string }>();
  const { selected } = useSelectedClassroom();
  const classroomId = paramClassroomId || selected?.classroomId;
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', classroomId],
    queryFn: () => chatApi.getMessages(classroomId!, 50),
    enabled: !!classroomId,
    refetchInterval: 30000,
  });

  const { data: settings } = useQuery<ChatSettings>({
    queryKey: ['chat-settings', classroomId],
    queryFn: () => chatApi.getSettings(classroomId!),
    enabled: !!classroomId,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => chatApi.sendMessage(classroomId!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', classroomId] });
      setInput('');
      setShouldAutoScroll(true);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Error al enviar mensaje');
    },
    onSettled: () => setIsSending(false),
  });

  // Socket.io real-time
  useEffect(() => {
    if (!classroomId) return;
    const socket = getSocket();
    if (!socket) return;

    // Parents are auto-joined to chat room on connect, but emit join-chat as a safety measure
    socket.emit('join-chat', classroomId);

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.classroomId !== classroomId) return;
      queryClient.setQueryData<ChatMessage[]>(['chat-messages', classroomId], (old = []) => {
        if (old.some(m => m.id === msg.id)) return old;
        return [...old, msg];
      });
      setShouldAutoScroll(true);
    };

    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      queryClient.setQueryData<ChatMessage[]>(['chat-messages', classroomId], (old = []) =>
        old.map(m => m.id === messageId ? { ...m, message: null, isDeleted: true } : m)
      );
    };

    const handleStatusChanged = (newSettings: ChatSettings) => {
      queryClient.setQueryData(['chat-settings', classroomId], newSettings);
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:message_deleted', handleMessageDeleted);
    socket.on('chat:status_changed', handleStatusChanged);

    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:message_deleted', handleMessageDeleted);
      socket.off('chat:status_changed', handleStatusChanged);
    };
  }, [classroomId, queryClient]);

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
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-xl">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 dark:text-white">Chat grupal</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Profesor y padres de la clase</p>
        </div>
      </div>

      {/* Closed banner */}
      {!isOpen && (
        <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
          <Lock size={16} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            El profesor ha cerrado el chat temporalmente.
          </span>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-gray-900 space-y-1"
        onScroll={() => {
          const el = scrollContainerRef.current;
          if (el) {
            setShouldAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
          }
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Aún no hay mensajes</p>
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
                  <div className={`max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    {!isGroupedWithPrev && !isOwnMessage && (
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                          isTeacher ? 'bg-indigo-500' : 'bg-emerald-500'
                        }`}>
                          {msg.senderName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {isTeacher ? (
                            <><span className="text-indigo-600 dark:text-indigo-400">Profesor</span> · {msg.senderName}</>
                          ) : (
                            <>
                              {msg.senderName}
                              {msg.childName && (
                                <span className="text-gray-400 dark:text-gray-500 font-normal"> — padre de {msg.childName}</span>
                              )}
                            </>
                          )}
                        </span>
                      </div>
                    )}

                    <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                      msg.isDeleted
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 italic border border-gray-200 dark:border-gray-700'
                        : isOwnMessage
                          ? 'bg-blue-500 text-white'
                          : isTeacher
                            ? 'bg-indigo-600 text-white'
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
                    </div>

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

      {/* Input */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
        {!isOpen ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-2.5">
            <Lock size={14} />
            El profesor ha cerrado el chat temporalmente.
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 max-h-32"
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
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Presiona Enter para enviar · Shift+Enter para salto de línea
            </p>
          </>
        )}
      </div>
    </div>
  );
}
