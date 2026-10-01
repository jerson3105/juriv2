import { GoogleGenAI } from '@google/genai';
import { RateLimitError } from './errors.js';

// Presupuesto de tiempo de las generaciones con IA. Gemini se corta ANTES que la petición HTTP:
// así una generación lenta termina en un error controlado, en vez de seguir (y cobrarse) cuando
// el usuario ya recibió un timeout y quizá reintentó.
export const GEMINI_TIMEOUT_MS = 100_000;
export const AI_REQUEST_TIMEOUT_MS = 120_000;

export const createGenAI = (apiKey: string): GoogleGenAI =>
  new GoogleGenAI({ apiKey, httpOptions: { timeout: GEMINI_TIMEOUT_MS } });

// Reintentos ante saturación (429) de Gemini; otros errores se propagan al momento.
const AI_RETRY_DELAYS_MS = [1500, 4000];

export const isAIRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    status?: unknown;
    message?: unknown;
  };

  const message = typeof candidate.message === 'string'
    ? candidate.message.toLowerCase()
    : '';

  return candidate.status === 429
    || message.includes('resource exhausted')
    || message.includes('resource_exhausted')
    || message.includes('too many requests')
    || message.includes('"code":429');
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateContentWithRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= AI_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isAIRateLimitError(error) || attempt === AI_RETRY_DELAYS_MS.length) {
        break;
      }

      await wait(AI_RETRY_DELAYS_MS[attempt]);
    }
  }

  if (isAIRateLimitError(lastError)) {
    throw new RateLimitError(
      'La IA está temporalmente saturada. Intenta nuevamente en unos minutos o reduce la cantidad de preguntas.'
    );
  }

  throw lastError;
};
