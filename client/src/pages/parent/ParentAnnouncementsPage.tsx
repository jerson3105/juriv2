import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Megaphone, Clock, ChevronUp, Loader2, MessageSquare, User } from 'lucide-react';
import { announcementApi, type Announcement } from '../../lib/announcementApi';
import { getSocket } from '../../lib/socket';
import { useSelectedClassroom } from '../../contexts/SelectedClassroomContext';

// ── helpers ──

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
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

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// ── component ──

const ParentAnnouncementsPage = () => {
  const { classroomId: paramClassroomId } = useParams<{ classroomId: string }>();
  const { selected } = useSelectedClassroom();
  const classroomId = paramClassroomId || selected?.classroomId;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInitScroll = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', classroomId, page],
    queryFn: () => announcementApi.list(classroomId!, page),
    enabled: !!classroomId,
  });

  // Auto-scroll to bottom on first load
  useEffect(() => {
    if (data && !didInitScroll.current) {
      didInitScroll.current = true;
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    }
  }, [data]);

  // Auto mark announcements as read when parent views the page
  const didMarkRead = useRef(false);
  useEffect(() => {
    if (data && classroomId && data.announcements.length > 0 && !didMarkRead.current) {
      didMarkRead.current = true;
      announcementApi.markRead(classroomId).catch(() => {});
    }
  }, [data, classroomId]);

  // Listen for real-time announcements via socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !classroomId) return;

    const handleNewAnnouncement = (announcement: Announcement) => {
      if (announcement.classroomId === classroomId) {
        queryClient.invalidateQueries({ queryKey: ['announcements', classroomId] });
        // Mark new announcement as read since parent is viewing this page
        announcementApi.markRead(classroomId).catch(() => {});
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
      }
    };

    socket.on('announcement:new', handleNewAnnouncement);
    return () => { socket.off('announcement:new', handleNewAnnouncement); };
  }, [classroomId, queryClient]);

  // Reverse so oldest is at top, newest at bottom
  const chronological = [...(data?.announcements || [])].reverse();
  const hasMore = data ? data.total > page * data.limit : false;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Avisos de clase</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selected?.classroomName ? `${selected.classroomName} · ${selected.teacherName}` : 'Mensajes del profesor'}
          </p>
        </div>
      </div>

      {/* Chat container — fixed height, internal scroll */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-gray-400" size={28} />
          </div>
        ) : chronological.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare size={48} className="mb-3 opacity-50" />
            <p className="text-lg font-medium">Sin avisos aún</p>
            <p className="text-sm mt-1">El profesor aún no ha enviado avisos</p>
          </div>
        ) : (
          <>
            {/* Load older */}
            {hasMore && (
              <div className="flex justify-center mb-3">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full transition-colors"
                >
                  <ChevronUp size={14} />
                  Cargar anteriores
                </button>
              </div>
            )}

            {chronological.map((msg, idx) => {
              const prev = idx > 0 ? chronological[idx - 1] : null;
              const showDateSep = !prev || !isSameDay(prev.createdAt, msg.createdAt);
              const isGroupStart = !prev || prev.teacherName !== msg.teacherName || showDateSep;

              return (
                <div key={msg.id}>
                  {/* Date separator */}
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        {formatDayLabel(msg.createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>
                  )}

                  {/* Message */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={isGroupStart ? 'mt-3' : 'mt-1'}
                  >
                    {isGroupStart ? (
                      // First message of group — show avatar + name
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User size={14} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-gray-800 dark:text-white">
                              {msg.teacherName}
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                              <Clock size={10} />
                              {formatTime(msg.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Continuation — indented, no avatar
                      <div className="pl-[42px] flex items-start gap-2">
                        <p className="flex-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                          {msg.message}
                        </p>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 pt-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100" style={{ opacity: 1 }}>
                          <Clock size={10} />
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    )}
                  </motion.div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
};

export default ParentAnnouncementsPage;
