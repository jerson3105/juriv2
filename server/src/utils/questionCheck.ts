import { createHmac } from 'node:crypto';
import { config_app } from '../config/env.js';

/**
 * Preguntas del banco vistas por el alumno (reto de la Expedición): se mandan sin la respuesta y se corrigen
 * en el servidor.
 * - Opciones: con su índice original como clave (el orden no delata la correcta).
 * - Parejas: la columna derecha va barajada y su clave es la posición barajada. La permutación sale de un
 *   HMAC con un secreto del servidor, así que el cliente no puede deducir qué pareja va con cuál.
 */

export type BankQuestionType = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING';

export interface BankQuestionRow {
  id: string;
  type: BankQuestionType;
  questionText: string;
  imageUrl: string | null;
  options: unknown;
  correctAnswer: unknown;
  pairs: unknown;
  explanation: string | null;
}

export interface StudentQuestion {
  id: string;
  type: BankQuestionType;
  text: string;
  imageUrl: string | null;
  options?: { key: number; text: string }[];
  left?: { key: number; text: string }[];
  right?: { key: number; text: string }[];
}

// En MariaDB las columnas JSON llegan como texto (a veces doblemente serializado); en MySQL 8, ya parseadas.
export const parseJsonArray = <T = unknown>(value: unknown): T[] => {
  let parsed = value;
  for (let i = 0; i < 3 && typeof parsed === 'string'; i++) {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return Object.values(parsed) as T[];
  return Array.isArray(parsed) ? (parsed as T[]) : [];
};

const optionsOf = (question: BankQuestionRow) =>
  parseJsonArray<{ text?: unknown; isCorrect?: unknown }>(question.options)
    .map((option) => ({ text: String(option?.text ?? ''), isCorrect: option?.isCorrect === true || option?.isCorrect === 'true' }));

const pairsOf = (question: BankQuestionRow) =>
  parseJsonArray<{ left?: unknown; right?: unknown }>(question.pairs)
    .map((pair) => ({ left: String(pair?.left ?? ''), right: String(pair?.right ?? '') }));

const trueFalseOf = (question: BankQuestionRow): boolean => {
  let value = question.correctAnswer;
  for (let i = 0; i < 3 && typeof value === 'string'; i++) {
    const lower = value.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    try { value = JSON.parse(value); } catch { break; }
  }
  return value === true;
};

/** Permutación estable por alumno y pregunta: posición barajada → índice original. */
export const matchingPermutation = (size: number, seed: string): number[] => {
  const digest = createHmac('sha256', config_app.jwt.secret).update(`expedition-matching:${seed}`).digest();
  let state = digest.readUInt32LE(0) || 1;
  const next = () => {
    // xorshift32
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
  const order = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
};

/** ¿Se puede usar en un reto? Debe tener lo necesario para corregirse. */
export const isPlayable = (question: BankQuestionRow): boolean => {
  switch (question.type) {
    case 'TRUE_FALSE': return true;
    case 'SINGLE_CHOICE': {
      const options = optionsOf(question);
      return options.length >= 2 && options.filter((o) => o.isCorrect).length === 1;
    }
    case 'MULTIPLE_CHOICE': {
      const options = optionsOf(question);
      return options.length >= 2 && options.some((o) => o.isCorrect);
    }
    case 'MATCHING': return pairsOf(question).length >= 2;
    default: return false;
  }
};

export const toStudentQuestion = (question: BankQuestionRow, seed: string): StudentQuestion => {
  const base = { id: question.id, type: question.type, text: question.questionText, imageUrl: question.imageUrl ?? null };
  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
    return { ...base, options: optionsOf(question).map((option, key) => ({ key, text: option.text })) };
  }
  if (question.type === 'MATCHING') {
    const pairs = pairsOf(question);
    const permutation = matchingPermutation(pairs.length, seed);
    return {
      ...base,
      left: pairs.map((pair, key) => ({ key, text: pair.left })),
      right: permutation.map((original, key) => ({ key, text: pairs[original].right })),
    };
  }
  return base;
};

const sameSet = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  const right = new Set(b);
  return a.every((value) => right.has(value));
};

/** Corrige la respuesta del alumno. Formatos: V/F boolean · única número · múltiple número[] · parejas número[] (izquierda → posición derecha). */
export const checkAnswer = (question: BankQuestionRow, answer: unknown, seed: string): boolean => {
  switch (question.type) {
    case 'TRUE_FALSE':
      return typeof answer === 'boolean' && answer === trueFalseOf(question);
    case 'SINGLE_CHOICE': {
      const correct = optionsOf(question).findIndex((o) => o.isCorrect);
      return Number.isInteger(answer) && answer === correct;
    }
    case 'MULTIPLE_CHOICE': {
      if (!Array.isArray(answer) || !answer.every((value) => Number.isInteger(value))) return false;
      const correct = optionsOf(question).flatMap((o, i) => (o.isCorrect ? [i] : []));
      return sameSet([...new Set(answer as number[])], correct);
    }
    case 'MATCHING': {
      const pairs = pairsOf(question);
      if (!Array.isArray(answer) || answer.length !== pairs.length) return false;
      const permutation = matchingPermutation(pairs.length, seed);
      return answer.every((position, left) => Number.isInteger(position) && permutation[position as number] === left);
    }
    default:
      return false;
  }
};

/** La respuesta correcta en el formato del alumno (se muestra recién en el reintento). */
export const correctAnswerFor = (question: BankQuestionRow, seed: string): boolean | number | number[] | null => {
  switch (question.type) {
    case 'TRUE_FALSE': return trueFalseOf(question);
    case 'SINGLE_CHOICE': return optionsOf(question).findIndex((o) => o.isCorrect);
    case 'MULTIPLE_CHOICE': return optionsOf(question).flatMap((o, i) => (o.isCorrect ? [i] : []));
    case 'MATCHING': {
      const permutation = matchingPermutation(pairsOf(question).length, seed);
      // izquierda i → posición barajada donde quedó su pareja
      return permutation.map((_, left) => permutation.indexOf(left));
    }
    default: return null;
  }
};

/** Respuesta válida en forma (antes de corregir): evita guardar basura en la base. */
export const isWellFormedAnswer = (type: BankQuestionType, answer: unknown): boolean => {
  if (type === 'TRUE_FALSE') return typeof answer === 'boolean';
  if (type === 'SINGLE_CHOICE') return Number.isInteger(answer) && (answer as number) >= 0 && (answer as number) < 20;
  return Array.isArray(answer) && answer.length <= 20 && answer.every((value) => Number.isInteger(value) && value >= 0 && value < 20);
};
