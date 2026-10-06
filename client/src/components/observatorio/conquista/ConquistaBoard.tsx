import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Star } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { regionTotal, teamTotal, type ConquistaState, type Region, type Team } from './conquistaLogic';
import {
  fogBlobs, litCount, regionIndex, regionSky, teamHex, veilOpacity, visibleBlobCount, type RegionSkyShape,
} from './conquistaSky';

// Tablero de Conquista: cada región es un pedazo de cielo con su constelación real tapada por la Niebla.
// Con cada acierto se enciende una estrella y una nube se retira; al despejarse, la constelación se
// completa y cae el estandarte del equipo. Lo nuevo se anima una sola vez comparando con `before`.

/**
 * Cifra que sube de `from` a `to` (marcador). Se monta con `key` por par de valores, así cada cambio
 * empieza desde su `from`. Con menos movimiento, o sin `from`, muestra el final.
 */
const TeamCount = ({ to, from }: { to: number; from: number | null }) => {
  const reduce = useReducedMotion();
  const animate = from !== null && from !== to && !reduce;
  const [value, setValue] = useState(from ?? to);
  useEffect(() => {
    if (!animate || from === null) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setValue(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, from, to]);
  return <>{animate ? value : to}</>;
};

interface TeamScoreboardProps {
  state: ConquistaState;
  highlight?: string[];
  /** Estado anterior: las cifras suben desde ahí. */
  before?: ConquistaState | null;
  /** Alianza estelar: una línea dorada une a los dos equipos. */
  alliance?: [string, string] | null;
}

/** Marcador: estrellas de cada equipo (sin puestos durante la partida; el podio va en la Bitácora). */
export const TeamScoreboard = ({ state, highlight = [], before = null, alliance = null }: TeamScoreboardProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chips = useRef(new Map<string, HTMLLIElement>());
  const [arc, setArc] = useState<string | null>(null);
  const pairKey = alliance ? alliance.join('|') : '';

  useLayoutEffect(() => {
    if (!pairKey) return;
    const [a, b] = pairKey.split('|');
    const measure = () => {
      const wrap = wrapRef.current?.getBoundingClientRect();
      const ra = chips.current.get(a)?.getBoundingClientRect();
      const rb = chips.current.get(b)?.getBoundingClientRect();
      if (!wrap || !ra || !rb) return;
      const x1 = ra.left + ra.width / 2 - wrap.left;
      const y1 = ra.top - wrap.top;
      const x2 = rb.left + rb.width / 2 - wrap.left;
      const y2 = rb.top - wrap.top;
      const lift = Math.max(26, Math.abs(x2 - x1) * 0.16);
      setArc(`M ${x1} ${y1} C ${x1} ${y1 - lift} ${x2} ${y2 - lift} ${x2} ${y2}`);
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [pairKey]);

  return (
    <div ref={wrapRef} className="relative w-full pt-3">
      {alliance && arc && (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden="true">
          <path d={arc} pathLength={1} fill="none" stroke="#fcd34d" strokeWidth={5} strokeLinecap="round" className="cq-line-draw" style={{ '--delay': '250ms' } as CSSProperties} />
        </svg>
      )}
      <ul className="flex w-full flex-wrap justify-center gap-2" aria-label="Estrellas por equipo">
        {state.teams.map((team) => {
          const color = teamHex(team.color);
          const lit = highlight.includes(team.id);
          const allied = !!alliance?.includes(team.id);
          const total = teamTotal(state, team.id);
          const from = before ? teamTotal(before, team.id) : null;
          return (
            <li
              key={team.id}
              ref={(el) => { if (el) chips.current.set(team.id, el); else chips.current.delete(team.id); }}
              className={`relative flex items-center gap-2 rounded-2xl border-2 px-3 py-1.5 ${lit ? 'cq-pop ring-4 ring-amber-300' : ''} ${allied ? 'ring-4 ring-amber-300/80' : ''}`}
              style={{ borderColor: color, backgroundColor: `${color}26` }}
            >
              <span className="text-[clamp(22px,3.4vh,40px)]" aria-hidden="true">{team.emblem}</span>
              <span className="text-[clamp(16px,2.6vh,30px)] font-bold text-white">{team.name}</span>
              <span className="inline-flex items-center gap-1 text-[clamp(18px,3vh,34px)] font-black text-amber-200">
                <Star className="h-[0.9em] w-[0.9em] fill-amber-300 text-amber-300" aria-hidden="true" />
                <TeamCount key={`${from}-${total}`} to={total} from={from} />
              </span>
              {allied && <span className="cq-pop absolute -right-2 -top-3 rounded-full bg-amber-300 px-1.5 text-base leading-6" aria-label="En alianza">🤝</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

interface RegionStarsProps {
  shape: RegionSkyShape;
  lit: number;
  /** Las encendidas desde este índice se animan, una tras otra. */
  animateFrom?: number;
  stagger?: number;
  baseDelay?: number;
  /** «unlit»: solo las apagadas (bajo la niebla); «lit»: encendidas y líneas (sobre la niebla). */
  layer?: 'all' | 'lit' | 'unlit';
  starScale?: number;
  lineWidth?: number;
  className?: string;
  label?: string;
}

/** Constelación en SVG: apagadas tenues; encendidas doradas con halo; cada línea al brillar sus dos extremos. */
export const RegionStars = ({
  shape, lit, animateFrom = lit, stagger = 120, baseDelay = 0, layer = 'all', starScale = 1, lineWidth = 0.55, className = '', label,
}: RegionStarsProps) => {
  const { constellation, stars } = shape;
  const isNew = (i: number) => i >= animateFrom && i < lit;
  const delayOf = (i: number) => baseDelay + Math.max(0, i - animateFrom) * stagger;
  return (
    <svg
      viewBox="0 0 100 70"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {layer !== 'unlit' && constellation.lines.map(([a, b]) => {
        if (a >= lit || b >= lit) return null;
        const p = stars[a];
        const q = stars[b];
        const fresh = isNew(a) || isNew(b);
        return (
          <line
            key={`${a}-${b}`}
            x1={p.x} y1={p.y} x2={q.x} y2={q.y}
            pathLength={1}
            stroke="#fde68a" strokeOpacity={0.62} strokeWidth={lineWidth} strokeLinecap="round"
            className={fresh ? 'cq-line-draw' : undefined}
            style={fresh ? { '--delay': `${Math.max(delayOf(a), delayOf(b)) + 250}ms` } as CSSProperties : undefined}
          />
        );
      })}
      {stars.map((s, i) => {
        const on = i < lit;
        if ((layer === 'lit' && !on) || (layer === 'unlit' && on)) return null;
        const r = s.r * starScale;
        if (!on) return <circle key={i} cx={s.x} cy={s.y} r={r * 0.7} fill="#c7d2fe" opacity={0.45} />;
        const fresh = isNew(i);
        return (
          <g
            key={i}
            className={fresh ? 'cq-ignite' : undefined}
            style={{ transformOrigin: `${s.x}px ${s.y}px`, ...(fresh ? { '--delay': `${delayOf(i)}ms` } : {}) } as CSSProperties}
          >
            <circle cx={s.x} cy={s.y} r={r * 2.6} fill="#fde68a" opacity={0.22} />
            <circle cx={s.x} cy={s.y} r={r} fill="#fef3c7" />
          </g>
        );
      })}
    </svg>
  );
};

const PENNANT_SIZE = {
  sm: { svg: 'h-[clamp(30px,5vh,56px)]', emblem: 'text-[clamp(12px,2vh,24px)]' },
  md: { svg: 'h-[clamp(40px,7.5vh,88px)]', emblem: 'text-[clamp(16px,2.8vh,34px)]' },
  lg: { svg: 'h-[clamp(56px,11vh,130px)]', emblem: 'text-[clamp(24px,4.2vh,52px)]' },
};

/** Estandarte del equipo (como los de la portada): tela de su color con borde dorado y su emblema. */
export const Pennant = ({ team, drop = false, delay = 0, size = 'md' }: { team: Team; drop?: boolean; delay?: number; size?: keyof typeof PENNANT_SIZE }) => (
  <span
    className={`relative inline-flex flex-col items-center ${drop ? 'cq-banner-drop' : ''}`}
    style={drop ? { '--delay': `${delay}ms` } as CSSProperties : undefined}
    aria-hidden="true"
  >
    <svg viewBox="0 0 40 58" className={`${PENNANT_SIZE[size].svg} w-auto`}>
      <rect x="1" y="0" width="38" height="4" rx="2" fill="#fcd34d" />
      <path d="M5 4 H35 V52 L20 43 L5 52 Z" fill={teamHex(team.color)} stroke="#fcd34d" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M5 4 H35 V11 H5 Z" fill="#000" opacity="0.18" />
    </svg>
    <span className={`absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 leading-none ${PENNANT_SIZE[size].emblem}`}>{team.emblem}</span>
  </span>
);

// Niebla: cúmulos violeta-gris (tres bultos y un brillo arriba) y, en los de abajo, el resplandor cálido
// de la portada; debajo, un velo suave. Solo degradados pintados una vez: lo que se anima es el conjunto.
const PUFF = (alpha: number) => `radial-gradient(closest-side, rgba(188, 178, 236, ${alpha}), rgba(140, 128, 198, ${alpha * 0.72}) 52%, rgba(98, 88, 156, ${alpha * 0.3}) 80%, transparent)`;
const CLOUD: CSSProperties = {
  backgroundImage: [
    'radial-gradient(closest-side, rgba(232, 226, 255, 0.4), transparent)',
    PUFF(0.7), PUFF(0.6), PUFF(0.6),
  ].join(', '),
  backgroundSize: '42% 38%, 66% 74%, 52% 58%, 52% 58%',
  backgroundPosition: '50% 18%, 50% 34%, 12% 72%, 88% 72%',
  backgroundRepeat: 'no-repeat',
};
const CLOUD_WARM: CSSProperties = {
  ...CLOUD,
  backgroundImage: `radial-gradient(closest-side, rgba(253, 186, 116, 0.42), transparent), ${CLOUD.backgroundImage}`,
  backgroundSize: `86% 38%, ${CLOUD.backgroundSize}`,
  backgroundPosition: `50% 96%, ${CLOUD.backgroundPosition}`,
};
const VEIL = 'linear-gradient(180deg, rgba(84, 74, 132, 0.75), rgba(60, 54, 104, 0.7))';
// La constelación ocupa la franja del medio: arriba va el nombre y abajo la barra.
const STAR_BOX = 'pointer-events-none absolute left-[5%] top-[22%] h-[60%] w-[90%]';

interface RegionTileProps {
  region: Region;
  teams: Team[];
  /** La región antes del último cambio (resultado o Viento solar). */
  before: Region | null;
  wind: boolean;
  /** Nadie acertó: la Niebla se espesa un momento. */
  thicken: boolean;
  onPick?: () => void;
  active?: boolean;
  spotlight?: boolean;
}

const RegionTile = ({ region, teams, before, wind, thicken, onPick, active, spotlight }: RegionTileProps) => {
  const index = regionIndex(region);
  const shape = regionSky(index, region.goal);
  const slots = shape.stars.length;
  const lit = litCount(region, slots);
  const litBefore = before ? Math.min(litCount(before, slots), lit) : lit;
  const blobs = fogBlobs(index, region.goal);
  const visible = visibleBlobCount(region, blobs.length);
  const visibleBefore = before ? visibleBlobCount(before, blobs.length) : visible;
  const veil = veilOpacity(region);
  const veilBefore = before ? veilOpacity(before) : veil;
  const justCleared = !!before && region.cleared && !before.cleared;
  const total = regionTotal(region);
  const conquerors = region.conquerors.map((id) => teams.find((t) => t.id === id)).filter((t): t is Team => !!t);
  const color = conquerors[0] ? teamHex(conquerors[0].color) : null;
  const border = color ?? (spotlight || active ? '#fcd34d' : 'rgba(255,255,255,0.18)');
  const starsStart = wind ? 550 : 200;
  // Cuando termina de encenderse la última estrella nueva: ahí llegan el color y el estandarte.
  const starsDone = starsStart + 120 * Math.max(0, lit - litBefore - 1) + 700;

  const content = (
    <>
      <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 35%, #1c2554 0%, #121a3d 62%, #0d1330 100%)' }} aria-hidden="true" />
      {color && (
        <span
          className={`pointer-events-none absolute inset-0 ${justCleared ? 'cq-fade-in' : ''}`}
          style={{ background: `radial-gradient(ellipse at 50% 55%, ${color}66 0%, ${color}29 48%, transparent 85%)`, ...(justCleared ? { '--delay': `${starsDone}ms` } : {}) } as CSSProperties}
          aria-hidden="true"
        />
      )}
      <RegionStars shape={shape} lit={lit} layer="unlit" starScale={1.25} className={STAR_BOX} />
      {(visible > 0 || visibleBefore > 0 || veilBefore > 0) && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <span className="cq-veil absolute inset-0" style={{ background: VEIL, '--from': veilBefore, '--to': veil } as CSSProperties} />
          <span className="cq-fog absolute -left-[8%] -right-[8%] inset-y-0">
            {blobs.map((b) => {
              const shown = b.order >= blobs.length - visible;
              const shownBefore = b.order >= blobs.length - visibleBefore;
              if (!shown && !shownBefore) return null;
              const leaving = shownBefore && !shown;
              return (
                <span
                  key={b.order}
                  className={`absolute ${leaving ? 'cq-blob-out' : ''}`}
                  style={{
                    left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%`,
                    ...(b.warm ? CLOUD_WARM : CLOUD),
                    // Con viento, todas las nubes salen hacia el mismo lado.
                    ...(leaving ? { '--dx': `${wind ? Math.abs(b.dx) : b.dx}%`, '--dy': `${b.dy}%`, '--delay': `${(wind ? 350 : 150) + (b.order % 3) * 90}ms` } : {}),
                  } as CSSProperties}
                />
              );
            })}
          </span>
          {thicken && <span className="cq-thicken absolute inset-0" style={{ background: VEIL }} />}
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-[#0b1026]/75 to-transparent" aria-hidden="true" />
      <RegionStars shape={shape} lit={lit} animateFrom={litBefore} baseDelay={starsStart} layer="lit" starScale={1.25} lineWidth={0.7} className={STAR_BOX} />
      {conquerors.length > 0 && (
        <span className="pointer-events-none absolute right-3 top-0 flex gap-1">
          {conquerors.slice(0, 2).map((t, i) => <Pennant key={t.id} team={t} drop={justCleared} delay={starsDone + 300 + i * 150} />)}
        </span>
      )}
      <span className="relative flex h-full flex-col justify-between gap-2 [text-shadow:0_2px_6px_rgba(0,0,0,0.85)]">
        <span className={`flex items-start justify-between gap-2 ${conquerors.length > 0 ? 'pr-[clamp(44px,8.5vh,96px)]' : ''}`}>
          <span className="min-w-0">
            <span className="block text-[clamp(18px,3vh,36px)] font-black leading-tight text-white">{region.name}</span>
            <span className="block text-[clamp(13px,1.9vh,22px)] font-semibold text-indigo-100">{region.subtitle}</span>
          </span>
          {!region.cleared && (
            <span className="shrink-0 rounded-full bg-[#0b1026]/60 px-2.5 py-0.5 text-[clamp(16px,2.4vh,28px)] font-black text-amber-100">
              {Math.min(total, region.goal)}/{region.goal} ⭐
            </span>
          )}
        </span>
        <span>
          {region.cleared && (
            <span className="mb-1 block text-[clamp(14px,2.1vh,24px)] font-bold text-amber-100">
              Conquistada por {conquerors.map((t) => `${t.emblem} ${t.name}`).join(' y ') || 'la clase'}
            </span>
          )}
          {/* Aporte por equipo (barra apilada) */}
          <span className="flex h-3 w-full overflow-hidden rounded-full bg-[#0b1026]/60 ring-1 ring-white/15" aria-hidden="true">
            {teams.map((t) => {
              const n = region.stars[t.id] ?? 0;
              return n > 0 ? <span key={t.id} style={{ width: `${(n / region.goal) * 100}%`, backgroundColor: teamHex(t.color) }} /> : null;
            })}
            {region.neutral > 0 && <span className="bg-amber-200" style={{ width: `${(region.neutral / region.goal) * 100}%` }} />}
          </span>
        </span>
      </span>
    </>
  );
  const className = `relative min-h-[25vh] overflow-hidden rounded-3xl border-4 p-4 text-left transition-transform ${spotlight ? 'ring-4 ring-amber-300' : ''}`;
  const style = { borderColor: border };
  if (onPick && !region.cleared) {
    return (
      <button type="button" data-region-id={region.id} onClick={onPick} className={`${className} hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300`} style={style}>
        {content}
      </button>
    );
  }
  return <div data-region-id={region.id} className={className} style={style}>{content}</div>;
};

const GUSTS = [
  { top: 12, width: 46, delay: 0, height: 0.9 },
  { top: 29, width: 34, delay: 260, height: 0.55 },
  { top: 46, width: 56, delay: 110, height: 1.05 },
  { top: 63, width: 38, delay: 380, height: 0.6 },
  { top: 80, width: 50, delay: 190, height: 0.85 },
];

/** Viento solar: ráfagas que cruzan el mapa de izquierda a derecha. */
const WindGusts = () => (
  <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-3xl" aria-hidden="true">
    {GUSTS.map((g) => (
      <span
        key={g.top}
        className="cq-gust absolute left-0 rounded-full"
        style={{
          top: `${g.top}%`, width: `${g.width}%`, height: `${g.height}vh`,
          background: 'linear-gradient(90deg, transparent, rgba(224, 231, 255, 0.75) 45%, rgba(255, 255, 255, 0.95) 55%, transparent)',
          '--delay': `${g.delay}ms`,
        } as CSSProperties}
      />
    ))}
  </div>
);

interface SkyMapProps {
  state: ConquistaState;
  onPick?: (regionId: string) => void;
  activeRegionId?: string | null;
  /** Estado anterior: estrellas nuevas, nubes que se retiran y conquistas se animan una vez. */
  before?: ConquistaState | null;
  wind?: boolean;
  thickenRegionId?: string | null;
  /** Región iluminada mientras «Jiro elige». */
  spotlightId?: string | null;
}

export const SkyMap = ({ state, onPick, activeRegionId, before = null, wind = false, thickenRegionId = null, spotlightId = null }: SkyMapProps) => (
  <div className="relative w-full">
    <div className={`grid w-full gap-3 ${state.regions.length > 4 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
      {state.regions.map((region) => (
        <RegionTile
          key={region.id}
          region={region}
          teams={state.teams}
          before={before?.regions.find((r) => r.id === region.id) ?? null}
          wind={wind}
          thicken={region.id === thickenRegionId}
          active={region.id === activeRegionId}
          spotlight={region.id === spotlightId}
          onPick={onPick ? () => onPick(region.id) : undefined}
        />
      ))}
    </div>
    {wind && <WindGusts />}
  </div>
);

/** Constelación pequeña de la región (encabezado de la pregunta). */
export const RegionMiniSky = ({ region }: { region: Region }) => {
  const shape = regionSky(regionIndex(region), region.goal);
  return <RegionStars shape={shape} lit={litCount(region, shape.stars.length)} starScale={1.6} lineWidth={1} className="h-[clamp(36px,6vh,72px)] w-auto shrink-0" />;
};
