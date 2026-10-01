import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { classrooms, questionBanks } from '../db/schema.js';
import { createGenAI, generateContentWithRetry } from '../utils/aiClient.js';
import { InternalServerError, NotFoundError, ValidationError } from '../utils/errors.js';
import { questionBankService } from './questionBank.service.js';

const MODEL = 'gemini-2.5-flash-lite';

export type GenerateKind = 'TRUE_FALSE' | 'SINGLE_CHOICE';

// "PRIMARIA_5" → "5.º de primaria"; sin dato, un nivel general.
const levelLabel = (gradeLevel: string | null) => {
  const match = gradeLevel?.toUpperCase().match(/^(INICIAL|PRIMARIA|SECUNDARIA)_?(\d+)?/);
  if (!match) return 'primaria';
  const stage = match[1].toLowerCase();
  if (stage === 'inicial') return match[2] ? `inicial (${match[2]} años)` : 'inicial';
  return match[2] ? `${match[2]}.º de ${stage}` : stage;
};

const trueFalseSchema = z.array(z.object({
  statement: z.string().trim().min(5).max(300),
  answer: z.boolean(),
  explanation: z.string().trim().min(5).max(500),
})).min(1);

const singleChoiceSchema = z.array(z.object({
  question: z.string().trim().min(5).max(300),
  options: z.array(z.string().trim().min(1).max(150)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(5).max(500),
})).min(1);

const promptFor = (kind: GenerateKind, topic: string, quantity: number, level: string) => {
  const common = `Eres un docente peruano. Escribe en español neutro, claro y apropiado para estudiantes de ${level}. Tema: "${topic}".
Responde ÚNICAMENTE con un arreglo JSON válido, sin texto adicional ni bloques de código.`;
  if (kind === 'TRUE_FALSE') {
    return `${common}
Genera exactamente ${quantity} afirmaciones de verdadero o falso para leer en voz alta en clase (una sola idea por afirmación, sin dobles negaciones). Mezcla verdaderas y falsas en proporción parecida.
Formato: [{ "statement": "...", "answer": true, "explanation": "Una o dos frases que expliquen por qué." }]`;
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
    model: MODEL,
    contents: promptFor(input.kind, input.topic, input.quantity, levelLabel(classroom.gradeLevel)),
    config: { responseMimeType: 'application/json' },
  }));
  const raw = parseArray(response.text || '');

  const items = input.kind === 'TRUE_FALSE'
    ? trueFalseSchema.safeParse(raw)
    : singleChoiceSchema.safeParse(raw);
  if (!items.success) throw new ValidationError('La IA no devolvió preguntas válidas. Intenta de nuevo.');

  if (!bank) {
    const name = `Observatorio · ${input.topic}`.slice(0, 100);
    [bank] = await db.select({ id: questionBanks.id, name: questionBanks.name }).from(questionBanks)
      .where(and(eq(questionBanks.classroomId, input.classroomId), eq(questionBanks.isActive, true), sql`LOWER(${questionBanks.name}) = ${name.toLowerCase()}`));
    if (!bank) {
      const created = await questionBankService.createBank({ classroomId: input.classroomId, name, icon: 'star', color: '#4f46e5' });
      if (!created) throw new InternalServerError('No se pudo crear el banco');
      bank = { id: created.id, name: created.name };
    }
  }

  let created = 0;
  for (const item of items.data.slice(0, input.quantity)) {
    if ('statement' in item) {
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
