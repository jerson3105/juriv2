import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Award, Check, Heart, RotateCcw, ShoppingBag, Sparkles } from 'lucide-react';
import { studentApi, type ProgressHistoryItem, type ProgressHistoryType, type ProgressPeriod } from '../../../lib/studentApi';
import { cardText, cardTitle, homeCard, localDateKey, rowButton } from '../home/studentHomeHelpers';
import { amountChip, amountParts, groupByDay, historyDayLabel, historyText } from './progressHelpers';

const FILTERS: { id: ProgressHistoryType; label: string }[] = [
  { id: 'ALL', label: 'Todo' },
  { id: 'XP', label: 'XP' },
  { id: 'GP', label: 'Oro' },
  { id: 'HP', label: 'Energía' },
];

const EMPTY: Record<ProgressHistoryType, string> = {
  ALL: 'Aún no hay movimientos en este periodo.',
  XP: 'Aún no hay XP en este periodo.',
  GP: 'No hay movimientos de oro en este periodo.',
  HP: 'Tu energía no cambió en este periodo.',
};

const iconOf = (item: ProgressHistoryItem) => {
  const props = { size: 18, 'aria-hidden': true } as const;
  if (item.kind === 'badge') return <Award {...props} />;
  if (item.kind === 'shop') return <ShoppingBag {...props} />;
  if (item.kind === 'behavior') return item.positive ? <Check {...props} /> : <RotateCcw {...props} />;
  return item.hp !== 0 && item.xp === 0 && item.gp === 0 ? <Heart {...props} /> : <Sparkles {...props} />;
};

// Lo que no salió bien y lo gastado van en gris; lo ganado, en azul (nunca rojo).
const isMuted = (item: ProgressHistoryItem) =>
  item.kind === 'shop' || (item.kind === 'behavior' ? item.positive === false : item.xp <= 0 && item.gp <= 0 && item.hp <= 0);

const HistoryRow = ({ item }: { item: ProgressHistoryItem }) => {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
            isMuted(item) ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' : 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
          }`}
        >
          {iconOf(item)}
        </span>
        <span className="min-w-0 break-words text-sm font-semibold text-gray-900 dark:text-white">{historyText(item)}</span>
      </span>
      <span className="flex flex-wrap gap-1.5 pl-[46px] sm:pl-0">
        {amountParts(item).map((part) => (
          <span key={part.key} className={`rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${amountChip[part.tone]}`}>{part.text}</span>
        ))}
      </span>
    </li>
  );
};

/**
 * Todo lo que ganó, perdió o gastó en el periodo, por día y de 20 en 20. Es el destino de «Ver todo en Mi
 * progreso» del inicio (#historial).
 */
export const HistoryCard = ({ profileId, period }: { profileId: string; period: ProgressPeriod }) => {
  const [type, setType] = useState<ProgressHistoryType>('ALL');
  const query = useInfiniteQuery({
    queryKey: ['my-progress-history', profileId, period, type],
    queryFn: ({ pageParam }) => studentApi.getMyProgressHistory(profileId, { period, type, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const today = localDateKey();

  return (
    <section id="historial" aria-labelledby="history-title" className={`${homeCard} scroll-mt-20`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-title" className={cardTitle}>Historial</h2>
        <div role="group" aria-label="Mostrar" className="flex flex-wrap gap-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={type === filter.id}
              onClick={() => setType(filter.id)}
              className={`min-h-[44px] min-w-[44px] rounded-xl px-3 text-sm font-semibold transition-colors ${
                type === filter.id ? 'bg-primary-600 text-white dark:bg-primary-300 dark:text-gray-900' : 'text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div role="status" aria-label="Cargando tu historial" className="mt-4 h-32 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-700" />
      ) : query.isError ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className={cardText}>No pudimos cargar tu historial.</p>
          <button type="button" onClick={() => void query.refetch()} className={rowButton}>Reintentar</button>
        </div>
      ) : items.length === 0 ? (
        <p className={`mt-3 ${cardText}`}>{EMPTY[type]}</p>
      ) : (
        <div className="mt-2 space-y-4">
          {groupByDay(items).map((group) => (
            <div key={group.key}>
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{historyDayLabel(group.key, today)}</h3>
              <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-700">
                {group.items.map((item) => <HistoryRow key={item.id} item={item} />)}
              </ul>
            </div>
          ))}
          {query.hasNextPage && (
            <button
              type="button"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className={`${rowButton} w-full justify-center disabled:opacity-60`}
            >
              {query.isFetchingNextPage ? 'Cargando…' : 'Mostrar más'}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
