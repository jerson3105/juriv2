import { ArrowDown } from 'lucide-react';
import type { StudentBadgeView } from '../../../lib/badgeApi';
import { BadgeMedallion } from '../../badges/BadgeMedallion';
import { cardLink, cardText, cardTitle, homeCard, plural } from '../home/studentHomeHelpers';
import { awardWhy, firstToEarn, howText, progressFill, progressText, savingsTrack, whenText } from './badgeStudentHelpers';

const SHOWN = 5;

interface BadgeShowcaseProps {
  view: StudentBadgeView;
  onOpenEarned: (badgeId: string) => void;
  onOpenToEarn: (badgeId: string) => void;
  onShowToEarn: () => void;
}

/** «Tu vitrina»: qué tienes (con la última y su porqué) y qué te falta poco. */
export const BadgeShowcase = ({ view, onOpenEarned, onOpenToEarn, onShowToEarn }: BadgeShowcaseProps) => {
  const { earned, toEarn, secrets, near } = view;
  const last = earned[0];
  const first = earned.length === 0 ? firstToEarn(toEarn) : null;
  const summary = [
    `Tienes ${plural(earned.length, 'insignia', 'insignias')}`,
    toEarn.length > 0 ? `${toEarn.length} por ganar` : null,
    secrets > 0 ? `y ${plural(secrets, 'secreta', 'secretas')}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section aria-labelledby="showcase-title" className={`${homeCard} grid gap-5 sm:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] sm:items-start`}>
      <div className="min-w-0">
        <h2 id="showcase-title" className={cardTitle}>Tu vitrina</h2>
        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{summary}</p>

        {last ? (
          <>
            <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Tus insignias">
              {earned.slice(0, SHOWN).map((badge) => (
                <li key={badge.id}>
                  <button
                    type="button"
                    onClick={() => onOpenEarned(badge.id)}
                    aria-haspopup="dialog"
                    aria-label={`${badge.name}${badge.count > 1 ? ` (×${badge.count})` : ''}`}
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                  >
                    <BadgeMedallion badge={badge} size="sm" />
                  </button>
                </li>
              ))}
              {earned.length > SHOWN && (
                <li className="flex h-12 min-w-[48px] items-center justify-center rounded-full bg-gray-100 px-2 text-sm font-bold text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                  +{earned.length - SHOWN}
                </li>
              )}
            </ul>
            <p className="mt-3 text-sm text-gray-900 dark:text-white">
              La última: <span className="font-bold">«{last.name}»</span> · {whenText(last.lastAt)}
            </p>
            <p className={cardText}>{awardWhy(last.awards[0], last)}</p>
          </>
        ) : (
          <>
            <p className={`${cardText} mt-2`}>Aún no tienes insignias. Mira abajo cómo ganar la primera.</p>
            {first && (
              <p className="mt-2 text-sm text-gray-900 dark:text-white">
                Empieza por <span className="font-bold">«{first.name}»</span>. {howText(first)}
              </p>
            )}
          </>
        )}
        {toEarn.length > 0 && (
          <button type="button" onClick={onShowToEarn} className={cardLink}>
            Ver cómo ganar más
            <ArrowDown size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {near && (
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Te falta poco</p>
          <button
            type="button"
            onClick={() => onOpenToEarn(near.id)}
            aria-haspopup="dialog"
            className="-my-2.5 mt-[-6px] block min-h-[44px] py-2.5 text-left text-base font-bold text-gray-900 underline-offset-2 hover:underline dark:text-white"
          >
            «{near.name}»
          </button>
          <div
            role="progressbar"
            aria-label={`Progreso hacia «${near.name}»`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={near.percent}
            aria-valuetext={progressText(near.progress)}
            className={`mt-2 ${savingsTrack}`}
          >
            <div className={progressFill} style={{ width: `${near.percent}%` }} />
          </div>
          <p className={`${cardText} mt-1`}>{progressText(near.progress)}</p>
        </div>
      )}
    </section>
  );
};
