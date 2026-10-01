import { useState } from 'react';
import { Award, CalendarCheck, ChevronDown, Loader2, RotateCcw, ShoppingBag, Sparkles, Star, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { FeedEntry } from '../../lib/historyApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton } from '../home/homeHelpers';
import { describeEntry, plural, revertible, timeLabel, TONE_TEXT, TONE_TILE, type FeedDay, type Tone } from './historyHelpers';

export type RevertTarget =
  | { kind: 'single'; entry: FeedEntry & { type: 'POINTS' | 'BADGE' | 'ATTENDANCE' } }
  | { kind: 'batch'; entries: FeedEntry[] };

interface ActivityFeedProps {
  days: FeedDay[];
  nameOf: (entry: FeedEntry) => string;
  viewerId?: string;
  onRevert: (target: RevertTarget) => void;
}

const iconOf = (entry: FeedEntry, tone: Tone) => {
  if (entry.type === 'POINTS') return tone === 'negative' ? <TrendingDown size={18} aria-hidden="true" /> : <TrendingUp size={18} aria-hidden="true" />;
  if (entry.type === 'BADGE') return <Award size={18} aria-hidden="true" />;
  if (entry.type === 'PURCHASE') return <ShoppingBag size={18} aria-hidden="true" />;
  if (entry.type === 'ATTENDANCE') return <CalendarCheck size={18} aria-hidden="true" />;
  if (entry.type === 'LEVEL_UP') return <Star size={18} aria-hidden="true" />;
  return <Sparkles size={18} aria-hidden="true" />;
};

// Autor solo si no eres tú: "Automático" (recompensas, sistema) u otro profesor.
const actorLabel = (entry: FeedEntry, viewerId?: string) => {
  if (entry.actor === undefined) return null;
  if (entry.actor === null) return 'Automático';
  return entry.actor.id === viewerId ? null : `Por ${entry.actor.name}`;
};

const amountClass = (dimmed: boolean, tone: Tone) =>
  `text-sm font-bold tabular-nums ${dimmed ? 'text-gray-700 line-through dark:text-gray-300' : TONE_TEXT[tone]}`;

const revertButton = 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-red-300';
const revertedChip = 'rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-100';

const EntryRow = ({ entry, name, viewerId, onRevert, nested = false }: {
  entry: FeedEntry;
  name: string;
  viewerId?: string;
  onRevert: (target: RevertTarget) => void;
  nested?: boolean;
}) => {
  const info = describeEntry(entry);
  const actor = actorLabel(entry, viewerId);
  // Dentro de un lote la hora ya está en la fila del lote.
  const meta = [nested ? null : timeLabel(entry.timestamp), actor, info.note].filter(Boolean).join(' · ');
  return (
    <li className={`flex items-center gap-3 py-2.5 ${nested ? 'pl-2' : ''}`}>
      {!nested && (
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${TONE_TILE[info.tone]}`}>
          {iconOf(entry, info.tone)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-sm text-gray-900 dark:text-white ${entry.isReverted ? 'line-through decoration-gray-500' : ''}`}>
          <span className="font-bold">{name}</span>{!nested && <> · <span className="font-medium">{info.title}</span></>}
        </span>
        {info.amount && !nested && <span className={`mt-0.5 block sm:hidden ${amountClass(!!entry.isReverted, info.tone)}`}>{info.amount}</span>}
        {(meta || entry.isReverted) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
            {meta}
            {entry.isReverted && <span className={revertedChip}>Revertido</span>}
          </span>
        )}
      </span>
      {info.amount && (
        <span className={`${nested ? '' : 'hidden sm:block'} flex-shrink-0 text-right ${amountClass(!!entry.isReverted, info.tone)}`}>{info.amount}</span>
      )}
      {revertible(entry) ? (
        <button type="button" onClick={() => onRevert({ kind: 'single', entry })} className={revertButton}
          aria-label={`Revertir: ${name}, ${info.title}`} title="Revertir">
          <RotateCcw size={18} aria-hidden="true" />
        </button>
      ) : (
        <span className="w-11 flex-shrink-0" aria-hidden="true" />
      )}
    </li>
  );
};

// Misma acción a varios alumnos: una fila que se despliega con cada alumno.
const BatchRow = ({ entries, nameOf, viewerId, onRevert }: {
  entries: FeedEntry[];
  nameOf: (entry: FeedEntry) => string;
  viewerId?: string;
  onRevert: (target: RevertTarget) => void;
}) => {
  const [open, setOpen] = useState(false);
  const first = entries[0];
  const info = describeEntry(first);
  const actor = actorLabel(first, viewerId);
  const pending = entries.filter(revertible);
  const reverted = entries.length - pending.length;
  const names = entries.slice(0, 3).map(nameOf).join(', ') + (entries.length > 3 ? ` y ${entries.length - 3} más` : '');
  const listId = `batch-${first.key.replace(/[^a-zA-Z0-9-]/g, '')}-${first.id}`;
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${TONE_TILE[info.tone]}`}>
          <Users size={18} aria-hidden="true" />
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={listId}
          className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600">
          <span className="flex flex-wrap items-center gap-2 text-sm text-gray-900 dark:text-white">
            <span className="font-medium">{info.title}</span>
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-900 dark:bg-primary-900/50 dark:text-primary-100">{plural(entries.length, 'alumno', 'alumnos')}</span>
            {reverted > 0 && <span className={revertedChip}>{reverted === entries.length ? 'Revertido' : `${reverted} revertido${reverted === 1 ? '' : 's'}`}</span>}
          </span>
          {info.amount && <span className={`mt-0.5 block sm:hidden ${amountClass(pending.length === 0, info.tone)}`}>{info.amount} c/u</span>}
          <span className="mt-0.5 flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
            <ChevronDown size={16} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            <span className="truncate">{[timeLabel(first.timestamp), actor, names].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
        {info.amount && (
          <span className={`hidden flex-shrink-0 text-right sm:block ${amountClass(pending.length === 0, info.tone)}`}>
            {info.amount} <span className="font-semibold text-gray-700 dark:text-gray-300">c/u</span>
          </span>
        )}
        {pending.length > 0 ? (
          <button type="button" onClick={() => onRevert({ kind: 'batch', entries: pending })} className={revertButton}
            aria-label={`Revertir a los ${pending.length} alumnos: ${info.title}`} title="Revertir a todos">
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        ) : (
          <span className="w-11 flex-shrink-0" aria-hidden="true" />
        )}
      </div>
      {open && (
        <ul id={listId} className="ml-5 mt-1 divide-y divide-gray-100 border-l-2 border-gray-200 pl-3 dark:divide-gray-700 dark:border-gray-700">
          {entries.map((entry) => (
            <EntryRow key={entry.key + entry.id} entry={entry} name={nameOf(entry)} viewerId={viewerId} onRevert={onRevert} nested />
          ))}
        </ul>
      )}
    </li>
  );
};

export const ActivityFeed = ({ days, nameOf, viewerId, onRevert }: ActivityFeedProps) => (
  <div className="space-y-4">
    {days.map((day) => (
      <section key={day.key} aria-labelledby={`day-${day.key}`}>
        <h3 id={`day-${day.key}`} className="border-b border-gray-200 pb-1.5 pt-1 text-sm font-bold text-gray-900 dark:border-gray-700 dark:text-white">
          {day.label}
        </h3>
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {day.items.map((item) => item.kind === 'batch' ? (
            <BatchRow key={item.key + item.entries[0].id} entries={item.entries} nameOf={nameOf} viewerId={viewerId} onRevert={onRevert} />
          ) : (
            <EntryRow key={item.entry.key + item.entry.id} entry={item.entry} name={nameOf(item.entry)} viewerId={viewerId} onRevert={onRevert} />
          ))}
        </ul>
      </section>
    ))}
  </div>
);

// ---------- Confirmación de reversión ----------

export const RevertDialog = ({ target, nameOf, busy, onConfirm, onClose }: {
  target: RevertTarget;
  nameOf: (entry: FeedEntry) => string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const entry = target.kind === 'single' ? target.entry : target.entries[0];
  const info = describeEntry(entry);
  const who = target.kind === 'single' ? nameOf(entry) : plural(target.entries.length, 'alumno', 'alumnos');
  const effect = entry.type === 'POINTS'
    ? 'Se descuenta lo que se dio (o se devuelve lo que se quitó) y se recalcula el nivel.'
    : entry.type === 'BADGE'
      ? 'Se quita la insignia y su recompensa de XP u oro.'
      : 'Se anula el registro y el XP que dio.';
  return (
    <HomeModal
      title="¿Revertir esta acción?"
      subtitle={`${info.title}${info.amount ? ` · ${info.amount}` : ''}`}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
        <button type="button" onClick={onConfirm} disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
          {target.kind === 'batch' ? `Revertir a ${who}` : 'Revertir'}
        </button>
      </>}
    >
      <p className="text-sm text-gray-800 dark:text-gray-100">
        <span className="font-semibold">{who}</span> · {new Date(entry.timestamp).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-sm text-gray-800 dark:text-gray-100">{effect} Queda en el registro como «Revertido».</p>
      {entry.type === 'POINTS' && (
        <p className="text-sm text-gray-700 dark:text-gray-300">El aporte que ya sumó al clan no se descuenta.</p>
      )}
    </HomeModal>
  );
};
