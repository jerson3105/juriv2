import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HomeActionButton, type HomeModalKind } from './HomeActionButton';
import { HomeEmptyState } from './HomeEmptyState';
import type { TodoItem } from './nextGoal';
import { cardLink, cardText, cardTitle, homeCard, rowButton } from './studentHomeHelpers';

const MAX_ROWS = 5;

interface TodoCardProps {
  items: TodoItem[];
  /** La clase tiene avisos con fecha (vale la pena el enlace al calendario). */
  hasNotes: boolean;
  /** La meta ya es una tarea: si no queda nada más, basta una línea. */
  goalIsTask: boolean;
  onOpen: (kind: HomeModalKind) => void;
}

/** "Para hacer": lo de hoy, lo que espera en la plataforma y los próximos avisos con fecha. */
export const TodoCard = ({ items, hasNotes, goalIsTask, onOpen }: TodoCardProps) => {
  const rows = items.slice(0, MAX_ROWS);
  const more = items.length - rows.length;

  return (
    <section aria-labelledby="todo-title" className={homeCard}>
      <h2 id="todo-title" className={cardTitle}>Para hacer</h2>
      {rows.length === 0 ? (
        goalIsTask ? (
          <p className={`mt-2 ${cardText}`}>Nada más por ahora.</p>
        ) : (
          <div className="mt-3">
            <HomeEmptyState
              emojis={['📌', '✅', '🎉']}
              title="¡Estás al día!"
              text="Cuando tu profe deje un aviso, aparecerá aquí."
              primary={{ to: '/my-attendance', label: 'Ver mi calendario' }}
              secondary={{ to: '/my-progress', label: 'Ver mi progreso' }}
            />
          </div>
        )
      ) : (
        <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((item) => (
            <li key={item.key} className="flex min-h-[56px] items-center gap-3 py-2">
              {item.chip ? (
                <span className={`min-w-[4rem] flex-shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-center text-xs font-bold ${item.today ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>
                  {item.chip}
                </span>
              ) : (
                <span className="min-w-[4rem] flex-shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{item.label}</p>
                <p className="break-words text-sm text-gray-900 dark:text-white">{item.text}</p>
              </div>
              {item.action && <HomeActionButton action={item.action} className={rowButton} onOpen={onOpen} />}
            </li>
          ))}
        </ul>
      )}
      {more > 0 ? (
        <Link to="/my-attendance" className={cardLink}>
          Ver {more} más en Mi calendario
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : hasNotes && rows.length > 0 ? (
        <Link to="/my-attendance" className={cardLink}>
          Ver todo en Mi calendario
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
};
