import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import type { StageSound } from './observatorioSound';

const SHOW_MS = 6200;
const SHOW_MS_STILL = 3500;
const OUT_MS = 450;

interface ActivityWelcomeProps {
  title: string;
  tagline: string;
  /** Portada 4:3 de la actividad (la del catálogo). */
  cover: string;
  sound: StageSound;
  onDone: () => void;
}

/**
 * Bienvenida a una actividad del Observatorio (≈6 s, a pantalla completa, al abrirla): cielo, la portada que se
 * acerca despacio, el nombre y una frase, con una caja de música. Cualquier tecla, un clic o «Saltar» la terminan;
 * mientras dura, ninguna tecla llega al escenario. Con «reducir movimiento», quieta y más corta.
 */
export const ActivityWelcome = ({ title, tagline, cover, sound, onDone }: ActivityWelcomeProps) => {
  const reduce = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });
  const ended = useRef(false);
  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    setLeaving(true);
    window.setTimeout(() => done.current(), OUT_MS);
  }, []);

  useEffect(() => {
    sound.unlock();
    sound.lullaby();
    const id = window.setTimeout(finish, reduce ? SHOW_MS_STILL : SHOW_MS);
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      finish();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [finish, reduce, sound]);

  return createPortal(
    <div
      className={`obs-sky fixed inset-0 z-[190] flex flex-col items-center justify-center gap-[2.5vh] overflow-hidden px-6 text-center text-white ${leaving ? 'aw-out' : 'aw-in'}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Bienvenida: ${title}`}
      onClick={finish}
    >
      <p className="aw-rise text-[clamp(16px,2.6vh,30px)] font-extrabold uppercase tracking-[0.2em] text-amber-200" style={{ '--aw-delay': '200ms' } as CSSProperties}>
        Observatorio de Jiro
      </p>
      <div className="aw-rise relative" style={{ '--aw-delay': '350ms' } as CSSProperties}>
        <div className="relative aspect-[4/3] w-[min(90vw,72vh)] overflow-hidden rounded-[clamp(20px,3.5vh,40px)] shadow-[0_0_0_4px_rgba(253,230,138,0.35),0_0_80px_rgba(129,140,248,0.45)]">
          <img src={cover} alt="" draggable={false} className="aw-zoom absolute inset-0 h-full w-full select-none object-cover" />
        </div>
        {['Z', 'z', 'z'].map((letter, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="aw-z absolute font-black text-indigo-100 [text-shadow:0_0_16px_rgba(199,210,254,0.85)]"
            style={{ left: `${66 + i * 6}%`, top: `${22 - i * 5}%`, fontSize: `clamp(20px,${4 - i * 0.6}vh,52px)`, '--aw-delay': `${900 + i * 500}ms` } as CSSProperties}
          >
            {letter}
          </span>
        ))}
      </div>
      <h1 className="aw-rise stage-title font-black text-white" style={{ '--aw-delay': '700ms' } as CSSProperties}>{title}</h1>
      <p className="aw-rise stage-body font-bold text-indigo-100" style={{ '--aw-delay': '1100ms' } as CSSProperties}>{tagline}</p>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); finish(); }}
        className="absolute bottom-5 right-5 inline-flex min-h-[44px] items-center rounded-xl bg-white/10 px-4 text-sm font-bold text-white ring-1 ring-white/25 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        Saltar ›
      </button>
    </div>,
    document.body,
  );
};
