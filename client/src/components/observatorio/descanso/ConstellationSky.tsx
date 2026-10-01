import type { Constellation } from './constellations';

interface ConstellationSkyProps {
  constellation: Constellation;
  /** Estrellas encendidas (en orden). */
  lit: number;
  /** Avance (0–1) de la siguiente estrella: crece y se aclara mientras hay calma. */
  charging?: number;
  className?: string;
  /** Sin animaciones de entrada (miniaturas del álbum). */
  still?: boolean;
  label?: string;
}

/**
 * Constelación en SVG: las apagadas se insinúan, las encendidas brillan (halo + núcleo, sin filtros)
 * y cada línea aparece cuando sus dos estrellas ya están encendidas.
 */
export const ConstellationSky = ({ constellation, lit, charging = 0, className = '', still = false, label }: ConstellationSkyProps) => (
  <svg viewBox="0 0 100 70" className={className} role="img" aria-label={label ?? `${constellation.name}: ${Math.min(lit, constellation.stars.length)} de ${constellation.stars.length} estrellas`}>
    {constellation.lines.map(([a, b]) => {
      if (a >= lit || b >= lit) return null;
      const p = constellation.stars[a];
      const q = constellation.stars[b];
      return (
        <line
          key={`${a}-${b}`}
          x1={p.x} y1={p.y} x2={q.x} y2={q.y}
          stroke="#fde68a" strokeOpacity={0.55} strokeWidth={0.45} strokeLinecap="round"
          className={still ? '' : 'obs-star-in'}
        />
      );
    })}
    {constellation.stars.map((star, i) => {
      const on = i < lit;
      const r = star.r ?? 2;
      // La siguiente se "carga" con la calma; el resto se insinúa (visible con luz en el aula).
      const grow = !on && i === lit ? Math.min(1, Math.max(0, charging)) : 0;
      return (
        <g key={i} style={{ transformOrigin: `${star.x}px ${star.y}px` }} className={on && !still ? 'obs-star-in' : ''}>
          {on && <circle cx={star.x} cy={star.y} r={r * 2.4} fill="#fde68a" opacity={0.18} />}
          {grow > 0 && <circle cx={star.x} cy={star.y} r={r * (1 + grow * 1.6)} fill="#fde68a" opacity={0.12 * grow} />}
          <circle cx={star.x} cy={star.y} r={on ? r : r * (0.6 + 0.4 * grow)} fill={on ? '#fef3c7' : grow > 0 ? '#fde68a' : '#c7d2fe'} opacity={on ? 1 : 0.55 + 0.4 * grow} />
        </g>
      );
    })}
  </svg>
);
