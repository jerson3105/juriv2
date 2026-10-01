import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classrooms, questionBanks } from '../db/schema.js';
import { InternalServerError, NotFoundError } from '../utils/errors.js';
import { generateDrafts } from './questionAi.service.js';
import { questionBankService } from './questionBank.service.js';

export { ERROR_PREFIX } from './questionAi.service.js';

export type GenerateKind = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'ERROR_STEPS';

/**
 * Observatorio: genera preguntas con IA y las guarda directo en un banco de la clase (sin CSV).
 * Con `bankId` las añade a ese banco (debe ser de esta clase); si no, usa o crea "Observatorio · tema".
 * Quedan "por revisar": el Observatorio avisa al usarlas y el banco permite aprobarlas.
 */
export const generateIntoBank = async (input: {
  classroomId: string;
  bankId?: string | null;
  topic: string;
  quantity: number;
  kind: GenerateKind;
}) => {
  const [classroom] = await db.select({ id: classrooms.id, gradeLevel: classrooms.gradeLevel })
    .from(classrooms).where(eq(classrooms.id, input.classroomId));
  if (!classroom) throw new NotFoundError('Clase no encontrada');

  let bank: { id: string; name: string } | undefined;
  if (input.bankId) {
    [bank] = await db.select({ id: questionBanks.id, name: questionBanks.name }).from(questionBanks)
      .where(and(eq(questionBanks.id, input.bankId), eq(questionBanks.classroomId, input.classroomId), eq(questionBanks.isActive, true)));
    if (!bank) throw new NotFoundError('Banco no encontrado');
  }

  const drafts = await generateDrafts({
    kinds: [input.kind], quantity: input.quantity, topic: input.topic, gradeLevel: classroom.gradeLevel,
  });

  if (!bank) {
    const name = `${input.kind === 'ERROR_STEPS' ? 'El Error de Jiro' : 'Observatorio'} · ${input.topic}`.slice(0, 100);
    [bank] = await db.select({ id: questionBanks.id, name: questionBanks.name }).from(questionBanks)
      .where(and(eq(questionBanks.classroomId, input.classroomId), eq(questionBanks.isActive, true), sql`LOWER(${questionBanks.name}) = ${name.toLowerCase()}`));
    if (!bank) {
      // Sin color fijo: el banco toma uno libre de la paleta del docente.
      const created = await questionBankService.createBank({ classroomId: input.classroomId, name, icon: input.kind === 'ERROR_STEPS' ? 'brain' : 'star' });
      if (!created) throw new InternalServerError('No se pudo crear el banco');
      bank = { id: created.id, name: created.name };
    }
  }

  const { created } = await questionBankService.createQuestionsBatch(bank.id, drafts, true);
  return { bankId: bank.id, bankName: bank.name, created };
};
