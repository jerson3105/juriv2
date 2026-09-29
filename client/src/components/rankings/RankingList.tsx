import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { classIcon, classOf, formatNumber, type ClassMap, type RankRow } from './rankingHelpers';

// Chip de movimiento del día: sube en verde; baja en gris (tono neutro, sin señalar a nadie).
export const MovementChip = ({ movement, onDark = false }: { movement: number | null; onDark?: boolean }) => {
  if (!movement) return null;
  const up = movement > 0;
  const places = Math.abs(movement);
  const label = `${up ? 'Subió' : 'Bajó'} ${places} ${places === 1 ? 'puesto' : 'puestos'} hoy`;
  const color = up
    ? onDark ? 'bg-emerald-400/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
    : onDark ? 'bg-white/10 text-slate-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${color}`} title={label}>
      {up ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
      {places}
      <span className="sr-only">{label}</span>
    </span>
  );
};

interface RankingListProps {
  rows: RankRow[];
  classMap: ClassMap;
  unit: string;
  plus: boolean;
}

// Resto de la clasificación (desde el 4.º). Las filas se recolocan animadas cuando cambian los puestos.
export const RankingList = ({ rows, classMap, unit, plus }: RankingListProps) => {
  const reduce = useReducedMotion();
  if (rows.length === 0) return null;
  return (
    <ol className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Resto de la clasificación">
      <AnimatePresence initial={false}>
        {rows.map((row, index) => {
          const classInfo = classOf(row, classMap);
          return (
            <motion.li
              key={row.student.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: Math.min(index, 12) * 0.03, layout: { type: 'spring', stiffness: 260, damping: 30 } }}
              className="flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0 dark:border-gray-700 sm:gap-4 sm:px-4"
            >
              <span className="w-9 flex-shrink-0 text-center text-base font-black tabular-nums text-gray-700 dark:text-gray-300" aria-label={`Puesto ${row.rank}${row.tied ? ', empate' : ''}`}>
                {row.rank}
              </span>
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xl dark:bg-indigo-900/40" aria-hidden="true">
                {classIcon(row, classMap)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate font-semibold text-gray-900 dark:text-white">{row.name}</span>
                  <MovementChip movement={row.movement} />
                </p>
                <p className="truncate text-xs text-gray-700 dark:text-gray-300">
                  {[classInfo?.name, `Nivel ${row.student.level}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="flex-shrink-0 text-right">
                <span className={`block font-black tabular-nums ${row.value > 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                  {plus && row.value > 0 ? '+' : ''}{formatNumber(row.value)}
                </span>
                <span className="block text-xs text-gray-700 dark:text-gray-300">{unit}</span>
              </p>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
};
