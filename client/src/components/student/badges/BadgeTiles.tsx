import { RARITY_LABELS, type BadgeToEarn, type EarnedBadge } from '../../../lib/badgeApi';
import { BadgeMedallion } from '../../badges/BadgeMedallion';
import { RARITY_STYLE } from '../../badges/badgeHelpers';
import { awardWhy, countChip, howText, isNew, newChip, progressFill, progressText, savingsTrack, shortDate } from './badgeStudentHelpers';

const tileBase = 'group flex h-full w-full flex-col items-center rounded-2xl border-2 p-4 text-center shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-lg motion-safe:hover:-translate-y-1';

const RarityChip = ({ rarity }: { rarity: EarnedBadge['rarity'] }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${RARITY_STYLE[rarity].chip}`}>{RARITY_LABELS[rarity]}</span>
);

/** Ganada: medallón encendido como en la vista del profe, con su porqué y «×N» si la ganó varias veces. */
export const EarnedTile = ({ badge, onOpen }: { badge: EarnedBadge; onOpen: () => void }) => (
  <li>
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={`${tileBase} bg-gradient-to-b to-white dark:to-gray-800 ${RARITY_STYLE[badge.rarity].tile}`}
    >
      <span className="relative">
        <BadgeMedallion badge={badge} size="md" />
        {badge.count > 1 && <span className={`absolute -right-3 -top-1 ${countChip}`}>×{badge.count}</span>}
      </span>
      <span className="mt-3 line-clamp-2 text-[15px] font-bold leading-5 text-gray-900 dark:text-white">{badge.name}</span>
      <span className="mt-1.5 flex flex-wrap justify-center gap-1">
        <RarityChip rarity={badge.rarity} />
        {isNew(badge.lastAt) && <span className={newChip}>Nueva</span>}
      </span>
      <span className="mt-2 line-clamp-2 text-xs text-gray-700 dark:text-gray-300">{awardWhy(badge.awards[0], badge)}</span>
      <span className="mt-auto pt-1 text-xs text-gray-700 dark:text-gray-300">{shortDate(badge.lastAt)}</span>
    </button>
  </li>
);

/** Por ganar: medallón apagado (sin candado), cómo se gana y, si se mide, cuánto le falta. */
export const ToEarnTile = ({ badge, onOpen }: { badge: BadgeToEarn; onOpen: () => void }) => (
  <li>
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={`${tileBase} border-dashed border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800`}
    >
      <BadgeMedallion badge={badge} size="md" dimmed />
      <span className="mt-3 line-clamp-2 text-[15px] font-bold leading-5 text-gray-900 dark:text-white">{badge.name}</span>
      <span className="mt-1.5"><RarityChip rarity={badge.rarity} /></span>
      <span className="mt-2 line-clamp-3 text-xs text-gray-700 dark:text-gray-300">{howText(badge)}</span>
      {badge.progress && badge.percent !== null && (
        <span className="mt-auto w-full pt-3">
          <span className={`block ${savingsTrack}`} aria-hidden="true">
            <span className={`block ${progressFill}`} style={{ width: `${badge.percent}%` }} />
          </span>
          <span className="mt-1 block text-xs font-semibold text-gray-900 dark:text-white">{progressText(badge.progress)}</span>
        </span>
      )}
    </button>
  </li>
);

/** Secreta sin descubrir: solo un «?» (ni nombre ni rareza). */
export const SecretTile = () => (
  <li className="flex h-full flex-col items-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-4 text-center dark:border-gray-600 dark:bg-gray-800">
    <BadgeMedallion badge={{ name: '', icon: '', customImage: null, rarity: 'COMMON' }} size="md" mystery />
    <span className="mt-3 text-[15px] font-bold text-gray-900 dark:text-white">Secreta</span>
    <span className="mt-1 text-xs text-gray-700 dark:text-gray-300">La descubres al ganarla</span>
  </li>
);
