import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { studentApi, type StudentNews, type StudentNewsLine } from '../../../lib/studentApi';
import { useStudentStore } from '../../../store/studentStore';
import { HomeEmptyState } from './HomeEmptyState';
import type { HomeModalKind } from './HomeActionButton';
import { addDaysKey, cardLink, cardText, cardTitle, homeCard, localDateKey, plural, rowButton } from './studentHomeHelpers';

const MAX_GAINS = 4;

interface WhatsNewCardProps {
  profileId: string;
  news: StudentNews;
  resting: boolean;
  /** Cartas del Correo recibidas desde el corte. */
  letters: number;
  onOpen: (kind: HomeModalKind) => void;
}

const times = (count: number) => (count > 1 ? ` (${count} veces)` : '');
const withReason = (line: StudentNewsLine) => (line.reason ? ` · ${line.reason}` : '');

// Cada línea: ícono decorativo (oculto al lector) + texto.
const Line = ({ emoji, children, className }: { emoji: string; children: ReactNode; className?: string }) => (
  <li className={className}><span aria-hidden="true">{emoji} </span>{children}</li>
);

const gainText = (line: StudentNewsLine) =>
  line.pointType === 'XP'
    ? `+${line.amount.toLocaleString('es')} XP${withReason(line)}${times(line.count)}`
    : `+${line.amount.toLocaleString('es')} de oro${withReason(line)}${times(line.count)}`;

const lossText = (line: StudentNewsLine) => {
  if (line.pointType === 'HP') return `Tu energía bajó ${line.amount.toLocaleString('es')}${withReason(line)}${times(line.count)}`;
  if (line.pointType === 'XP') return `${line.amount.toLocaleString('es')} XP menos${withReason(line)}${times(line.count)}`;
  return `${line.amount.toLocaleString('es')} de oro menos${withReason(line)}${times(line.count)}`;
};
/** "Desde hoy", "Desde ayer" o "Desde el lunes 28 de septiembre". */
const sinceLabel = (iso: string | null) => {
  if (!iso) return null;
  const key = localDateKey(new Date(iso));
  const today = localDateKey();
  if (key === today) return 'Desde hoy';
  if (addDaysKey(key, 1) === today) return 'Desde ayer';
  return `Desde el ${new Date(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')}`;
};

const lossEmoji = (line: StudentNewsLine, resting: boolean) => (line.pointType === 'HP' ? (resting ? '🌙' : '❤️') : line.pointType === 'XP' ? '⚡' : '🪙');

/**
 * "Lo nuevo desde tu última visita": lo que pasó en esta clase. Se da por visto cuando el
 * título lleva 1 s a la vista y ya no hay nada abierto al entrar (historia, racha, celebración);
 * sigue a la vista el resto de la sesión (la foto no cambia hasta la próxima visita).
 */
export const WhatsNewCard = ({ profileId, news, resting, letters, onOpen }: WhatsNewCardProps) => {
  const entrySettled = useStudentStore((s) => s.entrySettled);
  const headerRef = useRef<HTMLDivElement>(null);
  const marked = useRef<string | null>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || !entrySettled || marked.current === news.until) return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        timer = window.setTimeout(() => {
          if (marked.current === news.until) return;
          marked.current = news.until;
          observer.disconnect();
          void studentApi.markNewsSeen(profileId, news.until).catch(() => { marked.current = null; });
        }, 1000);
      } else if (timer) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    }, { threshold: 1 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [entrySettled, news.until, profileId]);

  const gains = news.gains.filter((g) => g.pointType !== 'HP');
  const recovered = news.gains.filter((g) => g.pointType === 'HP');
  const energyDown = news.losses.filter((l) => l.pointType === 'HP');
  const otherDown = news.losses.filter((l) => l.pointType !== 'HP');
  const shownGains = gains.slice(0, MAX_GAINS);
  const hasMain = news.totals.xp > 0 || news.totals.gp > 0 || news.badges.length > 0 || !!news.level || letters > 0 || gains.length > 0;
  const hasEnergy = recovered.length > 0 || energyDown.length > 0 || otherDown.length > 0;
  const firstVisit = news.since === null;

  // Primera visita sin nada: lo ocupa "Primeros pasos".
  if (firstVisit && !hasMain && !hasEnergy) return null;

  const title = firstVisit ? 'Lo que ya ganaste en esta clase' : 'Lo nuevo desde tu última visita';
  const since = sinceLabel(news.since);

  return (
    <section aria-labelledby="news-title" className={homeCard}>
      <div ref={headerRef}>
        <h2 id="news-title" className={cardTitle}>{title}</h2>
        {since && <p className={cardText}>{since}</p>}
      </div>

      {!hasMain && !hasEnergy ? (
        <div className="mt-3">
          <HomeEmptyState
            emojis={['🌱', '⚡', '🏅']}
            title="Aún no hay novedades"
            text="Participa en tu próxima clase y aquí verás lo que ganes."
            primary={{ to: '/my-progress', label: 'Ver mi progreso' }}
            secondary={{ to: '/my-badges', label: 'Ver mis insignias' }}
          />
        </div>
      ) : (
        <>
          {(news.totals.xp > 0 || news.totals.gp > 0 || news.badges.length > 0) && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="En total">
              {news.totals.xp > 0 && <li className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-100">+{news.totals.xp.toLocaleString('es')} XP</li>}
              {news.totals.gp > 0 && <li className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">+{news.totals.gp.toLocaleString('es')} de oro</li>}
              {news.badges.length > 0 && <li className="rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-800 dark:bg-violet-900/40 dark:text-violet-100"><span aria-hidden="true">🏅 </span>{plural(news.badges.length, 'insignia', 'insignias')}</li>}
            </ul>
          )}

          {hasMain && (
            <ul className="mt-3 space-y-1.5 text-sm text-gray-800 dark:text-gray-100">
              {news.level && <Line emoji="🎉">Subiste al nivel {news.level.to}</Line>}
              {news.badges.map((badge) => (
                <Line key={badge.id} emoji="🏅">
                  «{badge.name}»{badge.rewardXp > 0 && ` · +${badge.rewardXp} XP`}{badge.rewardGp > 0 && ` · +${badge.rewardGp} de oro`}
                </Line>
              ))}
              {shownGains.map((line) => <Line key={`${line.pointType}|${line.reason}`} emoji={line.pointType === 'XP' ? '⚡' : '🪙'}>{gainText(line)}</Line>)}
              {gains.length > MAX_GAINS && <li className="text-gray-700 dark:text-gray-300">y {plural(gains.length - MAX_GAINS, 'motivo más', 'motivos más')}</li>}
              {letters > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span><span aria-hidden="true">💌 </span>Recibiste {letters === 1 ? 'una carta' : `${letters} cartas`} de tu estrella secreta</span>
                  <button type="button" onClick={() => onOpen('correo')} aria-haspopup="dialog" className={rowButton}>Leer</button>
                </li>
              )}
            </ul>
          )}

          {hasEnergy && (
            <div className={`${hasMain ? 'mt-3 border-t border-dashed border-gray-300 pt-3 dark:border-gray-600' : 'mt-3'}`}>
              <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-100">
                {resting && energyDown.length > 0 && <Line emoji="🌙" className="font-semibold">Tu energía llegó a 0. Esto no cambia tus notas.</Line>}
                {energyDown.map((line) => <Line key={`hp|${line.reason}`} emoji={lossEmoji(line, resting)}>{lossText(line)}</Line>)}
                {recovered.map((line) => <Line key={`hp+|${line.reason}`} emoji="⚡">Recuperaste {line.amount.toLocaleString('es')} de energía{withReason(line)}</Line>)}
                {otherDown.map((line) => <Line key={`${line.pointType}-|${line.reason}`} emoji={lossEmoji(line, resting)}>{lossText(line)}</Line>)}
              </ul>
              {(energyDown.length > 0 || recovered.length > 0) && (
                <button type="button" onClick={() => onOpen('energy')} aria-haspopup="dialog" className={cardLink}>
                  ¿Qué es la energía y cómo se recupera?
                </button>
              )}
            </div>
          )}

          <Link to="/my-progress" className={`${cardLink} mt-1`}>
            Ver todo en Mi progreso
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
};
