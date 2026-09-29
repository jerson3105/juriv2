import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flag, RotateCcw } from 'lucide-react';
import { clockAt, formatNumber, type RaceData } from '../rankingHelpers';

const TOP = 10;
const DURATION_MS = 9000;

interface CeremonyRaceProps {
  race: RaceData;
  since: string;
  classIcons: string[];
  onTick?: () => void;
}

// "La carrera": repetición del día; las barras crecen con el XP real minuto a minuto y se adelantan.
export const CeremonyRace = ({ race, since, classIcons, onTick }: CeremonyRaceProps) => {
  const reduce = useReducedMotion();
  const last = race.frames.length - 1;
  const [frame, setFrame] = useState(reduce ? last : 0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let startedAt: number | null = null;
    let lastFrame = -1;
    const step = (now: number) => {
      if (startedAt === null) startedAt = now;
      const t = Math.min(1, (now - startedAt) / DURATION_MS);
      const next = Math.round(t * last);
      if (next !== lastFrame) {
        lastFrame = next;
        setFrame(next);
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, last, reduce]);

  const values = race.frames[frame];
  const order = values
    .map((value, i) => ({ i, value }))
    .sort((a, b) => b.value - a.value || race.names[a.i].localeCompare(race.names[b.i], 'es'))
    .slice(0, TOP);
  const leader = order[0]?.i;

  // Sonido de adelantamiento cuando cambia el líder.
  useEffect(() => {
    if (leader !== undefined) onTick?.();
  }, [leader, onTick]);

  const max = Math.max(1, ...race.frames[last]);
  const finished = frame === last;

  return (
    <div className="flex w-full max-w-5xl flex-col">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">La repetición</p>
          <h2 className="text-3xl font-black text-white sm:text-5xl">Así fue la carrera</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-white/10 px-3 py-1.5 text-2xl font-black tabular-nums text-white" aria-label={`Hora ${clockAt(since, race.minutes[frame])}`}>
            {finished ? <span className="inline-flex items-center gap-2 text-amber-300"><Flag size={22} aria-hidden="true" />Meta</span> : clockAt(since, race.minutes[frame])}
          </span>
          {finished && !reduce && (
            <button type="button" onClick={() => { setFrame(0); setRun((r) => r + 1); }} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/20">
              <RotateCcw size={16} aria-hidden="true" />
              Repetir
            </button>
          )}
        </div>
      </header>
      <ol className="flex flex-col gap-1.5" aria-label="Carrera de XP, diez primeros">
        {order.map(({ i, value }, pos) => {
          const pct = Math.max(2, (value / max) * 100);
          const isLeader = i === leader && value > 0;
          return (
            <motion.li key={race.students[i].id} layout={!reduce} transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 } }} className="flex items-center gap-3">
              <span className="w-7 text-right text-lg font-black tabular-nums text-amber-200">{pos + 1}</span>
              <span className={`flex w-32 min-w-0 items-center gap-2 text-base font-bold sm:w-44 ${isLeader ? 'text-amber-300' : 'text-white'}`}>
                <span aria-hidden="true">{classIcons[i]}</span>
                <span className="truncate">{race.names[i]}</span>
              </span>
              <div className="relative h-9 flex-1">
                <div
                  className={`absolute inset-y-0 left-0 rounded-r-xl transition-[width] duration-150 ease-linear ${isLeader ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_20px_rgba(252,211,77,0.5)]' : 'bg-gradient-to-r from-indigo-600 to-violet-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-20 text-right text-lg font-black tabular-nums text-white">{formatNumber(value)}</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
};
