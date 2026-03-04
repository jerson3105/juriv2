import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Megaphone, ChevronUp, Loader2, MessageSquare, Users, Wifi, Check, CheckCheck, X, Copy, UserCheck, UserX, CircleDot, ChevronRight } from 'lucide-react';
import { announcementApi, type ParentStats, type Announcement, type FamilyInfo } from '../../lib/announcementApi';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';

const MAX_CHARS = 500;
const GROUP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ── helpers ──

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
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function getReadTooltip(readCount: number, totalParents: number) {
  if (totalParents === 0) return null;
  if (readCount === 0) return 'Sin vistas aún';
  if (readCount >= totalParents) return 'Visto por todos';
  return `Visto por ${readCount} de ${totalParents} padres`;
}

/** Determine if two consecutive messages belong to the same visual group (<5 min apart). */
function isInSameGroup(a: Announcement, b: Announcement) {
  if (!isSameDay(a.createdAt, b.createdAt)) return false;
  const diff = Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return diff < GROUP_THRESHOLD_MS;
}

// ── Read-receipt icon with tooltip ──

function ReadReceipt({ readCount, totalParents }: { readCount: number; totalParents: number }) {
  const tooltip = getReadTooltip(readCount, totalParents);
  if (!tooltip) return null;

  const allRead = totalParents > 0 && readCount >= totalParents;
  const someRead = readCount > 0;

  return (
    <span className="relative group/tip cursor-default ml-1 inline-flex items-center">
      {allRead ? (
        <CheckCheck size={14} className="text-emerald-500" />
      ) : someRead ? (
        <CheckCheck size={14} className="text-gray-300 dark:text-gray-500" />
      ) : (
        <Check size={14} className="text-gray-300 dark:text-gray-500" />
      )}
      {/* Tooltip */}
      <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-700 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover/tip:opacity-100 z-10">
        {tooltip}
      </span>
    </span>
  );
}

// ── Families Panel Modal ──

const RELATIONSHIP_LABELS: Record<string, string> = {
  FATHER: 'Padre',
  MOTHER: 'Madre',
  TUTOR: 'Tutor',
  GUARDIAN: 'Tutor legal',
};

function FamiliesPanel({ classroomId, onClose }: { classroomId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['families', classroomId],
    queryFn: () => announcementApi.families(classroomId),
    enabled: !!classroomId,
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (code: string, studentId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(studentId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Familias de la clase</h2>
            {data && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {data.registered} de {data.total} familias registradas
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : !data || data.families.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Users size={40} className="mb-2 opacity-50" />
              <p className="text-sm">No hay estudiantes en esta clase</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.families.map((family) => (
                <FamilyRow
                  key={family.studentId}
                  family={family}
                  isCopied={copiedId === family.studentId}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function FamilyRow({ family, isCopied, onCopy }: {
  family: FamilyInfo;
  isCopied: boolean;
  onCopy: (code: string, studentId: string) => void;
}) {
  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors ${
      family.isRegistered
        ? 'bg-transparent'
        : 'bg-amber-50/50 dark:bg-amber-900/10'
    }`}>
      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
        family.isRegistered
          ? 'bg-emerald-100 dark:bg-emerald-900/30'
          : 'bg-gray-100 dark:bg-gray-700'
      }`}>
        {family.isRegistered ? (
          <UserCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
        ) : (
          <UserX size={15} className="text-gray-400 dark:text-gray-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
          Padre/madre de {family.studentName}
        </p>
        {family.isRegistered ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {family.parentName}
              {family.parentRelationship && ` · ${RELATIONSHIP_LABELS[family.parentRelationship] || family.parentRelationship}`}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">✓ Registrado</span>
            {family.isConnected && (
              <CircleDot size={10} className="text-emerald-500 flex-shrink-0" />
            )}
          </div>
        ) : (
          <div className="mt-1">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Sin registrar</p>
            {family.parentLinkCode ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Código:</span>
                <code className="text-[11px] font-mono font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  {family.parentLinkCode}
                </code>
                <button
                  onClick={() => onCopy(family.parentLinkCode!, family.studentId)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
                >
                  <Copy size={10} />
                  {isCopied ? (
                    <span className="text-emerald-500">¡Copiado!</span>
                  ) : (
                    <span>Copiar</span>
                  )}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic">Sin código asignado</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── component ──

export const AnnouncementsPage = () => {
  const { id: classroomId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [showFamilies, setShowFamilies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', classroomId, page],
    queryFn: () => announcementApi.list(classroomId!, page),
    enabled: !!classroomId,
  });

  // Parent stats query
  const { data: parentStats } = useQuery({
    queryKey: ['parent-stats', classroomId],
    queryFn: () => announcementApi.parentStats(classroomId!),
    enabled: !!classroomId,
    refetchInterval: 30000,
  });

  // Listen for real-time parent stats + read updates via socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !classroomId) return;

    const handleParentStats = (stats: ParentStats) => {
      queryClient.setQueryData(['parent-stats', classroomId], stats);
    };

    const handleReadUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', classroomId] });
    };

    socket.on('announcement:parent_stats', handleParentStats);
    socket.on('announcement:read_update', handleReadUpdate);
    return () => {
      socket.off('announcement:parent_stats', handleParentStats);
      socket.off('announcement:read_update', handleReadUpdate);
    };
  }, [classroomId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: (msg: string) => announcementApi.create(classroomId!, msg),
    onSuccess: () => {
      setMessage('');
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ['announcements', classroomId] });
      toast.success('Aviso enviado');
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

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) {
      setMessage(val);
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

  const charCount = message.length;
  const remaining = MAX_CHARS - charCount;
  const showCounter = charCount > 0;
  const isWarning = remaining <= 50;

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white shadow-md">
          <Megaphone size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Avisos a Padres</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Los padres de familia recibirán tus avisos en tiempo real
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Los padres con cuenta activa reciben una notificación cuando enviás un aviso.
          </p>
        </div>
      </div>

      {/* Parent stats indicator — clickable to open families panel */}
      <div className="mb-3 mt-2">
        {parentStats ? (
          parentStats.registeredParents === 0 ? (
            <button
              onClick={() => setShowFamilies(true)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors cursor-pointer text-left"
            >
              <Users size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 flex-1">
                Ningún padre registrado aún. Los avisos se entregarán cuando se registren.
              </p>
              <ChevronRight size={14} className="text-amber-400 flex-shrink-0" />
            </button>
          ) : (
            <button
              onClick={() => setShowFamilies(true)}
              className="w-full flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-1.5">
                <Users size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {parentStats.registeredParents} de {parentStats.totalStudents} padres registrados
                </span>
              </div>
              <div className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
              <div className="flex items-center gap-1.5">
                <Wifi size={12} className={parentStats.connectedParents > 0 ? 'text-emerald-500' : 'text-gray-400'} />
                <span className={`text-xs ${parentStats.connectedParents > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                  {parentStats.connectedParents} conectado{parentStats.connectedParents !== 1 ? 's' : ''} ahora
                </span>
              </div>
              <ChevronRight size={14} className="text-gray-400 flex-shrink-0 ml-auto" />
            </button>
          )
        ) : (
          <div className="h-9" />
        )}
      </div>

      {/* Families panel modal */}
      <AnimatePresence>
        {showFamilies && classroomId && (
          <FamiliesPanel classroomId={classroomId} onClose={() => setShowFamilies(false)} />
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 min-h-0"
      >
        {/* Load more button */}
        {hasMore && (
          <button
            onClick={loadMore}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors mb-2"
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
            {announcements.map((announcement, idx) => {
              const prev = idx > 0 ? announcements[idx - 1] : null;
              const next = idx < announcements.length - 1 ? announcements[idx + 1] : null;

              // Date separator: show if first message or different day from previous
              const showDateSep = !prev || !isSameDay(prev.createdAt, announcement.createdAt);

              // Grouping: consecutive messages within 5 min
              const groupedWithPrev = prev && !showDateSep && isInSameGroup(prev, announcement);
              const groupedWithNext = next && isSameDay(announcement.createdAt, next.createdAt) && isInSameGroup(announcement, next);
              const isLastInGroup = !groupedWithNext;

              // Border-radius: reduce bottom-right on non-last bubbles in a group
              const bubbleRadius = groupedWithNext
                ? 'rounded-2xl rounded-br-sm'
                : 'rounded-2xl rounded-br-md';

              return (
                <div key={announcement.id}>
                  {/* Date separator */}
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-4 first:mt-0">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        {formatDayLabel(announcement.createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>
                  )}

                  {/* Message bubble */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col items-end ${groupedWithPrev ? 'mt-0.5' : 'mt-3'}`}
                  >
                    <div className={`max-w-[85%] bg-gradient-to-br from-cyan-500 to-blue-600 text-white ${bubbleRadius} px-4 py-2.5 shadow-sm`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{announcement.message}</p>
                      {/* Timestamp + read icon — only on last message of group */}
                      {isLastInGroup && (
                        <div className="flex items-center justify-end gap-0.5 mt-1 -mb-0.5">
                          <span className="text-[11px] text-white/60">{formatTime(announcement.createdAt)}</span>
                          <ReadReceipt readCount={announcement.readCount} totalParents={announcement.totalParents} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="mt-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un aviso para los padres..."
            rows={1}
            maxLength={MAX_CHARS}
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
        <div className="flex items-center justify-between mt-1.5 ml-1">
          <p className="text-[11px] text-gray-400">
            Presiona Enter para enviar · Shift+Enter para salto de línea
          </p>
          {showCounter && (
            <span className={`text-[11px] font-medium tabular-nums ${isWarning ? 'text-amber-500' : 'text-gray-400'}`}>
              {charCount} / {MAX_CHARS}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
