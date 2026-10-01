import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CLAN_EMBLEMS, type StudentClanInfo } from '../../../lib/clanApi';
import { cardText, homeCard } from './studentHomeHelpers';

/** Mi clan: lo que aporta el alumno y lo de todo el equipo (sin puesto ni victorias). */
export const ClanCard = ({ info }: { info: StudentClanInfo }) => (
  <Link
    to="/my-clan"
    className={`${homeCard} flex items-center gap-4 transition-colors hover:border-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 dark:hover:border-primary-500`}
  >
    <span
      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl"
      style={{ backgroundColor: `${info.clan.color}25`, border: `2px solid ${info.clan.color}50` }}
      aria-hidden="true"
    >
      {CLAN_EMBLEMS[info.clan.emblem] || '🛡️'}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Mi clan</span>
      <span className="block truncate text-base font-bold text-gray-900 dark:text-white">{info.clan.name}</span>
      <span className={`block ${cardText}`}>
        Tu aporte: <strong className="text-gray-900 dark:text-white">+{info.myContribution.toLocaleString('es')} XP</strong>
        {' · '}Entre todos: {info.clan.totalXp.toLocaleString('es')} XP
      </span>
    </span>
    <ChevronRight size={20} className="flex-shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
  </Link>
);
