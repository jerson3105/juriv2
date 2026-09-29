import { Minus, Plus } from 'lucide-react';
import type { Behavior } from '../../lib/behaviorApi';
import { formatBehaviorRewards, getBehaviorRewards } from '../../lib/behaviorPoints';

interface QuickBehaviorPickerProps {
  positives: Behavior[];
  negatives: Behavior[];
  positive: Behavior | null;
  negative: Behavior | null;
  allowNegative: boolean;
  onPositiveChange: (id: string) => void;
  onNegativeChange: (id: string) => void;
}

const selectClass =
  'min-h-[36px] max-w-[220px] rounded-lg border px-2 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

// Elige qué comportamiento aplican los botones +/− de cada fila.
export const QuickBehaviorPicker = ({
  positives,
  negatives,
  positive,
  negative,
  allowNegative,
  onPositiveChange,
  onNegativeChange,
}: QuickBehaviorPickerProps) => {
  if (positives.length === 0 && (!allowNegative || negatives.length === 0)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Acción rápida</span>
      {positives.length > 0 && (
        <select
          aria-label="Comportamiento del botón +"
          value={positive?.id ?? ''}
          onChange={(event) => onPositiveChange(event.target.value)}
          className={`${selectClass} border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200`}
        >
          {positives.map((behavior) => (
            <option key={behavior.id} value={behavior.id}>
              + {behavior.name} ({formatBehaviorRewards(behavior)})
            </option>
          ))}
        </select>
      )}
      {allowNegative && negatives.length > 0 && (
        <select
          aria-label="Comportamiento del botón −"
          value={negative?.id ?? ''}
          onChange={(event) => onNegativeChange(event.target.value)}
          className={`${selectClass} border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200`}
        >
          {negatives.map((behavior) => (
            <option key={behavior.id} value={behavior.id}>
              − {behavior.name} ({formatBehaviorRewards(behavior)})
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

interface QuickPointButtonsProps {
  studentName: string;
  positive: Behavior | null;
  negative: Behavior | null;
  allowNegative: boolean;
  disabled: boolean;
  onApply: (behavior: Behavior) => void;
}

const buttonClass =
  'inline-flex items-center justify-center gap-1 min-h-[36px] min-w-[44px] px-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary-500';

const firstRewardLabel = (behavior: Behavior) => {
  const reward = getBehaviorRewards(behavior)[0];
  return reward ? `${reward.amount} ${reward.type}` : '';
};

// Botones +/− de una fila: aplican el comportamiento rápido a ese alumno con un clic.
export const QuickPointButtons = ({ studentName, positive, negative, allowNegative, disabled, onApply }: QuickPointButtonsProps) => (
  <div className="inline-flex items-center gap-1.5">
    {positive && (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onApply(positive);
        }}
        disabled={disabled}
        aria-label={`Dar ${positive.name} a ${studentName}`}
        title={`${positive.name} (${formatBehaviorRewards(positive)})`}
        className={`${buttonClass} bg-emerald-700 hover:bg-emerald-800`}
      >
        <Plus size={14} aria-hidden="true" />
        {firstRewardLabel(positive)}
      </button>
    )}
    {allowNegative && negative && (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onApply(negative);
        }}
        disabled={disabled}
        aria-label={`Aplicar ${negative.name} a ${studentName}`}
        title={`${negative.name} (${formatBehaviorRewards(negative)})`}
        className={`${buttonClass} bg-red-600 hover:bg-red-700`}
      >
        <Minus size={14} aria-hidden="true" />
        {firstRewardLabel(negative)}
      </button>
    )}
  </div>
);
