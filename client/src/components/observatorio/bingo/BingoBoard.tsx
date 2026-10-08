import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { BingoAnswer, BingoSize } from '../../../lib/bingoApi';
import { stageControlClass } from '../EscenarioObservatorio';
import { FREE, type checkCard } from './bingoLogic';

/**
 * La Esfera de Jiro: un anillo con una estrellita por cada bola que queda (hasta 40). Al sortear gira ~2,5 vueltas
 * y frena; el astro con la pregunta llega al centro. Solo se anima con transform/opacity.
 */
export const EsferaJiro = ({ remaining, spin, children }: { remaining: number; spin: number; children: ReactNode }) => {
  const dots = Math.min(remaining, 40);
  return (
    <div className="relative aspect-square w-[min(36vh,72vw)] shrink-0">
      <div key={spin} className={`absolute inset-0 ${spin > 0 ? 'bg-spin' : ''}`} aria-hidden="true">
        {Array.from({ length: dots }, (_, i) => {
          const angle = (i / Math.max(dots, 1)) * Math.PI * 2 - Math.PI / 2;
          return (
            <span
              key={i}
              className="absolute h-[2.4%] w-[2.4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]"
              style={{ left: `${50 + 46 * Math.cos(angle)}%`, top: `${50 + 46 * Math.sin(angle)}%` }}
            />
          );
        })}
      </div>
      <div className="absolute inset-[8%] rounded-full border-2 border-amber-200/25" aria-hidden="true" />
      <div className="absolute inset-[15%] flex items-center justify-center">{children}</div>
    </div>
  );
};

/** El astro del centro: «?» mientras se piensa; al revelar gira y muestra la respuesta. */
export const Astro = ({ text, revealKey, delayMs }: { text: string | null; revealKey: string; delayMs: number }) => {
  const long = (text ?? '').length > 8;
  return (
    <div
      key={revealKey}
      className={`${text ? 'bg-flip' : 'bg-astro-in'} flex h-full w-full items-center justify-center rounded-full p-[8%] text-center ring-4 ring-amber-300/70 shadow-[0_0_60px_rgba(129,140,248,0.55)]`}
      style={{ background: 'radial-gradient(circle at 35% 30%, #6366f1, #312e81 60%, #1e1b4b)', '--bg-delay': `${delayMs}ms` } as CSSProperties}
    >
      <span className={`font-black leading-none text-amber-200 [hyphens:auto] [overflow-wrap:break-word] ${text ? (long ? 'text-[clamp(22px,4.2vh,52px)]' : 'text-[clamp(34px,8vh,96px)]') : 'text-[clamp(48px,12vh,140px)]'}`}>
        {text ?? '?'}
      </span>
    </div>
  );
};

/**
 * «Cielo de palabras»: todas las respuestas posibles; las ya reveladas, encendidas con ★ y su número de salida, y la
 * última con anillo. Tres señales a la vez (no solo color).
 */
// Palabras largas (MicroPython, Pin.OUT) con letra algo más chica: en casillas angostas se partían por la mitad.
const wordSizeClass = (text: string) => (text.length > 10 ? 'text-[0.72em]' : text.length > 7 ? 'text-[0.85em]' : '');

export const CieloDePalabras = ({ answers, revealedOrder, lastKey, compact = false }: {
  answers: BingoAnswer[];
  /** Respuestas reveladas, sin repetir, en el orden en que se encendieron (su número de salida). */
  revealedOrder: string[];
  /** La respuesta de la última bola revelada (puede haberse encendido antes con otra pregunta). */
  lastKey: string | null;
  compact?: boolean;
}) => {
  const position = new Map(revealedOrder.map((key, i) => [key, i + 1]));
  const last = lastKey;
  return (
    <ul className={`grid gap-1.5 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 xl:grid-cols-3'}`} aria-label="Respuestas del bingo">
      {answers.map((answer) => {
        const n = position.get(answer.key);
        const isLast = answer.key === last;
        return (
          <li
            key={answer.key}
            className={`relative flex min-h-[2.6em] items-center justify-center rounded-xl px-1.5 pb-1 pt-[0.85em] text-center text-[clamp(15px,2.2vh,26px)] font-bold leading-tight ${n
              ? `bg-amber-300 text-amber-950 ${isLast ? 'bg-lit ring-4 ring-white' : ''}`
              : 'border border-dashed border-white/25 text-indigo-100'}`}
          >
            {/* La estrella y el número de salida van en las esquinas: al lado de la palabra le quitaban ancho y la partían. */}
            {n && <span className="absolute left-1.5 top-0.5 text-[0.65em]" aria-hidden="true">★</span>}
            <span className={`min-w-0 [hyphens:auto] [overflow-wrap:break-word] ${wordSizeClass(answer.text)}`}>{answer.text}</span>
            {n && <span className="absolute right-1.5 top-0.5 text-[0.6em] font-black opacity-70">#{n}</span>}
            <span className="sr-only">{n ? `salió en el sorteo ${n}${isLast ? ', la última' : ''}` : 'aún no sale'}</span>
          </li>
        );
      })}
    </ul>
  );
};

/** Un cartón dibujado como constelación: casillas encendidas, la figura resaltada y Jiro libre al centro. */
export const CardConstellation = ({ cells, size, answerText, result }: {
  cells: string[];
  size: BingoSize;
  answerText: Map<string, string>;
  result: ReturnType<typeof checkCard>;
}) => {
  const inPattern = new Set(result.pattern);
  return (
    <div className={`grid w-[min(52vh,86vw)] gap-2 ${size === 3 ? 'grid-cols-3' : 'grid-cols-4'}`} role="img" aria-label="Cartón verificado">
      {cells.map((key, i) => {
        const lit = result.lit[i];
        const highlight = inPattern.has(i);
        return (
          <div
            key={i}
            className={`relative flex aspect-square items-center justify-center rounded-2xl p-1.5 text-center font-black leading-tight [hyphens:auto] [overflow-wrap:break-word] ${size === 3 ? 'text-[clamp(16px,3.2vh,34px)]' : 'text-[clamp(13px,2.4vh,26px)]'} ${lit
              ? 'bg-amber-300 text-amber-950'
              : 'border-2 border-dashed border-white/30 text-indigo-100'} ${highlight ? (result.complete ? 'ring-4 ring-white' : 'ring-4 ring-amber-300/60') : ''}`}
          >
            {key === FREE ? <span aria-label="Jiro, casilla libre">★ Jiro</span> : answerText.get(key) ?? ''}
            {lit && key !== FREE && <span className="absolute right-1 top-0.5 text-[0.6em]" aria-hidden="true">★</span>}
          </div>
        );
      })}
    </div>
  );
};

/** Pide el número del cartón para verificar un ¡Bingo! (el número no identifica a nadie). */
export const VerifyForm = ({ max, onVerify }: { max: number; onVerify: (card: number) => void }) => {
  const [value, setValue] = useState('');
  const card = Number(value);
  const valid = Number.isInteger(card) && card >= 1 && card <= max;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onVerify(card);
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center justify-center gap-3">
      <label className="stage-option font-black text-white" htmlFor="bingo-card-number">Cartón Nº</label>
      <input
        id="bingo-card-number"
        autoFocus
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 3))}
        className="w-[4.5em] rounded-2xl border-2 border-amber-300 bg-[#0b1026] px-3 py-2 text-center text-[clamp(28px,6vh,64px)] font-black text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60"
        aria-describedby="bingo-card-hint"
      />
      <button type="submit" disabled={!valid} className={`${stageControlClass} border border-amber-300 text-lg disabled:opacity-50`}>Verificar</button>
      <p id="bingo-card-hint" className="w-full text-center text-base text-indigo-100">Del 1 al {max}. Enter para verificar · Esc para volver.</p>
    </form>
  );
};
