import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BellOff, ChevronRight, PartyPopper, Star } from 'lucide-react';
import { historyApi } from '../../lib/historyApi';
import { localToday } from '../home/homeHelpers';
import { LEVEL_SOURCE_LABEL, timeLabel } from '../history/historyHelpers';
import { useCelebrationStore } from '../../store/celebrationStore';
import { levelUpsTodayKey } from './celebrationHelpers';

/**
 * «Hoy subieron» en la Lista: neutro en 0 y en oro si hubo subidas o hay celebraciones guardadas (modo
 * silencioso). Dentro, quién subió hoy (cualquier origen) y «Celebrar ahora». Las preferencias viven en
 * «Modo clase», en la barra del aula.
 */
export const TodayLevelUps = ({ classroomId, nameOf }: { classroomId: string; nameOf: (studentId: string, fallback: string | null) => string }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { since, date } = localToday();
  const silent = useCelebrationStore((s) => s.silent);
  const pending = useCelebrationStore((s) => s.pending.length);
  const playPending = useCelebrationStore((s) => s.playPending);

  const { data } = useQuery({
    queryKey: [...levelUpsTodayKey(classroomId), date],
    queryFn: () => historyApi.getFeed(classroomId, { type: 'LEVEL_UP', from: since, limit: 50 }),
    staleTime: 30_000,
  });
  const entries = useMemo(() => (data?.entries ?? []).filter((e) => !e.isReverted), [data]);
  const students = new Set(entries.map((e) => e.studentId)).size;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    // En el celular, en 0 no ocupa lugar en la barra.
    <div className={`relative ${students === 0 && pending === 0 ? 'max-sm:hidden' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="today-level-ups"
        title="Subidas de nivel de hoy"
        className={students > 0 || pending > 0 ? 'pg-btn pg-gold border-transparent' : 'pg-btn pg-btn-ghost pg-fg2'}
      >
        {silent ? <BellOff size={15} aria-hidden="true" /> : <Star size={15} className={students > 0 ? 'fill-current' : ''} aria-hidden="true" />}
        {students > 0 ? <span>Hoy subieron {students}</span> : <span aria-hidden="true">{students}</span>}
        {pending > 0 && <span className="rounded-full bg-amber-700 px-1.5 text-xs font-bold text-white" aria-hidden="true">{pending}</span>}
        <span className="sr-only">{students > 0 ? '' : 'Hoy subieron de nivel: 0'}{silent ? ' (modo silencioso)' : ''}{pending > 0 ? `, ${pending} sin celebrar` : ''}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={panelRef} id="today-level-ups"
            className="fixed inset-x-4 bottom-4 z-50 max-h-[75vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Subidas de nivel de hoy</p>
            {entries.length === 0 ? (
              <p className="py-3 text-sm text-gray-700 dark:text-gray-300">Nadie ha subido de nivel hoy.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="w-12 flex-shrink-0 tabular-nums text-gray-700 dark:text-gray-300">{timeLabel(e.timestamp)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900 dark:text-white">{nameOf(e.studentId, e.studentName)}</span>
                      {e.details.levelSource && <span className="block text-gray-700 dark:text-gray-300">{LEVEL_SOURCE_LABEL[e.details.levelSource] ?? ''}</span>}
                    </span>
                    <span className="flex-shrink-0 font-semibold text-gray-800 dark:text-gray-100">
                      Nv {e.details.fromLevel ?? (e.details.newLevel ?? 1) - 1} → <span className="text-amber-700 dark:text-amber-300">{e.details.newLevel}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {pending > 0 && (
              <button type="button" onClick={() => { playPending(); setOpen(false); }}
                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-gray-900 hover:bg-amber-400">
                <PartyPopper size={16} aria-hidden="true" /> Celebrar ahora ({pending})
              </button>
            )}
            <p className="mt-2 border-t border-gray-100 pt-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
              El modo silencioso y los sonidos están en «Modo clase», arriba.
            </p>
            <Link to={`/classroom/${classroomId}/history?type=LEVEL_UP&period=today`}
              className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary-800 hover:underline dark:text-primary-200">
              Ver en el Registro <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
};
