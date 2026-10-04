import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronRight, Compass, Loader2 } from 'lucide-react';
import { useCurrentStudentProfile } from '../../hooks/useCurrentStudentProfile';
import { expeditionApi, expeditionKeys, type StudentExpeditionSummary } from '../../lib/expeditionApi';
import { ExpeditionThumb } from '../../components/expeditions/ExpeditionStage';
import { KIND_INFO, dueLabel, isOverdue, plural } from '../../components/expeditions/expeditionHelpers';
import { useExpeditionLive } from '../../components/expeditions/useExpeditionLive';
import { primaryButton } from '../../components/home/homeHelpers';

/** Qué le toca al alumno, en una línea y sin promesas falsas. */
const statusLine = (expedition: StudentExpeditionSummary) => {
  if (expedition.finished) return '¡Llegaste a la meta!';
  if (expedition.status === 'ARCHIVED') return 'Tu profe cerró esta expedición';
  if (expedition.needsWork) return `Tu profe te pide mejorar «${expedition.needsWork.title}»`;
  const current = expedition.current;
  if (!current) return '';
  if (current.state === 'WAITING') return `Esperando a tu profe en «${current.title}»`;
  if (current.kind === 'CLASS') return `Próxima parada en clase: «${current.title}»`;
  return `${KIND_INFO[current.kind].action}: «${current.title}»`;
};

const ExpeditionCard = ({ expedition }: { expedition: StudentExpeditionSummary }) => {
  const due = !expedition.finished && expedition.status === 'PUBLISHED' ? dueLabel(expedition.current?.dueAt ?? null) : null;
  return (
    <li>
      <Link to={`/expeditions/${expedition.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pg-ring)] dark:border-gray-700 dark:bg-gray-800">
        <span className="obs-sky relative block aspect-[10/5] overflow-hidden" aria-hidden="true">
          <ExpeditionThumb scenario={expedition.scenario} constellationId={expedition.constellationId} mapImageUrl={expedition.mapImageUrl}
            stopsCount={expedition.stopsCount} doneCount={expedition.doneCount} finished={expedition.finished} />
          {expedition.actionable && (
            <span className="absolute right-2 top-2 rounded-full bg-blue-700 px-2.5 py-1 text-xs font-bold text-white">Te toca</span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-1 p-4">
          <span className="text-lg font-bold text-gray-900 dark:text-white">{expedition.name}</span>
          <span className="text-sm text-gray-800 dark:text-gray-200">{statusLine(expedition)}</span>
          <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">{expedition.doneCount} de {plural(expedition.stopsCount, 'parada', 'paradas')}</span>
            {due && (
              <span className={`inline-flex items-center gap-1 ${isOverdue(expedition.current?.dueAt ?? null) ? 'font-bold text-red-700 dark:text-red-300' : ''}`}>
                <CalendarClock size={14} aria-hidden="true" /> {due}
              </span>
            )}
            <ChevronRight size={18} className="ml-auto text-gray-500 transition-transform group-hover:translate-x-0.5 dark:text-gray-400" aria-hidden="true" />
          </span>
        </span>
      </Link>
    </li>
  );
};

export const StudentExpeditionsPage = () => {
  const { profile } = useCurrentStudentProfile();
  const classroomId = profile?.classroomId;
  useExpeditionLive('student');
  const query = useQuery({
    queryKey: expeditionKeys.mine(classroomId ?? ''),
    queryFn: () => expeditionApi.mine(classroomId!),
    enabled: !!classroomId,
  });
  const all = query.data ?? [];
  const active = all.filter((e) => !e.finished && e.status === 'PUBLISHED');
  const ended = all.filter((e) => e.finished || e.status === 'ARCHIVED');

  return (
    <div data-pg="" className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="obs-sky flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-amber-200" aria-hidden="true">
          <Compass size={22} />
        </span>
        <div>
          <h1 className="text-lg font-bold pg-fg">Expediciones</h1>
          <p className="text-sm pg-fg2">Viajes por paradas con Jiro: cada parada lograda enciende una estrella</p>
        </div>
      </div>

      {query.isLoading || !classroomId ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm pg-fg2" role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Cargando tus expediciones…</p>
      ) : query.isError ? (
        <div className="rounded-2xl border border-[var(--pg-line)] p-6 text-center">
          <p className="text-sm pg-fg">No se pudieron cargar tus expediciones.</p>
          <button type="button" onClick={() => void query.refetch()} className={`${primaryButton} mt-3`}>Reintentar</button>
        </div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
            <span className="text-4xl">🗺️</span><span className="text-5xl">⭐</span><span className="text-4xl">🧭</span>
          </div>
          <h2 className="mt-4 text-lg font-bold pg-fg">Aún no hay expediciones</h2>
          <p className="mx-auto mt-1 max-w-md text-sm pg-fg2">Cuando tu profe publique una, aparecerá aquí y en tu inicio.</p>
          <Link to="/my-class" className={`${primaryButton} mt-5`}>Ir a mi inicio</Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section aria-labelledby="exp-active" className="space-y-2">
              <h2 id="exp-active" className="text-base font-bold pg-fg">En camino</h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{active.map((e) => <ExpeditionCard key={e.id} expedition={e} />)}</ul>
            </section>
          )}
          {ended.length > 0 && (
            <section aria-labelledby="exp-ended" className="space-y-2">
              <h2 id="exp-ended" className="text-base font-bold pg-fg">Terminadas</h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{ended.map((e) => <ExpeditionCard key={e.id} expedition={e} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};
