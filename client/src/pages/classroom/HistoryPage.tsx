import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ScrollText, Settings2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { historyApi, type FeedEntry, type FeedType } from '../../lib/historyApi';
import { useAuthStore } from '../../store/authStore';
import { ActivityFeed, RevertDialog, type RevertTarget } from '../../components/history/ActivityFeed';
import {
  feedKey, groupFeed, localDateString, PERIOD_LABEL, PERIODS, periodParams, summaryKey, TYPE_FILTERS, type PeriodKey,
} from '../../components/history/historyHelpers';
import { inputClass, labelClass } from '../../components/home/homeHelpers';

const PAGE_SIZE = 30;

interface ClassroomStudent {
  id: string;
  characterName?: string | null;
  realName?: string | null;
  realLastName?: string | null;
}

const chip = (active: boolean) =>
  `min-h-[40px] flex-shrink-0 rounded-full px-3.5 text-sm font-semibold ${active
    ? 'bg-primary-600 text-white'
    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'}`;

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export const HistoryPage = () => {
  const { classroom } = useOutletContext<{ classroom: { id: string; showCharacterName?: boolean; students?: ClassroomStudent[] } }>();
  const classroomId = classroom?.id;
  const viewerId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const [type, setType] = useState<FeedType>('ALL');
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [studentId, setStudentId] = useState('');
  const [target, setTarget] = useState<RevertTarget | null>(null);
  const [reverting, setReverting] = useState(false);

  // Nombre según la configuración de la clase (personaje o nombre real).
  const students = useMemo(() => {
    const showCharacter = classroom?.showCharacterName !== false;
    return (classroom?.students ?? [])
      .map((s) => ({
        id: s.id,
        name: (!showCharacter && [s.realName, s.realLastName].filter(Boolean).join(' ')) || s.characterName || 'Sin nombre',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [classroom?.students, classroom?.showCharacterName]);
  const nameById = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students]);
  const nameOf = (entry: FeedEntry) => nameById.get(entry.studentId) ?? entry.studentName ?? 'Estudiante';

  const today = localDateString();
  const range = useMemo(() => periodParams(period, custom, today), [period, custom, today]);
  const filters = useMemo(() => ({ ...range, studentId: studentId || undefined }), [range, studentId]);
  const invalidRange = range === null;

  const feed = useInfiniteQuery({
    queryKey: feedKey(classroomId, type, filters),
    queryFn: ({ pageParam }) => historyApi.getFeed(classroomId, { ...filters, type, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: !!classroomId && !invalidRange,
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: summaryKey(classroomId, filters),
    queryFn: () => historyApi.getSummary(classroomId, filters),
    enabled: !!classroomId && !invalidRange,
    placeholderData: keepPreviousData,
  });

  const entries = useMemo(() => feed.data?.pages.flatMap((p) => p.entries) ?? [], [feed.data]);
  const days = useMemo(() => groupFeed(entries), [entries]);
  const filtered = type !== 'ALL' || period !== 'all' || !!studentId;

  const clearFilters = () => {
    setType('ALL');
    setPeriod('all');
    setCustom({ from: '', to: '' });
    setStudentId('');
  };

  const refreshAfterRevert = () => {
    for (const key of ['history-feed', 'history-summary', 'history', 'history-stats', 'classroom', 'students', 'student-summary', 'student-activity']) {
      queryClient.invalidateQueries({ queryKey: [key, classroomId] });
    }
  };

  const confirmRevert = async () => {
    if (!target || reverting) return;
    setReverting(true);
    try {
      const result = target.kind === 'single'
        ? await historyApi.revertEntry(target.entry.type, target.entry.id)
        : await historyApi.revertBatch(classroomId, target.entries.map((e) => e.id));
      toast.success(result.message || 'Acción revertida');
      setTarget(null);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo revertir'));
    } finally {
      setReverting(false);
      refreshAfterRevert();
    }
  };

  const stats = [
    { label: 'XP otorgado', value: summary.data ? `+${summary.data.xpGiven}` : '—', tone: 'text-emerald-800 dark:text-emerald-300' },
    { label: 'XP quitado', value: summary.data ? `−${summary.data.xpRemoved}` : '—', tone: 'text-red-800 dark:text-red-300' },
    { label: 'Insignias', value: summary.data?.badges ?? '—', tone: 'text-gray-900 dark:text-white' },
    { label: 'Compras', value: summary.data?.purchases ?? '—', tone: 'text-gray-900 dark:text-white' },
    { label: 'Objetos usados', value: summary.data?.itemsUsed ?? '—', tone: 'text-gray-900 dark:text-white' },
  ];

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
            <ScrollText size={22} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Registro de actividad</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">Qué pasó en la clase, cuándo y quién lo hizo. Puedes revertir puntos, insignias y asistencia.</p>
          </div>
        </div>
        <Link to={`/classroom/${classroomId}/settings/riesgo`}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800">
          <Settings2 size={16} aria-hidden="true" /> Borrar datos de la clase
        </Link>
      </div>

      {/* Filtros */}
      <section aria-label="Filtros del registro" className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div role="radiogroup" aria-label="Tipo de actividad" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {TYPE_FILTERS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={type === f.id} onClick={() => setType(f.id)} className={chip(type === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-80">
            <p id="period-label" className={labelClass}>Periodo</p>
            <div role="radiogroup" aria-labelledby="period-label" className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {PERIODS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={period === p.id} onClick={() => setPeriod(p.id)} className={chip(period === p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full sm:w-64">
            <label htmlFor="history-student" className={labelClass}>Alumno</label>
            <select id="history-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">Todos los alumnos</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="history-from" className={labelClass}>Desde</label>
              <input id="history-from" type="date" value={custom.from} max={custom.to || today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className={`${inputClass} mt-1`} />
            </div>
            <div>
              <label htmlFor="history-to" className={labelClass}>Hasta</label>
              <input id="history-to" type="date" value={custom.to} min={custom.from || undefined} max={today} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className={`${inputClass} mt-1`} />
            </div>
            {invalidRange && <p role="alert" className="pb-2.5 text-sm font-semibold text-red-700 dark:text-red-300">La fecha inicial debe ser anterior a la final.</p>}
          </div>
        )}
        {filtered && (
          <button type="button" onClick={clearFilters}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-primary-800 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-900/30">
            <X size={16} aria-hidden="true" /> Quitar filtros
          </button>
        )}
      </section>

      {/* Resumen del periodo filtrado */}
      <section aria-labelledby="summary-title" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 id="summary-title" className="text-sm font-bold text-gray-900 dark:text-white">
          Resumen · {PERIOD_LABEL[period]}{studentId ? ` · ${nameById.get(studentId) ?? ''}` : ''}
        </h2>
        <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-sm text-gray-700 dark:text-gray-300">{s.label}</dt>
              <dd className={`text-xl font-black tabular-nums ${s.tone}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">El XP no cuenta lo que se revirtió.</p>
      </section>

      {/* Registro */}
      <section aria-labelledby="feed-title" aria-busy={feed.isFetching} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 id="feed-title" className="text-base font-bold text-gray-900 dark:text-white">Actividad</h2>
          {feed.isFetching && !feed.isFetchingNextPage && !feed.isLoading && (
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Actualizando…
            </span>
          )}
        </div>

        {invalidRange ? (
          <p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300">Corrige el rango de fechas para ver la actividad.</p>
        ) : feed.isLoading ? (
          <div className="space-y-2 py-2" aria-label="Cargando actividad">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />)}
          </div>
        ) : feed.isError ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-800 dark:text-gray-100">No se pudo cargar el registro.</p>
            <button type="button" onClick={() => feed.refetch()} className="mt-2 min-h-[44px] rounded-xl px-4 text-sm font-semibold text-primary-800 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-900/30">Reintentar</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center">
            <ScrollText className="mx-auto h-8 w-8 text-gray-500 dark:text-gray-400" aria-hidden="true" />
            <p className="mt-2 text-sm text-gray-800 dark:text-gray-100">{filtered ? 'No hay actividad con estos filtros.' : 'Todavía no hay actividad en la clase.'}</p>
          </div>
        ) : (
          <>
            <ActivityFeed days={days} nameOf={nameOf} viewerId={viewerId} onRevert={setTarget} />
            <div className="mt-3 flex justify-center border-t border-gray-100 pt-3 dark:border-gray-700">
              {feed.hasNextPage ? (
                <button type="button" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 px-5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                  {feed.isFetchingNextPage && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Cargar más
                </button>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300">No hay más actividad{filtered ? ' con estos filtros' : ''}.</p>
              )}
            </div>
          </>
        )}
      </section>

      {target && (
        <RevertDialog target={target} nameOf={nameOf} busy={reverting} onConfirm={confirmRevert} onClose={() => !reverting && setTarget(null)} />
      )}
    </div>
  );
};
