import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type JiroPose = 'cheer' | 'point' | 'nervous';

const JIRO_IMAGE: Record<JiroPose, string> = {
  cheer: '/assets/jiro/gala/presenta.webp',
  point: '/assets/jiro/gala/senala.webp',
  nervous: '/assets/jiro/gala/redoble.webp',
};

// Fondo de estadio de noche: luces en la grada, dos reflectores que barren y un suelo iluminado.
export const CeremonyBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_top,#312e81_0%,#0f172a_45%,#020617_100%)]" aria-hidden="true">
    <div className="absolute inset-x-0 top-3 flex justify-around px-10">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="rk-lamp h-2 w-2 rounded-full bg-amber-100 shadow-[0_0_18px_6px_rgba(254,243,199,0.55)]" style={{ animationDelay: `${(i % 4) * 0.45}s` }} />
      ))}
    </div>
    <span className="rk-beam rk-beam-left" />
    <span className="rk-beam rk-beam-right" />
    <span className="absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(ellipse_at_bottom,rgba(99,102,241,0.35),transparent_70%)]" />
    <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />
  </div>
);

interface JiroPresenterProps {
  pose: JiroPose;
  line: string;
  hidden?: boolean;
}

// Jiro presenta la gala desde la esquina con un globo de texto.
export const JiroPresenter = ({ pose, line, hidden = false }: JiroPresenterProps) => {
  const reduce = useReducedMotion();
  if (hidden) return null;
  return (
    <div className="pointer-events-none absolute bottom-16 left-2 z-10 hidden w-[15vw] min-w-[140px] max-w-[230px] md:block">
      <AnimatePresence mode="wait">
        <motion.p
          key={line}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.25 }}
          className="relative mb-2 ml-3 w-fit max-w-full rounded-2xl bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-lg"
          aria-live="polite"
        >
          {line}
          <span className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45 bg-white" />
        </motion.p>
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.img
          key={pose}
          src={JIRO_IMAGE[pose]}
          alt=""
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: pose === 'nervous' ? [0, -3, 0, -3, 0] : 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: pose === 'nervous' ? 0.6 : 0.3, repeat: pose === 'nervous' && !reduce ? Infinity : 0 }}
          className="w-full select-none drop-shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
        />
      </AnimatePresence>
    </div>
  );
};
