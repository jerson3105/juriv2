import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Coins, Flame, Heart, Moon, Shirt, Sparkles } from 'lucide-react';
import { AvatarRenderer, type AvatarGender, type EquippedItem } from '../../avatar/AvatarRenderer';
import { Starfield } from '../../auth/SpaceScene';
import { ConstellationSky } from '../../observatorio/descanso/ConstellationSky';
import { CONSTELLATIONS } from '../../observatorio/descanso/constellations';
import { Hearts } from '../../energy/EnergyMeter';
import { nextGiftOf, type StreakStatus } from '../loginStreak';
import { HomeActionButton, type HomeModalKind } from './HomeActionButton';
import type { Goal } from './nextGoal';
import { nightLink, nightPrimary, plural, seedOf } from './studentHomeHelpers';

const SMALL_SKIES = CONSTELLATIONS.filter((c) => c.small);

interface StudentHeroProps {
  classroomId: string;
  gender: AvatarGender;
  equipped: EquippedItem[];
  /** Rol del personaje (Guardián, Arcano…) y su ícono. */
  role: { name: string; icon: string | null };
  level: number;
  xp: { inLevel: number; needed: number; percent: number; remaining: number };
  hp: number;
  maxHp: number;
  gold: number;
  /** Inicial a 2.º: corazones en lugar de números. */
  young: boolean;
  streak?: StreakStatus;
  goal: Goal;
  glow: string;
  storyTitle: string | null;
  canDress: boolean;
  canChangeRole: boolean;
  onOpen: (kind: HomeModalKind | 'streak') => void;
}

const chip = 'inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15';

/**
 * Bloque principal del inicio: el personaje en su escenario (halo, plataforma de luz y una
 * constelación que se enciende con el nivel), su progreso y "Tu próxima meta".
 * Es la única superficie de noche del inicio.
 */
export const StudentHero = (props: StudentHeroProps) => {
  const { goal, xp, onOpen } = props;
  const seed = seedOf(props.classroomId);
  const sky = SMALL_SKIES[seed % SMALL_SKIES.length];
  // La quinta estrella se enciende al subir de nivel.
  const lit = Math.min(4, 1 + Math.floor(xp.percent / 25));
  const resting = props.hp <= 0;
  const gift = nextGiftOf(props.streak);
  const streakDays = props.streak?.streak?.currentStreak ?? 0;
  const withBackground = props.equipped.some((item) => item.slot === 'BACKGROUND');

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 text-white shadow-xl sm:p-6 dark:ring-1 dark:ring-indigo-400/30">
      <Starfield count={24} seed={seed} />
      <span className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl" style={{ background: props.glow }} aria-hidden="true" />

      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-5 sm:gap-x-6 xl:grid-cols-[auto_minmax(0,1fr)_18.75rem]">
        {/* Escenario del personaje */}
        <div className="relative flex flex-col items-center self-end sm:row-span-2">
          <div className="pointer-events-none absolute -right-4 -top-3 w-16 sm:-right-6 sm:w-20" aria-hidden="true">
            <ConstellationSky constellation={sky} lit={lit} still />
          </div>
          <span
            className="pointer-events-none absolute -inset-x-6 bottom-[6%] top-[4%] rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(224,231,255,0.42), rgba(224,231,255,0.12) 62%, transparent)' }}
            aria-hidden="true"
          />
          <AvatarRenderer
            gender={props.gender}
            size="hero"
            equippedItems={props.equipped}
            label={`Tu personaje: ${props.role.name}`}
            className={`z-10 ${withBackground ? 'overflow-hidden rounded-2xl ring-1 ring-white/20' : ''}`}
          />
          <span className="-mt-4 h-5 w-[86%] rounded-[50%] bg-indigo-200/30 shadow-[0_0_24px_rgba(165,180,252,0.45)]" aria-hidden="true" />
        </div>

        {/* Progreso */}
        <div className="min-w-0 self-center">
          <h2 id="hero-title" className="text-xs font-bold uppercase tracking-wide text-indigo-200">
            {props.storyTitle ? `📖 ${props.storyTitle}` : 'Tu personaje'}
          </h2>
          <p className="mt-1 text-xl font-black leading-tight sm:text-2xl">
            {props.role.icon && <span aria-hidden="true">{props.role.icon} </span>}
            {props.role.name}
          </p>
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-bold text-white">Nivel {props.level}</span>
              <span className="tabular-nums text-indigo-100">{xp.inLevel.toLocaleString('es')}/{xp.needed.toLocaleString('es')} XP</span>
            </div>
            <div
              role="progressbar"
              aria-label={`Nivel ${props.level}`}
              aria-valuemin={0}
              aria-valuemax={xp.needed}
              aria-valuenow={xp.inLevel}
              aria-valuetext={`${xp.inLevel} de ${xp.needed} XP`}
              className="mt-1 h-3 overflow-hidden rounded-full bg-white/15"
            >
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: xp.percent / 100 }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full w-full origin-left rounded-full bg-gradient-to-r from-sky-400 to-blue-400"
              />
            </div>
            {goal.key !== 'xp' && (
              <p className="mt-1 text-sm text-indigo-100">
                Te faltan <strong className="text-white">{xp.remaining.toLocaleString('es')} XP</strong> para el nivel {props.level + 1}
              </p>
            )}
          </div>
        </div>

        {/* Energía, oro, días seguidos y accesos del personaje */}
        <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
          <ul className="flex flex-wrap items-center gap-2" aria-label="Tu estado en la clase">
            <li>
              {resting ? (
                <span className={chip}><Moon size={14} className="fill-current" aria-hidden="true" />Descansando</span>
              ) : props.young ? (
                <span className={chip}><Hearts hp={props.hp} maxHp={props.maxHp} tone="night" /></span>
              ) : (
                <span className={chip}>
                  <Heart size={14} className="fill-red-400 text-red-400" aria-hidden="true" />
                  Energía <span className="tabular-nums">{props.hp}/{props.maxHp}</span>
                </span>
              )}
            </li>
            <li>
              <span className={chip}><Coins size={14} className="text-amber-300" aria-hidden="true" />{props.gold.toLocaleString('es')} de oro</span>
            </li>
            {props.streak?.enabled && (
              <li>
                <button
                  type="button"
                  onClick={() => onOpen('streak')}
                  aria-haspopup="dialog"
                  className={`${chip} min-h-[44px] text-left hover:bg-white/20`}
                >
                  <Flame size={14} className="flex-shrink-0 text-orange-300" aria-hidden="true" />
                  <span>
                    {plural(streakDays, 'día seguido', 'días seguidos')}
                    {gift && ` · regalo en ${plural(gift.daysRemaining, 'día', 'días')}`}
                  </span>
                  <ChevronRight size={14} className="flex-shrink-0" aria-hidden="true" />
                </button>
              </li>
            )}
          </ul>
          {(props.canDress || (props.canChangeRole && goal.key !== 'role')) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {props.canDress && (
                <Link to="/my-avatar" className={nightLink}>
                  <Shirt size={16} aria-hidden="true" />
                  Vestir a mi personaje
                </Link>
              )}
              {props.canChangeRole && goal.key !== 'role' && (
                <button type="button" onClick={() => onOpen('role')} aria-haspopup="dialog" className={nightLink}>
                  <Sparkles size={16} aria-hidden="true" />
                  Cambiar mi rol
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tu próxima meta */}
        <section
          aria-labelledby="goal-title"
          className={`col-span-2 flex flex-col self-stretch rounded-2xl p-4 ring-1 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1 ${goal.resting ? 'bg-slate-700/50 ring-slate-300/20' : 'bg-white/10 ring-white/15'}`}
        >
          <h3 id="goal-title" className="text-xs font-bold uppercase tracking-wide text-indigo-200">Tu próxima meta</h3>
          <p className="mt-2 text-lg font-black leading-snug"><span aria-hidden="true">{goal.emoji}</span> {goal.title}</p>
          {goal.body && <p className="mt-1 break-words text-sm text-indigo-50">{goal.body}</p>}
          {goal.detail && <p className="mt-1 text-sm text-white/80">{goal.detail}</p>}
          {(goal.primary || goal.secondary) && (
            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3">
              {goal.primary && <HomeActionButton action={goal.primary} className={nightPrimary} arrow onOpen={onOpen} />}
              {goal.secondary && (
                <HomeActionButton
                  action={goal.secondary}
                  className="inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-white underline underline-offset-2 hover:text-indigo-100"
                  onOpen={onOpen}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  );
};
