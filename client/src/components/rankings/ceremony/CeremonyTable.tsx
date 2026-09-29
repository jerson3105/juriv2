import { motion, useReducedMotion } from 'framer-motion';
import type { ClassMap, RankRow } from '../rankingHelpers';
import { CeremonyRow } from './CeremonyActs';

interface CeremonyTableProps {
  rows: RankRow[];
  classMap: ClassMap;
  unit: string;
  plus: boolean;
}

// Clasificación completa al final de la gala: todos encuentran su puesto (tono neutro, solo se destacan subidas).
export const CeremonyTable = ({ rows, classMap, unit, plus }: CeremonyTableProps) => {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full w-full max-w-7xl flex-col">
      <header className="mb-4 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">Busca tu nombre</p>
        <h2 className="text-3xl font-black text-white sm:text-5xl">Clasificación completa</h2>
      </header>
      <ol className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto pb-2 pr-1 md:grid-cols-2 xl:grid-cols-3" aria-label="Clasificación completa">
        {rows.map((row, i) => (
          <motion.li
            key={row.student.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 40) * 0.025 }}
          >
            <CeremonyRow row={row} classMap={classMap} unit={unit} plus={plus} highlight={row.rank <= 3 && row.value > 0} />
          </motion.li>
        ))}
      </ol>
    </div>
  );
};
