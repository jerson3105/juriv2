import type { BingoServerState, BingoSize } from '../../../lib/bingoApi';

/** Casilla libre de Jiro (centro del 3×3). */
export const FREE = '*';

export type FigureId = 'linea' | 'esquinas' | 'lleno';
/** Figuras que crecen en la misma partida: ganan todos los que completan con la misma bola. */
export const FIGURES: { id: FigureId; name: string; hint: string }[] = [
  { id: 'linea', name: 'Línea', hint: 'una fila, una columna o una diagonal' },
  { id: 'esquinas', name: 'Cuatro esquinas', hint: 'las cuatro esquinas del cartón' },
  { id: 'lleno', name: 'Cielo completo', hint: 'todo el cartón' },
];

export interface BingoWinner { card: number; figure: FigureId; game: number; ball: number }

/** Estado de la partida: lo del servidor (mazo y cartones) + lo que agrega el escenario del docente. */
export interface BingoState extends BingoServerState {
  /** Bolas de este juego en orden de sorteo (sin él, aún se reparten los cartones). */
  order?: string[];
  /** Cuántas bolas salieron en este juego. */
  drawn?: number;
  /** La última bola salida ya se reveló. */
  revealed?: boolean;
  /** ¿La mayoría acertó? por bola salida (null = aún sin marcar). */
  marks?: (boolean | null)[];
  /** Figura que se busca (índice en FIGURES). */
  figure?: number;
  /** Bola (cuenta de salidas) con la que se ganó la figura actual: con la próxima bola se pasa a la siguiente. */
  figureWonAt?: number | null;
  winners?: BingoWinner[];
  /** Juegos anteriores de la misma partida (mismos cartones). */
  totals?: { balls: number; stars: number };
  /** Revancha: las bolas que la clase falló vuelven al final. */
  revancha?: { ids: string[]; index: number; revealed: boolean; recovered: number } | null;
  /** Segundos para pensar antes de revelar (0 = sin tiempo). */
  thinkSeconds?: number;
}

export interface BingoResult extends Record<string, unknown> {
  title: string;
  size: BingoSize;
  games: number;
  balls: number;
  stars: number;
  bingos: number;
  /** Revancha del último juego: cuántas volvieron y cuántas recuperó la clase. */
  recovered: number;
  missed: number;
}

/** Meta de la clase: que la mayoría acierte en el 70 % de las bolas. */
export const CLASS_GOAL = 0.7;

/** Filas, columnas y diagonales (índices en orden de lectura). */
export const lines = (size: BingoSize): number[][] => {
  const out: number[][] = [];
  for (let r = 0; r < size; r += 1) out.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c += 1) out.push(Array.from({ length: size }, (_, r) => r * size + c));
  out.push(Array.from({ length: size }, (_, i) => i * size + i));
  out.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));
  return out;
};

/** Grupos de casillas que completan cada figura. */
export const figurePatterns = (figure: FigureId, size: BingoSize): number[][] => {
  if (figure === 'linea') return lines(size);
  if (figure === 'esquinas') return [[0, size - 1, size * (size - 1), size * size - 1]];
  return [Array.from({ length: size * size }, (_, i) => i)];
};

/**
 * ¿El cartón completa la figura con las respuestas ya reveladas? Devuelve el patrón completo (o el más cercano) y
 * cuántas casillas le faltan. La casilla de Jiro cuenta como encendida.
 */
export const checkCard = (cells: string[], revealedKeys: Set<string>, figure: FigureId, size: BingoSize) => {
  const lit = cells.map((key) => key === FREE || revealedKeys.has(key));
  let best: number[] = [];
  let missing = Infinity;
  for (const pattern of figurePatterns(figure, size)) {
    const gap = pattern.filter((i) => !lit[i]).length;
    if (gap < missing) { missing = gap; best = pattern; }
    if (gap === 0) break;
  }
  return { lit, pattern: best, missing, complete: missing === 0 };
};

/** Respuestas que ya se revelaron en este juego (la bola recién sorteada no cuenta hasta revelarla). */
export const revealedKeys = (state: BingoState) => {
  const order = state.order ?? [];
  const drawn = state.drawn ?? 0;
  const count = state.revealed ? drawn : Math.max(0, drawn - 1);
  const byId = new Map(state.balls.map((b) => [b.id, b.key]));
  return new Set(order.slice(0, count).map((id) => byId.get(id)).filter((k): k is string => !!k));
};

/** Estrellas de la clase: bolas en que la mayoría acertó (todos los juegos) + las recuperadas en la revancha. */
export const classStars = (state: BingoState) =>
  (state.totals?.stars ?? 0) + (state.marks ?? []).filter((m) => m === true).length + (state.revancha?.recovered ?? 0);

/** Bolas jugadas (todos los juegos) con su marca. */
export const ballsPlayed = (state: BingoState) => (state.totals?.balls ?? 0) + (state.marks ?? []).filter((m) => m !== null).length;

/** Bolas falladas del juego actual (para la revancha). */
export const missedBalls = (state: BingoState) => {
  const order = state.order ?? [];
  return (state.marks ?? []).flatMap((m, i) => (m === false && order[i] ? [order[i]] : []));
};

/** XP sugerido para todos: 10; 15 si la clase llegó a la meta; 20 si además recuperó todo en la revancha. */
export const suggestedXp = (stars: number, balls: number, recoveredAll: boolean) => {
  if (balls === 0) return 10;
  const reached = stars / balls >= CLASS_GOAL;
  if (reached && recoveredAll) return 20;
  return reached ? 15 : 10;
};

/** Respuestas ordenadas como en el tablero: números de menor a mayor; palabras en orden alfabético. */
export const sortedAnswers = <T extends { key: string; text: string }>(answers: T[]) => {
  const numeric = answers.every((a) => /^-?\d+([.,]\d+)?$/.test(a.text));
  return [...answers].sort((a, b) => (numeric
    ? Number(a.text.replace(',', '.')) - Number(b.text.replace(',', '.'))
    : a.text.localeCompare(b.text, 'es', { sensitivity: 'base' })));
};

/** Barajado para el orden de sorteo (en el cliente: no afecta a los cartones). */
export const shuffled = <T>(items: T[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
