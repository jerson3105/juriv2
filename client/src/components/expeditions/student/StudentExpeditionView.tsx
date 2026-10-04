import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CalendarClock, ChevronRight, Flag } from 'lucide-react';
import { expeditionApi, expeditionKeys, type Reflection, type StudentExpedition, type StudentStop } from '../../../lib/expeditionApi';
import { errorMessage } from '../../auth/authHelpers';
import { primaryButton } from '../../home/homeHelpers';
import { secondaryButton } from '../../gradebook/gradebookHelpers';
import { ExpeditionStage } from '../ExpeditionStage';
import { KIND_INFO, REFLECTIONS, REFLECTION_INFO, STATE_INFO, dueLabel, isOverdue, plural, rewardLabel } from '../expeditionHelpers';
import { StopSheet } from './StopSheet';

const NUMBER_TONE: Record<StudentStop['state'], string> = {
  LOCKED: 'border border-dashed border-gray-400 text-gray-600 dark:border-gray-500 dark:text-gray-300',
  AVAILABLE: 'bg-blue-700 text-white',
  STARTED: 'bg-blue-700 text-white',
  WAITING: 'bg-amber-700 text-white',
  NEEDS_WORK: 'bg-slate-700 text-white',
  DONE: 'bg-amber-300 text-amber-950',
};

const StopRow = ({ stop, number, current, onOpen }: { stop: StudentStop; number: number; current: boolean; onOpen: () => void }) => {
  const kind = KIND_INFO[stop.kind];
  const state = STATE_INFO[stop.state];
  const due = stop.state !== 'DONE' && stop.state !== 'LOCKED' ? dueLabel(stop.dueAt) : null;
  return (
    <li>
      <button type="button" onClick={onOpen} aria-current={current ? 'step' : undefined}
        className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--pg-ring)] dark:hover:bg-gray-700/50 ${current ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:ring-blue-800' : ''}`}>
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${NUMBER_TONE[stop.state]}`}>{number}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold text-gray-900 dark:text-white">{stop.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-gray-700 dark:text-gray-300">
            <span><span aria-hidden="true">{kind.emoji}</span> {kind.label}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold">{state.label}{stop.state === 'DONE' && stop.doneInClass ? ' en clase' : ''}{stop.goldStar ? ' ⭐' : ''}</span>
            {due && (
              <span className={`inline-flex items-center gap-1 ${isOverdue(stop.dueAt) ? 'font-bold text-red-700 dark:text-red-300' : ''}`}>
                <CalendarClock size={14} aria-hidden="true" /> {due}
              </span>
            )}
          </span>
        </span>
        <ChevronRight size={18} className="flex-shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
      </button>
    </li>
  );
};

/** «¿Cómo me fue?»: tres opciones y lo más difícil (opcional). No paga nada; se puede cambiar. */
const ReflectionBox = ({ expedition, preview }: { expedition: StudentExpedition; preview: boolean }) => {
  const queryClient = useQueryClient();
  const saved = expedition.reflection;
  const [editing, setEditing] = useState(!saved);
  const [value, setValue] = useState<Reflection | null>(saved?.value ?? null);
  const [note, setNote] = useState(saved?.note ?? '');
  const save = useMutation({
    mutationFn: () => expeditionApi.reflect(expedition.id, { value: value!, note: note.trim() || null }),
    onSuccess: (data) => {
      queryClient.setQueryData(expeditionKeys.play(expedition.id), data);
      setEditing(false);
      toast.success('¡Gracias! Tu profe lo verá');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar tu respuesta')),
  });

  if (saved && !editing) {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-white/70 px-3 py-2 text-sm text-amber-950 dark:bg-black/20 dark:text-amber-50">
        <span>Respondiste: <strong><span aria-hidden="true">{REFLECTION_INFO[saved.value].emoji}</span> {REFLECTION_INFO[saved.value].label}</strong>{saved.note ? ` · «${saved.note}»` : ''}</span>
        <button type="button" onClick={() => setEditing(true)} className="min-h-[36px] font-semibold underline">Cambiar</button>
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-white/70 p-3 dark:bg-black/20">
      <p id={`reflection-${expedition.id}`} className="font-bold text-amber-950 dark:text-amber-50">¿Cómo te fue?</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`reflection-${expedition.id}`}>
        {REFLECTIONS.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={value === option} onClick={() => setValue(option)} disabled={preview}
            className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl border-2 px-4 text-base font-bold ${value === option
              ? 'border-amber-800 bg-amber-200 text-amber-950 dark:border-amber-200 dark:bg-amber-800/70 dark:text-white'
              : 'border-amber-300 bg-white text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-transparent dark:text-amber-50 dark:hover:bg-amber-900/40'}`}>
            <span aria-hidden="true">{REFLECTION_INFO[option].emoji}</span> {REFLECTION_INFO[option].label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-sm font-semibold text-amber-950 dark:text-amber-50">¿Qué fue lo más difícil? <span className="font-normal">(opcional)</span></span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} rows={2} disabled={preview}
          className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-amber-700 dark:bg-gray-900 dark:text-gray-100" />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        {saved && (
          <button type="button" onClick={() => { setEditing(false); setValue(saved.value); setNote(saved.note ?? ''); }} className={secondaryButton}>Cancelar</button>
        )}
        <button type="button" disabled={!value || save.isPending || preview} onClick={() => save.mutate()} className={primaryButton}>Guardar</button>
      </div>
    </div>
  );
};

const FinishCard = ({ expedition, preview }: { expedition: StudentExpedition; preview: boolean }) => {
  const evidence = expedition.stops.filter((s) => s.kind === 'EVIDENCE' && s.evidence).length;
  // El mejor resultado de cada reto (después del reintento, si lo hubo).
  const scores = expedition.stops.map((s) => s.finalScore ?? s.firstScore).filter((score): score is number => score !== null);
  const stars = expedition.stops.filter((s) => s.goldStar).length;
  return (
    <section aria-label="Llegaste a la meta" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
      <h2 className="flex items-center gap-2 text-xl font-extrabold text-amber-950 dark:text-amber-50">
        <Flag size={22} aria-hidden="true" /> ¡Llegaste a la meta!
      </h2>
      <ReflectionBox expedition={expedition} preview={preview} />
      {expedition.closingText && (
        <blockquote className="mt-3 whitespace-pre-line text-base text-amber-950 dark:text-amber-50">
          <span className="font-bold">Jiro: </span>«{expedition.closingText}»
        </blockquote>
      )}
      <p className="mt-3 text-sm font-bold text-amber-950 dark:text-amber-50">Lo que lograste</p>
      <ul className="mt-1 flex flex-wrap gap-2 text-sm font-semibold text-amber-950 dark:text-amber-50">
        <li className="rounded-full bg-white/70 px-3 py-1 dark:bg-black/20">{plural(expedition.stops.length, 'parada lograda', 'paradas logradas')}</li>
        {evidence > 0 && <li className="rounded-full bg-white/70 px-3 py-1 dark:bg-black/20">{plural(evidence, 'evidencia', 'evidencias')}</li>}
        {scores.length > 0 && <li className="rounded-full bg-white/70 px-3 py-1 dark:bg-black/20">Mejor reto: {Math.max(...scores)} %</li>}
        {stars > 0 && <li className="rounded-full bg-white/70 px-3 py-1 dark:bg-black/20">{stars} ⭐</li>}
        {(expedition.finishXp > 0 || expedition.finishGold > 0) && (
          <li className="rounded-full bg-white/70 px-3 py-1 dark:bg-black/20">Premio de la meta: {rewardLabel(expedition.finishXp, expedition.finishGold)}</li>
        )}
      </ul>
    </section>
  );
};

/**
 * Lo que ve el alumno: el escenario (constelación o mapa) con su personaje en la parada actual, la lista de
 * paradas y, en el celular, «Tu próxima parada» fija abajo. Tocar una parada abre su hoja.
 */
export const StudentExpeditionView = ({ expedition, here, preview = false, header }: {
  expedition: StudentExpedition;
  here?: ReactNode;
  preview?: boolean;
  header?: ReactNode;
}) => {
  // ?parada=<id> (desde el inicio o el calendario) abre esa parada al entrar.
  const [params, setParams] = useSearchParams();
  const [openId, setOpenIdState] = useState<string | null>(() => params.get('parada'));
  const setOpenId = (id: string | null) => {
    setOpenIdState(id);
    if (!id && params.has('parada')) {
      const next = new URLSearchParams(params);
      next.delete('parada');
      setParams(next, { replace: true });
    }
  };
  const stops = expedition.stops;
  const current = expedition.finished ? null : stops.find((stop) => stop.id === expedition.currentStopId) ?? null;
  const done = stops.filter((stop) => stop.state === 'DONE' || stop.state === 'NEEDS_WORK').length;
  const openedIndex = stops.findIndex((stop) => stop.id === openId);
  const opened = openedIndex >= 0 ? stops[openedIndex] : null;
  const percent = stops.length ? Math.round((done / stops.length) * 100) : 0;

  return (
    <div className={`space-y-4 ${current ? 'pb-24 lg:pb-0' : ''}`}>
      {header}
      <div>
        <div className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
          <span>{done} de {plural(stops.length, 'parada', 'paradas')}</span>
          {expedition.status === 'ARCHIVED' && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-800 dark:bg-gray-700 dark:text-gray-100">Terminada</span>}
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Avance en la expedición">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {expedition.finished && <FinishCard expedition={expedition} preview={preview} />}
      {!expedition.finished && expedition.description && (
        <p className="rounded-xl bg-indigo-50 p-3 text-base text-indigo-950 dark:bg-indigo-950/50 dark:text-indigo-50">
          <span className="font-bold">Jiro: </span>{expedition.description}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <ExpeditionStage
          scenario={expedition.scenario}
          constellationId={expedition.constellationId}
          mapImageUrl={expedition.mapImageUrl}
          stops={stops.map((stop) => ({ id: stop.id, kind: stop.kind, title: stop.title, state: stop.state, goldStar: stop.goldStar, mapX: stop.mapX, mapY: stop.mapY }))}
          finished={expedition.finished}
          currentStopId={current?.id ?? null}
          here={here}
          onSelect={setOpenId}
          label={`${expedition.name}: ${done} de ${stops.length} paradas`}
        />
        <section aria-label="Paradas" className="pg-surface p-2">
          {current && (
            <div className="hidden px-2 pb-2 pt-1 lg:block">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">Tu próxima parada</p>
              <button type="button" onClick={() => setOpenId(current.id)} className="mt-1 flex w-full items-center justify-between gap-2 rounded-xl bg-blue-700 px-4 py-3 text-left font-bold text-white hover:bg-blue-800">
                <span className="min-w-0 truncate">{KIND_INFO[current.kind].action}: {current.title}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
          <ol className="space-y-1">
            {stops.map((stop, index) => (
              <StopRow key={stop.id} stop={stop} number={index + 1} current={stop.id === current?.id} onOpen={() => setOpenId(stop.id)} />
            ))}
          </ol>
        </section>
      </div>

      {current && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 lg:hidden">
          <button type="button" onClick={() => setOpenId(current.id)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-blue-700 px-4 py-3 text-left text-white">
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-blue-100">Tu próxima parada</span>
              <span className="block truncate font-bold">{stops.indexOf(current) + 1}. {KIND_INFO[current.kind].action}: {current.title}</span>
            </span>
            <ChevronRight size={20} className="flex-shrink-0" aria-hidden="true" />
          </button>
        </div>
      )}

      {opened && (
        <StopSheet
          expedition={expedition}
          stop={opened}
          number={openedIndex + 1}
          previousTitle={openedIndex > 0 ? stops[openedIndex - 1].title : null}
          preview={preview}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
};
