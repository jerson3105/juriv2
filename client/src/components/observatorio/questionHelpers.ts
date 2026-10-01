import { parseQuestionData, type Question } from '../../lib/questionBankApi';

export interface ProjectedAnswer {
  /** Índice de la opción correcta (V/F: 0 = Verdadero, 1 = Falso). */
  index: number;
  text: string;
  /** Opciones en orden (V/F: Verdadero y Falso). */
  options: string[];
}

/**
 * Respuesta de una pregunta que se puede jugar levantando una tarjeta: V/F, u opción única con
 * 2 a 4 opciones y exactamente una correcta. Las demás devuelven null (no se proyectan).
 */
export const answerOf = (question: Question): ProjectedAnswer | null => {
  const parsed = parseQuestionData(question);
  if (question.type === 'TRUE_FALSE') {
    const raw = parsed.correctAnswer;
    if (raw !== true && raw !== false && raw !== 'true' && raw !== 'false') return null;
    const value = raw === true || raw === 'true';
    return { index: value ? 0 : 1, text: value ? 'Verdadero' : 'Falso', options: ['Verdadero', 'Falso'] };
  }
  if (question.type !== 'SINGLE_CHOICE') return null;
  const options = parsed.options ?? [];
  const correct = options.filter((o) => o.isCorrect);
  if (options.length < 2 || options.length > 4 || correct.length !== 1) return null;
  const index = options.findIndex((o) => o.isCorrect);
  return { index, text: options[index].text, options: options.map((o) => o.text) };
};

/** Preguntas muy largas bajan un escalón de tamaño para no desbordar el escenario. */
export const questionSizeClass = (text: string) => (text.length > 120 ? 'stage-option' : 'stage-title');
