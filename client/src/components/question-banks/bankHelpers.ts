import {
  DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, parseQuestionData,
  type CreateQuestionData, type DraftQuestion, type MatchingPair, type Question, type QuestionDifficulty, type QuestionOption, type TeacherBank,
} from '../../lib/questionBankApi';
import { answerOf } from '../observatorio/questionHelpers';

// Igual que ERROR_PREFIX del servidor (questionAi.service) y de El Error de Jiro.
export const ERROR_PREFIX = '¿En qué paso está el error?';
const STEP_RE = /^Paso \d+:\s*/;

export const isErrorQuestion = (q: Pick<Question, 'questionText'>) => q.questionText.startsWith(ERROR_PREFIX);

export const bankRoute = (classroomId: string, bankId?: string) =>
  `/classroom/${classroomId}/question-banks${bankId ? `/${bankId}` : ''}`;

export type ActivityKey = 'estrellas' | 'conquista' | 'error' | 'bingo';
export const ACTIVITY_NAMES: Record<ActivityKey, string> = {
  estrellas: 'Estrellas en Movimiento',
  conquista: 'Conquista del Cielo',
  error: 'El Error de Jiro',
  bingo: 'Bingo Estelar',
};
/** Abre la actividad del Observatorio con el banco ya elegido. */
export const activityRoute = (classroomId: string, activity: ActivityKey, bankId: string) =>
  `/classroom/${classroomId}/activities?actividad=${activity}&banco=${bankId}`;

// ==================== Bingo Estelar (igual que server/src/utils/bingo.ts) ====================

/** Una respuesta más larga no cabe en la casilla impresa (MAX_ANSWER_CHARS). */
export const BINGO_MAX_CHARS = 18;
/** Respuestas distintas para jugar: cartón 3×3 y 4×4 (minAnswersFor). */
export const BINGO_MIN_ANSWERS = { 3: 12, 4: 20 } as const;

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();
/** «Lima», «lima» y «Lima.» son la misma casilla (sin tildes, mayúsculas ni punto final). */
const bingoKey = (answer: unknown) => {
  if (typeof answer !== 'string') return null;
  const text = cleanText(answer);
  const key = cleanText(text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()).replace(/[.\s]+$/, '');
  return key && text.length <= BINGO_MAX_CHARS ? key : null;
};

/** Casillas que aporta una pregunta al Bingo: opción única → su correcta; unir pares → cada derecha. */
export const bingoKeysOf = (question: Question): string[] => {
  const parsed = parseQuestionData(question);
  if (question.type === 'SINGLE_CHOICE') {
    if (isErrorQuestion(question)) return [];
    const correct = (parsed.options ?? []).filter((o) => o.isCorrect);
    const key = correct.length === 1 && question.questionText.trim() ? bingoKey(correct[0].text) : null;
    return key ? [key] : [];
  }
  if (question.type === 'MATCHING') {
    return (parsed.pairs ?? []).flatMap((p) => (p.left?.trim() ? bingoKey(p.right) ?? [] : []));
  }
  return [];
};

/** Dónde se puede usar una pregunta y, si no entra en ninguna actividad proyectada, por qué. */
export const usesOf = (question: Question): { uses: string[]; blocker: string | null } => {
  const answer = answerOf(question);
  if (answer && isErrorQuestion(question)) return { uses: ['El Error de Jiro', 'Sorteo'], blocker: null };
  const bingo = bingoKeysOf(question).length > 0 ? ['Bingo'] : [];
  if (answer) return { uses: ['Estrellas', 'Conquista', ...bingo, 'Sorteo'], blocker: null };
  const parsed = parseQuestionData(question);
  switch (question.type) {
    case 'MATCHING':
      return bingo.length
        ? { uses: bingo, blocker: null }
        : { uses: [], blocker: `Unir pares solo entra en Bingo, con respuestas de hasta ${BINGO_MAX_CHARS} letras` };
    case 'MULTIPLE_CHOICE':
      return { uses: ['Sorteo'], blocker: 'Varias correctas: no entra en Estrellas, Conquista ni Bingo' };
    case 'SINGLE_CHOICE': {
      const options = parsed.options ?? [];
      if (options.length > 4) {
        return bingo.length ? { uses: [...bingo, 'Sorteo'], blocker: null } : { uses: ['Sorteo'], blocker: 'Más de 4 opciones: no entra en Estrellas ni Conquista' };
      }
      return { uses: ['Sorteo'], blocker: 'Marca exactamente 1 opción correcta' };
    }
    default:
      return { uses: [], blocker: 'Falta marcar la respuesta' };
  }
};

/** Respuesta en una línea para la lista ("✓ Marte"). */
export const answerSummary = (question: Question) => {
  const parsed = parseQuestionData(question);
  if (question.type === 'TRUE_FALSE') {
    const value = parsed.correctAnswer === true || parsed.correctAnswer === 'true';
    return `✓ ${value ? 'Verdadero' : 'Falso'}`;
  }
  if (question.type === 'MATCHING') return `${parsed.pairs?.length ?? 0} pares`;
  const options = parsed.options ?? [];
  const correct = options.filter((o) => o.isCorrect);
  if (isErrorQuestion(question)) {
    const index = options.findIndex((o) => o.isCorrect);
    return index >= 0 ? `✓ El error está en el paso ${index + 1}` : 'Sin paso marcado';
  }
  if (question.type === 'MULTIPLE_CHOICE') return `✓ ${correct.map((o) => o.text).join(' · ')} (${correct.length} de ${options.length})`;
  return correct[0] ? `✓ ${correct[0].text}` : 'Sin respuesta marcada';
};

export const difficultyLabel = (d: QuestionDifficulty | null) => (d ? DIFFICULTY_LABELS[d] : 'Sin dificultad');

/** Para qué actividades sirve un banco (tarjeta y "Usar en clase"). */
export const bankActivities = (bank: Pick<TeacherBank, 'stats'>) => {
  const general = bank.stats.projectable - bank.stats.errorExercises;
  const list: { key: ActivityKey; count: number }[] = [];
  if (general > 0) list.push({ key: 'estrellas', count: general }, { key: 'conquista', count: general });
  if (bank.stats.errorExercises > 0) list.push({ key: 'error', count: bank.stats.errorExercises });
  // Bingo cuenta respuestas distintas y necesita las de un cartón 3×3.
  if (bank.stats.bingoAnswers >= BINGO_MIN_ANSWERS[3]) list.push({ key: 'bingo', count: bank.stats.bingoAnswers });
  return list;
};

// ==================== Estado del editor (pregunta manual o borrador de la IA) ====================

export type EditorKind = 'TRUE_FALSE' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'MATCHING' | 'ERROR';

export const EDITOR_KINDS: { value: EditorKind; label: string; hint: string }[] = [
  { value: 'TRUE_FALSE', label: 'V o F', hint: 'Verdadero o falso' },
  { value: 'SINGLE_CHOICE', label: 'Única', hint: 'Una correcta' },
  { value: 'MULTIPLE_CHOICE', label: 'Múltiple', hint: 'Varias correctas' },
  { value: 'MATCHING', label: 'Unir', hint: 'Relacionar pares' },
  { value: 'ERROR', label: 'Con error', hint: 'Para El Error de Jiro' },
];

/** Nombre completo del tipo (listas y revisión). */
export const kindName = (kind: EditorKind) => (kind === 'ERROR' ? 'Con error' : QUESTION_TYPE_LABELS[kind]);

export interface EditorState {
  kind: EditorKind;
  /** En "Con error", el problema (sin el prefijo). */
  questionText: string;
  correctAnswer: boolean | null;
  /** Opciones; en "Con error", los pasos (isCorrect = el paso equivocado). */
  options: QuestionOption[];
  pairs: MatchingPair[];
  explanation: string;
  difficulty: QuestionDifficulty | null;
  imageUrl: string;
  points: number;
  timeLimitSeconds: number;
}

export const emptyEditor = (kind: EditorKind = 'TRUE_FALSE'): EditorState => ({
  kind,
  questionText: '',
  correctAnswer: null,
  options: kind === 'ERROR'
    ? [{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]
    : [{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }],
  pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
  explanation: '',
  difficulty: null,
  imageUrl: '',
  points: 10,
  timeLimitSeconds: 30,
});

/** Cambia el tipo conservando lo que ya se escribió cuando tiene sentido. */
export const switchKind = (state: EditorState, kind: EditorKind): EditorState => {
  const base = emptyEditor(kind);
  const keepOptions = (state.kind === 'SINGLE_CHOICE' || state.kind === 'MULTIPLE_CHOICE') && (kind === 'SINGLE_CHOICE' || kind === 'MULTIPLE_CHOICE');
  return {
    ...base,
    questionText: state.questionText,
    explanation: state.explanation,
    difficulty: state.difficulty,
    imageUrl: state.imageUrl,
    points: state.points,
    timeLimitSeconds: state.timeLimitSeconds,
    options: keepOptions
      ? (kind === 'SINGLE_CHOICE'
        ? state.options.map((o, i) => ({ ...o, isCorrect: i === state.options.findIndex((x) => x.isCorrect) }))
        : state.options)
      : base.options,
  };
};

const fromParts = (input: {
  type: Question['type']; questionText: string; options?: QuestionOption[] | null; correctAnswer?: unknown; pairs?: MatchingPair[] | null;
  explanation?: string | null; difficulty: QuestionDifficulty | null; imageUrl?: string | null; points?: number; timeLimitSeconds?: number;
}): EditorState => {
  const isError = input.type === 'SINGLE_CHOICE' && input.questionText.startsWith(ERROR_PREFIX);
  return {
    kind: isError ? 'ERROR' : input.type,
    questionText: isError ? input.questionText.slice(ERROR_PREFIX.length).trim() : input.questionText,
    correctAnswer: input.type === 'TRUE_FALSE' ? input.correctAnswer === true || input.correctAnswer === 'true' : null,
    options: (input.options ?? []).map((o) => ({ text: isError ? o.text.replace(STEP_RE, '') : o.text, isCorrect: !!o.isCorrect })),
    pairs: input.pairs ?? [],
    explanation: input.explanation ?? '',
    difficulty: input.difficulty,
    imageUrl: input.imageUrl ?? '',
    points: input.points ?? 10,
    timeLimitSeconds: input.timeLimitSeconds ?? 30,
  };
};

export const editorFromQuestion = (question: Question) => {
  const parsed = parseQuestionData(question);
  return fromParts({ ...parsed, options: parsed.options, pairs: parsed.pairs });
};

export const editorFromDraft = (draft: DraftQuestion) => fromParts(draft);

/** Qué falta para poder guardar (null = todo bien). */
export const validateEditor = (s: EditorState): string | null => {
  if (!s.questionText.trim()) return s.kind === 'ERROR' ? 'Escribe el problema' : 'Escribe la pregunta';
  const filled = s.options.filter((o) => o.text.trim());
  switch (s.kind) {
    case 'TRUE_FALSE':
      return s.correctAnswer === null ? 'Elige si es verdadero o falso' : null;
    case 'SINGLE_CHOICE':
      if (filled.length < 2) return 'Escribe al menos 2 opciones';
      return filled.filter((o) => o.isCorrect).length === 1 ? null : 'Marca la opción correcta';
    case 'MULTIPLE_CHOICE':
      if (filled.length < 2) return 'Escribe al menos 2 opciones';
      return filled.some((o) => o.isCorrect) ? null : 'Marca al menos una opción correcta';
    case 'MATCHING':
      return s.pairs.filter((p) => p.left.trim() && p.right.trim()).length >= 2 ? null : 'Completa al menos 2 pares';
    case 'ERROR':
      if (filled.length < 2) return 'Escribe al menos 2 pasos';
      return filled.filter((o) => o.isCorrect).length === 1 ? null : 'Marca el paso que tiene el error';
    default:
      return null;
  }
};

/** Estado del editor → datos para el servidor ("Con error" se guarda como opción única con prefijo). */
export const editorToPayload = (s: EditorState): CreateQuestionData => {
  const options = s.options.filter((o) => o.text.trim()).map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }));
  const base = {
    difficulty: s.difficulty,
    explanation: s.explanation.trim() || undefined,
    imageUrl: s.imageUrl.trim() || undefined,
    points: s.points,
    timeLimitSeconds: s.timeLimitSeconds,
  };
  switch (s.kind) {
    case 'TRUE_FALSE':
      return { ...base, type: 'TRUE_FALSE', questionText: s.questionText.trim(), correctAnswer: !!s.correctAnswer };
    case 'MATCHING':
      return { ...base, type: 'MATCHING', questionText: s.questionText.trim(), pairs: s.pairs.filter((p) => p.left.trim() && p.right.trim()).map((p) => ({ left: p.left.trim(), right: p.right.trim() })) };
    case 'ERROR':
      return {
        ...base,
        type: 'SINGLE_CHOICE',
        questionText: `${ERROR_PREFIX} ${s.questionText.trim()}`,
        options: options.map((o, i) => ({ text: `Paso ${i + 1}: ${o.text}`, isCorrect: o.isCorrect })),
      };
    default:
      return { ...base, type: s.kind, questionText: s.questionText.trim(), options };
  }
};

/** Pregunta "de mentira" con lo escrito en el editor (resúmenes y avisos antes de guardar). */
export const questionFromEditor = (s: EditorState): Question => {
  const payload = editorToPayload(s);
  return {
    ...payload,
    id: 'preview', bankId: '', points: payload.points ?? 10, timeLimitSeconds: payload.timeLimitSeconds ?? 30,
    imageUrl: payload.imageUrl ?? null, options: payload.options ?? null, correctAnswer: payload.correctAnswer ?? null,
    pairs: payload.pairs ?? null, explanation: payload.explanation ?? null, difficulty: payload.difficulty ?? null,
    aiGenerated: false, reviewedAt: null, isActive: true, createdAt: '', updatedAt: '',
  };
};

/** Para avisar en el editor si la pregunta se podrá proyectar. */
export const usesOfEditor = (s: EditorState) => usesOf(questionFromEditor(s));

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
