import { GoogleGenAI } from '@google/genai';

// Presupuesto de tiempo de las generaciones con IA. Gemini se corta ANTES que la petición HTTP:
// así una generación lenta termina en un error controlado, en vez de seguir (y cobrarse) cuando
// el usuario ya recibió un timeout y quizá reintentó.
export const GEMINI_TIMEOUT_MS = 100_000;
export const AI_REQUEST_TIMEOUT_MS = 120_000;

export const createGenAI = (apiKey: string): GoogleGenAI =>
  new GoogleGenAI({ apiKey, httpOptions: { timeout: GEMINI_TIMEOUT_MS } });
