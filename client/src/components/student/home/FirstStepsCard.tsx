import { Link } from 'react-router-dom';
import type { HomeModalKind } from './HomeActionButton';
import { cardLink, cardText, cardTitle, homeCard, plural, rowButton } from './studentHomeHelpers';

interface FirstStepsCardProps {
  /** Elegir rol (si la clase deja elegir y aún no lo hizo, y no es ya la meta). */
  role: boolean;
  /** Vestir al personaje (si la clase tiene ropa y aún no se puso nada). */
  dress: boolean;
  /** Aún no ganó XP. */
  firstXp: boolean;
  onOpen: (kind: HomeModalKind) => void;
}

/** "Primeros pasos" del recién llegado: se calcula con los datos y desaparece al completarlos. */
export const FirstStepsCard = ({ role, dress, firstXp, onOpen }: FirstStepsCardProps) => {
  const pending = [role, dress, firstXp].filter(Boolean).length;
  if (pending === 0) return null;

  return (
    <section aria-labelledby="steps-title" className={homeCard}>
      <h2 id="steps-title" className={cardTitle}>Primeros pasos</h2>
      <p className={cardText}>{plural(pending, 'cosa', 'cosas')} para empezar.</p>
      <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
        {role && (
          <li className="flex min-h-[56px] items-center justify-between gap-3 py-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white"><span aria-hidden="true">✨ </span>Elige tu rol</p>
            <button type="button" onClick={() => onOpen('role')} aria-haspopup="dialog" className={rowButton}>Elegir</button>
          </li>
        )}
        {dress && (
          <li className="flex min-h-[56px] items-center justify-between gap-3 py-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white"><span aria-hidden="true">👕 </span>Viste a tu personaje</p>
            <Link to="/my-avatar" className={rowButton}>Ir</Link>
          </li>
        )}
        {firstXp && (
          <li className="py-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white"><span aria-hidden="true">⚡ </span>Gana tus primeros XP en clase</p>
            <p className={cardText}>Participa y cumple: tu profe te dará XP.</p>
          </li>
        )}
        <li className="py-1">
          <button type="button" onClick={() => onOpen('energy')} aria-haspopup="dialog" className={cardLink}>
            <span aria-hidden="true">❤️</span> ¿Qué es la energía?
          </button>
        </li>
        <li className="py-2">
          <p className={cardText}><span aria-hidden="true">🚪 </span>Al terminar, toca <strong>Salir</strong> para que nadie use tu cuenta.</p>
        </li>
      </ul>
    </section>
  );
};
