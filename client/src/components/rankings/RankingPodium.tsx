import { motion, useReducedMotion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { StudentAvatarMini } from '../avatar/StudentAvatarMini';
import { useCountUp } from '../../hooks/useCountUp';
import { formatNumber, PEDESTAL_STYLE, type RankRow } from './rankingHelpers';


// En pantalla: 2.º, 1.º, 3.º; en el DOM (lectores de pantalla) van en orden 1, 2, 3.
const PLACE_ORDER = ['order-2', 'order-1', 'order-3'];

const PodiumPlace = ({ row, place, unit, plus }: { row: RankRow; place: 0 | 1 | 2; unit: string; plus: boolean }) => {
  const reduce = useReducedMotion();
  const value = useCountUp(row.value, 1100, 250 + (2 - place) * 150);
  const style = PEDESTAL_STYLE[place];
  const first = place === 0;

  return (
    <motion.li
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + (2 - place) * 0.15, type: 'spring', stiffness: 160, damping: 18 }}
      className={`flex w-1/3 max-w-[11rem] flex-col items-center ${PLACE_ORDER[place]}`}
      aria-label={`Puesto ${row.rank}${row.tied ? ' (empate)' : ''}: ${row.name}, ${formatNumber(row.value)} ${unit}`}
    >
      <div className="relative flex flex-col items-center" aria-hidden="true">
        {first && (
          <motion.span
            animate={reduce ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="mb-1 text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.8)]"
          >
            <Crown size={26} fill="currentColor" />
          </motion.span>
        )}
        <span className="pointer-events-none absolute inset-x-[-40%] bottom-0 top-1/4 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),transparent_65%)]" />
        <StudentAvatarMini studentProfileId={row.student.id} gender={row.student.avatarGender ?? 'MALE'} size="sm" className={first ? 'scale-110' : ''} />
      </div>
      <p className={`mt-2 w-full truncate text-center font-black text-white ${first ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`} title={row.name} aria-hidden="true">
        {row.name}
      </p>
      <p className={`font-bold tabular-nums ${first ? 'text-amber-300' : 'text-indigo-100'} text-sm`} aria-hidden="true">
        {plus && row.value > 0 ? '+' : ''}{formatNumber(value)} {unit}
      </p>
      <div className={`relative mt-2 flex w-full items-start justify-center overflow-hidden rounded-t-xl bg-gradient-to-b ${style.bar} ${style.height} shadow-lg`} aria-hidden="true">
        <span className="badge-shine-auto pointer-events-none absolute inset-0"><span className="badge-shine-band" /></span>
        <span className={`mt-2 text-3xl font-black sm:text-4xl ${style.text}`}>{row.rank}</span>
        {row.tied && <span className={`absolute bottom-1.5 rounded-full bg-white/70 px-2 text-xs font-bold ${style.text}`}>Empate</span>}
      </div>
    </motion.li>
  );
};

interface RankingPodiumProps {
  rows: RankRow[];
  unit: string;
  plus: boolean;
  mascot?: string;
}

// Podio del tablero: escenario oscuro con foco sobre el 1.º, avatares de pie sobre los pedestales.
export const RankingPodium = ({ rows, unit, plus, mascot }: RankingPodiumProps) => {
  const [first, second, third] = rows;
  return (
    <section aria-label="Podio" className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 px-3 pt-6 shadow-xl sm:px-6">
      <span className="pointer-events-none absolute left-1/2 top-0 h-full w-72 -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(253,230,138,0.35),transparent_65%)]" aria-hidden="true" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" aria-hidden="true" />
      {mascot && <img src={mascot} alt="" className="pointer-events-none absolute bottom-0 left-2 hidden w-40 select-none lg:block xl:w-48" />}
      <ol className="relative mx-auto flex max-w-xl items-end justify-center gap-2 sm:gap-4">
        {first && <PodiumPlace row={first} place={0} unit={unit} plus={plus} />}
        {second ? <PodiumPlace row={second} place={1} unit={unit} plus={plus} /> : <li className="order-1 w-1/3 max-w-[11rem]" aria-hidden="true" />}
        {third ? <PodiumPlace row={third} place={2} unit={unit} plus={plus} /> : <li className="order-3 w-1/3 max-w-[11rem]" aria-hidden="true" />}
      </ol>
    </section>
  );
};
