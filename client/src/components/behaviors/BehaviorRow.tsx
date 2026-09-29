import { Award, BookOpen, Check, Copy, Pencil, Trash2 } from 'lucide-react';
import type { Behavior, BehaviorUsage } from '../../lib/behaviorApi';
import { getBehaviorRewards, REWARD_PILL_CLASS } from '../../lib/behaviorPoints';
import { usageLabel } from './behaviorHelpers';

interface BehaviorRowProps {
  behavior: Behavior;
  usage?: BehaviorUsage;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const actionClass =
  'flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white';

// Fila compacta: icono, nombre, recompensas y uso real; acciones siempre visibles.
export const BehaviorRow = ({
  behavior,
  usage,
  selectionMode,
  isSelected,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onDelete,
}: BehaviorRowProps) => {
  const rewards = getBehaviorRewards(behavior);
  const sign = behavior.isPositive ? '+' : '−';
  const unused = !usage || usage.uses === 0;

  const content = (
    <>
      {selectionMode && (
        <span
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
            isSelected ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-400 dark:border-gray-500'
          }`}
          aria-hidden="true"
        >
          {isSelected && <Check size={14} />}
        </span>
      )}
      <span
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
          behavior.isPositive ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'
        }`}
        aria-hidden="true"
      >
        {behavior.icon || (behavior.isPositive ? '⭐' : '💔')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words text-[15px] font-semibold leading-5 text-gray-900 dark:text-white" title={behavior.name}>
          {behavior.name}
        </span>
        {behavior.description && (
          <span className="mt-0.5 block truncate text-xs text-gray-600 dark:text-gray-300" title={behavior.description}>
            {behavior.description}
          </span>
        )}
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {rewards.map((reward) => (
            <span key={reward.type} className={`rounded-full px-2 py-0.5 text-xs font-bold ${REWARD_PILL_CLASS[reward.type]}`}>
              {sign}{reward.amount} {reward.type}
            </span>
          ))}
          <span className={`text-xs ${unused ? 'italic text-gray-600 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {usageLabel(usage)}
          </span>
        </span>
        {(behavior.competency || behavior.schoolBehaviorId) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {behavior.competency && (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                title={behavior.competency.name}
              >
                <Award size={12} className="flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{behavior.competency.shortName || behavior.competency.name}</span>
              </span>
            )}
            {behavior.competencyIndicator && (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                title={behavior.competencyIndicator.name}
              >
                <BookOpen size={12} className="flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{behavior.competencyIndicator.name}</span>
              </span>
            )}
            {behavior.schoolBehaviorId && (
              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                🏫 Escuela
              </span>
            )}
          </span>
        )}
      </span>
    </>
  );

  if (selectionMode) {
    return (
      <li>
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={isSelected}
          className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
            isSelected
              ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30'
              : 'border-gray-200 bg-white hover:border-primary-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-600'
          }`}
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600">
      {content}
      <span className="flex flex-shrink-0 items-center gap-0.5 self-start sm:self-center">
        <button type="button" onClick={onDuplicate} aria-label={`Duplicar ${behavior.name}`} title="Duplicar" className={actionClass}>
          <Copy size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={onEdit} aria-label={`Editar ${behavior.name}`} title="Editar" className={actionClass}>
          <Pencil size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Eliminar ${behavior.name}`}
          title="Eliminar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
};
