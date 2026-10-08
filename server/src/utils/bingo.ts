import { createHash, randomBytes } from 'node:crypto';

/**
 * Bingo Estelar (Observatorio): lógica pura. El servidor es la ÚNICA fuente de los cartones: la hoja impresa, el
 * cartón en pantalla del alumno y la verificación del docente salen de la misma semilla de la partida.
 */

export const BINGO_SIZES = [3, 4] as const;
export type BingoSize = typeof BINGO_SIZES[number];

/** Una respuesta más larga no cabe en la casilla impresa. */
export const MAX_ANSWER_CHARS = 18;
export const MAX_ANSWERS = 60;
export const MAX_BALLS = 60;
export const MAX_CARDS = 120;
/** Casilla libre de Jiro (centro del 3×3). */
export const FREE_CELL = '*';

/** Casillas con respuesta por cartón: el 3×3 tiene a Jiro libre en el centro. */
export const cellsFor = (size: BingoSize) => (size === 3 ? 8 : 16);
/** Mínimo de respuestas distintas para que los cartones no se parezcan demasiado. */
export const minAnswersFor = (size: BingoSize) => cellsFor(size) + 4;
/** Lo recomendado: unas dos respuestas por casilla. */
export const recommendedAnswersFor = (size: BingoSize) => cellsFor(size) * 2;

export interface BingoAnswer { key: string; text: string }
/** Una bola: la pregunta que se sortea y la respuesta (clave) que marca su casilla. */
export interface BingoBall { id: string; prompt: string; context: string | null; key: string; explanation: string | null }
export interface BingoDeck { answers: BingoAnswer[]; balls: BingoBall[]; skipped: number; unreviewed: number }

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

/** «Lima», «lima» y «Lima.» son la misma casilla (sin tildes, mayúsculas ni punto final). */
export const normalizeAnswer = (text: string) => clean(text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()).replace(/[.\s]+$/, '');

interface SourceQuestion {
  id: string;
  type: string;
  questionText: string;
  options: { text?: unknown; isCorrect?: unknown }[] | null;
  pairs: { left?: unknown; right?: unknown }[] | null;
  explanation: string | null;
  aiGenerated: boolean;
  reviewedAt: Date | string | null;
}

/** Varias bolas pueden marcar la misma casilla (3 × 8 y 4 × 6 dan 24). Si sobran bolas, se queda una muestra. */
const finishDeck = (balls: BingoBall[], skipped: number, unreviewed: number, texts: Map<string, string>, random = Math.random): BingoDeck => {
  const order = [...balls];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const kept: BingoBall[] = [];
  const keys = new Set<string>();
  for (const ball of order) {
    if (kept.length >= MAX_BALLS) break;
    if (!keys.has(ball.key) && keys.size >= MAX_ANSWERS) continue;
    keys.add(ball.key);
    kept.push(ball);
  }
  return { answers: [...keys].map((key) => ({ key, text: texts.get(key) ?? key })), balls: kept, skipped, unreviewed };
};

/** Una respuesta que cabe en una casilla (texto limpio y su clave), o null. */
export const bingoAnswer = (answer: unknown): BingoAnswer | null => {
  if (typeof answer !== 'string') return null;
  const text = clean(answer);
  const key = normalizeAnswer(text);
  return key && text.length <= MAX_ANSWER_CHARS ? { key, text } : null;
};

// Igual que ERROR_PREFIX (questionAi.service): los ejercicios de El Error de Jiro no son bolas.
const ERROR_PREFIX = '¿En qué paso está el error?';

interface Candidate { id: string; prompt: unknown; context: string | null; answer: unknown; explanation: string | null }

/**
 * Lo que una pregunta aporta al Bingo: opción única → su correcta (sin una sola correcta, una bola inválida); unir
 * pares → cada par (izquierda = bola, derecha = casilla). V/F, opción múltiple y «Con error» no participan (null).
 */
const candidatesOf = (q: Pick<SourceQuestion, 'id' | 'type' | 'questionText' | 'options' | 'pairs' | 'explanation'>): Candidate[] | null => {
  if (q.type === 'SINGLE_CHOICE') {
    if (q.questionText.startsWith(ERROR_PREFIX)) return null;
    const correct = (Array.isArray(q.options) ? q.options : []).filter((o) => o?.isCorrect === true);
    return [{ id: q.id, prompt: q.questionText, context: null, answer: correct.length === 1 ? correct[0].text : null, explanation: q.explanation }];
  }
  if (q.type === 'MATCHING') {
    return (Array.isArray(q.pairs) ? q.pairs : []).map((pair, i) => ({ id: `${q.id}:${i}`, prompt: pair?.left, context: q.questionText, answer: pair?.right, explanation: null }));
  }
  return null;
};

const usable = (c: Candidate) => (typeof c.prompt === 'string' && clean(c.prompt) ? bingoAnswer(c.answer) : null);

/** Claves de las casillas que aporta una pregunta (estadísticas del banco: la misma regla que el mazo). */
export const bingoKeysOf = (q: Pick<SourceQuestion, 'type' | 'questionText' | 'options' | 'pairs'>): string[] =>
  (candidatesOf({ ...q, id: '', explanation: null }) ?? []).flatMap((c) => usable(c)?.key ?? []);

/**
 * Mazo desde un banco: opción única (la opción correcta es la casilla) y unir pares (izquierda = bola, derecha =
 * casilla). V/F y opción múltiple no sirven (dos respuestas o una casilla ambigua). Respuestas cortas, sin repetirse.
 */
export const deckFromQuestions = (questions: SourceQuestion[], random = Math.random): BingoDeck => {
  const balls: BingoBall[] = [];
  const texts = new Map<string, string>();
  let skipped = 0;
  let unreviewed = 0;
  for (const q of questions) {
    const candidates = candidatesOf(q);
    if (!candidates) continue;
    if (q.aiGenerated && !q.reviewedAt) unreviewed += 1;
    for (const c of candidates) {
      const answer = usable(c);
      if (!answer) { skipped += 1; continue; }
      if (!texts.has(answer.key)) texts.set(answer.key, answer.text);
      balls.push({
        id: c.id, prompt: clip(clean(c.prompt as string), 200), context: c.context ? clip(clean(c.context), 160) : null,
        key: answer.key, explanation: c.explanation ? clip(clean(c.explanation), 200) : null,
      });
    }
  }
  return finishDeck(balls, skipped, unreviewed, texts, random);
};

/** Mazo «Tablas»: t × f para cada tabla elegida (f de 1 a 10); la casilla es el producto. */
export const tablesDeck = (tables: number[], random = Math.random): BingoDeck => {
  const balls: BingoBall[] = [];
  const texts = new Map<string, string>();
  for (const t of [...new Set(tables)].sort((a, b) => a - b)) {
    for (let f = 1; f <= 10; f += 1) {
      const key = String(t * f);
      texts.set(key, key);
      balls.push({ id: `t${t}x${f}`, prompt: `${t} × ${f}`, context: null, key, explanation: null });
    }
  }
  return finishDeck(balls, 0, 0, texts, random);
};

export const tablesTitle = (tables: number[]) => {
  const sorted = [...new Set(tables)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Tabla del ${sorted[0]}`;
  const contiguous = sorted.every((t, i) => i === 0 || t === sorted[i - 1] + 1);
  return contiguous ? `Tablas del ${sorted[0]} al ${sorted[sorted.length - 1]}` : `Tablas del ${sorted.join(', ')}`;
};

export const newSeed = () => randomBytes(8).toString('hex');

const seedInt = (text: string) => createHash('sha256').update(text).digest().readUInt32LE(0);
/** PRNG pequeño y determinista (mulberry32): la misma semilla da siempre los mismos cartones. */
const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Cartones 1..count de la partida: casillas en orden de lectura (claves de respuesta), con FREE_CELL en el centro del
 * 3×3. Nunca repite un cartón (reintenta con otra sub-semilla). Depende solo de la semilla, el tamaño y el orden
 * de las respuestas: por eso el cartón N es el mismo en el papel, en la pantalla del alumno y al verificar.
 */
export const generateCards = (seed: string, size: BingoSize, answerKeys: string[], count: number): string[][] => {
  const cells = cellsFor(size);
  if (answerKeys.length < cells) return [];
  const seen = new Set<string>();
  const cards: string[][] = [];
  for (let n = 1; n <= count; n += 1) {
    let picked: string[] = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const rand = mulberry32(seedInt(`${seed}:${n}:${attempt}`));
      const pool = [...answerKeys];
      for (let i = 0; i < cells; i += 1) {
        const j = i + Math.floor(rand() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      picked = pool.slice(0, cells);
      const signature = [...picked].sort().join('|');
      if (!seen.has(signature)) {
        seen.add(signature);
        break;
      }
    }
    if (size === 3) picked.splice(4, 0, FREE_CELL);
    cards.push(picked);
  }
  return cards;
};
