import { useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CalendarCheck, Loader2, RotateCcw, ShoppingBag, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { historyApi, type ActivityLogEntry } from '../../../lib/historyApi';
import { activityKey, errorMessage } from './profileHelpers';

type Filter = 'ALL' | 'POINTS' | 'BADGE' | 'PURCHASE' | 'ATTENDANCE';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'Todo' },
  { id: 'POINTS', label: 'Puntos' },
  { id: 'BADGE', label: 'Insignias' },
  { id: 'PURCHASE', label: 'Compras' },
  { id: 'ATTENDANCE', label: 'Asistencia' },
];
const PAGE = 20;
const ATTENDANCE_LABEL: Record<string, string> = { PRESENT: 'Presente', LATE: 'Tardanza', ABSENT: 'Falta', EXCUSED: 'Justificada' };
const MULTIPLIER_LABEL: Record<number, string> = { 500: '½', 250: '¼', 125: '⅛' };

const describe = (entry: ActivityLogEntry) => {
  const d = entry.details;
  if (entry.type === 'POINTS') {
    const sign = d.action === 'REMOVE' ? '−' : '+';
    const parts = [
      d.xpAmount ? `${sign}${d.xpAmount} XP` : null,
      d.hpAmount ? `${sign}${d.hpAmount} HP` : null,
      d.gpAmount ? `${sign}${d.gpAmount} GP` : null,
    ].filter(Boolean);
    if (parts.length === 0 && d.amount) parts.push(`${sign}${d.amount} ${d.pointType ?? ''}`.trim());
    const partial = d.multiplier && d.multiplier !== 1000 ? ` (${MULTIPLIER_LABEL[d.multiplier] ?? `${d.multiplier / 1000}×`})` : '';
    return { title: d.reason || 'Puntos', amount: parts.join(' · ') + partial, positive: d.action !== 'REMOVE' };
  }
  if (entry.type === 'BADGE') return { title: `${d.badgeIcon ?? '🏅'} Insignia: ${d.badgeName ?? ''}`, amount: '', positive: true };
  if (entry.type === 'PURCHASE') return { title: `Compró ${d.itemName ?? 'un objeto'}`, amount: d.totalPrice ? `−${d.totalPrice} GP` : '', positive: false };
  if (entry.type === 'ITEM_USED') return { title: `Usó ${d.itemName ?? 'un objeto'}`, amount: '', positive: true };
  if (entry.type === 'LEVEL_UP') return { title: `Subió al nivel ${d.newLevel}`, amount: '', positive: true };
  return { title: `Asistencia: ${ATTENDANCE_LABEL[d.attendanceStatus ?? ''] ?? d.attendanceStatus}`, amount: '', positive: d.attendanceStatus !== 'ABSENT' };
};

const iconOf = (entry: ActivityLogEntry, positive: boolean) => {
  if (entry.type === 'POINTS') return positive ? <TrendingUp size={18} aria-hidden="true" /> : <TrendingDown size={18} aria-hidden="true" />;
  if (entry.type === 'BADGE') return <Award size={18} aria-hidden="true" />;
  if (entry.type === 'PURCHASE') return <ShoppingBag size={18} aria-hidden="true" />;
  if (entry.type === 'ATTENDANCE') return <CalendarCheck size={18} aria-hidden="true" />;
  return <Sparkles size={18} aria-hidden="true" />;
};

const canUndo = (entry: ActivityLogEntry): entry is ActivityLogEntry & { type: 'POINTS' | 'BADGE' | 'ATTENDANCE' } =>
  !entry.isReverted && (entry.type === 'POINTS' || entry.type === 'BADGE' || entry.type === 'ATTENDANCE');

export const ActivityTab = ({ classroomId, studentId }: { classroomId: string; studentId: string }) => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [undoing, setUndoing] = useState<string | null>(null);

  // Paginación por cursor: sin tope de profundidad (el total por desplazamiento no era real).
  const query = useInfiniteQuery({
    queryKey: activityKey(classroomId, studentId, filter),
    queryFn: ({ pageParam }) => historyApi.getFeed(classroomId, { studentId, type: filter, limit: PAGE, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
  });
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];

  const undo = async (entry: ActivityLogEntry & { type: 'POINTS' | 'BADGE' | 'ATTENDANCE' }, title: string) => {
    setUndoing(entry.id);
    try {
      await historyApi.revertEntry(entry.type, entry.id);
      toast.success(`Deshecho: ${title}`);
      queryClient.invalidateQueries({ queryKey: ['student-activity', classroomId, studentId] });
      queryClient.invalidateQueries({ queryKey: ['student-summary', classroomId, studentId] });
      queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      queryClient.invalidateQueries({ queryKey: ['student-badges', studentId] });
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo deshacer'));
    } finally {
      setUndoing(null);
    }
  };

  return (
    <section aria-labelledby="activity-title" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="activity-title" className="text-base font-bold text-gray-900 dark:text-white">
          Registro de actividad
        </h2>
        <div role="radiogroup" aria-label="Filtrar registro" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}
              className={`min-h-[36px] rounded-full px-3 text-sm font-semibold ${filter === f.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary-600" aria-label="Cargando registro" /></div>
      ) : query.isError ? (
        <p className="py-8 text-center text-sm text-gray-700 dark:text-gray-300">No se pudo cargar el registro.</p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-700 dark:text-gray-300">Sin actividad {filter === 'ALL' ? 'registrada' : 'de este tipo'}.</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {entries.map((entry) => {
              const info = describe(entry);
              return (
                <li key={`${entry.type}-${entry.id}-${entry.key}`} className={`flex items-center gap-3 py-2.5 ${entry.isReverted ? 'opacity-70' : ''}`}>
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${info.positive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'}`}>
                    {iconOf(entry, info.positive)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold text-gray-900 dark:text-white ${entry.isReverted ? 'line-through' : ''}`}>{info.title}</span>
                    <span className="block text-xs text-gray-700 dark:text-gray-300">
                      {new Date(entry.timestamp).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {entry.isReverted && ' · Deshecho'}
                    </span>
                  </span>
                  {info.amount && (
                    <span className={`flex-shrink-0 text-sm font-bold tabular-nums ${info.positive ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>{info.amount}</span>
                  )}
                  {canUndo(entry) && (
                    <button type="button" onClick={() => undo(entry, info.title)} disabled={undoing !== null}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
                      aria-label={`Deshacer: ${info.title}`} title="Deshacer">
                      <RotateCcw size={16} className={undoing === entry.id ? 'animate-spin' : ''} aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300">{query.hasNextPage ? `Mostrando ${entries.length}` : `${entries.length} en total`}</p>
            {query.hasNextPage && (
              <button type="button" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                {query.isFetchingNextPage && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Cargar más
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
};
