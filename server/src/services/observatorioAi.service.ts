import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { classrooms, questionBanks } from '../db/schema.js';
import { createGenAI, generateContentWithRetry } from '../utils/aiClient.js';
import { InternalServerError, NotFoundError, ValidationError } from '../utils/errors.js';
import { questionBankService } from './questionBank.service.js';

const MODEL = 'gemini-2.5-flash-lite';
// Inventar un error claro (y no una forma equivalente) le cuesta al modelo ligero.
const ERROR_MODEL = 'gemini-2.5-flash';

export type GenerateKind = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'ERROR_STEPS';

/** El Error de Jiro se guarda como opción única con este enunciado: así se reconoce en cualquier banco. */
export const ERROR_PREFIX = '¿En qué paso está el error?';

// "PRIMARIA_5" → "5.º de primaria"; sin dato, un nivel general.
const levelLabel = (gradeLevel: string | null) => {
  const match = gradeLevel?.toUpperCase().match(/^(INICIAL|PRIMARIA|SECUNDARIA)_?(\d+)?/);
  if (!match) return 'primaria';
  const stage = match[1].toLowerCase();
  if (stage === 'inicial') return match[2] ? `inicial (${match[2]} años)` : 'inicial';
  return match[2] ? `${match[2]}.º de ${stage}` : stage;
};

const trueFalseSchema = z.object({
  statement: z.string().trim().min(5).max(300),
  answer: z.boolean(),
  explanation: z.string().trim().min(5).max(500),
});

const singleChoiceSchema = z.object({
  question: z.string().trim().min(5).max(300),
  options: z.array(z.string().trim().min(1).max(150)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(5).max(500),
});

// La IA da la solución correcta y la versión equivocada de UN paso; el servidor arma el ejercicio.
const errorStepsSchema = z.object({
  problem: z.string().trim().min(5).max(300),
  steps: z.array(z.string().trim().min(1).max(200)).min(3).max(4),
  wrongIndex: z.number().int().min(0).max(3),
  wrongStep: z.string().trim().min(1).max(200),
  correction: z.string().trim().min(5).max(500),
});

const promptFor = (kind: GenerateKind, topic: string, quantity: number, level: string) => {
  const common = `Eres un docente peruano. Escribe en español neutro, claro y apropiado para estudiantes de ${level}. Tema: "${topic}".
Responde ÚNICAMENTE con un arreglo JSON válido, sin texto adicional ni bloques de código.`;
  if (kind === 'TRUE_FALSE') {
    return `${common}
Genera exactamente ${quantity} afirmaciones de verdadero o falso para leer en voz alta en clase (una sola idea por afirmación, sin dobles negaciones). Mezcla verdaderas y falsas en proporción parecida.
Formato: [{ "statement": "...", "answer": true, "explanation": "Una o dos frases que expliquen por qué." }]`;
  }
  if (kind === 'ERROR_STEPS') {
    return `${common}
Genera exactamente ${quantity} ejercicios. Para cada uno:
- "problem": enunciado breve.
- "steps": la solución CORRECTA en 3 o 4 pasos cortos.
- "wrongIndex": índice (desde 0) del paso que vas a alterar; no elijas el primero.
- "wrongStep": ese mismo paso, con la misma forma, pero con un error típico de estudiantes que sea claramente incorrecto (no una forma equivalente ni un error de tipeo).
- "correction": una o dos frases: qué está mal en ese paso y cómo es lo correcto.
Ejemplo: [{"problem":"Calcula 1/2 + 1/3","steps":["El común denominador de 2 y 3 es 6.","1/2 = 3/6 y 1/3 = 2/6.","3/6 + 2/6 = 5/6."],"wrongIndex":2,"wrongStep":"3/6 + 2/6 = 5/12.","correction":"Con igual denominador se suman solo los numeradores: 3/6 + 2/6 = 5/6."}]`;
  }
  return `${common}
Genera exactamente ${quantity} preguntas de opción única con 4 opciones breves (una sola correcta; las incorrectas, plausibles).
Formato: [{ "question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "Una o dos frases que expliquen la respuesta." }]`;
};

const parseArray = (text: string) => {
  let clean = text.trim();
  if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(clean) as unknown;
  } catch {
    throw new ValidationError('La IA no devolvió preguntas válidas. Intenta de nuevo.');
  }
};

/**
 * Observatorio: genera preguntas con IA y las guarda directo en un banco de la clase (sin CSV).
 * Con `bankId` las añade a ese banco (debe ser de esta clase); si no, usa o crea "Observatorio · tema".
 */
export const generateIntoBank = async (input: {
  classroomId: string;
  bankId?: string | null;
  topic: string;
  quantity: number;
  kind: GenerateKind;
}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new InternalServerError('La generación con IA no está configurada');

  const [classroom] = await db.select({ id: classrooms.id, gradeLevel: classrooms.gradeLevel })
    .from(classrooms).where(eq(classrooms.id, input.classroomId));
  if (!classroom) throw new NotFoundError('Clase no encontrada');

  let bank: { id: string; name: string } | undefined;
  if (input.bankId) {
    [bank] = await db.select({ id: questionBanks.id, name: questionBanks.name }).from(questionBanks)
      .where(and(eq(questionBanks.id, input.bankId), eq(questionBanks.classroomId, input.classroomId), eq(questionBanks.isActive, true)));
    if (!bank) throw new NotFoundError('Banco no encontrado');
  }

  const ai = createGenAI(apiKey);
  const response = await generateContentWithRetry(() => ai.models.generateContent({
    model: input.kind === 'ERROR_STEPS' ? ERROR_MODEL : MODEL,
    contents: promptFor(input.kind, input.topic, input.quantity, levelLabel(classroom.gradeLevel)),
    config: { responseMimeType: 'application/json' },
  }));
  const raw = parseArray(response.text || '');

  // Validación por ítem: se guardan los válidos; solo falla si no queda ninguno.
  const schema = input.kind === 'TRUE_FALSE' ? trueFalseSchema : input.kind === 'ERROR_STEPS' ? errorStepsSchema : singleChoiceSchema;
  const list = Array.isArray(raw) ? raw : [];
  const items = list
    .map((item) => schema.safeParse(item))
    .flatMap((r) => (r.success ? [r.data as z.infer<typeof trueFalseSchema> | z.infer<typeof singleChoiceSchema> | z.infer<typeof errorStepsSchema>] : []));
  if (items.length === 0) {
    console.warn('[observatorioAi] La IA no devolvió ítems válidos:', JSON.stringify(raw).slice(0, 600));
    throw new ValidationError('La IA no devolvió preguntas válidas. Intenta de nuevo.');
  }

  if (!bank) {
    const name = `${input.kind === 'ERROR_STEPS' ? 'El Error de Jiro' : 'Observatorio'} · ${input.topic}`.slice(0, 100);
    [bank] = await db.select({ id: questionBanks.id, name: questionBanks.name }).from(questionBanks)
      .where(and(eq(questionBanks.classroomId, input.classroomId), eq(questionBanks.isActive, true), sql`LOWER(${questionBanks.name}) = ${name.toLowerCase()}`));
    if (!bank) {
      const created = await questionBankService.createBank({ classroomId: input.classroomId, name, icon: 'star', color: '#4f46e5' });
      if (!created) throw new InternalServerError('No se pudo crear el banco');
      bank = { id: created.id, name: created.name };
    }
  }

  let created = 0;
  for (const item of items.slice(0, input.quantity)) {
    if ('steps' in item) {
      // Sin paso alterado de verdad (fuera de rango o idéntico) no hay ejercicio.
      if (item.wrongIndex >= item.steps.length || item.wrongStep === item.steps[item.wrongIndex]) continue;
      const steps = item.steps.map((text, i) => (i === item.wrongIndex ? item.wrongStep : text));
      await questionBankService.createQuestion({
        bankId: bank.id, type: 'SINGLE_CHOICE', difficulty: 'MEDIUM', questionText: `${ERROR_PREFIX} ${item.problem}`,
        options: steps.map((text, i) => ({ text: `Paso ${i + 1}: ${text}`, isCorrect: i === item.wrongIndex })),
        explanation: item.correction,
      });
    } else if ('statement' in item) {
      await questionBankService.createQuestion({
        bankId: bank.id, type: 'TRUE_FALSE', difficulty: 'EASY', questionText: item.statement, correctAnswer: item.answer, explanation: item.explanation,
      });
    } else {
      await questionBankService.createQuestion({
        bankId: bank.id, type: 'SINGLE_CHOICE', difficulty: 'MEDIUM', questionText: item.question,
        options: item.options.map((text, i) => ({ text, isCorrect: i === item.correctIndex })), explanation: item.explanation,
      });
    }
    created += 1;
  }

  return { bankId: bank.id, bankName: bank.name, created };
};
