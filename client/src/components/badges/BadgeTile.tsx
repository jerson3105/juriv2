import { motion } from 'framer-motion';
import { Archive, Copy, Gift, Hand, Lock, Pencil, Zap } from 'lucide-react';
import { RARITY_LABELS, type Badge } from '../../lib/badgeApi';
import type { Behavior } from '../../lib/behaviorApi';
import { REWARD_PILL_CLASS } from '../../lib/behaviorPoints';
import { BadgeMedallion } from './BadgeMedallion';
import { RARITY_STYLE, canAwardManually, conditionText } from './badgeHelpers';

interface BadgeTileProps {
  badge: Badge;
  index: number;
  behaviors: Behavior[];
  holders: { students: number; awards: number };
  onAward: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
}

const iconButton =
  'flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white';

// Baldosa de insignia para el profesor: qué es, cómo se gana, qué da y quién la tiene.
export const BadgeTile = ({ badge, index, behaviors, holders, onAward, onEdit, onDuplicate, onArchive }: BadgeTileProps) => {
  const style = RARITY_STYLE[badge.rarity];
  const condition = conditionText(badge.unlockCondition, behaviors);
  const manual = canAwardManually(badge);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25, delay: Math.min(index, 12) * 0.03 }}
      whileHover={{ y: -4 }}
      className={`group flex flex-col rounded-2xl border-2 bg-gradient-to-b to-white p-4 shadow-sm transition-shadow hover:shadow-lg dark:to-gray-800 ${style.tile}`}
    >
      <div className="relative flex justify-center pt-1">
        <BadgeMedallion badge={badge} size="md" />
        {badge.isSecret && (
          <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-full bg-gray-900/85 px-2 py-0.5 text-xs font-semibold text-white" title="Los alumnos no la ven hasta ganarla">
            <Lock size={11} aria-hidden="true" />
            Secreta
          </span>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 text-center text-[15px] font-bold leading-5 text-gray-900 dark:text-white" title={badge.name}>
        {badge.name}
      </h3>
      <div className="mt-1.5 flex justify-center">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.chip}`}>{RARITY_LABELS[badge.rarity]}</span>
      </div>
      {badge.description && (
        <p className="mt-2 line-clamp-2 text-center text-xs text-gray-700 dark:text-gray-300" title={badge.description}>
          {badge.description}
        </p>
      )}

      <div className="mt-3 space-y-1.5 border-t border-gray-200/80 pt-3 text-xs dark:border-gray-700">
        <p className="flex items-start gap-1.5 text-gray-800 dark:text-gray-200">
          {badge.assignmentMode === 'MANUAL' ? (
            <Hand size={14} className="mt-px flex-shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true" />
          ) : (
            <Zap size={14} className="mt-px flex-shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
          )}
          <span>
            {badge.assignmentMode === 'MANUAL' && 'La das tú'}
            {badge.assignmentMode === 'AUTOMATIC' && `Sola ${condition ?? '(sin condición)'}`}
            {badge.assignmentMode === 'BOTH' && `La das tú o sola ${condition ?? ''}`}
          </span>
        </p>
        {(badge.rewardXp > 0 || badge.rewardGp > 0) && (
          <p className="flex flex-wrap gap-1">
            {badge.rewardXp > 0 && <span className={`rounded-full px-2 py-0.5 font-bold ${REWARD_PILL_CLASS.XP}`}>+{badge.rewardXp} XP</span>}
            {badge.rewardGp > 0 && <span className={`rounded-full px-2 py-0.5 font-bold ${REWARD_PILL_CLASS.GP}`}>+{badge.rewardGp} GP</span>}
          </p>
        )}
        <p className={holders.students > 0 ? 'font-semibold text-gray-800 dark:text-gray-100' : 'italic text-gray-600 dark:text-gray-400'}>
          {holders.students > 0
            ? `${holders.students} ${holders.students === 1 ? 'alumno la tiene' : 'alumnos la tienen'}${holders.awards > holders.students ? ` · ${holders.awards} veces` : ''}`
            : 'Nadie la tiene aún'}
        </p>
      </div>

      <div className="mt-auto space-y-2 pt-3">
        {manual ? (
          <button
            type="button"
            onClick={onAward}
            className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            <Gift size={16} aria-hidden="true" />
            Otorgar
          </button>
        ) : (
          <p className="flex min-h-[40px] items-center justify-center rounded-xl bg-gray-100 px-2 text-center text-xs font-semibold text-gray-700 dark:bg-gray-700/60 dark:text-gray-200">Se otorga sola</p>
        )}
        {(onEdit || onDuplicate || onArchive) && (
        <div className="flex justify-center gap-1">
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={`Editar ${badge.name}`} title="Editar" className={iconButton}>
            <Pencil size={16} aria-hidden="true" />
          </button>
        )}
        {onDuplicate && (
          <button type="button" onClick={onDuplicate} aria-label={`Duplicar ${badge.name}`} title="Duplicar" className={iconButton}>
            <Copy size={16} aria-hidden="true" />
          </button>
        )}
        {onArchive && (
          <button
            type="button"
            onClick={onArchive}
            aria-label={`Archivar ${badge.name}`}
            title="Archivar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <Archive size={16} aria-hidden="true" />
          </button>
        )}
        </div>
        )}
      </div>
    </motion.li>
  );
};
