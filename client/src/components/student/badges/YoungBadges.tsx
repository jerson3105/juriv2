import { Hand } from 'lucide-react';
import { RARITY_LABELS, type BadgeToEarn, type StudentBadgeView } from '../../../lib/badgeApi';
import { BadgeMedallion } from '../../badges/BadgeMedallion';
import { RARITY_STYLE } from '../../badges/badgeHelpers';
import { cardText, cardTitle, homeCard } from '../home/studentHomeHelpers';
import { countChip, groupToEarn, progressFill, savingsTrack } from './badgeStudentHelpers';

const MAX_TO_EARN = 4;

/** Progreso para pequeños: puntos si la meta es corta; si no, una barra sin números. */
const YoungProgress = ({ badge }: { badge: BadgeToEarn }) => {
  const progress = badge.progress!;
  const current = Math.min(progress.current, progress.target);
  if (progress.unit === 'times' && progress.target <= 10) {
    return (
      <span className="mt-2 flex justify-center gap-1" role="img" aria-label={`${current} de ${progress.target}`}>
        {Array.from({ length: progress.target }, (_, index) => (
          <span key={index} className={`h-3 w-3 rounded-full ${index < current ? 'bg-primary-600 dark:bg-primary-300' : 'bg-gray-300 dark:bg-gray-600'}`} />
        ))}
      </span>
    );
  }
  return (
    <span className="mt-2 block w-full">
      <span className={`block ${savingsTrack}`} aria-hidden="true">
        <span className={`block ${progressFill}`} style={{ width: `${badge.percent ?? 0}%` }} />
      </span>
      <span className="mt-1 block text-sm font-semibold text-gray-900 dark:text-white">{(badge.percent ?? 0) >= 50 ? '¡Vas bien!' : '¡Tú puedes!'}</span>
    </span>
  );
};

interface YoungBadgesProps {
  view: StudentBadgeView;
  onOpenEarned: (badgeId: string) => void;
  onOpenToEarn: (badgeId: string) => void;
}

/**
 * «Mis insignias» de los pequeños (inicial a 2.º): medallas grandes, frases de una idea, la rareza
 * solo con el color (y en texto para el lector), sin XP ni oro, sin secretas ni listas plegadas.
 */
export const YoungBadges = ({ view, onOpenEarned, onOpenToEarn }: YoungBadgesProps) => {
  const { auto, teacher } = groupToEarn(view.toEarn);
  const next = [...auto, ...teacher].slice(0, MAX_TO_EARN);

  return (
    <div className="space-y-5">
      <section aria-labelledby="young-mine-title" className={homeCard}>
        <h2 id="young-mine-title" className={cardTitle}>Tus insignias</h2>
        {view.earned.length === 0 ? (
          <p className={`${cardText} mt-2`}>Aún no tienes. ¡Mira abajo cómo ganar una!</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {view.earned.map((badge) => (
              <li key={badge.id}>
                <button
                  type="button"
                  onClick={() => onOpenEarned(badge.id)}
                  aria-haspopup="dialog"
                  className={`flex h-full w-full flex-col items-center rounded-2xl border-2 bg-gradient-to-b to-white p-3 text-center dark:to-gray-800 ${RARITY_STYLE[badge.rarity].tile}`}
                >
                  <span className="relative">
                    <BadgeMedallion badge={badge} size="lg" />
                    {badge.count > 1 && <span className={`absolute -right-3 -top-1 ${countChip}`}>×{badge.count}</span>}
                  </span>
                  <span className="mt-2 line-clamp-2 text-base font-bold text-gray-900 dark:text-white">{badge.name}</span>
                  <span className="sr-only">{RARITY_LABELS[badge.rarity]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {next.length > 0 && (
        <section aria-labelledby="young-next-title" className={homeCard}>
          <h2 id="young-next-title" className={cardTitle}>Puedes ganar</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {next.map((badge) => (
              <li key={badge.id}>
                <button
                  type="button"
                  onClick={() => onOpenToEarn(badge.id)}
                  aria-haspopup="dialog"
                  className="flex h-full w-full flex-col items-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-3 text-center dark:border-gray-600 dark:bg-gray-800"
                >
                  <BadgeMedallion badge={badge} size="lg" dimmed />
                  <span className="mt-2 line-clamp-2 text-base font-bold text-gray-900 dark:text-white">{badge.name}</span>
                  {badge.kind === 'TEACHER' || !badge.progress ? (
                    <span className="mt-1 flex items-center gap-1 text-sm text-gray-800 dark:text-gray-100">
                      <Hand size={16} aria-hidden="true" />Tu profe te la da
                    </span>
                  ) : (
                    <YoungProgress badge={badge} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
