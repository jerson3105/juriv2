import { useState } from 'react';
import type { TodoItem } from '../home/nextGoal';
import { TodoRow } from '../home/TodoRow';
import { cardLink, cardText, cardTitle, homeCard } from '../home/studentHomeHelpers';

const VISIBLE = 6;
const noop = () => undefined;

/** "Lo próximo": todas las fechas desde hoy con su texto completo (es el destino de "Ver todo en Mi calendario"). */
export const UpcomingCard = ({ items }: { items: TodoItem[] }) => {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? items : items.slice(0, VISIBLE);
  const hidden = items.length - VISIBLE;

  return (
    <section aria-labelledby="upcoming-title" className={homeCard}>
      <h2 id="upcoming-title" className={cardTitle}>Lo próximo</h2>
      {items.length === 0 ? (
        <p className={`mt-2 ${cardText}`}>Nada próximo por ahora.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((item) => <TodoRow key={item.key} item={item} onOpen={noop} />)}
        </ul>
      )}
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className={cardLink}>
          {expanded ? 'Ver menos' : `Ver ${hidden} más`}
        </button>
      )}
    </section>
  );
};
