import { z } from 'zod';
import type { BankQuestionType, QuestionDifficulty } from '../db/schema.js';
import { createGenAI, generateContentWithRetry } from '../utils/aiClient.js';
import { InternalServerError, ValidationError } from '../utils/errors.js';

// Generación de preguntas con IA (banco de preguntas y Observatorio): JSON validado ítem por ítem,
// nivel tomado de la clase, sin CSV. Devuelve borradores; quien llama decide si se guardan.

const MODEL = 'gemini-2.5-flash-lite';
// Inventar un error claro (y no una forma equivalente) le cuesta al modelo ligero.
const ERROR_MODEL = 'gemini-2.5-flash';

export type AiKind = BankQuestionType | 'ERROR_STEPS';

/** El Error de Jiro se guarda como opción única con este enunciado: así se reconoce en cualquier banco. */
export const ERROR_PREFIX = '¿En qué paso está el error?';

export interface DraftQuestion {
  type: BankQuestionType;
  questionText: string;
  options?: { text: string; isCorrect: boolean }[];
  correctAnswer?: boolean;
  pairs?: { left: string; right: string }[];
  explanation: string;
  difficulty: QuestionDifficulty | null;
}

// "PRIMARIA_5" → "5.º de primaria"; sin dato, un nivel general.
export const levelLabel = (gradeLevel: string | null | undefined) => {
  const match = gradeLevel?.toUpperCase().match(/^(INICIAL|PRIMARIA|SECUNDARIA)_?(\d+)?/);
  if (!match) return null;
  const stage = match[1].toLowerCase();
  if (stage === 'inicial') return match[2] ? `inicial (${match[2]} años)` : 'inicial';
  return match[2] ? `${match[2]}.º de ${stage}` : stage;
};

const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']).nullable().optional().catch(null);
const text = (max: number) => z.string().trim().min(1).max(max);

const itemSchemas = {
  TRUE_FALSE: z.object({
    type: z.literal('TRUE_FALSE'),
    statement: text(300),
    answer: z.boolean(),
    explanation: text(500),
    difficulty: difficultySchema,
  }),
  SINGLE_CHOICE: z.object({
    type: z.literal('SINGLE_CHOICE'),
    question: text(300),
    options: z.array(text(150)).min(3).max(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: text(500),
    difficulty: difficultySchema,
  }),
  MULTIPLE_CHOICE: z.object({
    type: z.literal('MULTIPLE_CHOICE'),
    question: text(300),
    options: z.array(text(150)).min(3).max(5),
    correctIndexes: z.array(z.number().int().min(0).max(4)).min(1),
    explanation: text(500),
    difficulty: difficultySchema,
  }),
  MATCHING: z.object({
    type: z.literal('MATCHING'),
    question: text(300),
    pairs: z.array(z.object({ left: text(120), right: text(120) })).min(3).max(5),
    explanation: text(500),
    difficulty: difficultySchema,
  }),
  // La IA da la solución correcta y la versión equivocada de UN paso; el servidor arma el ejercicio.
  ERROR_STEPS: z.object({
    problem: text(300),
    steps: z.array(text(200)).min(3).max(4),
    wrongIndex: z.number().int().min(0).max(3),
    wrongStep: text(200),
    correction: text(500),
    difficulty: difficultySchema,
  }),
};

const FORMATS: Record<BankQuestionType, string> = {
  TRUE_FALSE: '{"type":"TRUE_FALSE","statement":"Afirmación para leer en voz alta (una sola idea, sin dobles negaciones)","answer":true,"explanation":"Una o dos frases que expliquen por qué.","difficulty":"EASY"}',
  SINGLE_CHOICE: '{"type":"SINGLE_CHOICE","question":"...","options":["...","...","...","..."],"correctIndex":1,"explanation":"...","difficulty":"MEDIUM"}',
  MULTIPLE_CHOICE: '{"type":"MULTIPLE_CHOICE","question":"... (indica que hay varias correctas)","options":["...","...","...","..."],"correctIndexes":[0,2],"explanation":"...","difficulty":"MEDIUM"}',
  MATCHING: '{"type":"MATCHING","question":"Relaciona ...","pairs":[{"left":"...","right":"..."},{"left":"...","right":"..."},{"left":"...","right":"..."}],"explanation":"...","difficulty":"MEDIUM"}',
};

const promptFor = (kinds: AiKind[], quantity: number, level: string, topic: string | null, difficulty: QuestionDifficulty | null) => {
  const source = topic ? `Tema: "${topic}".` : 'Usa SOLO el contenido del documento PDF adjunto.';
  const common = `Eres un docente peruano. Escribe en español neutro, claro y apropiado para estudiantes de ${level}. ${source}
Responde ÚNICAMENTE con un arreglo JSON válido, sin texto adicional ni bloques de código.
"difficulty" es tu sugerencia: "EASY", "MEDIUM" o "HARD"${difficulty ? ` (el docente pidió "${difficulty}": úsala en todas)` : ' (varía según la pregunta)'}.`;
  if (kinds.includes('ERROR_STEPS')) {
    return `${common}
Genera exactamente ${quantity} ejercicios. Para cada uno:
- "problem": enunciado breve.
- "steps": la solución CORRECTA en 3 o 4 pasos cortos.
- "wrongIndex": índice (desde 0) del paso que vas a alterar; no elijas el primero.
- "wrongStep": ese mismo paso, con la misma forma, pero con un error típico de estudiantes que sea claramente incorrecto (no una forma equivalente ni un error de tipeo).
- "correction": una o dos frases: qué está mal en ese paso y cómo es lo correcto.
- "difficulty": tu sugerencia.
Ejemplo: [{"problem":"Calcula 1/2 + 1/3","steps":["El común denominador de 2 y 3 es 6.","1/2 = 3/6 y 1/3 = 2/6.","3/6 + 2/6 = 5/6."],"wrongIndex":2,"wrongStep":"3/6 + 2/6 = 5/12.","correction":"Con igual denominador se suman solo los numeradores: 3/6 + 2/6 = 5/6.","difficulty":"MEDIUM"}]`;
  }
  const types = kinds as BankQuestionType[];
  return `${common}
Genera exactamente ${quantity} preguntas, repartidas entre estos tipos: ${types.join(', ')}.
Las opciones incorrectas deben ser plausibles; la explicación es obligatoria.
Formato de cada tipo (un objeto por pregunta, todas en un mismo arreglo):
${types.map((t) => `- ${FORMATS[t]}`).join('\n')}`;
};

const parseArray = (raw: string): unknown[] => {
  let clean = raw.trim();
  if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  try {
    const value = JSON.parse(clean) as unknown;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

/** Convierte un ítem válido de la IA en el formato de pregunta del banco. */
const toDraft = (kind: AiKind, item: unknown, forcedDifficulty: QuestionDifficulty | null): DraftQuestion | null => {
  if (kind === 'ERROR_STEPS') {
    const r = itemSchemas.ERROR_STEPS.safeParse(item);
    if (!r.success) return null;
    const e = r.data;
    // Sin paso alterado de verdad (fuera de rango o idéntico) no hay ejercicio.
    if (e.wrongIndex >= e.steps.length || e.wrongStep === e.steps[e.wrongIndex]) return null;
    const steps = e.steps.map((s, i) => (i === e.wrongIndex ? e.wrongStep : s));
    return {
      type: 'SINGLE_CHOICE',
      questionText: `${ERROR_PREFIX} ${e.problem}`,
      options: steps.map((s, i) => ({ text: `Paso ${i + 1}: ${s}`, isCorrect: i === e.wrongIndex })),
      explanation: e.correction,
      difficulty: forcedDifficulty ?? e.difficulty ?? null,
    };
  }
  const type = (item as { type?: string } | null)?.type;
  switch (type) {
    case 'TRUE_FALSE': {
      const r = itemSchemas.TRUE_FALSE.safeParse(item);
      return r.success ? { type, questionText: r.data.statement, correctAnswer: r.data.answer, explanation: r.data.explanation, difficulty: forcedDifficulty ?? r.data.difficulty ?? null } : null;
    }
    case 'SINGLE_CHOICE': {
      const r = itemSchemas.SINGLE_CHOICE.safeParse(item);
      if (!r.success || r.data.correctIndex >= r.data.options.length) return null;
      return {
        type, questionText: r.data.question, explanation: r.data.explanation, difficulty: forcedDifficulty ?? r.data.difficulty ?? null,
        options: r.data.options.map((t, i) => ({ text: t, isCorrect: i === r.data.correctIndex })),
      };
    }
    case 'MULTIPLE_CHOICE': {
      const r = itemSchemas.MULTIPLE_CHOICE.safeParse(item);
      if (!r.success) return null;
      const correct = new Set(r.data.correctIndexes.filter((i) => i < r.data.options.length));
      if (correct.size === 0) return null;
      return {
        type, questionText: r.data.question, explanation: r.data.explanation, difficulty: forcedDifficulty ?? r.data.difficulty ?? null,
        options: r.data.options.map((t, i) => ({ text: t, isCorrect: correct.has(i) })),
      };
    }
    case 'MATCHING': {
      const r = itemSchemas.MATCHING.safeParse(item);
      return r.success ? { type, questionText: r.data.question, pairs: r.data.pairs, explanation: r.data.explanation, difficulty: forcedDifficulty ?? r.data.difficulty ?? null } : null;
    }
    default:
      return null;
  }
};

/**
 * Pide a la IA `quantity` preguntas de los tipos indicados, sobre un tema o un PDF. Valida ítem por
 * ítem (uno malo no descarta a los demás) y falla solo si no queda ninguno.
 */
export const generateDrafts = async (input: {
  kinds: AiKind[];
  quantity: number;
  gradeLevel: string | null | undefined;
  /** Nivel escrito por el docente cuando la clase no lo tiene configurado. */
  levelOverride?: string | null;
  topic?: string | null;
  pdf?: Buffer | null;
  difficulty?: QuestionDifficulty | null;
}): Promise<DraftQuestion[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new InternalServerError('La generación con IA no está configurada');
  if (!input.topic && !input.pdf) throw new ValidationError('Indica un tema o sube un PDF');
  const kinds: AiKind[] = input.kinds.includes('ERROR_STEPS') ? ['ERROR_STEPS'] : input.kinds;
  if (kinds.length === 0) throw new ValidationError('Elige al menos un tipo de pregunta');

  const level = input.levelOverride?.trim() || levelLabel(input.gradeLevel) || 'primaria';
  const prompt = promptFor(kinds, input.quantity, level, input.topic ?? null, input.difficulty ?? null);
  const ai = createGenAI(apiKey);
  const contents = input.pdf
    ? [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: input.pdf.toString('base64') } }, { text: prompt }] }]
    : prompt;
  const response = await generateContentWithRetry(() => ai.models.generateContent({
    model: kinds.includes('ERROR_STEPS') ? ERROR_MODEL : MODEL,
    contents,
    config: { responseMimeType: 'application/json' },
  }));

  const list = parseArray(response.text || '');
  const kind = kinds.includes('ERROR_STEPS') ? 'ERROR_STEPS' : 'MIXED';
  const drafts = list
    .map((item) => toDraft(kind === 'ERROR_STEPS' ? 'ERROR_STEPS' : ((item as { type?: AiKind } | null)?.type ?? 'TRUE_FALSE'), item, input.difficulty ?? null))
    .filter((d): d is DraftQuestion => !!d && (kind === 'ERROR_STEPS' || kinds.includes(d.type)))
    .slice(0, input.quantity);
  if (drafts.length === 0) {
    console.warn('[questionAi] La IA no devolvió ítems válidos:', JSON.stringify(list).slice(0, 600));
    throw new ValidationError(kind === 'ERROR_STEPS'
      ? 'Jiro no encontró pasos en ese tema. Los ejercicios con error necesitan un cálculo o procedimiento (ej.: suma de fracciones).'
      : 'La IA no devolvió preguntas válidas. Intenta de nuevo.');
  }
  return drafts;
};
