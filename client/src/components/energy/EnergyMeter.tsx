import { Heart, Moon } from 'lucide-react';
import { heartsOf, LOW_ENERGY_RATIO } from './energyHelpers';

/** "Descansando": HP en 0. Luna en tonos pizarra, sin rojo ni alarmas. */
export const RestingPill = ({ compact = false }: { compact?: boolean }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100 ${compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}>
    <Moon size={compact ? 12 : 14} className="fill-current" aria-hidden="true" />
    Descansando
  </span>
);

/** Inicial: 5 corazones, sin números. */
export const Hearts = ({ hp, maxHp }: { hp: number; maxHp: number }) => {
  const full = heartsOf(hp, maxHp);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Energía: ${full} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Heart key={i} size={14} aria-hidden="true"
          className={i < full ? 'fill-red-600 text-red-600 dark:fill-red-400 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'} />
      ))}
    </span>
  );
};

/** Energía de un alumno: luna si descansa, corazones en inicial, barra y número en el resto. */
export const EnergyMeter = ({ hp, maxHp, initial }: { hp: number; maxHp: number; initial?: boolean }) => {
  if (hp <= 0) return <RestingPill compact />;
  if (initial) return <Hearts hp={hp} maxHp={maxHp} />;
  const ratio = Math.min(1, hp / Math.max(1, maxHp));
  const low = ratio < LOW_ENERGY_RATIO;
  return (
    <span className="inline-flex items-center gap-2">
      <Heart size={14} className={`flex-shrink-0 ${low ? 'fill-red-600 text-red-600 dark:fill-red-400 dark:text-red-400' : 'text-red-600 dark:text-red-400'}`} aria-hidden="true" />
      <span className="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600" aria-hidden="true">
        <span className={`block h-full origin-left rounded-full ${low ? 'bg-red-600' : ratio < 0.6 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ transform: `scaleX(${ratio})` }} />
      </span>
      <span className={`text-sm font-medium tabular-nums ${low ? 'text-red-700 dark:text-red-300' : 'text-gray-800 dark:text-gray-100'}`}>
        {hp}/{maxHp}
      </span>
    </span>
  );
};
