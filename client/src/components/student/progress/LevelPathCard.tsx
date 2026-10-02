import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import type { StudentProgress } from '../../../lib/studentApi';
import { levelProgress } from '../../students/profile/profileHelpers';
import { cardLink, cardText, cardTitle, homeCard, plural } from '../home/studentHomeHelpers';
import { fmt } from './progressHelpers';

interface LevelPathCardProps {
  xp: number;
  level: number;
  xpPerLevel: number;
  badges: StudentProgress['badges'] | null;
}

/** «Tu camino»: el nivel y el XP del perfil (los mismos de la cabecera) y cuánto falta para el siguiente. */
export const LevelPathCard = ({ xp, level, xpPerLevel, badges }: LevelPathCardProps) => {
  const current = Math.max(1, level || 1);
  const { inLevel, needed, percent } = levelProgress(xp, current, xpPerLevel);
  const missing = Math.max(0, needed - inLevel);
  // El anterior (si hay), el actual y los que siguen: siempre cuatro pasos.
  const first = Math.max(1, current - 1);
  const steps = [first, first + 1, first + 2, first + 3];

  return (
    <section aria-labelledby="path-title" className={homeCard}>
      <h2 id="path-title" className={cardTitle}>Tu camino</h2>
      <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
        Nivel {current} <span className="text-base font-bold text-gray-700 dark:text-gray-300">· {fmt(xp)} XP</span>
      </p>

      <ol className="mt-3 grid grid-cols-4 gap-1.5">
        {steps.map((step) => {
          const done = step < current;
          const isCurrent = step === current;
          return (
            <li key={step} className="min-w-0">
              <p className={`flex items-center justify-center gap-1 text-xs ${isCurrent ? 'font-black text-gray-900 dark:text-white' : 'font-semibold text-gray-700 dark:text-gray-300'}`}>
                {done && <Check size={12} aria-hidden="true" />}
                Nivel {step}
                <span className="sr-only">{done ? ' (superado)' : isCurrent ? ' (tu nivel)' : ''}</span>
              </p>
              <div
                className="mt-1 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                {...(isCurrent ? { role: 'progressbar', 'aria-label': `Avance del nivel ${current}`, 'aria-valuemin': 0, 'aria-valuemax': needed, 'aria-valuenow': inLevel } : { 'aria-hidden': true })}
              >
                <div className="h-full rounded-full bg-primary-600 dark:bg-primary-400" style={{ width: done ? '100%' : isCurrent ? `${percent}%` : '0%' }} />
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
        Te faltan {fmt(missing)} XP para el nivel {current + 1}
      </p>
      <p className={cardText}>Ganas XP cuando participas y cumples en clase.</p>

      {badges && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 border-t border-gray-200 pt-2 dark:border-gray-700">
          <p className={`${cardText} min-w-0 break-words`}>
            <span aria-hidden="true">🏅 </span>
            {badges.count > 0
              ? <>{plural(badges.count, 'insignia', 'insignias')}{badges.latest && <> · la última: «{badges.latest.name}»</>}</>
              : 'Aún no tienes insignias.'}
          </p>
          <Link to="/my-badges" className={cardLink}>
            {badges.count > 0 ? 'Ver mis insignias' : 'Ver insignias'}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
};
