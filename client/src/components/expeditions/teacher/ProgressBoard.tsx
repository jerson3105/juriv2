import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Flag, Hourglass, Loader2, Lock, RotateCcw, School, Star } from 'lucide-react';
import { SidePanel } from '../../gradebook/SidePanel';
import { primaryButton } from '../../home/homeHelpers';
import { secondaryButton } from '../../gradebook/gradebookHelpers';
import { expeditionApi, expeditionKeys, type BoardStudent, type ExpeditionBoard, type StopState } from '../../../lib/expeditionApi';
import { KIND_INFO, plural } from '../expeditionHelpers';

const CELL: Record<StopState, { label: string; node: ReactNode; className: string }> = {
  DONE: { label: 'Lograda', node: <Check size={14} strokeWidth={3} aria-hidden="true" />, className: 'bg-emerald-700 text-white' },
  NEEDS_WORK: { label: 'Le pediste mejorar', node: <RotateCcw size={13} strokeWidth={3} aria-hidden="true" />, className: 'bg-slate-700 text-white' },
  WAITING: { label: 'Espera tu revisión', node: <Hourglass size={13} strokeWidth={3} aria-hidden="true" />, className: 'bg-amber-700 text-white' },
  STARTED: { label: 'En curso', node: <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />, className: 'bg-blue-100 text-blue-800 ring-2 ring-blue-500 dark:bg-blue-900/50 dark:text-blue-100' },
  AVAILABLE: { label: 'Le toca', node: <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />, className: 'text-blue-700 ring-2 ring-blue-500 dark:text-blue-300' },
  LOCKED: { label: 'Bloqueada', node: <Lock size={11} aria-hidden="true" />, className: 'text-gray-400 dark:text-gray-500' },
};

/** Elegir a los presentes. El «Deshacer» vive en el editor (el panel se cierra al confirmar). */
export const ClassMarkPanel = ({ board, stopId, onClose, onConfirm }: {
  board: ExpeditionBoard; stopId: string; onClose: () => void; onConfirm: (studentIds: string[], stopId: string, stopTitle: string) => void;
}) => {
  const stopIndex = board.stops.findIndex((s) => s.id === stopId);
  const stop = board.stops[stopIndex];
  const has = (student: BoardStudent) => student.states.find((s) => s.stopId === stopId)?.state === 'DONE';
  const missing = board.students.filter((student) => !has(student));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = missing.length > 0 && missing.every((student) => selected.has(student.id));

  const confirm = () => {
    onConfirm([...selected], stopId, stop.title);
    onClose();
  };

  return (
    <SidePanel title={`Marcar «${stop?.title ?? ''}»`} subtitle={`Parada ${stopIndex + 1} · En clase: elige a quienes estuvieron`} onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button>
          <button type="button" disabled={selected.size === 0} onClick={confirm} className={primaryButton}>Marcar {selected.size || ''}</button>
        </>
      )}>
      <div data-pg="" className="space-y-3">
      {missing.length === 0 ? (
        <p className="text-sm text-gray-800 dark:text-gray-200">Todos tienen esta parada.</p>
      ) : (
        <>
          <label className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 font-semibold text-gray-900 dark:text-gray-100">
            <input type="checkbox" className="pg-check" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(missing.map((s) => s.id)))} />
            Todos los que faltan ({missing.length})
          </label>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {missing.map((student) => (
              <li key={student.id}>
                <label className="flex min-h-[44px] items-center gap-3 px-2 py-1.5 text-gray-900 dark:text-gray-100">
                  <input type="checkbox" className="pg-check" checked={selected.has(student.id)} onChange={() => toggle(student.id)} />
                  <span className="min-w-0 flex-1 truncate">{student.name}</span>
                  {!student.hasAccount && <span className="text-xs text-gray-700 dark:text-gray-300">sin cuenta</span>}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-sm text-gray-700 dark:text-gray-300">Cada uno recibe la recompensa de la parada. Tienes 5 segundos para deshacer.</p>
      </div>
    </SidePanel>
  );
};

/** Progreso de la clase: en qué parada va cada alumno. Proyectando, solo los conteos (sin nombres). */
export const ProgressBoard = ({ expeditionId, projecting, onMarkClass }: { expeditionId: string; projecting: boolean; onMarkClass: (stopId: string, board: ExpeditionBoard) => void }) => {
  const query = useQuery({ queryKey: expeditionKeys.board(expeditionId), queryFn: () => expeditionApi.board(expeditionId) });
  const board = query.data;
  const finished = useMemo(() => board?.students.filter((s) => s.finished).length ?? 0, [board]);

  if (query.isLoading) return <p className="flex items-center justify-center gap-2 py-10 text-sm pg-fg2" role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Cargando el progreso…</p>;
  if (query.isError || !board) return <p className="py-10 text-center text-sm pg-fg">No se pudo cargar el progreso.</p>;
  if (board.stops.length === 0) return <p className="py-10 text-center text-sm pg-fg2">Agrega paradas para ver el progreso.</p>;

  const counts = (
    <ul className="flex flex-wrap gap-2">
      {board.stops.map((stop, i) => (
        <li key={stop.id} className="pg-surface flex items-center gap-2 px-3 py-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-300 text-xs font-extrabold text-amber-950">{i + 1}</span>
          <span className="pg-fg"><span aria-hidden="true">{KIND_INFO[stop.kind].emoji}</span> {plural(stop.here, 'alumno aquí', 'alumnos aquí')}</span>
        </li>
      ))}
      <li className="pg-surface flex items-center gap-2 px-3 py-2 text-sm font-semibold pg-fg"><Flag size={16} aria-hidden="true" /> {plural(finished, 'llegó a la meta', 'llegaron a la meta')}</li>
    </ul>
  );

  if (projecting) {
    return (
      <div className="space-y-3">
        {counts}
        <p className="text-sm pg-fg2">Mientras proyectas se ocultan los nombres: solo se ven cuántos hay en cada parada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {counts}
      {board.students.length === 0 ? (
        <p className="py-6 text-center text-sm pg-fg2">Esta clase aún no tiene alumnos.</p>
      ) : (
        <div className="pg-surface overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--pg-line)]">
                <th scope="col" className="sticky left-0 z-10 bg-[var(--pg-surface)] px-3 py-2 text-left font-semibold pg-fg">Alumno</th>
                {board.stops.map((stop, i) => (
                  <th key={stop.id} scope="col" className="px-1 py-2 text-center font-semibold pg-fg">
                    <span className="flex flex-col items-center gap-1">
                      <span title={stop.title} className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-300 text-xs font-extrabold text-amber-950">{i + 1}</span>
                      <span className="sr-only">{stop.title}</span>
                      {stop.kind === 'CLASS' && (
                        <button type="button" onClick={() => onMarkClass(stop.id, board)} className="pg-icon-btn h-8 w-8" aria-label={`Marcar presentes en «${stop.title}»`} title="Marcar presentes">
                          <School size={15} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 text-center font-semibold pg-fg">Meta</th>
              </tr>
            </thead>
            <tbody>
              {board.students.map((student) => (
                <tr key={student.id} className="pg-row border-b last:border-b-0">
                  <th scope="row" className="sticky left-0 z-10 max-w-[12rem] truncate bg-[var(--pg-surface)] px-3 py-2 text-left font-medium pg-fg">
                    {student.name}
                    {!student.hasAccount && <span className="block text-xs font-normal pg-fg2">sin cuenta</span>}
                  </th>
                  {student.states.map((cell, i) => {
                    const look = CELL[cell.state];
                    const label = `${board.stops[i].title}: ${look.label}${cell.goldStar ? ', con estrella' : ''}${cell.firstScore !== null ? `, ${cell.firstScore} %` : ''}`;
                    return (
                      <td key={cell.stopId} className="px-1 py-2 text-center">
                        <span className={`relative mx-auto flex h-6 w-6 items-center justify-center rounded-full ${look.className}`} title={label} role="img" aria-label={label}>
                          {look.node}
                          {cell.goldStar && <Star size={10} fill="currentColor" className="absolute -right-1 -top-1 text-amber-500" aria-hidden="true" />}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center">{student.finished ? <Flag size={16} className="mx-auto text-amber-600 dark:text-amber-300" aria-label="Llegó a la meta" /> : <span className="sr-only">Aún no</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs pg-fg2">
        {(['DONE', 'AVAILABLE', 'STARTED', 'WAITING', 'NEEDS_WORK', 'LOCKED'] as StopState[]).map((state) => (
          <span key={state} className="inline-flex items-center gap-1.5">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${CELL[state].className}`}>{CELL[state].node}</span>{CELL[state].label}
          </span>
        ))}
      </p>
    </div>
  );
};
