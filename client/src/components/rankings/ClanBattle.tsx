import { motion, useReducedMotion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { CLAN_EMBLEMS } from '../../lib/clanApi';
import { formatNumber, type ClanRow } from './rankingHelpers';

interface ClanBattleProps {
  rows: ClanRow[];
  plus: boolean;
}

// Clanes como batalla de barras: cada barra crece con el color del clan hasta su XP.
export const ClanBattle = ({ rows, plus }: ClanBattleProps) => {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-3 rounded-3xl bg-gradient-to-b from-slate-950 via-indigo-950 to-violet-950 p-4 shadow-xl sm:p-6" aria-label="Batalla de clanes">
      {rows.map((row, index) => {
        const leader = row.rank === 1 && row.value > 0;
        const pct = Math.max(row.value > 0 ? 4 : 0, (row.value / max) * 100);
        return (
          <motion.li
            key={row.clan.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex items-center gap-3"
          >
            <span className="w-6 flex-shrink-0 text-center text-lg font-black text-white tabular-nums">{row.rank}</span>
            <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl shadow-lg ring-2 ring-white/20" style={{ backgroundColor: row.clan.color }} aria-hidden="true">
              {CLAN_EMBLEMS[row.clan.emblem] || '🛡️'}
              {leader && <Crown size={18} fill="currentColor" className="absolute -top-3 left-1/2 -ml-[9px] text-amber-300 drop-shadow" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-bold text-white">
                  {row.clan.name}
                  <span className="ml-2 text-xs font-medium text-indigo-200">{row.clan.members?.length ?? 0} miembros</span>
                </p>
                <p className={`flex-shrink-0 font-black tabular-nums ${leader ? 'text-amber-300' : 'text-white'}`}>
                  {plus && row.value > 0 ? '+' : ''}{formatNumber(row.value)} XP
                </p>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: row.clan.color, boxShadow: `0 0 12px ${row.clan.color}` }}
                  initial={{ width: reduce ? `${pct}%` : '0%' }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: reduce ? 0 : 1.1, delay: 0.2 + index * 0.08, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
};
