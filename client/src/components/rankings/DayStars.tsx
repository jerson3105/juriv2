import { motion, useReducedMotion } from 'framer-motion';
import { CLAN_EMBLEMS } from '../../lib/clanApi';
import { formatNumber, type DayStars as DayStarsData } from './rankingHelpers';

// Tira de "Estrellas del día": se ve siempre que hoy haya actividad, sea cual sea el periodo elegido.
export const DayStars = ({ stars }: { stars: DayStarsData }) => {
  const reduce = useReducedMotion();
  const items = [
    stars.climber && { icon: '🚀', title: 'Gran escalada', who: stars.climber.row.name, detail: `subió ${stars.climber.places} ${stars.climber.places === 1 ? 'puesto' : 'puestos'}` },
    stars.xp && { icon: '⚡', title: 'Más XP hoy', who: stars.xp.name, detail: `+${formatNumber(stars.xp.amount)} XP` },
    stars.gold && { icon: '🪙', title: 'Más oro hoy', who: stars.gold.name, detail: `+${formatNumber(stars.gold.amount)} de oro` },
    stars.clan && { icon: CLAN_EMBLEMS[stars.clan.clan.emblem] || '🛡️', title: 'Clan del día', who: stars.clan.clan.name, detail: `+${formatNumber(stars.clan.amount)} XP` },
  ].filter(Boolean) as { icon: string; title: string; who: string; detail: string }[];

  if (items.length === 0) return null;
  return (
    <section aria-label="Estrellas del día">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">Estrellas del día</h2>
      {/* En móvil, carrusel horizontal para no empujar el podio hacia abajo. */}
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0">
        {items.map((item, i) => (
          <motion.li
            key={item.title}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="flex w-[72%] flex-shrink-0 snap-start items-center gap-3 rounded-2xl border border-amber-200 min-[480px]:w-[45%] lg:w-auto bg-gradient-to-br from-amber-50 to-white p-3 dark:border-amber-500/30 dark:from-amber-900/20 dark:to-gray-800"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-2xl dark:bg-amber-900/50" aria-hidden="true">{item.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">{item.title}</p>
              <p className="truncate font-bold text-gray-900 dark:text-white" title={item.who}>{item.who}</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">{item.detail}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
};
