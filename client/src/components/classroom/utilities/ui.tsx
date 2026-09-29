import { X } from 'lucide-react';
import type { Behavior } from '../../../lib/behaviorApi';
import { getBehaviorRewards } from '../../../lib/behaviorPoints';

// Botón de cerrar de las herramientas a pantalla completa (fondo oscuro).
export const ToolCloseButton = ({ onClose }: { onClose: () => void }) => (
  <button
    type="button"
    onClick={onClose}
    aria-label="Cerrar herramienta"
    title="Cerrar (Esc)"
    className="absolute top-4 right-4 z-10 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white"
  >
    <X size={24} aria-hidden="true" />
  </button>
);

// Comportamientos a un toque sobre fondo oscuro (herramientas proyectadas).
export const DarkBehaviorButtons = ({
  behaviors,
  disabled,
  onApply,
}: {
  behaviors: Behavior[];
  disabled: boolean;
  onApply: (behavior: Behavior) => void;
}) => (
  <div className="flex flex-wrap justify-center gap-2">
    {behaviors.map((behavior) => {
      const rewards = getBehaviorRewards(behavior);
      const sign = behavior.isPositive ? '+' : '−';
      return (
        <button
          key={behavior.id}
          type="button"
          onClick={() => onApply(behavior)}
          disabled={disabled}
          className={`inline-flex items-center gap-2 min-h-[48px] px-4 rounded-xl border-2 text-base font-semibold text-white transition-colors disabled:opacity-50 ${
            behavior.isPositive
              ? 'border-emerald-400/70 bg-emerald-500/20 hover:bg-emerald-500/35'
              : 'border-rose-400/70 bg-rose-500/20 hover:bg-rose-500/35'
          }`}
        >
          <span aria-hidden="true">{behavior.icon || (behavior.isPositive ? '⭐' : '💔')}</span>
          {behavior.name}
          <span className={`text-sm font-bold ${behavior.isPositive ? 'text-emerald-200' : 'text-rose-200'}`}>
            {rewards.map((r) => `${sign}${r.amount} ${r.type}`).join(' · ')}
          </span>
        </button>
      );
    })}
  </div>
);
