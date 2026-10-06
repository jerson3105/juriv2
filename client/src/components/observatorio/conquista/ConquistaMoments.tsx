import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { StageSound } from '../observatorioSound';
import { Pennant, RegionStars } from './ConquistaBoard';
import { CARDS, type ActiveCard, type ConquistaState, type Region, type Team } from './conquistaLogic';
import { starBurst, starRain } from './conquistaFx';
import { regionIndex, regionSky } from './conquistaSky';

// Momentos de Conquista: la conquista de una región (la constelación viene al centro y se completa,
// cae el estandarte y Jiro cuenta su dato), la carta de Jiro y el cielo despejado del final.

const teamsOf = (ids: string[], teams: Team[]) => ids.map((id) => teams.find((t) => t.id === id)).filter((t): t is Team => !!t);

const STAGGER = 110;
const START = 450;
const HOLD_MS = 2400;

interface ConquestMomentProps {
  region: Region;
  teams: Team[];
  sound: StageSound;
  /** Espera antes de aparecer: deja ver la última estrella encenderse en el mapa. */
  delay: number;
  onDone: () => void;
}

/** Conquista: la región viene al centro, su constelación se completa y cae el estandarte (≈3 s; Espacio la salta). */
export const ConquestMoment = ({ region, teams, sound, delay, onDone }: ConquestMomentProps) => {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(delay <= 0);
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });
  const shape = regionSky(regionIndex(region), region.goal);
  const count = shape.stars.length;
  const starsEnd = START + count * STAGGER + 300;
  const conquerors = teamsOf(region.conquerors, teams);

  // Sale desde su recuadro en el mapa (si está a la vista) hacia el centro del área de juego.
  const [from] = useState(() => {
    const rect = document.querySelector(`[data-region-id="${region.id}"]`)?.getBoundingClientRect();
    const left = window.innerWidth >= 768 ? window.innerWidth * 0.22 : 0;
    if (!rect) return { x: 0, y: 40, scale: 0.6 };
    return {
      x: rect.left + rect.width / 2 - (left + (window.innerWidth - left) / 2),
      y: rect.top + rect.height / 2 - (window.innerHeight - 56) / 2,
      scale: Math.min(1, Math.max(0.2, rect.width / ((window.innerWidth - left) * 0.7))),
    };
  });

  useEffect(() => {
    if (shown) return;
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [shown, delay]);

  useEffect(() => {
    if (!shown) return;
    const timers: number[] = [];
    if (reduce) {
      sound.conquer();
      timers.push(window.setTimeout(() => done.current(), 4500));
    } else {
      sound.whoosh();
      for (let i = 0; i < count; i += 1) timers.push(window.setTimeout(() => sound.star(i), START + i * STAGGER));
      timers.push(window.setTimeout(() => { sound.conquer(); starBurst(); }, starsEnd));
      timers.push(window.setTimeout(() => done.current(), starsEnd + HOLD_MS));
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [shown, reduce, count, starsEnd, sound]);

  if (!shown) return null;
  return (
    <div className="fixed bottom-14 left-0 right-0 top-0 z-20 flex items-center justify-center md:left-[22vw]" role="status" aria-live="polite">
      <div className="cq-fade-in absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(30,27,75,0.94),rgba(7,11,28,0.97)_70%)]" aria-hidden="true" />
      <motion.div
        className="relative flex w-[min(70vw,120vh)] flex-col items-center gap-[1.5vh] px-4 text-center"
        initial={reduce ? false : { opacity: 0, x: from.x, y: from.y, scale: from.scale }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <p className="text-[clamp(18px,3vh,34px)] font-bold uppercase tracking-[0.2em] text-indigo-200">{region.name}</p>
        <RegionStars
          shape={shape}
          lit={count}
          animateFrom={reduce ? count : 0}
          stagger={STAGGER}
          baseDelay={START}
          lineWidth={0.5}
          className="h-[36vh] w-auto max-w-full"
          label={`${shape.constellation.name}, completa`}
        />
        <p className="stage-title cq-rise font-black text-amber-200" style={{ '--delay': `${starsEnd}ms` } as CSSProperties}>¡Región despejada!</p>
        {conquerors.length > 0 ? (
          <div className="flex flex-wrap items-end justify-center gap-6">
            {conquerors.map((t, i) => (
              <div key={t.id} className="flex flex-col items-center gap-1">
                <Pennant team={t} drop delay={starsEnd + 150 + i * 160} size="lg" />
                <span className="stage-body cq-rise font-black text-white" style={{ '--delay': `${starsEnd + 450 + i * 160}ms` } as CSSProperties}>
                  {t.name} <span className="text-amber-200">+3 ⭐</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="stage-body cq-rise text-indigo-100" style={{ '--delay': `${starsEnd + 300}ms` } as CSSProperties}>La clase despejó esta región.</p>
        )}
      </motion.div>
    </div>
  );
};

const CARD_LINE: Record<ActiveCard['id'], string> = {
  lluvia: 'Esta ronda, cada acierto vale doble.',
  alianza: 'Si uno de los dos acierta, ganan los dos.',
  viento: 'La Niebla retrocede: todas las regiones ganan una estrella.',
  segunda: 'Los equipos que fallen responderán otra pregunta de la misma región.',
  telescopio: 'Jiro descartará una opción incorrecta.',
};

/** Carta de Jiro (encima del mapa, apaisada para que el mapa siga a la vista): entra girando, con su efecto. */
export const CardPanel = ({ card, state }: { card: ActiveCard; state: ConquistaState }) => {
  const info = CARDS[card.id];
  const pair = card.pair ? teamsOf(card.pair, state.teams) : [];
  return (
    <div className="cq-card-in relative flex w-full max-w-5xl items-center gap-[2vw] overflow-hidden rounded-3xl border-2 border-amber-300 bg-amber-300/15 px-6 py-3" role="status">
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_50%,rgba(252,211,77,0.3),transparent_60%)]" aria-hidden="true" />
      <span className="relative text-[clamp(56px,10vh,120px)] leading-none" aria-hidden="true">
        <span className="obs-star-in inline-block">{info.icon}</span>
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[clamp(28px,5vh,60px)] font-black leading-tight text-amber-100">{info.title}</span>
        <span className="stage-body block text-white">{CARD_LINE[card.id]}</span>
        {pair.length === 2 && <span className="stage-body block font-bold text-white">{pair.map((t) => `${t.emblem} ${t.name}`).join(' + ')}</span>}
      </span>
      {card.id === 'lluvia' && (
        <span className="cq-pop relative shrink-0 rounded-2xl bg-amber-300 px-4 py-1 text-[clamp(28px,5vh,60px)] font-black text-amber-950" style={{ '--delay': '450ms' } as CSSProperties}>
          ×2
        </span>
      )}
    </div>
  );
};

/** Cielo despejado: las constelaciones de todas las regiones se completan una tras otra, con lluvia de estrellas. */
export const ConquistaFinale = ({ state, sound }: { state: ConquistaState; sound: StageSound }) => {
  const reduce = useReducedMotion();
  useEffect(() => {
    sound.conquer();
    starRain();
    const id = window.setTimeout(starRain, 1700);
    return () => window.clearTimeout(id);
  }, [sound]);
  return (
    <div className="flex w-full max-w-6xl flex-col items-center gap-[2vh]">
      <h2 className="stage-title cq-rise text-center font-black text-amber-200">¡Cielo despejado!</h2>
      <div className={`grid w-full gap-4 ${state.regions.length > 4 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
        {state.regions.map((region, i) => {
          const shape = regionSky(regionIndex(region), region.goal);
          const at = 300 + i * 420;
          return (
            <div
              key={region.id}
              className="cq-rise flex flex-col items-center gap-1 rounded-3xl border-2 border-white/10 bg-white/5 p-3"
              style={{ '--delay': `${at}ms` } as CSSProperties}
            >
              <RegionStars
                shape={shape}
                lit={shape.stars.length}
                animateFrom={reduce ? shape.stars.length : 0}
                stagger={60}
                baseDelay={at + 150}
                className="h-[16vh] w-auto max-w-full"
                label={shape.constellation.name}
              />
              <p className="text-[clamp(18px,2.8vh,32px)] font-black text-white">{shape.constellation.name}</p>
              <div className="flex min-h-[clamp(30px,5vh,56px)] gap-2">
                {teamsOf(region.conquerors, state.teams).map((t) => <Pennant key={t.id} team={t} size="sm" />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
