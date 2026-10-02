import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { HomeModalKind } from './HomeActionButton';
import { HomeEmptyState } from './HomeEmptyState';
import type { TodoItem } from './nextGoal';
import { TodoRow } from './TodoRow';
import { cardLink, cardText, cardTitle, homeCard } from './studentHomeHelpers';

const MAX_ROWS = 5;

interface TodoCardProps {
  items: TodoItem[];
  /** La clase tiene avisos con fecha (vale la pena el enlace al calendario). */
  hasNotes: boolean;
  /** La meta ya es una tarea: si no queda nada más, basta una línea. */
  goalIsTask: boolean;
  /** La clase tiene insignias (si no, no se manda a una página vacía). */
  hasBadges: boolean;
  onOpen: (kind: HomeModalKind) => void;
}

/** "Para hacer": lo de hoy, lo que espera en la plataforma y los próximos avisos con fecha. */
export const TodoCard = ({ items, hasNotes, goalIsTask, hasBadges, onOpen }: TodoCardProps) => {
  const rows = items.slice(0, MAX_ROWS);

  return (
    <section aria-labelledby="todo-title" className={homeCard}>
      <h2 id="todo-title" className={cardTitle}>Para hacer</h2>
      {rows.length === 0 ? (
        goalIsTask ? (
          <p className={`mt-2 ${cardText}`}>Nada más por ahora.</p>
        ) : (
          <div className="mt-3">
            {/* Sin nada pendiente, el calendario también estaría vacío: no se manda allá. */}
            <HomeEmptyState
              emojis={['📌', '✅', '🎉']}
              title="¡Estás al día!"
              text="Cuando tu profe deje un aviso, aparecerá aquí."
              primary={{ to: '/my-progress', label: 'Ver mi progreso' }}
              secondary={hasBadges ? { to: '/my-badges', label: 'Ver mis insignias' } : undefined}
            />
          </div>
        )
      ) : (
        <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((item) => <TodoRow key={item.key} item={item} onOpen={onOpen} />)}
        </ul>
      )}
      {rows.length > 0 && (items.length > rows.length || hasNotes) && (
        <Link to="/my-calendar" className={cardLink}>
          Ver todo en Mi calendario
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
};
