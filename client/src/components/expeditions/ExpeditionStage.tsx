import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Check, Hourglass, Lock, RotateCcw, Star } from 'lucide-react';
import { useMotionBudget } from '../layout/sidebar/useSidebarState';
import { assetUrl, type ExpeditionScenario, type StopKind, type StopState } from '../../lib/expeditionApi';
import { KIND_INFO, STATE_INFO, stageConstellation } from './expeditionHelpers';

export interface StageStop {
  id: string;
  kind: StopKind;
  title: string;
  state: StopState;
  goldStar?: boolean;
  mapX: number | null;
  mapY: number | null;
}

interface ExpeditionStageProps {
  scenario: ExpeditionScenario;
  constellationId: string | null;
  mapImageUrl: string | null;
  stops: StageStop[];
  /** Llegó a la meta: se encienden también las estrellas que sobran y se cierra la figura. */
  finished?: boolean;
  currentStopId?: string | null;
  /** Lo que marca «Estás aquí» (el personaje del alumno), sobre la estrella actual. */
  here?: ReactNode;
  selectedId?: string | null;
  onSelect?: (stopId: string) => void;
  /** Mapa (docente): tocar el mapa ubica esta parada. */
  placingId?: string | null;
  onPlace?: (x: number, y: number) => void;
  /** «plan»: editor del docente (todas encendidas, sin estados). */
  variant?: 'play' | 'plan';
  label: string;
  className?: string;
}

const isLit = (state: StopState) => state === 'DONE' || state === 'NEEDS_WORK';

/** Recuerda qué estaba encendido en el render anterior: lo nuevo se anima una vez (no al abrir la página). */
const useJustLit = (litKeys: string[]) => {
  const previous = useRef<Set<string> | null>(null);
  const justLit = useMemo(() => {
    if (!previous.current) return new Set<string>();
    return new Set(litKeys.filter((key) => !previous.current!.has(key)));
    // litKeys cambia de identidad en cada render: se compara por contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [litKeys.join('|')]);
  useEffect(() => {
    previous.current = new Set(litKeys);
  });
  return justLit;
};

/** Estrella con número: forma e ícono además de color (bloqueada, tu turno, esperando, mejorar, lograda). */
const StopStar = ({ number, stop, current, selected, justLit, twinkleDelay, plan }: {
  number: number; stop: StageStop; current: boolean; selected: boolean; justLit: boolean; twinkleDelay: number; plan: boolean;
}) => {
  if (plan) {
    // Editor: la figura completa, sin estados ni animación.
    return (
      <span className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-amber-300 text-sm font-extrabold tabular-nums text-amber-950 shadow-[0_0_0_4px_rgb(253_230_138/0.28),0_0_14px_rgb(253_230_138/0.5)] ${selected ? 'outline outline-[3px] outline-offset-2 outline-white' : ''}`}>
        {number}
      </span>
    );
  }
  const lit = isLit(stop.state);
  const open = stop.state === 'AVAILABLE' || stop.state === 'STARTED';
  const face = lit
    ? 'bg-amber-300 text-amber-950 shadow-[0_0_0_4px_rgb(253_230_138/0.28),0_0_18px_rgb(253_230_138/0.6)] exp-lit-glow'
    : open
      ? 'bg-white text-blue-800 ring-[3px] ring-blue-400'
      : stop.state === 'WAITING'
        ? 'bg-white text-amber-900 ring-[3px] ring-amber-400'
        : 'border-[1.5px] border-dashed border-indigo-200/70 bg-indigo-200/15 text-indigo-100';
  return (
    <span className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold tabular-nums ${face} ${justLit ? 'exp-just-lit' : ''} ${current && open ? 'exp-current' : ''} ${selected ? 'outline outline-[3px] outline-offset-2 outline-amber-300' : ''}`}
      style={{ '--d': `${twinkleDelay}s` } as CSSProperties}>
      {number}
      {stop.state === 'DONE' && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#047857] text-white ring-2 ring-[#0b1026]">
          <Check size={10} strokeWidth={3.5} aria-hidden="true" />
        </span>
      )}
      {stop.state === 'NEEDS_WORK' && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-white ring-2 ring-[#0b1026]">
          <RotateCcw size={10} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {stop.state === 'WAITING' && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-700 text-white ring-2 ring-[#0b1026]">
          <Hourglass size={9} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {stop.state === 'LOCKED' && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-950 text-indigo-100 ring-1 ring-indigo-200/60">
          <Lock size={8} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      {stop.goldStar && (
        <span className="absolute -right-1.5 -top-1.5 text-amber-200 drop-shadow-[0_0_4px_rgb(251_191_36)]">
          <Star size={13} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
    </span>
  );
};

/**
 * Escenario de la expedición: una constelación real (las paradas son sus estrellas, en orden) o un mapa de la
 * biblioteca con la proporción de la imagen (las posiciones son % de la imagen, no del contenedor: así no se
 * corren en el celular). Las estrellas son botones de 44 px fuera del SVG.
 */
export const ExpeditionStage = ({
  scenario, constellationId, mapImageUrl, stops, finished = false, currentStopId, here,
  selectedId, onSelect, placingId, onPlace, variant = 'play', label, className = '',
}: ExpeditionStageProps) => {
  const motion = useMotionBudget();
  const [ratio, setRatio] = useState(16 / 9);
  const constellation = stageConstellation(constellationId, stops.length);
  const isMap = scenario === 'MAP' && !!mapImageUrl;
  const plan = variant === 'plan';

  // Posición de cada parada en % del escenario.
  const points = stops.map((stop, index) => {
    if (isMap) return { x: stop.mapX ?? 10 + index * 8, y: stop.mapY ?? 50 };
    const star = constellation.stars[index] ?? { x: 50, y: 35 };
    return { x: star.x, y: (star.y / 70) * 100 };
  });

  // Estrellas encendidas: las paradas logradas y, al llegar a la meta, todas las de la figura (en el editor, las
  // paradas: así el docente ve la forma de su constelación).
  const stopLit = (index: number) => plan || isLit(stops[index].state);
  const litStar = (index: number) => (index < stops.length ? stopLit(index) : finished);
  const litLines = isMap
    ? stops.slice(1).map((_, i) => (stopLit(i) && stopLit(i + 1) ? `m${i}` : null)).filter((key): key is string => !!key)
    : constellation.lines.filter(([a, b]) => litStar(a) && litStar(b)).map(([a, b]) => `${a}-${b}`);
  const litKeys = plan ? [] : [
    ...stops.filter((stop) => isLit(stop.state)).map((stop) => stop.id),
    ...(!isMap && finished ? constellation.stars.slice(stops.length).map((_, i) => `meta${i}`) : []),
    ...litLines.map((key) => `line:${key}`),
  ];
  const justLit = useJustLit(litKeys);

  const place = (event: MouseEvent<HTMLDivElement>) => {
    if (!placingId || !onPlace) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100));
    onPlace(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };

  const currentIndex = stops.findIndex((stop) => stop.id === currentStopId);

  return (
    <div
      data-motion={motion}
      role="group"
      aria-label={label}
      className={`obs-sky relative w-full select-none overflow-hidden rounded-2xl ${className}`}
      style={{ aspectRatio: isMap ? String(ratio) : '100 / 70' }}
    >
      {isMap && (
        <img
          src={assetUrl(mapImageUrl)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
          }}
        />
      )}

      {/* Líneas: en la constelación aparecen cuando sus dos estrellas brillan; en el mapa, el camino recorrido. */}
      <svg viewBox={isMap ? '0 0 100 100' : '0 0 100 70'} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {isMap ? (
          stops.slice(1).map((_, i) => {
            const a = points[i];
            const b = points[i + 1];
            const key = `m${i}`;
            const lit = litLines.includes(key);
            return (
              <g key={key}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgb(11 16 38 / 0.55)" strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={lit ? '#fcd34d' : '#e0e7ff'} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke"
                  strokeDasharray={lit ? undefined : '2 7'} pathLength={lit ? 1 : undefined}
                  className={lit && justLit.has(`line:${key}`) ? 'exp-line-new' : ''}
                />
              </g>
            );
          })
        ) : (
          <>
            {constellation.lines.map(([a, b]) => {
              if (!litStar(a) || !litStar(b)) return null;
              const p = constellation.stars[a];
              const q = constellation.stars[b];
              const key = `${a}-${b}`;
              return (
                <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#fde68a" strokeOpacity={0.75} strokeWidth={0.6} strokeLinecap="round" pathLength={1}
                  className={justLit.has(`line:${key}`) ? 'exp-line-new' : ''} />
              );
            })}
            {/* Las estrellas que sobran: la meta. Se encienden todas al terminar. */}
            {constellation.stars.slice(stops.length).map((star, i) => {
              const lit = finished;
              return (
                <g key={`meta${i}`} className={lit && justLit.has(`meta${i}`) ? 'exp-meta-in' : ''} style={{ transformOrigin: `${star.x}px ${star.y}px`, animationDelay: `${0.15 * i}s` }}>
                  {lit && <circle cx={star.x} cy={star.y} r={(star.r ?? 2) * 2.4} fill="#fde68a" opacity={0.2} />}
                  <circle cx={star.x} cy={star.y} r={lit ? star.r ?? 2 : (star.r ?? 2) * 0.55} fill={lit ? '#fef3c7' : '#c7d2fe'} opacity={lit ? 1 : 0.45} />
                </g>
              );
            })}
          </>
        )}
      </svg>

      {/* Paradas */}
      {stops.map((stop, index) => {
        const point = points[index];
        const info = STATE_INFO[stop.state];
        const name = plan
          ? `Parada ${index + 1}: ${stop.title}. ${KIND_INFO[stop.kind].label}`
          : `Parada ${index + 1}: ${stop.title}. ${KIND_INFO[stop.kind].label}. ${info.label}${stop.goldStar ? ', con estrella dorada' : ''}`;
        const star = (
          <StopStar
            number={index + 1}
            stop={stop}
            current={index === currentIndex}
            selected={stop.id === selectedId}
            justLit={justLit.has(stop.id)}
            twinkleDelay={(index * 0.7) % 3}
            plan={plan}
          />
        );
        return (
          <div key={stop.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${point.x}%`, top: `${point.y}%` }}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(stop.id)} aria-label={name} title={stop.title}
                className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-amber-300">
                {star}
              </button>
            ) : (
              <span role="img" aria-label={name} className="flex h-11 w-11 items-center justify-center">{star}</span>
            )}
          </div>
        );
      })}

      {/* «Estás aquí»: el personaje del alumno sobre su estrella actual (debajo si la estrella está arriba). */}
      {here && currentIndex >= 0 && (
        <div className="pointer-events-none absolute" style={{
          left: `${Math.min(92, Math.max(8, points[currentIndex].x))}%`,
          top: `${points[currentIndex].y}%`,
          transform: points[currentIndex].y > 32 ? 'translate(-50%, calc(-100% - 14px))' : 'translate(-50%, 20px)',
        }}>
          <div className="exp-here flex flex-col items-center">
            {here}
            <span className="sr-only">Estás aquí</span>
          </div>
        </div>
      )}

      {placingId && onPlace && (
        <div className="absolute inset-0 cursor-crosshair bg-indigo-950/20" onClick={place} role="presentation">
          <p className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-[#0b1026]/85 px-3 py-1 text-xs font-semibold text-white">
            Toca el mapa donde va la parada
          </p>
        </div>
      )}
    </div>
  );
};

/** Miniatura sin botones (tarjetas): la constelación con las paradas logradas encendidas, o el mapa. */
export const ExpeditionThumb = ({ scenario, constellationId, mapImageUrl, stopsCount, doneCount, finished, className = '' }: {
  scenario: ExpeditionScenario; constellationId: string | null; mapImageUrl: string | null;
  stopsCount: number; doneCount: number; finished: boolean; className?: string;
}) => {
  if (scenario === 'MAP' && mapImageUrl) {
    return <img src={assetUrl(mapImageUrl)} alt="" className={`h-full w-full object-cover ${className}`} loading="lazy" />;
  }
  const constellation = stageConstellation(constellationId, Math.max(1, stopsCount));
  const lit = (i: number) => (i < stopsCount ? i < doneCount : finished);
  return (
    <svg viewBox="0 0 100 70" className={`h-full w-full ${className}`} aria-hidden="true">
      {constellation.lines.map(([a, b]) => {
        if (!lit(a) || !lit(b)) return null;
        const p = constellation.stars[a];
        const q = constellation.stars[b];
        return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#fde68a" strokeOpacity={0.6} strokeWidth={0.5} />;
      })}
      {constellation.stars.map((star, i) => (
        <g key={i}>
          {lit(i) && <circle cx={star.x} cy={star.y} r={(star.r ?? 2) * 2.2} fill="#fde68a" opacity={0.18} />}
          <circle cx={star.x} cy={star.y} r={lit(i) ? star.r ?? 2 : (star.r ?? 2) * 0.7} fill={lit(i) ? '#fef3c7' : '#c7d2fe'} opacity={lit(i) ? 1 : i < stopsCount ? 0.65 : 0.35} />
        </g>
      ))}
    </svg>
  );
};
