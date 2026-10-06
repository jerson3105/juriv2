import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { CONSTELLATIONS, type Constellation } from '../../observatorio/descanso/constellations';
import type { ThemeEffect } from '../../../lib/themeEffects';
import { ThemeBandScene } from './SidebarThemeFx';
import type { MotionLevel } from './useSidebarState';

export type BandSky =
  | { kind: 'class'; constellation: Constellation; lit: number; key: string }
  | { kind: 'orion' };

type Vars = CSSProperties & Record<`--${string}`, string | number>;
const ORION = CONSTELLATIONS.find((constellation) => constellation.id === 'orion')!;

/**
 * La constelación de la banda, con el trazo del acceso (auth-draw/auth-pop) y un tamaño que se ve en el
 * proyector (estrellas ≥ 2 px). Encendidas: dorado; apagadas: se insinúan. Una estrella nueva hace «pop»
 * y su línea se traza cuando sus dos extremos ya brillan.
 */
const BandConstellation = ({ constellation, lit, animate }: { constellation: Constellation; lit: number; animate: boolean }) => (
  <svg viewBox="0 0 100 70" className="h-auto w-full overflow-visible" aria-hidden="true">
    {constellation.lines.map(([a, b], index) => {
      if (a >= lit || b >= lit) return null;
      const from = constellation.stars[a];
      const to = constellation.stars[b];
      return (
        <line
          key={`${a}-${b}`}
          x1={from.x} y1={from.y} x2={to.x} y2={to.y}
          pathLength={1}
          stroke="#fde68a"
          strokeOpacity={0.7}
          strokeWidth={1.1}
          strokeLinecap="round"
          className={animate ? 'auth-draw' : ''}
          style={{ '--auth-delay': `${0.25 + index * 0.12}s` } as Vars}
        />
      );
    })}
    {constellation.stars.map((star, index) => {
      const on = index < lit;
      const r = (star.r ?? 2) * 1.35;
      return (
        <g key={index}>
          {on && <circle cx={star.x} cy={star.y} r={r * 2.2} fill="#fde68a" opacity={0.2} />}
          <circle
            cx={star.x}
            cy={star.y}
            r={on ? r : r * 0.6}
            fill={on ? '#fef3c7' : '#c7d2fe'}
            opacity={on ? 1 : 0.6}
            className={on && animate ? 'auth-pop' : ''}
            style={{ '--auth-delay': `${index * 0.08}s`, transformBox: 'fill-box', transformOrigin: 'center' } as Vars}
          />
        </g>
      );
    })}
  </svg>
);

// Cinco estrellas como máximo, entre el logo y la constelación (nunca bajo los textos).
const TWINKLES = [
  { left: '46%', top: '16%', s: 2, d: 4.2, delay: 0.2 },
  { left: '53%', top: '34%', s: 1.5, d: 5, delay: 1.1 },
  { left: '59%', top: '9%', s: 2.5, d: 4.6, delay: 0.6 },
  { left: '64%', top: '27%', s: 1.5, d: 5.4, delay: 1.7 },
  { left: '50%', top: '4%', s: 1.5, d: 4.8, delay: 2.3 },
];
const REPLAY_AFTER_MS = 12_000;

interface SidebarBandProps {
  sky: BandSky;
  /** Color de la noche (teñida con el tema de la clase) o null: noche pura. */
  tint: string | null;
  /** Titileo de 3 ciclos al llegar y al pasar el ratón (alumno y profe fuera de clase). */
  twinkle: boolean;
  motion: MotionLevel;
  /** Escena del tema de la clase en la banda (o null) y si se mueve. */
  effect: ThemeEffect | null;
  effectMoving: boolean;
  rail: boolean;
  logoTo: string;
  showClose: boolean;
  closeRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
  children?: ReactNode;
}

/**
 * La banda del Observatorio: el cielo pintado (obs-sky, sin animación) con el logo, el contexto de la
 * clase y su constelación. Las estrellas aparecen una vez al entrar y nada se mueve en reposo.
 */
export const SidebarBand = ({ sky, tint, twinkle, motion, effect, effectMoving, rail, logoTo, showClose, closeRef, onClose, children }: SidebarBandProps) => {
  const [run, setRun] = useState(0);
  const lastRun = useRef(0);
  // El titileo de llegada cuenta como la primera vuelta.
  useEffect(() => {
    lastRun.current = Date.now();
  }, []);
  const animate = motion === 'full';
  const showTwinkles = twinkle && animate && !rail;

  return (
    <div
      data-sb="night"
      data-motion={motion}
      className="sb-band obs-sky relative flex-shrink-0 overflow-hidden border-b border-white/10 text-white"
      style={tint ? ({ '--sb-night-bg': tint } as CSSProperties) : undefined}
      onMouseEnter={() => {
        if (!showTwinkles || Date.now() - lastRun.current < REPLAY_AFTER_MS) return;
        lastRun.current = Date.now();
        setRun((value) => value + 1);
      }}
    >
      {effect && !rail && <ThemeBandScene effect={effect} moving={effectMoving} />}
      {!rail && (
        <div className={`pointer-events-none absolute top-1 w-[4.5rem] ${showClose ? 'right-14' : 'right-3'}`} aria-hidden="true">
          {sky.kind === 'class'
            ? <BandConstellation key={sky.key} constellation={sky.constellation} lit={sky.lit} animate={animate} />
            : <BandConstellation constellation={ORION} lit={ORION.stars.length} animate={animate} />}
        </div>
      )}
      {showTwinkles && (
        <div key={run} className="pointer-events-none absolute inset-0" aria-hidden="true">
          {TWINKLES.map((star, index) => (
            <span
              key={index}
              className="sb-twinkle"
              style={{ left: star.left, top: star.top, '--s': `${star.s}px`, '--d': `${star.d}s`, '--delay': `${star.delay}s` } as CSSProperties}
            />
          ))}
        </div>
      )}

      <div className={`relative ${rail ? 'flex flex-col items-center gap-2 px-2 py-3' : 'px-3 pb-3 pt-2'}`}>
        <div className={`flex h-10 items-center ${rail ? 'justify-center' : 'justify-between'}`}>
          <Link to={logoTo} className="sb-focus inline-flex items-center rounded-lg" aria-label="Juried: ir al inicio">
            <img src={rail ? '/logo-solo.png' : '/logo.png'} alt="" className={rail ? 'h-8 w-8' : 'h-8 w-auto'} />
          </Link>
          {showClose && (
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar menú"
              className="sb-focus flex h-11 w-11 items-center justify-center rounded-xl text-white/90 hover:bg-white/10 hover:text-white"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        {children && <div className={rail ? '' : 'mt-1.5'}>{children}</div>}
      </div>
    </div>
  );
};
