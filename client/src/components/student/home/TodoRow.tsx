import { HomeActionButton, type HomeModalKind } from './HomeActionButton';
import type { TodoItem } from './nextGoal';
import { rowButton } from './studentHomeHelpers';

interface TodoRowProps {
  item: TodoItem;
  onOpen: (kind: HomeModalKind) => void;
  /** Aviso de un día que ya pasó (historial del calendario). */
  done?: boolean;
  /** Sin la columna del día (en el detalle de un día ya se sabe la fecha). */
  chipless?: boolean;
}

/** Una fila de fecha: chip del día, categoría, texto completo (nunca cortado) y, si aplica, su botón. */
export const TodoRow = ({ item, onOpen, done = false, chipless = false }: TodoRowProps) => (
  <li className="flex min-h-[56px] items-center gap-3 py-2">
    {chipless ? null : item.chip ? (
      <span className={`min-w-[4rem] flex-shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-center text-xs font-bold ${item.today ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>
        {item.chip}
      </span>
    ) : (
      <span className="min-w-[4rem] flex-shrink-0" aria-hidden="true" />
    )}
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
        {item.label}
        {done && <span className="ml-2 normal-case tracking-normal">· Ya pasó</span>}
      </p>
      <p className="break-words text-sm text-gray-900 dark:text-white">{item.text}</p>
    </div>
    {item.action && <HomeActionButton action={item.action} className={rowButton} onOpen={onOpen} />}
  </li>
);
