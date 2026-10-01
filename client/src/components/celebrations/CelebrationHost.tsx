import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { RARITY_LABELS } from '../../lib/badgeApi';
import { RARITY_STYLE } from '../badges/badgeHelpers';
import { useSound } from '../../hooks/useSound';
import { isMilestone, useCelebrationStore, type Celebration, type CelebrationBadge, type CelebrationLevelUp } from '../../store/celebrationStore';

const VISIBLE_MS = 2500;
const REDUCED_VISIBLE_MS = 4000;
const MAX_ROWS = 6;
// Capa única para celebraciones: encima de modales de vista (60) y debajo de los del layout (200).
// Con el escenario del Observatorio abierto (z-180), todo el host sube a 190.
const LAYER = 'z-[80]';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Un solo lugar para celebrar subidas de nivel e insignias (profesor y alumno).
 * Una acción = una tarjeta; si llega otra, la reemplaza. Solo transform/opacity, sin desenfoques.
 */
export const CelebrationHost = () => {
  const current = useCelebrationStore((s) => s.current);
  const dismiss = useCelebrationStore((s) => s.dismiss);
  const sound = useCelebrationStore((s) => s.sound);
  const raised = useCelebrationStore((s) => s.raised);
  const { play } = useSound();
  const cardRef = useRef<HTMLDivElement>(null);
  const remaining = useRef(VISIBLE_MS);
  const [paused, setPaused] = useState(false);
  const reduced = prefersReducedMotion();
  const duration = reduced ? REDUCED_VISIBLE_MS : VISIBLE_MS;
  const id = current?.id;
  const autoClose = !!current && current.audience === 'class';

  // Al aparecer: sonido (uno por acción) y un único estallido de confeti desde la tarjeta.
  useEffect(() => {
    if (!current) return;
    remaining.current = duration;
    setPaused(false);
    if (sound) play(current.levelUps.length > 0 ? 'levelUp' : 'badge');
    const frame = requestAnimationFrame(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      const big = current.audience === 'personal' || isMilestone(current);
      // Carga diferida: el confeti no pesa en el paquete inicial.
      void import('canvas-confetti').then(({ default: confetti }) => confetti({
        particleCount: big ? 90 : 30,
        spread: big ? 100 : 70,
        startVelocity: big ? 42 : 28,
        ticks: big ? 160 : 90,
        scalar: 0.9,
        zIndex: raised ? 191 : 81,
        disableForReducedMotion: true,
        origin: rect
          ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: Math.min(0.9, (rect.top + rect.height * 0.4) / window.innerHeight) }
          : { x: 0.5, y: 0.2 },
        colors: ['#f59e0b', '#fbbf24', '#2563eb', '#10b981', '#ec4899'],
      }));
    });
    return () => cancelAnimationFrame(frame);
    // Solo al cambiar de celebración.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Cierre automático (las de clase); el hover o el foco lo pausan.
  useEffect(() => {
    if (!autoClose || paused || id === undefined) return;
    const started = Date.now();
    const timer = setTimeout(() => dismiss(id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(400, remaining.current - (Date.now() - started));
    };
  }, [autoClose, paused, id, dismiss]);

  useEffect(() => {
    if (id === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Que Esc cierre solo la celebración (no el escenario o el modal de debajo).
        event.preventDefault();
        dismiss(id);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [id, dismiss]);

  if (typeof document === 'undefined') return null;

  const content = (
    <AnimatePresence>
      {current && (
        current.audience === 'personal'
          ? <PersonalCard key={current.id} celebration={current} cardRef={cardRef} onClose={() => dismiss(current.id)} />
          : isMilestone(current)
            ? <MilestoneCard key={current.id} celebration={current} cardRef={cardRef} onClose={() => dismiss(current.id)}
                onPause={setPaused} paused={paused} duration={duration} reduced={reduced} />
            : <ClassCard key={current.id} celebration={current} cardRef={cardRef} onClose={() => dismiss(current.id)}
                onPause={setPaused} paused={paused} duration={duration} reduced={reduced} />
      )}
    </AnimatePresence>
  );
  return createPortal(raised ? <div className="relative z-[190]">{content}</div> : content, document.body);
};

type CardProps = {
  celebration: Celebration;
  cardRef: RefObject<HTMLDivElement>;
  onClose: () => void;
};
type TimedProps = CardProps & { onPause: (paused: boolean) => void; paused: boolean; duration: number; reduced: boolean };

const titleOf = (c: Celebration) => {
  if (c.levelUps.length === 1) return '¡Subió de nivel!';
  if (c.levelUps.length > 1) return `¡${c.levelUps.length} subieron de nivel!`;
  return c.badges.length === 1 ? '¡Nueva insignia!' : `¡${c.badges.length} insignias nuevas!`;
};

// Destellos que suben desde el ícono (animación extra, una sola vez).
const Sparkles = () => (
  <span aria-hidden="true" className="pointer-events-none absolute inset-0">
    {[-22, -10, 2, 14, 24].map((dx, i) => (
      <span key={dx} className="celebrate-rise absolute left-1/2 top-1/2 text-xs text-amber-500"
        style={{ '--dx': `${dx}px`, animationDelay: `${120 + i * 70}ms`, marginLeft: -4, marginTop: -6 } as CSSProperties}>✦</span>
    ))}
  </span>
);

const Shine = () => (
  <span aria-hidden="true" className="celebrate-shine pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-amber-100/80 to-transparent dark:via-amber-200/10" />
);

const Avatar = ({ item }: { item: CelebrationLevelUp }) => (
  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-lg font-bold text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100" aria-hidden="true">
    {item.icon || item.name.charAt(0).toUpperCase()}
  </span>
);

const LevelRow = ({ item, index }: { item: CelebrationLevelUp; index: number }) => (
  <li className="celebrate-row flex min-w-0 items-center gap-2.5" style={{ animationDelay: `${80 + index * 40}ms` }}>
    <Avatar item={item} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{item.name}</span>
      <span className="block text-sm text-gray-700 dark:text-gray-300">
        Nv {item.from} → <span className="celebrate-pop font-bold text-amber-700 dark:text-amber-300" style={{ animationDelay: `${160 + index * 40}ms` }}>{item.to}</span>
      </span>
    </span>
  </li>
);

const BadgeIcon = ({ badge, size = 'h-10 w-10 text-xl' }: { badge: CelebrationBadge; size?: string }) => (
  <span className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${size} ${RARITY_STYLE[badge.rarity].disc}`} aria-hidden="true">
    {badge.customImage ? <img src={badge.customImage} alt="" className="h-full w-full object-cover" /> : badge.icon}
  </span>
);

const BadgeRow = ({ badge, showRecipients = true }: { badge: CelebrationBadge; showRecipients?: boolean }) => {
  const shown = badge.recipients.slice(0, 3).join(', ');
  const more = badge.recipients.length - 3;
  return (
    <li className="celebrate-row flex min-w-0 items-center gap-2.5">
      <BadgeIcon badge={badge} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{badge.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${RARITY_STYLE[badge.rarity].chip}`}>{RARITY_LABELS[badge.rarity]}</span>
        </span>
        {showRecipients && badge.recipients.length > 0 && (
          <span className="block truncate text-sm text-gray-700 dark:text-gray-300">{shown}{more > 0 ? ` y ${more} más` : ''}</span>
        )}
      </span>
    </li>
  );
};

const CloseButton = ({ onClose }: { onClose: () => void }) => (
  <button type="button" onClick={onClose} aria-label="Cerrar celebración"
    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
    <X size={18} aria-hidden="true" />
  </button>
);

const TimerBar = ({ duration, paused, reduced }: { duration: number; paused: boolean; reduced: boolean }) => (
  reduced ? null : (
    <div className="h-1 bg-amber-100 dark:bg-amber-900/40" aria-hidden="true">
      <div className="h-full origin-left bg-amber-500"
        style={{ animation: `celebrate-timer ${duration}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }} />
    </div>
  )
);

const Body = ({ celebration }: { celebration: Celebration }) => {
  const rows = celebration.levelUps.slice(0, MAX_ROWS);
  const hidden = celebration.levelUps.length - rows.length;
  return (
    <div className="space-y-3 px-4 pb-4">
      {rows.length > 0 && (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {rows.map((item, i) => <LevelRow key={item.key} item={item} index={i} />)}
        </ul>
      )}
      {hidden > 0 && <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">y {hidden} más</p>}
      {celebration.badges.length > 0 && (
        <ul className="space-y-2 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0 dark:border-gray-700">
          {celebration.badges.map((b) => <BadgeRow key={b.key} badge={b} />)}
        </ul>
      )}
    </div>
  );
};

// Tarjeta ligera arriba al centro: no bloquea ni roba el foco.
const ClassCard = ({ celebration, cardRef, onClose, onPause, paused, duration, reduced }: TimedProps) => (
  <div className={`pointer-events-none fixed inset-x-0 top-[72px] ${LAYER} flex justify-center px-4`}>
    <motion.div
      ref={cardRef}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.16 } }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      onMouseEnter={() => onPause(true)}
      onMouseLeave={() => onPause(false)}
      onFocus={() => onPause(true)}
      onBlur={() => onPause(false)}
      className="pointer-events-auto relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-xl dark:border-amber-700/60 dark:bg-gray-800"
    >
      <Shine />
      <div className="relative flex items-start gap-3 p-4 pb-3">
        <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
          <Star size={20} className="celebrate-pop fill-current" aria-hidden="true" />
          <Sparkles />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-gray-900 dark:text-white">{titleOf(celebration)}</p>
          {celebration.context && <p className="truncate text-sm text-gray-700 dark:text-gray-300">{celebration.context}</p>}
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <div className="relative"><Body celebration={celebration} /></div>
      <TimerBar duration={duration} paused={paused} reduced={reduced} />
    </motion.div>
  </div>
);

// Hito (múltiplo de 5 o insignia legendaria): al centro, con velo sin desenfoque.
const MilestoneCard = ({ celebration, cardRef, onClose, onPause, paused, duration, reduced }: TimedProps) => {
  const hero = celebration.levelUps.find((l) => Math.floor(l.to / 5) > Math.floor(l.from / 5));
  const legendary = celebration.badges.find((b) => b.rarity === 'LEGENDARY');
  const rest: Celebration = {
    ...celebration,
    levelUps: celebration.levelUps.filter((l) => l !== hero),
    badges: celebration.badges.filter((b) => b !== legendary || !!hero),
  };
  return (
    <motion.div
      className={`fixed inset-0 ${LAYER} flex items-center justify-center bg-black/50 p-4`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        ref={cardRef}
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => onPause(true)}
        onMouseLeave={() => onPause(false)}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-amber-300 bg-white text-center shadow-2xl dark:border-amber-600 dark:bg-gray-800"
      >
        <Shine />
        <div className="absolute right-2 top-2"><CloseButton onClose={onClose} /></div>
        <div className="relative px-6 pb-4 pt-8">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <span aria-hidden="true" className="celebrate-ring absolute inset-0 rounded-full border-4 border-amber-400" />
            <span aria-hidden="true" className="celebrate-ring absolute inset-0 rounded-full border-4 border-amber-300" style={{ animationDelay: '180ms' }} />
            {hero ? (
              <span className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                <span className="text-xs font-bold uppercase tracking-wider">Nivel</span>
                <span className="celebrate-pop text-4xl font-black leading-none">{hero.to}</span>
              </span>
            ) : legendary ? <BadgeIcon badge={legendary} size="h-24 w-24 text-5xl" /> : null}
            <Sparkles />
          </div>
          <p className="mt-4 text-xl font-black text-gray-900 dark:text-white">
            {hero ? `¡${hero.name} llegó al nivel ${hero.to}!` : `¡${legendary?.name}!`}
          </p>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            {hero ? '¡Un hito!' : `Insignia legendaria · ${legendary?.recipients.join(', ')}`}
          </p>
        </div>
        {(rest.levelUps.length > 0 || rest.badges.length > 0) && (
          <div className="relative border-t border-gray-100 pt-3 text-left dark:border-gray-700"><Body celebration={rest} /></div>
        )}
        <TimerBar duration={duration} paused={paused} reduced={reduced} />
      </motion.div>
    </motion.div>
  );
};

// Alumno: su propia celebración, queda hasta que pulsa.
const PersonalCard = ({ celebration, cardRef, onClose }: CardProps) => {
  const up = celebration.levelUps[0];
  const gained = up ? up.to - up.from : 0;
  return (
    <motion.div
      className={`fixed inset-0 ${LAYER} flex items-center justify-center bg-black/50 p-4`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.16 } }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber-300 bg-white text-center shadow-2xl dark:border-amber-600 dark:bg-gray-800"
      >
        <Shine />
        <div className="relative px-6 pb-6 pt-8">
          {up && (
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              <span aria-hidden="true" className="celebrate-ring absolute inset-0 rounded-full border-4 border-amber-400" />
              <span className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                <span className="text-xs font-bold uppercase tracking-wider">Nivel</span>
                <span className="celebrate-pop text-4xl font-black leading-none">{up.to}</span>
              </span>
              <Sparkles />
            </div>
          )}
          <h2 id="celebration-title" className="mt-4 text-xl font-black text-gray-900 dark:text-white">
            {up ? (gained > 1 ? `¡Subiste ${gained} niveles!` : '¡Subiste de nivel!') : celebration.badges.length > 1 ? '¡Ganaste insignias!' : '¡Ganaste una insignia!'}
          </h2>
          {up && <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nivel {up.from} → {up.to}</p>}
          {up && celebration.progress !== undefined && (
            <div className="mx-auto mt-3 max-w-[220px]">
              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden="true">
                <div className="h-full origin-left rounded-full bg-amber-500" style={{ transform: `scaleX(${Math.max(0, Math.min(1, celebration.progress / 100))})` }} />
              </div>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{Math.round(celebration.progress)} % hacia el nivel {up.to + 1}</p>
            </div>
          )}
          {celebration.badges.length > 0 && (
            <ul className="mt-4 space-y-2 text-left">
              {celebration.badges.map((b) => <BadgeRow key={b.key} badge={b} showRecipients={false} />)}
            </ul>
          )}
          <button type="button" onClick={onClose} autoFocus
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-500 px-6 text-sm font-bold text-gray-900 hover:bg-amber-400">
            ¡Genial!
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
