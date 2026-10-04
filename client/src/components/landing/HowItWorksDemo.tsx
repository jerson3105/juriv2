import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { Award, Coins, HeartHandshake } from 'lucide-react';
import { EASE_OUT } from './landingStyles';

const XP_GOAL = 200;
const START = { xp: 120, gold: 45, progress: 4 };

/**
 * La idea de Juried en dos segundos: el docente reconoce algo → suben la experiencia y el oro → se completa una
 * insignia. Corre una sola vez al entrar en pantalla y queda quieta; el botón se puede volver a tocar.
 */
export const HowItWorksDemo = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const xp = useMotionValue(START.xp);
  const gold = useMotionValue(START.gold);
  const xpLabel = useTransform(xp, (v) => Math.round(v));
  const goldLabel = useTransform(gold, (v) => Math.round(v));
  const xpBar = useTransform(xp, (v) => Math.min(v, XP_GOAL) / XP_GOAL);
  // El objetivo vive en un ref: un toque a mitad del conteo suma sobre el objetivo, no sobre lo que se ve.
  const target = useRef({ xp: START.xp, gold: START.gold });
  // Un temporizador por efecto visual: un toque nuevo reinicia lo visual, nunca descarta lo ya sumado.
  const timers = useRef({ press: 0, chips: 0, medal: 0 });
  const played = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [burst, setBurst] = useState(0);
  const [chips, setChips] = useState(false);
  const [progress, setProgress] = useState(START.progress);
  const [level, setLevel] = useState(3);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach((id) => window.clearTimeout(id));
  }, []);

  const restart = useCallback((key: 'press' | 'chips' | 'medal', fn: () => void, ms: number) => {
    window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(fn, ms);
  }, []);

  const recognize = useCallback((byUser: boolean) => {
    setPressed(true);
    restart('press', () => setPressed(false), 100);
    // Suma al instante: varios toques seguidos se acumulan todos.
    target.current = { xp: target.current.xp + 10, gold: target.current.gold + 5 };
    const { xp: nextXp, gold: nextGold } = target.current;
    setBurst((n) => n + 1);
    setChips(true);
    restart('chips', () => setChips(false), 1000);
    if (reduce) {
      xp.set(nextXp);
      gold.set(nextGold);
    } else {
      animate(xp, nextXp, { duration: 0.6, ease: EASE_OUT });
      animate(gold, nextGold, { duration: 0.6, ease: EASE_OUT, delay: 0.05 });
    }
    if (nextXp >= XP_GOAL) setLevel(4);
    if (byUser) setAnnounce(`Ana tiene ahora ${nextXp} de experiencia y ${nextGold} de oro.`);
    restart('medal', () => setProgress(5), 700);
  }, [reduce, xp, gold, restart]);

  // Una sola vez, al verse; «played» se marca al dispararse (en desarrollo StrictMode monta dos veces).
  useEffect(() => {
    if (!inView || played.current) return;
    const id = window.setTimeout(() => {
      played.current = true;
      recognize(false);
    }, 600);
    return () => window.clearTimeout(id);
  }, [inView, recognize]);

  const done = progress >= 5;
  const chip = (key: string, text: string, className: string) => (
    <AnimatePresence>
      {chips && (
        <motion.span
          key={`${key}-${burst}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT, delay: key === 'oro' ? 0.05 : 0 }}
          className={`absolute -top-6 text-xs font-bold ${className}`}
        >
          {text}
        </motion.span>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={ref} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="sr-only">
        Ejemplo: cuando el docente reconoce que Ana ayudó a un compañero, ella gana 10 de experiencia y 5 de oro, y completa la insignia «Gran explicador».
      </p>
      <p className="sr-only" aria-live="polite">{announce}</p>

      <div aria-hidden="true">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">Ana</p>
            <p className="text-sm text-slate-500">Nivel {level}</p>
          </div>
          <div className="relative inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900">
            <Coins size={16} />
            <motion.span className="tabular-nums">{goldLabel}</motion.span>
            <span>oro</span>
            {chip('oro', '+5 oro', 'right-1 text-amber-700')}
          </div>
        </div>

        <div className="mt-6">
          <div className="relative flex items-baseline justify-between text-sm">
            <span className="font-semibold text-slate-700">Experiencia</span>
            <span className="tabular-nums text-slate-500">
              <motion.span>{xpLabel}</motion.span> / {XP_GOAL} XP
            </span>
            {chip('xp', '+10 XP', 'right-0 text-indigo-700')}
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <motion.div className="h-full origin-left rounded-full bg-indigo-600" style={{ scaleX: xpBar }} />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => recognize(true)}
        aria-label="Probar: reconocer que Ana ayudó a un compañero, más 10 de experiencia y 5 de oro"
        className={`mt-6 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-left font-semibold text-emerald-900 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 [@media(hover:hover)]:hover:bg-emerald-100 ${pressed ? 'scale-[0.97]' : ''}`}
      >
        <span className="flex items-center gap-2">
          <HeartHandshake size={18} aria-hidden="true" />
          Ayuda a un compañero
        </span>
        <span className="text-sm text-emerald-800">+10 XP · +5 oro</span>
      </button>

      <div className="mt-6 flex items-center gap-4 border-t border-slate-200 pt-5" aria-hidden="true">
        <motion.span
          key={done ? 'lista' : 'pendiente'}
          initial={done ? { opacity: 0, scale: 0.9 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${done ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}
        >
          <Award size={22} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Insignia «Gran explicador»</p>
          <p className="text-sm text-slate-500">{done ? '¡Nueva insignia!' : `${progress} de 5 ayudas`}</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-2 w-2 rounded-full transition-colors duration-200 ${i < progress ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>
    </div>
  );
};
