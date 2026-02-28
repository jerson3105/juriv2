import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Megaphone, Clock, ChevronUp, Loader2, MessageSquare } from 'lucide-react';
import { announcementApi } from '../../lib/announcementApi';
import toast from 'react-hot-toast';

export const AnnouncementsPage = () => {
  const { id: classroomId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', classroomId, page],
    queryFn: () => announcementApi.list(classroomId!, page),
    enabled: !!classroomId,
  });

  const sendMutation = useMutation({
    mutationFn: (msg: string) => announcementApi.create(classroomId!, msg),
    onSuccess: () => {
      setMessage('');
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ['announcements', classroomId] });
      toast.success('Aviso enviado');
      // Scroll to bottom after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Error al enviar aviso');
    },
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Reverse the announcements so oldest are at the top (chat style)
  const announcements = [...(data?.announcements || [])].reverse();
  const hasMore = data ? data.total > page * data.limit : false;

  const loadMore = () => {
    if (hasMore) {
      setPage(p => p + 1);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white shadow-md">
          <Megaphone size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Avisos a Padres</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Los padres de familia recibirán tus avisos en tiempo real
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 min-h-0"
      >
        {/* Load more button */}
        {hasMore && (
          <button
            onClick={loadMore}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <ChevronUp size={16} />
            Cargar anteriores
          </button>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <MessageSquare size={48} className="mb-3 opacity-50" />
            <p className="text-lg font-medium">Sin avisos aún</p>
            <p className="text-sm mt-1">Escribe tu primer aviso para los padres de familia</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {announcements.map((announcement) => (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end"
              >
                <div className="max-w-[85%] bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-sm">
                  <p className="text-sm whitespace-pre-wrap break-words">{announcement.message}</p>
                  <div className="flex items-center justify-end gap-1 mt-1.5">
                    <Clock size={11} className="text-white/60" />
                    <span className="text-[11px] text-white/60">{formatDate(announcement.createdAt)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="mt-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un aviso para los padres..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent max-h-32"
            style={{ minHeight: '42px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex items-center justify-center hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {sendMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5 ml-1">
          Presiona Enter para enviar · Shift+Enter para salto de línea
        </p>
      </div>
    </div>
  );
};
