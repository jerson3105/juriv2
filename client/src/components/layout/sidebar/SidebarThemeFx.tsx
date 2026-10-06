import type { CSSProperties, ReactNode } from 'react';
import type { ThemeEffect } from '../../../lib/themeEffects';

// Efecto del tema en el menú lateral (pedido del dueño): escena en la banda, filo animado, un ambiente leve en el
// fondo y el marcador de la página con el símbolo del tema. Suave y continuo: un movimiento lento por parte, solo
// transform y opacidad; quien llama decide `moving` (quieto proyectando, con menos movimiento o con «Efectos del
// tema» apagado). Colores fijos de cada dibujo: nada del tema llega crudo al CSS.

const vars = (values: Record<string, string | number>) => values as CSSProperties;

// ── Marcador de la página («estás aquí») con el símbolo del tema ─────────────────────────────────────
// Los estilos de .sb-marker / .sb-tile-star pintan todo `path` de dorado: aquí cada forma lleva su color en
// línea, que gana a esa regla.

const paint = (fill: string, stroke = 'none', strokeWidth = 0): CSSProperties => ({ fill, stroke, strokeWidth });

const MARKS: Record<ThemeEffect, ReactNode> = {
  brillo: <path d="M8 0.6C8.55 5.1 10.9 7.45 15.4 8C10.9 8.55 8.55 10.9 8 15.4C7.45 10.9 5.1 8.55 0.6 8C5.1 7.45 7.45 5.1 8 0.6Z" style={paint('#fcd34d', '#b45309', 0.8)} />,
  aurora: <path d="M8 0.6C8.55 5.1 10.9 7.45 15.4 8C10.9 8.55 8.55 10.9 8 15.4C7.45 10.9 5.1 8.55 0.6 8C5.1 7.45 7.45 5.1 8 0.6Z" style={paint('#6ee7b7', '#047857', 0.8)} />,
  sol: (
    <g>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="8" y1="0.9" x2="8" y2="2.9" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${a} 8 8)`} />
      ))}
      <circle cx="8" cy="8" r="3.9" fill="#fcd34d" stroke="#d97706" strokeWidth="0.7" />
    </g>
  ),
  luna: <path d="M10.4 1.6A6.6 6.6 0 1 0 14.5 11.8A5.3 5.3 0 0 1 10.4 1.6Z" style={paint('#fde68a', '#ca8a04', 0.7)} />,
  luces: (
    <g>
      <rect x="6.2" y="0.8" width="3.6" height="2.8" rx="0.7" fill="#94a3b8" />
      <ellipse cx="8" cy="9.4" rx="3.9" ry="5.3" fill="#fde047" stroke="#ca8a04" strokeWidth="0.7" />
      <ellipse cx="6.7" cy="8" rx="0.9" ry="1.7" fill="#ffffff" opacity="0.75" />
    </g>
  ),
  escarcha: (
    <g stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round">
      <line x1="8" y1="1" x2="8" y2="15" />
      <line x1="1.9" y1="4.5" x2="14.1" y2="11.5" />
      <line x1="1.9" y1="11.5" x2="14.1" y2="4.5" />
      <circle cx="8" cy="8" r="1.8" fill="#7dd3fc" stroke="none" />
    </g>
  ),
  ola: (
    <g>
      <path d="M8 1.2C10.6 4.8 13.2 7.5 13.2 10.2A5.2 5.2 0 0 1 2.8 10.2C2.8 7.5 5.4 4.8 8 1.2Z" style={paint('#38bdf8', '#0369a1', 0.7)} />
      <ellipse cx="6.2" cy="10.4" rx="1" ry="1.8" fill="#e0f2fe" opacity="0.8" />
    </g>
  ),
  enredadera: (
    <g>
      <path d="M2 14C2 6.5 6.5 2 14 2C14 9.5 9.5 14 2 14Z" style={paint('#4ade80', '#15803d', 0.8)} />
      <path d="M3 13L11.5 4.5" style={paint('none', '#15803d', 0.9)} />
    </g>
  ),
  cometa: (
    <g>
      <line x1="1.5" y1="14.5" x2="8.5" y2="7.5" stroke="#fde68a" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
      <path d="M11 1.5l1.2 2.7 2.9.3-2.2 1.9.7 2.9L11 7.8 8.4 9.3l.7-2.9-2.2-1.9 2.9-.3z" style={paint('#fde047', '#ca8a04', 0.6)} />
    </g>
  ),
  brasas: (
    <g>
      <path d="M8 0.8C10.6 3.9 13.1 6.1 12.7 9.9C12.4 12.9 10.4 15.2 8 15.2C5.6 15.2 3.6 12.9 3.3 10.1C3 7.4 4.7 6.2 5.6 4.1C6.3 5.6 7 6 7.6 6C7.3 4.3 7.3 2.5 8 0.8Z" style={paint('#f97316', '#c2410c', 0.6)} />
      <path d="M8 7.2C9.6 9.2 10.6 10.4 10.3 12.2C10.1 13.6 9.1 14.4 8 14.4C6.9 14.4 5.9 13.6 5.8 12.2C5.7 10.8 6.8 9.9 7.3 8.8C7.6 9.6 8 9.9 8.4 9.9C8.1 9 7.9 8 8 7.2Z" style={paint('#fde047')} />
    </g>
  ),
  codigo: (
    <g>
      <path d="M3 4L7.5 8L3 12" style={paint('none', '#4ade80', 2)} strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8.8" y="11" width="5.2" height="1.9" rx="0.5" fill="#e2e8f0" />
    </g>
  ),
  fiesta: (
    <g>
      <rect x="1.8" y="2.6" width="4.6" height="2.4" rx="0.5" fill="#f472b6" transform="rotate(-25 4.1 3.8)" />
      <rect x="9" y="1.6" width="4.2" height="2.3" rx="0.5" fill="#fde047" transform="rotate(30 11.1 2.8)" />
      <rect x="4.8" y="9.6" width="4.6" height="2.4" rx="0.5" fill="#38bdf8" transform="rotate(15 7.1 10.8)" />
      <circle cx="12.8" cy="11.6" r="1.5" fill="#a78bfa" />
    </g>
  ),
};

/** Símbolo del tema para el marcador de la página actual (mismo lienzo 16 × 16 que el destello dorado). */
export const ThemeMark = ({ effect, className = '' }: { effect: ThemeEffect; className?: string }) => (
  <svg viewBox="0 0 16 16" className={`overflow-visible ${className}`} aria-hidden="true">{MARKS[effect]}</svg>
);

// ── Escena de la banda (el cielo de arriba) ──────────────────────────────────────────────────────────
// Solo en las zonas libres: la franja de arriba entre el logo y la constelación, y el pie de la banda (su margen
// inferior de 12 px). Lo que cruza la banda entera es breve (cometa) o muy tenue (copos, brasas).

const Spark = ({ x, y, s, delay, moving }: { x: string; y: string; s: number; delay: number; moving: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    className={`absolute ${moving ? 'tfx-twinkle-slow' : 'opacity-70'}`}
    style={{ left: x, top: y, width: s, height: s, ...vars({ '--d': '3.8s', '--delay': `${delay}s` }) }}
  >
    <path d="M8 0.6C8.55 5.1 10.9 7.45 15.4 8C10.9 8.55 8.55 10.9 8 15.4C7.45 10.9 5.1 8.55 0.6 8C5.1 7.45 7.45 5.1 8 0.6Z" fill="#fef3c7" />
  </svg>
);

/** Copos, brasas o confeti que atraviesan la banda (pocos, tenues, con fases distintas). */
const BandFlow = ({ kind, moving }: { kind: 'snow' | 'ember' | 'confetti'; moving: boolean }) => {
  if (!moving) return null;
  const xs = [14, 31, 47, 63, 78, 90];
  return (
    <>
      {xs.map((x, i) => {
        const style = vars({ left: `${x}%`, '--d': `${7 + (i % 3) * 1.6}s`, '--delay': `${-i * 1.3}s`, '--to': '170px', '--x': `${(i % 2 ? 1 : -1) * 10}px`, '--o': kind === 'confetti' ? 0.9 : 0.75 });
        if (kind === 'ember') {
          return <span key={x} className="tfx-rise absolute bottom-0 h-1.5 w-1.5 rounded-full bg-orange-300 shadow-[0_0_6px_1px_rgba(251,146,60,0.8)]" style={style} />;
        }
        if (kind === 'confetti') {
          return <span key={x} className="tfx-fall absolute top-0 h-1.5 w-1 rounded-[1px]" style={{ ...style, background: ['#f472b6', '#fde047', '#38bdf8', '#4ade80', '#a78bfa', '#fb923c'][i] }} />;
        }
        return (
          <svg key={x} viewBox="0 0 10 10" className="tfx-fall absolute top-0 h-2 w-2" style={style}>
            <g stroke="#e0f2fe" strokeWidth="1.3" strokeLinecap="round"><line x1="5" y1="0.5" x2="5" y2="9.5" /><line x1="1" y1="2.8" x2="9" y2="7.2" /><line x1="1" y1="7.2" x2="9" y2="2.8" /></g>
          </svg>
        );
      })}
    </>
  );
};

const Garland = ({ moving }: { moving: boolean }) => (
  <svg viewBox="0 0 256 14" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-3.5 w-full">
    <path d="M0 2 Q16 9 32 2 T64 2 T96 2 T128 2 T160 2 T192 2 T224 2 T256 2" fill="none" stroke="#1e293b" strokeWidth="1.2" opacity="0.8" />
    {Array.from({ length: 8 }, (_, i) => (
      <circle
        key={i}
        cx={16 + i * 32}
        cy="8.6"
        r="2.6"
        fill={['#fde047', '#fb7185', '#4ade80', '#38bdf8'][i % 4]}
        className={moving && i % 2 ? 'tfx-twinkle' : undefined}
        style={moving && i % 2 ? vars({ animationDelay: `${(i % 3) * 0.3}s` }) : undefined}
      />
    ))}
  </svg>
);

const Bunting = () => (
  <svg viewBox="0 0 256 14" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-3.5 w-full">
    <path d="M0 1.5 Q128 6 256 1.5" fill="none" stroke="#fde68a" strokeWidth="0.8" opacity="0.8" />
    {Array.from({ length: 11 }, (_, i) => {
      const x = 6 + i * 23.5;
      const y = 1.5 + 4.5 * (1 - ((x - 128) / 128) ** 2);
      return <path key={i} d={`M${x - 6} ${y} L${x + 6} ${y} L${x} ${y + 8} Z`} fill={['#f472b6', '#fde047', '#38bdf8', '#4ade80', '#a78bfa'][i % 5]} opacity="0.9" />;
    })}
  </svg>
);

const SCENES: Record<ThemeEffect, (moving: boolean) => ReactNode> = {
  brillo: (moving) => (
    <>
      <Spark x="44%" y="14%" s={9} delay={0} moving={moving} />
      <Spark x="55%" y="30%" s={6} delay={1.2} moving={moving} />
      <Spark x="61%" y="8%" s={7} delay={2.1} moving={moving} />
      <Spark x="50%" y="4%" s={5} delay={0.7} moving={moving} />
    </>
  ),
  aurora: (moving) => (
    <>
      <span className={`absolute -inset-x-1/4 top-0 h-3/5 ${moving ? 'tfx-drift' : ''}`} style={{ background: 'linear-gradient(100deg, transparent 15%, rgba(52, 211, 153, 0.3) 38%, transparent 62%)', ...vars({ '--d': '14s' }) }} />
      <span className={`absolute -inset-x-1/4 top-[8%] h-1/2 ${moving ? 'tfx-drift' : ''}`} style={{ background: 'linear-gradient(80deg, transparent 30%, rgba(167, 139, 250, 0.28) 55%, transparent 78%)', ...vars({ '--d': '19s', '--delay': '-6s' }) }} />
    </>
  ),
  luces: (moving) => <Garland moving={moving} />,
  escarcha: (moving) => (
    <>
      <svg viewBox="0 0 40 24" className="absolute bottom-0 right-0 h-6 w-10 opacity-70">
        <g stroke="#e0f2fe" strokeWidth="1" strokeLinecap="round"><path d="M40 6 L28 18 M34 12 L34 6 M34 12 L40 12 M40 16 L33 23 M22 24 L30 16" /></g>
      </svg>
      <BandFlow kind="snow" moving={moving} />
    </>
  ),
  ola: (moving) => (
    <svg viewBox="0 0 512 16" preserveAspectRatio="none" className={`absolute bottom-0 left-0 h-4 w-[200%] ${moving ? 'tfx-wave' : ''}`} style={vars({ animationDuration: '9s' })}>
      <path d="M0 8 Q32 2 64 8 T128 8 T192 8 T256 8 T320 8 T384 8 T448 8 T512 8 V16 H0 Z" fill="#38bdf8" opacity="0.35" />
      <path d="M0 11 Q32 6 64 11 T128 11 T192 11 T256 11 T320 11 T384 11 T448 11 T512 11 V16 H0 Z" fill="#0ea5e9" opacity="0.45" />
    </svg>
  ),
  enredadera: (moving) => (
    <>
      {[{ side: 'left-1', flip: false }, { side: 'right-1', flip: true }].map(({ side, flip }) => (
        <span key={side} className={`absolute bottom-0 ${side} h-12 w-6 ${moving ? 'tfx-sway' : ''}`} style={{ transformOrigin: 'bottom center' }}>
          <svg viewBox="0 0 24 48" className="h-full w-full" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
            <path d="M12 48 C12 38 4 36 6 28 C8 20 18 20 16 12 C15 7 10 5 11 1" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" pathLength={1} className={moving ? 'tfx-draw' : undefined} />
            {[{ x: 7, y: 34, r: -35 }, { x: 15, y: 22, r: 30 }, { x: 13, y: 9, r: -25 }].map((l) => (
              <ellipse key={l.y} cx={l.x} cy={l.y} rx="4" ry="2.2" fill="#4ade80" opacity="0.9" transform={`rotate(${l.r} ${l.x} ${l.y})`} />
            ))}
          </svg>
        </span>
      ))}
    </>
  ),
  sol: (moving) => (
    <>
      <span className="absolute left-1/2 top-[-30px] h-24 w-40 -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(253, 224, 71, 0.25), transparent)' }} />
      <svg viewBox="0 0 40 40" className="absolute left-[52%] top-[-10px] h-9 w-9 -translate-x-1/2">
        <g className={moving ? 'tfx-spin' : undefined} style={{ transformOrigin: '20px 20px', animationDuration: '30s' }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <rect key={a} x="18.5" y="2" width="3" height="7" rx="1.5" fill="#fde68a" transform={`rotate(${a} 20 20)`} />)}
        </g>
        <circle cx="20" cy="20" r="9.5" fill="#fcd34d" />
      </svg>
    </>
  ),
  luna: (moving) => (
    <svg viewBox="0 0 40 40" className="absolute left-[50%] top-1 h-8 w-8 -translate-x-1/2 overflow-visible">
      <circle cx="18" cy="20" r="15" fill="#c7d2fe" className={moving ? 'tfx-breathe' : undefined} style={{ transformOrigin: '18px 20px', opacity: moving ? undefined : 0.3 }} />
      <path d="M23 6.5A14 14 0 1 0 32.5 27A11.5 11.5 0 0 1 23 6.5Z" fill="#fef3c7" />
      <circle cx="-14" cy="12" r="1.2" fill="#fef3c7" />
      <circle cx="48" cy="30" r="1" fill="#fef3c7" />
    </svg>
  ),
  cometa: (moving) => (moving ? (
    <span className="tfx-diag absolute left-0 top-0 flex h-1.5 w-16 items-center justify-end" style={vars({ '--delay': '1.5s' })}>
      <span className="absolute inset-y-[2px] left-0 right-1 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(253, 230, 138, 0.9))' }} />
      <span className="relative h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_2px_rgba(253,230,138,0.9)]" />
    </span>
  ) : null),
  brasas: (moving) => (
    <>
      <span className="absolute inset-x-0 bottom-0 h-6" style={{ background: 'linear-gradient(to top, rgba(249, 115, 22, 0.28), transparent)' }} />
      <BandFlow kind="ember" moving={moving} />
    </>
  ),
  codigo: (moving) => (
    <span className="absolute left-[40%] top-0 flex h-9 w-[24%] justify-between overflow-hidden font-mono text-[9px] leading-[10px] text-emerald-300/50">
      {['1011001011', '0110100110', '1100101101'].map((col, i) => (
        <span key={col} className={`flex flex-col ${moving ? 'tfx-scroll-down' : ''}`} style={vars({ '--d': `${5 + i * 1.5}s` })}>
          {(col + col).split('').map((c, j) => <span key={j}>{c}</span>)}
        </span>
      ))}
    </span>
  ),
  fiesta: (moving) => (
    <>
      <Bunting />
      <BandFlow kind="confetti" moving={moving} />
    </>
  ),
};

/** Escena del tema en la banda del menú (decorativa). */
export const ThemeBandScene = ({ effect, moving }: { effect: ThemeEffect; moving: boolean }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    {SCENES[effect](moving)}
  </div>
);

// ── Filo derecho del menú ───────────────────────────────────────────────────────────────────────────

const EDGE: Record<ThemeEffect, (moving: boolean) => ReactNode> = {
  brillo: (moving) => (
    <>
      <span className="absolute inset-0 bg-white/20" />
      {moving && <span className="tfx-down absolute inset-x-0 top-0 h-32" style={{ background: 'linear-gradient(transparent, rgba(255,255,255,0.95), transparent)', animationDuration: '10s' }} />}
    </>
  ),
  aurora: (moving) => <span className={`absolute inset-0 ${moving ? 'tfx-aurora' : 'opacity-60'}`} style={{ background: 'linear-gradient(180deg, #34d399, #a78bfa, #34d399, #a78bfa)' }} />,
  luces: (moving) => (
    <>
      <span className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 8px, #fde047 0 1.8px, transparent 2.2px)', backgroundSize: '4px 32px' }} />
      <span className={`absolute inset-0 ${moving ? 'tfx-twinkle' : ''}`} style={{ backgroundImage: 'radial-gradient(circle at 2px 24px, #fb7185 0 1.8px, transparent 2.2px)', backgroundSize: '4px 32px' }} />
    </>
  ),
  escarcha: (moving) => (
    <>
      <span className="absolute inset-y-0 right-0 w-0.5" style={{ background: 'linear-gradient(180deg, #e0f2fe, #7dd3fc, #e0f2fe)' }} />
      <span className={`absolute inset-0 ${moving ? 'tfx-twinkle' : 'opacity-60'}`} style={{ backgroundImage: 'radial-gradient(circle at 2px 12px, #ffffff 0 1.5px, transparent 2px)', backgroundSize: '4px 44px' }} />
    </>
  ),
  ola: (moving) => (
    <span className="absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 6 400" preserveAspectRatio="none" className={`absolute left-0 top-0 h-[200%] w-full ${moving ? 'tfx-scroll-down' : ''}`} style={vars({ '--d': '8s' })}>
        <path d="M3 0 Q6 12.5 3 25 T3 50 T3 75 T3 100 T3 125 T3 150 T3 175 T3 200 T3 225 T3 250 T3 275 T3 300 T3 325 T3 350 T3 375 T3 400" fill="none" stroke="#7dd3fc" strokeWidth="1.6" />
      </svg>
    </span>
  ),
  enredadera: (moving) => (
    <svg viewBox="0 0 6 400" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <path d="M3 0 C6 30 0 50 3 80 S6 130 3 160 S0 210 3 240 S6 290 3 320 S0 370 3 400" fill="none" stroke="#4ade80" strokeWidth="1.6" pathLength={1} className={moving ? 'tfx-draw' : undefined} style={moving ? { animationDuration: '3.5s' } : undefined} />
    </svg>
  ),
  sol: (moving) => <span className={`absolute inset-0 ${moving ? 'tfx-glow' : ''}`} style={{ background: 'linear-gradient(180deg, #fde68a, #fbbf24, #f59e0b, #fbbf24, #fde68a)' }} />,
  luna: (moving) => <span className={`absolute inset-0 ${moving ? 'tfx-glow' : ''}`} style={{ background: 'linear-gradient(180deg, #e0e7ff, #a5b4fc, #eef2ff, #a5b4fc, #e0e7ff)' }} />,
  cometa: (moving) => (
    <>
      <span className="absolute inset-0 bg-indigo-200/25" />
      {moving && (
        <span className="tfx-down absolute inset-x-0 top-0 flex h-24 flex-col items-center justify-end">
          <span className="absolute inset-x-[1px] bottom-1 top-0 rounded-full" style={{ background: 'linear-gradient(transparent, rgba(253,230,138,0.9))' }} />
          <span className="relative h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_2px_rgba(253,230,138,0.9)]" />
        </span>
      )}
    </>
  ),
  brasas: (moving) => <span className={`absolute inset-0 ${moving ? 'tfx-glow' : ''}`} style={{ background: 'linear-gradient(180deg, #fbbf24, #f97316, #ef4444, #f97316, #fbbf24)', animationDuration: '2.6s' }} />,
  codigo: (moving) => (
    <span className="absolute inset-0 overflow-hidden">
      <span className={`absolute inset-x-0 top-0 h-[200%] ${moving ? 'tfx-scroll-down' : ''}`} style={{ backgroundImage: 'repeating-linear-gradient(180deg, #22c55e 0 14px, transparent 14px 20px, #38bdf8 20px 26px, transparent 26px 32px)', ...vars({ '--d': '6s' }) }} />
    </span>
  ),
  fiesta: () => <span className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(180deg, #f472b6 0 8px, transparent 8px 14px, #fde047 14px 22px, transparent 22px 28px, #38bdf8 28px 36px, transparent 36px 42px)' }} />,
};

/** Filo derecho del menú con el efecto del tema (decorativo). */
export const ThemeEdge = ({ effect, moving }: { effect: ThemeEffect; moving: boolean }) => (
  <span className="pointer-events-none absolute inset-y-0 right-0 z-20 w-1 overflow-hidden opacity-90" aria-hidden="true">
    {EDGE[effect](moving)}
  </span>
);

// ── Ambiente del fondo del menú ─────────────────────────────────────────────────────────────────────
// Siete piezas como máximo, pequeñas y tenues (≤ 0,35), con fases distintas; solo se dibuja en movimiento.

type Glyph = 'spark' | 'dot' | 'snow' | 'bubble' | 'leaf' | 'mote' | 'ember' | 'digit' | 'confetti' | 'blob';
const AMBIENT: Record<ThemeEffect, { glyph: Glyph; flow: 'fall' | 'rise' | 'still' | 'drift' }> = {
  brillo: { glyph: 'spark', flow: 'still' },
  aurora: { glyph: 'blob', flow: 'drift' },
  luces: { glyph: 'dot', flow: 'still' },
  escarcha: { glyph: 'snow', flow: 'fall' },
  ola: { glyph: 'bubble', flow: 'rise' },
  enredadera: { glyph: 'leaf', flow: 'fall' },
  sol: { glyph: 'mote', flow: 'rise' },
  luna: { glyph: 'spark', flow: 'still' },
  cometa: { glyph: 'dot', flow: 'still' },
  brasas: { glyph: 'ember', flow: 'rise' },
  codigo: { glyph: 'digit', flow: 'fall' },
  fiesta: { glyph: 'confetti', flow: 'fall' },
};
const SLOTS = [
  { x: 12, y: 22, d: 19 }, { x: 78, y: 38, d: 23 }, { x: 34, y: 61, d: 17 }, { x: 64, y: 12, d: 21 },
  { x: 88, y: 74, d: 25 }, { x: 22, y: 86, d: 20 }, { x: 52, y: 47, d: 24 },
];
const DOT_COLORS = ['#fde047', '#fb7185', '#4ade80', '#38bdf8'];
const CONFETTI = ['#f472b6', '#fde047', '#38bdf8', '#4ade80', '#a78bfa', '#fb923c', '#f472b6'];

const glyphOf = (glyph: Glyph, i: number): ReactNode => {
  switch (glyph) {
    case 'spark':
      return <svg viewBox="0 0 16 16" className="h-2.5 w-2.5"><path d="M8 0.6C8.55 5.1 10.9 7.45 15.4 8C10.9 8.55 8.55 10.9 8 15.4C7.45 10.9 5.1 8.55 0.6 8C5.1 7.45 7.45 5.1 8 0.6Z" fill="#fef3c7" /></svg>;
    case 'dot':
      return <span className="block h-1.5 w-1.5 rounded-full" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />;
    case 'snow':
      return <svg viewBox="0 0 10 10" className="h-2.5 w-2.5"><g stroke="#e0f2fe" strokeWidth="1.2" strokeLinecap="round"><line x1="5" y1="0.5" x2="5" y2="9.5" /><line x1="1" y1="2.8" x2="9" y2="7.2" /><line x1="1" y1="7.2" x2="9" y2="2.8" /></g></svg>;
    case 'bubble':
      return <span className="block h-2.5 w-2.5 rounded-full border border-sky-200/80" />;
    case 'leaf':
      return <svg viewBox="0 0 16 16" className="h-3 w-3"><path d="M2 14C2 6.5 6.5 2 14 2C14 9.5 9.5 14 2 14Z" fill="#86efac" /></svg>;
    case 'mote':
      return <span className="block h-1 w-1 rounded-full bg-amber-100" />;
    case 'ember':
      return <span className="block h-1.5 w-1.5 rounded-full bg-orange-300" />;
    case 'digit':
      return <span className="block font-mono text-[10px] font-bold text-emerald-300">{i % 2 ? '1' : '0'}</span>;
    case 'confetti':
      return <span className="block h-2 w-1 rounded-[1px]" style={{ background: CONFETTI[i] }} />;
    case 'blob':
      return <span className="block h-32 w-32 rounded-full" style={{ background: `radial-gradient(closest-side, ${i % 2 ? 'rgba(167,139,250,0.3)' : 'rgba(52,211,153,0.3)'}, transparent)` }} />;
  }
};

/** Ambiente leve detrás del menú. Quien llama lo monta solo en movimiento. */
export const ThemeAmbient = ({ effect }: { effect: ThemeEffect }) => {
  const { glyph, flow } = AMBIENT[effect];
  const slots = glyph === 'blob' ? SLOTS.slice(0, 2) : SLOTS;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {slots.map((slot, i) => {
        const moving = flow === 'fall' ? 'tfx-fall' : flow === 'rise' ? 'tfx-rise' : flow === 'drift' ? 'tfx-drift' : 'tfx-twinkle-slow';
        const place: CSSProperties = flow === 'fall'
          ? { left: `${slot.x}%`, top: 0 }
          : flow === 'rise' ? { left: `${slot.x}%`, bottom: 0 } : { left: `${slot.x}%`, top: `${slot.y}%` };
        return (
          <span
            key={i}
            className={`absolute ${moving} ${flow === 'still' ? 'opacity-30' : ''}`}
            style={{
              ...place,
              ...vars({
                '--d': `${flow === 'still' ? 3 + (i % 4) * 0.8 : slot.d}s`,
                '--delay': `${-(i * slot.d) / slots.length}s`,
                '--to': '105vh',
                '--x': `${(i % 2 ? 1 : -1) * 18}px`,
                '--r': `${(i % 3 - 1) * 160}deg`,
                '--o': glyph === 'blob' ? 0.25 : 0.32,
              }),
            }}
          >
            {glyphOf(glyph, i)}
          </span>
        );
      })}
    </div>
  );
};
