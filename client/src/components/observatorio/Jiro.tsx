import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { JIRO_POSES, preloadJiro, useStablePose, type JiroPose } from './jiroPoses';

// Movimiento en reposo (solo transform): respira dormido, tiembla nervioso, flota el resto.
const idleMotion = (pose: JiroPose) => {
  if (pose === 'dormido') return { animate: { scale: [1, 1.015, 1] }, transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const } };
  if (pose === 'nervioso' || pose === 'sobresaltado') return { animate: { x: [0, -3, 3, -2, 0] }, transition: { duration: 0.5, repeat: Infinity, repeatDelay: 1.6 } };
  if (pose === 'celebrando' || pose === 'emocionado') return { animate: { y: [0, -10, 0] }, transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const } };
  return { animate: { y: [0, -5, 0] }, transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const } };
};

interface JiroProps {
  pose: JiroPose;
  /** Lo que dice Jiro (solo texto). Se anuncia a lectores de pantalla. */
  line?: string | null;
  /** stage = proyectado (globo grande, fondo noche); card = portada (claro/oscuro). */
  variant?: 'stage' | 'card';
  balloonSide?: 'top' | 'right';
  /** Alto de la figura (clases de Tailwind); el ancho sale de la proporción. */
  sizeClassName?: string;
  /** Tamaño del texto del globo en stage (por defecto, el de proyección). */
  balloonTextClassName?: string;
  /** Ancho máximo del globo (arriba). */
  balloonWidthClassName?: string;
  className?: string;
}

export const Jiro = ({
  pose, line, variant = 'stage', balloonSide = 'top', sizeClassName = 'h-[40vh]', balloonTextClassName = 'stage-balloon',
  balloonWidthClassName = 'max-w-[min(32ch,90vw)]', className = '',
}: JiroProps) => {
  const reduce = useReducedMotion();
  const shown = useStablePose(pose);
  useEffect(preloadJiro, []);
  const idle = reduce ? null : idleMotion(shown);

  const balloonClass = variant === 'stage'
    ? `${balloonTextClassName} rounded-[1.1em] bg-white px-[0.8em] py-[0.45em] font-bold text-slate-900 shadow-lg`
    : 'rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-base font-semibold text-slate-800 shadow-sm dark:border-indigo-400/30 dark:bg-gray-800 dark:text-gray-100';
  const tail = balloonSide === 'top'
    ? 'absolute -bottom-2 left-[22%] h-4 w-4 rotate-45'
    : 'absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45';
  const tailColor = variant === 'stage' ? 'bg-white' : 'border-b border-l border-indigo-100 bg-white dark:border-indigo-400/30 dark:bg-gray-800';

  return (
    <div className={`flex ${balloonSide === 'top' ? 'flex-col items-start' : 'flex-row-reverse items-center justify-end'} gap-3 ${className}`}>
      {/* Contenedor estable con aria-live: el cambio de texto se anuncia. */}
      <div aria-live="polite" className={balloonSide === 'top' ? `ml-[4%] ${balloonWidthClassName}` : 'min-w-0 flex-1'}>
        <AnimatePresence mode="wait" initial={false}>
          {line && (
            <motion.p
              key={line}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22 }}
              className={`relative w-fit ${balloonClass}`}
            >
              {line}
              <span className={`${tail} ${tailColor}`} aria-hidden="true" />
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <motion.div
        className={`relative aspect-[3/4] shrink-0 ${sizeClassName}`}
        animate={idle?.animate}
        transition={idle?.transition}
        aria-hidden="true"
      >
        <AnimatePresence initial={false}>
          <motion.img
            key={shown}
            src={JIRO_POSES[shown]}
            alt=""
            draggable={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.01 : 0.35 }}
            className={`absolute inset-0 h-full w-full select-none object-contain object-bottom ${variant === 'stage' ? 'drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)]' : ''}`}
          />
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
