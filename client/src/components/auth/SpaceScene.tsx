import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { CONSTELLATIONS } from '../observatorio/descanso/constellations';

// Generador determinista: las estrellas quedan en el mismo lugar en cada visita (sin saltos).
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Cielo de estrellas que titilan (decorativo). */
export const Starfield = ({ count = 60, seed = 7 }: { count?: number; seed?: number }) => {
  const stars = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => ({
      left: rand() * 100,
      top: rand() * 100,
      size: rand() < 0.15 ? 2.5 : rand() < 0.5 ? 1.75 : 1.2,
      base: 0.25 + rand() * 0.45,
      duration: 2.5 + rand() * 3.5,
      delay: rand() * 4,
    }));
  }, [count, seed]);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className="auth-twinkle absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, opacity: s.base,
            '--auth-o': s.base, '--auth-d': `${s.duration}s`, '--auth-delay': `${s.delay}s`,
          } as Vars}
        />
      ))}
    </div>
  );
};

interface ConstellationArtProps {
  id: string;
  className?: string;
  /** Trazar las líneas al aparecer (en el panel nocturno). */
  draw?: boolean;
  /** Colores: noche (dorado sobre azul) o tenue (fondo de la tarjeta). */
  tone?: 'night' | 'faint';
  delay?: number;
}

/** Una constelación real (las mismas del Descanso del Observatorio), trazada línea a línea. */
export const ConstellationArt = ({ id, className = '', draw = false, tone = 'night', delay = 0 }: ConstellationArtProps) => {
  const constellation = CONSTELLATIONS.find((c) => c.id === id);
  if (!constellation) return null;
  const night = tone === 'night';
  return (
    <svg viewBox="0 0 100 70" className={`pointer-events-none ${className}`} aria-hidden="true">
      {constellation.lines.map(([a, b], i) => {
        const from = constellation.stars[a];
        const to = constellation.stars[b];
        return (
          <line
            key={i}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            pathLength={1}
            className={`${draw ? 'auth-draw' : ''} ${night ? 'stroke-amber-200/70' : 'stroke-primary-300/50 dark:stroke-indigo-300/25'}`}
            strokeWidth={night ? 0.5 : 0.4}
            strokeLinecap="round"
            style={{ '--auth-delay': `${delay + 0.25 + i * 0.12}s` } as Vars}
          />
        );
      })}
      {constellation.stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x} cy={s.y} r={(s.r ?? 1.8) * (night ? 0.7 : 0.55)}
          className={`${draw ? 'auth-pop' : ''} ${night ? 'fill-amber-200' : 'fill-primary-400/60 dark:fill-indigo-300/40'}`}
          style={{ '--auth-delay': `${delay + i * 0.08}s`, transformBox: 'fill-box', transformOrigin: 'center' } as Vars}
        />
      ))}
    </svg>
  );
};
