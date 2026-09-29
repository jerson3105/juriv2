import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { StudentAvatarMini } from '../../avatar/StudentAvatarMini';
import { formatNumber, PEDESTAL_STYLE, type RankRow } from '../rankingHelpers';

const PLACE_ORDER = ['order-2', 'order-1', 'order-3'];
const MEDAL = ['Oro', 'Plata', 'Bronce'];
// Altura del pedestal: bajo y apagado hasta que se revela, luego sube.
const HEIGHT = [
  { full: 176, low: 60 },
  { full: 128, low: 50 },
  { full: 96, low: 44 },
];

interface CeremonyPodiumProps {
  rows: RankRow[];
  revealedFrom: number; // los puestos con índice >= revealedFrom ya se ven
  drumming: number | null; // puesto que está sonando el redoble
  unit: string;
  plus: boolean;
  compact: boolean;
}

const Place = ({ row, place, revealed, drumming, unit, plus, compact }: { row?: RankRow; place: 0 | 1 | 2; revealed: boolean; drumming: boolean; unit: string; plus: boolean; compact: boolean }) => {
  const reduce = useReducedMotion();
  const style = PEDESTAL_STYLE[place];
  const first = place === 0;
  const scale = compact ? 0.6 : 1;
  const height = (revealed ? HEIGHT[place].full : HEIGHT[place].low) * scale;

  return (
    <li className={`relative flex w-[30vw] max-w-[270px] flex-col items-center ${PLACE_ORDER[place]}`} aria-hidden={!revealed}>
      {/* Foco sobre el pedestal durante el redoble y al revelarse */}
      <AnimatePresence>
        {(drumming || revealed) && (
          <motion.span
            key="spot"
            initial={{ opacity: 0 }}
            animate={{ opacity: drumming ? [0.35, 0.8, 0.35] : first ? 0.9 : 0.55 }}
            exit={{ opacity: 0 }}
            transition={drumming && !reduce ? { duration: 0.6, repeat: Infinity } : { duration: 0.4 }}
            className="pointer-events-none absolute -inset-x-16 bottom-0 top-[-60vh] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)] bg-gradient-to-b from-amber-100/40 via-amber-100/10 to-transparent"
          />
        )}
      </AnimatePresence>

      <div className="relative flex min-h-[1px] flex-col items-center">
        {row && revealed ? (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -80, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 170, damping: 13 }}
            className="relative flex flex-col items-center"
          >
            {first && <span className="rk-rays pointer-events-none absolute -inset-24" aria-hidden="true" />}
            {first && (
              <motion.span
                initial={reduce ? { opacity: 0 } : { y: -120, opacity: 0, rotate: -30 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 11 }}
                className="relative z-10 -mb-1 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.9)]"
              >
                <Crown size={compact ? 30 : 48} fill="currentColor" />
              </motion.span>
            )}
            <span className="relative">
              <span className="pointer-events-none absolute inset-x-[-45%] bottom-0 top-1/4 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.25),transparent_65%)]" aria-hidden="true" />
              <StudentAvatarMini studentProfileId={row.student.id} gender={row.student.avatarGender ?? 'MALE'} size={compact ? 'sm' : 'md'} />
            </span>
            <p className={`relative mt-2 max-w-full truncate text-center font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] ${first ? (compact ? 'text-xl' : 'text-4xl') : (compact ? 'text-base' : 'text-2xl')}`} title={row.name}>
              {row.name}
            </p>
            <p className={`relative font-black tabular-nums ${first ? 'text-amber-300' : 'text-indigo-100'} ${compact ? 'text-sm' : 'text-xl'}`}>
              {plus && row.value > 0 ? '+' : ''}{formatNumber(row.value)} {unit}
            </p>
          </motion.div>
        ) : (
          <motion.span
            animate={drumming && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.5, repeat: drumming ? Infinity : 0 }}
            className={`mb-2 flex items-center justify-center rounded-full border-2 border-dashed font-black ${drumming ? 'border-amber-200 text-amber-200' : 'border-white/30 text-white/50'} ${compact ? 'h-16 w-16 text-3xl' : 'h-28 w-28 text-6xl'}`}
          >
            ?
          </motion.span>
        )}
      </div>

      <motion.div
        initial={false}
        animate={{ height }}
        transition={{ type: 'spring', stiffness: 120, damping: 16 }}
        className={`relative mt-3 flex w-full items-start justify-center overflow-hidden rounded-t-2xl bg-gradient-to-b ${style.bar} shadow-[0_-10px_40px_rgba(0,0,0,0.35)] ${revealed ? '' : 'opacity-40'}`}
      >
        {revealed && <span className="badge-shine-auto pointer-events-none absolute inset-0"><span className="badge-shine-band" /></span>}
        <span className={`relative flex flex-col items-center font-black ${style.text}`}>
          <span className={compact ? 'text-3xl' : 'text-6xl'}>{row?.rank ?? place + 1}</span>
          {!compact && revealed && <span className="text-sm uppercase tracking-widest">{MEDAL[place]}</span>}
        </span>
      </motion.div>
    </li>
  );
};

// Podio de la gala: tres pedestales; cada puesto se revela tras su redoble (3.º, 2.º y por último el 1.º).
export const CeremonyPodium = ({ rows, revealedFrom, drumming, unit, plus, compact }: CeremonyPodiumProps) => {
  const labels = rows
    .map((row, i) => (i >= revealedFrom ? `Puesto ${row.rank}: ${row.name}, ${formatNumber(row.value)} ${unit}` : null))
    .filter(Boolean)
    .join('. ');
  return (
    <div className="flex w-full flex-col items-center">
      <p className="sr-only" aria-live="assertive">{labels}</p>
      <ol className="flex w-full items-end justify-center gap-3 sm:gap-8">
        {([0, 1, 2] as const).map((place) => (
          <Place
            key={place}
            row={rows[place]}
            place={place}
            revealed={!!rows[place] && place >= revealedFrom}
            drumming={drumming === place}
            unit={unit}
            plus={plus}
            compact={compact}
          />
        ))}
      </ol>
    </div>
  );
};
