import { useId, type CSSProperties, type ReactNode } from 'react';
import type { MotionLevel } from '../layout/sidebar/useSidebarState';
import { accentGradient, type StoryAccent } from '../../lib/storyTheme';
import type { ThemeEffect } from '../../lib/themeEffects';

// Efecto del tema en la cabecera (pedido del dueño): la línea de color cobra vida y un adorno dibujado acompaña a
// la clase. Cada efecto tiene a lo sumo un bucle (en la línea o en el adorno) y solo anima transform/opacidad.
// Con «full» se mueve; proyectando («calm»), con menos movimiento («off») o con los efectos apagados queda quieto.
// Los colores salen del acento ya derivado (hex normalizado) o son fijos del dibujo: nada del tema llega crudo al CSS.

/** Qué parte se mueve en cada efecto (una sola): así nunca hay dos bucles a la vez. */
const LOOP_IN: Record<ThemeEffect, 'line' | 'ornament' | 'once'> = {
  brillo: 'line', aurora: 'line', luces: 'line', escarcha: 'line', ola: 'line', cometa: 'line',
  sol: 'ornament', luna: 'ornament', brasas: 'ornament', codigo: 'ornament',
  enredadera: 'once', fiesta: 'once',
};

const delay = (ms: number) => ({ '--delay': `${ms}ms` }) as CSSProperties;
const origin = (x: number, y: number): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

// ── Línea de la cabecera ──────────────────────────────────────────────────────────────────────────

const STRIP = 'pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden';

const EffectStrip = ({ effect, accent, moving }: { effect: ThemeEffect; accent: StoryAccent; moving: boolean }) => {
  switch (effect) {
    case 'brillo':
      return moving ? (
        <span className={`${STRIP} h-0.5`}>
          <span className="tfx-sweep absolute inset-y-0 left-0 w-40" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)' }} />
        </span>
      ) : null;
    case 'aurora':
      return (
        <span className={`${STRIP} h-1`}>
          <span
            className={`absolute inset-0 ${moving ? 'tfx-aurora' : 'opacity-50'}`}
            style={{ background: `linear-gradient(90deg, #34d399, ${accent.secondary}, #a78bfa, ${accent.primary}, #34d399)` }}
          />
        </span>
      );
    case 'luces':
      return (
        <span className={`${STRIP} h-2`}>
          <span className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 8px 5px, #fde047 0 2.5px, transparent 3px)', backgroundSize: '32px 8px' }} />
          <span
            className={`absolute inset-0 ${moving ? 'tfx-twinkle' : ''}`}
            style={{ backgroundImage: 'radial-gradient(circle at 24px 5px, #fb7185 0 2.5px, transparent 3px), radial-gradient(circle at 16px 5px, #4ade80 0 2px, transparent 2.5px)', backgroundSize: '32px 8px, 64px 8px' }}
          />
        </span>
      );
    case 'escarcha':
      return (
        <span className={`${STRIP} h-2`}>
          <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: `linear-gradient(90deg, #e0f2fe, #7dd3fc, ${accent.primary}, #bae6fd)` }} />
          <span
            className={`absolute inset-0 ${moving ? 'tfx-twinkle' : 'opacity-70'}`}
            style={{ backgroundImage: 'radial-gradient(circle at 12px 4px, #ffffff 0 1.5px, transparent 2px), radial-gradient(circle at 36px 2px, #e0f2fe 0 1px, transparent 1.5px)', backgroundSize: '48px 8px, 48px 8px' }}
          />
        </span>
      );
    case 'ola':
      return (
        <span className={`${STRIP} h-2`}>
          <svg className={`absolute bottom-0 left-0 h-2 w-[200%] ${moving ? 'tfx-wave' : ''}`} viewBox="0 0 400 8" preserveAspectRatio="none">
            <path d="M0 5 Q 25 0 50 5 T 100 5 T 150 5 T 200 5 T 250 5 T 300 5 T 350 5 T 400 5 V 8 H 0 Z" fill={accent.primary} opacity={0.85} />
            <path d="M0 6 Q 25 2.5 50 6 T 100 6 T 150 6 T 200 6 T 250 6 T 300 6 T 350 6 T 400 6" fill="none" stroke="#e0f2fe" strokeWidth={1} opacity={0.9} />
          </svg>
        </span>
      );
    case 'enredadera':
      return (
        <span className={`${STRIP} h-2.5`}>
          <svg className="absolute bottom-0 left-0 h-2.5 w-full" viewBox="0 0 400 10" preserveAspectRatio="none">
            <path d="M0 8 C 30 3 50 9 80 6 S 130 2 160 7 S 210 9 240 5 S 300 3 330 7 S 380 8 400 5" fill="none" stroke="#16a34a" strokeWidth={1.6} pathLength={1} className={moving ? 'tfx-draw' : undefined} />
          </svg>
          {[8, 22, 37, 51, 66, 80, 93].map((x, i) => (
            <span
              key={x}
              className={`absolute bottom-0.5 h-1.5 w-2.5 rounded-[100%_0] ${moving ? 'tfx-pop' : ''}`}
              style={{ left: `${x}%`, background: i % 2 ? '#4ade80' : '#22c55e', rotate: `${i % 2 ? -20 : 20}deg`, ...(moving ? delay(300 + i * 260) : {}) }}
            />
          ))}
        </span>
      );
    case 'sol':
      return (
        <span className={`${STRIP} h-1`}>
          <span className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #fde68a, #fbbf24, #f59e0b, #fbbf24, #fde68a)' }} />
        </span>
      );
    case 'luna':
      return (
        <span className={`${STRIP} h-1`}>
          <span className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #c7d2fe, #a5b4fc, #eef2ff, #a5b4fc, #c7d2fe)' }} />
        </span>
      );
    case 'cometa':
      return moving ? (
        <span className={`${STRIP} h-2`}>
          <span className="tfx-comet absolute bottom-0 left-0 flex h-2 w-28 items-center justify-end">
            <span className="absolute inset-y-[3px] left-0 right-1 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(253,230,138,0.85))' }} />
            <span className="relative h-2 w-2 rounded-full bg-white shadow-[0_0_6px_2px_rgba(253,230,138,0.9)]" />
          </span>
        </span>
      ) : null;
    case 'brasas':
      return (
        <span className={`${STRIP} h-1`}>
          <span className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #fbbf24, #f97316, #ef4444, #f97316, #fbbf24)' }} />
        </span>
      );
    case 'codigo':
      return (
        <span className={`${STRIP} h-0.5`}>
          {/* Colores de editor (los del tema son oscuros para el texto blanco y se perdían en modo oscuro). */}
          <span className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #22c55e 0 14px, transparent 14px 20px, #38bdf8 20px 26px, transparent 26px 32px)' }} />
        </span>
      );
    case 'fiesta':
      return (
        <span className={`${STRIP} h-2`}>
          {[4, 13, 21, 30, 38, 47, 55, 64, 72, 81, 89, 97].map((x, i) => (
            <span
              key={x}
              className={`absolute bottom-0.5 h-1.5 w-1 rounded-sm ${moving ? 'tfx-pop' : ''}`}
              style={{ left: `${x}%`, background: ['#f472b6', '#fbbf24', '#38bdf8', '#4ade80', '#a78bfa'][i % 5], rotate: `${(i % 3 - 1) * 30}deg`, ...(moving ? delay(i * 90) : {}) }}
            />
          ))}
        </span>
      );
    default:
      return null;
  }
};

/** Línea de color de la cabecera con el efecto del tema (reemplaza al filo fijo de antes). */
export const ThemeHeaderLine = ({ accent, level }: { accent: StoryAccent; level: MotionLevel }) => {
  const moving = level === 'full' && LOOP_IN[accent.effect] !== 'ornament';
  const baseHidden = accent.effect === 'escarcha' || accent.effect === 'codigo';
  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0" aria-hidden="true">
      {!baseHidden && <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: accentGradient(accent, 90) }} />}
      <EffectStrip effect={accent.effect} accent={accent} moving={moving} />
    </span>
  );
};

// ── Adorno ───────────────────────────────────────────────────────────────────────────────────────

const OUTLINE = 'rgba(30, 27, 75, 0.35)';

/** Dibujos propios (40 × 40), redondos y con brillo dorado como el arte de Jiro. `moving`: su bucle o su entrada. */
const Drawing = ({ effect, uid, moving }: { effect: ThemeEffect; uid: string; moving: boolean }): ReactNode => {
  switch (effect) {
    case 'sol':
      return (
        <>
          <defs>
            <radialGradient id={`${uid}s`} cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="#fff7c2" /><stop offset="0.6" stopColor="#fcd34d" /><stop offset="1" stopColor="#f59e0b" />
            </radialGradient>
          </defs>
          <g className={moving ? 'tfx-spin' : undefined} style={origin(20, 20)}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <rect key={a} x="18.4" y="1" width="3.2" height="7" rx="1.6" fill={a % 90 ? '#fde68a' : '#fbbf24'} transform={`rotate(${a} 20 20)`} />
            ))}
          </g>
          <circle cx="20" cy="20" r="10.5" fill={`url(#${uid}s)`} stroke="#d97706" strokeOpacity="0.55" strokeWidth="1" />
          <circle cx="16.5" cy="19" r="1.25" fill="#78350f" />
          <circle cx="23.5" cy="19" r="1.25" fill="#78350f" />
          <circle cx="14.3" cy="22.6" r="1.7" fill="#fb7185" opacity="0.5" />
          <circle cx="25.7" cy="22.6" r="1.7" fill="#fb7185" opacity="0.5" />
          <path d="M17 23 Q20 25.8 23 23" stroke="#78350f" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'luna':
      return (
        <>
          <defs>
            <linearGradient id={`${uid}m`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fefce8" /><stop offset="1" stopColor="#fde68a" />
            </linearGradient>
          </defs>
          <circle cx="18" cy="21" r="16" fill="#c7d2fe" className={moving ? 'tfx-breathe' : undefined} style={{ ...origin(18, 21), opacity: moving ? undefined : 0.35 }} />
          <path d="M23 6.5 A14 14 0 1 0 32.5 27 A11.5 11.5 0 0 1 23 6.5 Z" fill={`url(#${uid}m)`} stroke="#ca8a04" strokeOpacity="0.5" strokeWidth="1" />
          <path d="M11.5 19.5 q1.6 1.4 3.2 0" stroke="#78350f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M16.5 23 q1.6 1.4 3.2 0" stroke="#78350f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <circle cx="12.5" cy="24" r="1.6" fill="#fb7185" opacity="0.45" />
          <path d="M14.5 27.5 q2.2 1.5 4.4 -0.3" stroke="#78350f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M32 5 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" fill="#fde047" />
        </>
      );
    case 'luces':
      return (
        <>
          <path d="M2 9 Q20 25 38 9" stroke="#334155" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {[
            { x: 9, y: 14.5, c: '#f87171', r: 18 }, { x: 20, y: 17.2, c: '#fde047', r: 0 }, { x: 31, y: 14.5, c: '#4ade80', r: -18 },
          ].map((b) => (
            <g key={b.x} transform={`rotate(${b.r} ${b.x} ${b.y})`}>
              <circle cx={b.x} cy={b.y + 7} r="6.5" fill={b.c} opacity="0.25" />
              <rect x={b.x - 2} y={b.y - 0.5} width="4" height="3.5" rx="1" fill="#475569" />
              <ellipse cx={b.x} cy={b.y + 7} rx="3.6" ry="5" fill={b.c} stroke={OUTLINE} strokeWidth="0.8" />
              <ellipse cx={b.x - 1.2} cy={b.y + 5.5} rx="1" ry="1.8" fill="#ffffff" opacity="0.7" />
            </g>
          ))}
        </>
      );
    case 'escarcha':
      return (
        <>
          <g stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round">
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <g key={a} transform={`rotate(${a} 20 20)`}>
                <line x1="20" y1="20" x2="20" y2="4" />
                <line x1="20" y1="9" x2="16" y2="5.5" />
                <line x1="20" y1="9" x2="24" y2="5.5" />
              </g>
            ))}
          </g>
          <circle cx="20" cy="20" r="4" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M33 30 l0.8 2 2 0.8 -2 0.8 -0.8 2 -0.8 -2 -2 -0.8 2 -0.8 z" fill="#bae6fd" />
        </>
      );
    case 'ola':
      return (
        <>
          <defs>
            <linearGradient id={`${uid}o`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#0369a1" />
            </linearGradient>
          </defs>
          <path d="M2 26 C6 14 16 8 25 11 C33 14 35 22 29 25 C25 27 21 24 23 21 C24 19 27 19.5 27.5 21.5 C30 18 26 13.5 21 14.5 C14 16 11 24 11 30 L38 30 L38 38 L2 38 Z" fill={`url(#${uid}o)`} stroke={OUTLINE} strokeWidth="0.8" />
          <path d="M11 29 C12 22 16 16.5 22 16" stroke="#e0f2fe" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="9" r="1.8" fill="#7dd3fc" />
          <circle cx="35.5" cy="13.5" r="1.2" fill="#bae6fd" />
          <path d="M2 34 Q8 31 14 34 T26 34 T38 34" stroke="#e0f2fe" strokeWidth="1.2" fill="none" opacity="0.8" />
        </>
      );
    case 'enredadera':
      return (
        <>
          <path d="M6 36 C6 26 14 26 15 19 C16 12 24 12 26 7" stroke="#15803d" strokeWidth="2.2" fill="none" strokeLinecap="round" pathLength={1} className={moving ? 'tfx-draw' : undefined} />
          {[
            { x: 8.5, y: 28, r: -40 }, { x: 18, y: 22, r: 35 }, { x: 19, y: 13, r: -30 },
          ].map((l, i) => (
            // El giro va en la hoja y la entrada en su grupo: el transform del CSS reemplazaría al del SVG.
            <g key={i} className={moving ? 'tfx-pop' : undefined} style={{ ...origin(l.x, l.y), ...(moving ? delay(600 + i * 450) : {}) }}>
              <ellipse cx={l.x} cy={l.y} rx="5" ry="2.8" fill="#4ade80" stroke="#15803d" strokeWidth="0.8" transform={`rotate(${l.r} ${l.x} ${l.y})`} />
            </g>
          ))}
          <g className={moving ? 'tfx-pop' : undefined} style={{ ...origin(27, 7), ...(moving ? delay(2100) : {}) }}>
            {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="27" cy="3.6" rx="2" ry="2.8" fill="#f9a8d4" transform={`rotate(${a} 27 7)`} />)}
            <circle cx="27" cy="7" r="1.8" fill="#fde047" />
          </g>
        </>
      );
    case 'cometa':
      return (
        <>
          <path d="M4 36 L26 12" stroke="#fde68a" strokeWidth="6" strokeLinecap="round" opacity="0.25" />
          <path d="M8 33 L26 13" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          <circle cx="28" cy="11" r="6.5" fill="#fde68a" opacity="0.35" />
          <path d="M28 4.5 l1.9 4.4 4.6 0.4 -3.5 3 1.1 4.5 -4.1 -2.4 -4.1 2.4 1.1 -4.5 -3.5 -3 4.6 -0.4 z" fill="#fde047" stroke="#ca8a04" strokeWidth="0.8" strokeLinejoin="round" />
          <circle cx="9" cy="10" r="1.2" fill="#c7d2fe" />
          <circle cx="34" cy="30" r="1.4" fill="#fde68a" />
        </>
      );
    case 'brasas':
      return (
        <>
          <rect x="7" y="31" width="26" height="4.5" rx="2.2" fill="#92400e" transform="rotate(-12 20 33)" />
          <rect x="7" y="31" width="26" height="4.5" rx="2.2" fill="#b45309" transform="rotate(12 20 33)" />
          <g className={moving ? 'tfx-flicker' : undefined} style={origin(20, 32)}>
            <path d="M20 4 C24 11 30 14 29 22 C28.5 28 24.5 31.5 20 31.5 C15.5 31.5 11.5 28 11 22.5 C10.6 17 14 15 15.5 11 C17 14 18.5 15 19.5 15 C19 11 19 7.5 20 4 Z" fill="#f97316" stroke="#c2410c" strokeWidth="0.8" />
            <path d="M20 15 C23 19 25 21 24.5 25 C24 28.5 22 30 20 30 C18 30 15.8 28.5 15.6 25.5 C15.4 22.5 17.5 21 18.5 19 C19 20.5 19.8 21 20.5 21 C20 19 19.6 17 20 15 Z" fill="#fde047" />
          </g>
          <circle cx="31" cy="11" r="1.2" fill="#fb923c" />
          <circle cx="9" cy="14" r="1" fill="#fdba74" />
        </>
      );
    case 'codigo':
      return (
        <>
          <rect x="3" y="6" width="34" height="28" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1" />
          <circle cx="8.5" cy="11" r="1.5" fill="#f87171" />
          <circle cx="13" cy="11" r="1.5" fill="#fbbf24" />
          <circle cx="17.5" cy="11" r="1.5" fill="#4ade80" />
          <path d="M13 18 L8.5 22.5 L13 27" stroke="#4ade80" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22.5 17.5 L18 27.5" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" />
          <path d="M27.5 18 L32 22.5 L27.5 27" stroke="#4ade80" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="26" y="29" width="5" height="1.8" rx="0.6" fill="#e2e8f0" className={moving ? 'tfx-blink' : undefined} />
        </>
      );
    case 'fiesta':
      return (
        <>
          <path d="M5 35 L13 15 L25 27 Z" fill="#f472b6" stroke="#be185d" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M8.2 27 L18.5 32.5 M10.6 21 L22.2 30" stroke="#fde68a" strokeWidth="2" />
          {[
            { x: 24, y: 9, c: '#fbbf24', w: 3, h: 1.6, r: 20 }, { x: 31, y: 13, c: '#38bdf8', w: 2.6, h: 1.6, r: -30 },
            { x: 29, y: 5, c: '#4ade80', w: 2.4, h: 1.4, r: 50 }, { x: 34, y: 21, c: '#a78bfa', w: 2.6, h: 1.5, r: 10 },
            { x: 20, y: 6, c: '#f87171', w: 2.2, h: 1.4, r: -40 },
          ].map((p, i) => (
            <g key={i} className={moving ? 'tfx-pop' : undefined} style={{ ...origin(p.x, p.y), ...(moving ? delay(150 + i * 120) : {}) }}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="0.5" fill={p.c} transform={`rotate(${p.r} ${p.x} ${p.y})`} />
            </g>
          ))}
          <path d="M22 18 q3 -4 7 -3 q3 1 5 -2" stroke="#fbbf24" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'aurora':
      return (
        <>
          <circle cx="20" cy="20" r="17" fill="#1e1b4b" stroke="#4338ca" strokeWidth="1" />
          <path d="M5 21 C11 13 17 22 23 14 C27 9 31 14 35 11" stroke="#34d399" strokeWidth="3.2" fill="none" strokeLinecap="round" opacity="0.9" />
          <path d="M6 25 C12 18 18 26 24 19 C28 15 31 19 34 16" stroke="#a78bfa" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.85" />
          <path d="M5.5 30 Q20 23 34.5 30 A17 17 0 0 1 5.5 30 Z" fill="#312e81" />
          <circle cx="12" cy="10" r="0.9" fill="#ffffff" />
          <circle cx="28" cy="7.5" r="1" fill="#fde68a" />
        </>
      );
    default:
      return (
        <>
          <path d="M20 3 C21.6 13 27 18.4 37 20 C27 21.6 21.6 27 20 37 C18.4 27 13 21.6 3 20 C13 18.4 18.4 13 20 3 Z" fill="#fcd34d" stroke="#d97706" strokeOpacity="0.6" strokeWidth="1" strokeLinejoin="round" />
          <path d="M20 10 C20.8 15.5 24.5 19.2 30 20 C24.5 20.8 20.8 24.5 20 30 C19.2 24.5 15.5 20.8 10 20 C15.5 19.2 19.2 15.5 20 10 Z" fill="#fef3c7" />
          <path d="M33 5 l0.9 2.2 2.2 0.9 -2.2 0.9 -0.9 2.2 -0.9 -2.2 -2.2 -0.9 2.2 -0.9 z" fill="#fde68a" />
          <path d="M8 29 l0.7 1.7 1.7 0.7 -1.7 0.7 -0.7 1.7 -0.7 -1.7 -1.7 -0.7 1.7 -0.7 z" fill="#fde68a" />
        </>
      );
  }
};

interface ThemeOrnamentProps {
  accent: StoryAccent;
  level: MotionLevel;
  className?: string;
}

/** Adorno dibujado del tema (40 × 40) junto a la esquina de la cabecera. Decorativo: el lector no lo anuncia. */
export const ThemeOrnament = ({ accent, level, className = 'h-10 w-10' }: ThemeOrnamentProps) => {
  const uid = `tfx${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const loop = LOOP_IN[accent.effect];
  const moving = level === 'full' && loop !== 'line';
  return (
    <svg viewBox="0 0 40 40" className={`pointer-events-none shrink-0 overflow-visible ${className}`} aria-hidden="true" focusable="false">
      <Drawing effect={accent.effect} uid={uid} moving={moving} />
    </svg>
  );
};
