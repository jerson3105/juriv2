import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { activitySessions, classrooms, questionBanks, studentProfiles } from '../db/schema.js';
import { teacherOwnsClassroom } from '../utils/access.js';
import {
  BINGO_SIZES, FREE_CELL, MAX_ANSWERS, MAX_CARDS, cellsFor, deckFromQuestions, generateCards, minAnswersFor, newSeed, tablesDeck, tablesTitle,
  type BingoDeck, type BingoSize,
} from '../utils/bingo.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { activityService } from './activity.service.js';
import { questionBankService } from './questionBank.service.js';

export type BingoSource = { kind: 'bank'; bankId: string } | { kind: 'tables'; tables: number[] };

/**
 * Lo que el servidor necesita leer del estado (el resto —sorteos, marcas de la clase, bingos— lo guarda el
 * escenario del docente). El estado es JSON del docente: se valida al leerlo y, si no cuadra, no hay cartones.
 */
const stateSchema = z.object({
  version: z.literal(1),
  title: z.string().max(120),
  size: z.union([z.literal(3), z.literal(4)]),
  seed: z.string().min(8).max(64),
  game: z.number().int().min(1).max(999),
  answers: z.array(z.object({ key: z.string().min(1).max(80), text: z.string().min(1).max(40) })).min(1).max(MAX_ANSWERS),
  cardCount: z.number().int().min(1).max(MAX_CARDS),
  screen: z.array(z.object({ studentId: z.string().max(36), card: z.number().int().min(1).max(MAX_CARDS) })).max(MAX_CARDS),
}).passthrough();
type ServerState = z.infer<typeof stateSchema>;

const parseJson = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readState = (raw: unknown): ServerState | null => {
  const parsed = stateSchema.safeParse(parseJson(raw));
  if (!parsed.success) return null;
  const state = parsed.data;
  if (state.answers.length < cellsFor(state.size) || new Set(state.answers.map((a) => a.key)).size !== state.answers.length) return null;
  return state;
};

const shuffled = <T>(items: T[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Bingo Estelar: el servidor arma el mazo (banco u «Tablas»), reparte los cartones y es la única fuente de su
 * contenido. Los presentes con cuenta juegan su cartón en pantalla; el resto, en una hoja impresa. Se verifica por
 * número de cartón, sin nombres.
 */
class BingoService {
  /** Mazo de la fuente; un banco tiene que ser de una clase del propio docente. */
  private async deck(teacherId: string, source: BingoSource): Promise<BingoDeck & { title: string }> {
    if (source.kind === 'tables') return { title: tablesTitle(source.tables), ...tablesDeck(source.tables) };
    const [bank] = await db.select({ id: questionBanks.id, name: questionBanks.name, classroomId: questionBanks.classroomId, isActive: questionBanks.isActive })
      .from(questionBanks)
      .where(eq(questionBanks.id, source.bankId));
    if (!bank || !bank.isActive || !(await teacherOwnsClassroom(teacherId, bank.classroomId))) throw new NotFoundError('Banco no encontrado');
    const rows = await questionBankService.getQuestionsByBank(bank.id);
    return { title: bank.name, ...deckFromQuestions(rows) };
  }

  /** Cuántas respuestas y bolas da la fuente (el semáforo de la preparación). */
  async preview(teacherId: string, source: BingoSource) {
    const deck = await this.deck(teacherId, source);
    return {
      title: deck.title,
      answers: deck.answers.length,
      balls: deck.balls.length,
      skipped: deck.skipped,
      unreviewed: deck.unreviewed,
      minimum: Object.fromEntries(BINGO_SIZES.map((size) => [size, minAnswersFor(size)])),
    };
  }

  async create(classroomId: string, teacherId: string, input: { source: BingoSource; size: BingoSize; paperCount: number; screenStudentIds: string[] }) {
    const deck = await this.deck(teacherId, input.source);
    const minimum = minAnswersFor(input.size);
    if (deck.answers.length < minimum) {
      throw new ValidationError(`Para un cartón de ${input.size}×${input.size} hacen falta al menos ${minimum} respuestas distintas y cortas; esta fuente tiene ${deck.answers.length}.`);
    }
    // En pantalla, solo alumnos activos de esta clase con cuenta propia (el cliente no decide a quién).
    const ids = [...new Set(input.screenStudentIds)];
    const screenRows = ids.length
      ? await db.select({ id: studentProfiles.id }).from(studentProfiles)
        .where(and(eq(studentProfiles.classroomId, classroomId), inArray(studentProfiles.id, ids), eq(studentProfiles.isActive, true), isNotNull(studentProfiles.userId)))
      : [];
    const cardCount = screenRows.length + input.paperCount;
    if (cardCount < 1) throw new ValidationError('Elige cuántos cartones se juegan');
    if (cardCount > MAX_CARDS) throw new ValidationError(`Como máximo ${MAX_CARDS} cartones por partida`);
    // El número del cartón no delata a nadie: los de pantalla se reparten al azar entre los primeros.
    const screen = shuffled(screenRows.map((r) => r.id)).map((studentId, i) => ({ studentId, card: i + 1 }));
    const state = {
      version: 1 as const,
      title: deck.title.slice(0, 120),
      size: input.size,
      seed: newSeed(),
      game: 1,
      answers: deck.answers,
      balls: deck.balls,
      cardCount,
      screen,
    };
    return activityService.create(classroomId, teacherId, 'BINGO', `Bingo Estelar · ${deck.title}`.slice(0, 120), state);
  }

  private async bingoSession(sessionId: string, teacherId: string) {
    const session = await activityService.ownedSession(sessionId, teacherId);
    if (session.activityType !== 'BINGO') throw new NotFoundError('Partida no encontrada');
    return session;
  }

  /** Todos los cartones (para imprimir y verificar). Sin nombres: solo número y si se juega en pantalla. */
  async cards(sessionId: string, teacherId: string) {
    const session = await this.bingoSession(sessionId, teacherId);
    const state = readState(session.state);
    if (!state) throw new ValidationError('Esta partida no tiene cartones válidos');
    const onScreen = new Set(state.screen.map((s) => s.card));
    const cards = generateCards(state.seed, state.size, state.answers.map((a) => a.key), state.cardCount);
    return {
      size: state.size,
      game: state.game,
      cards: cards.map((cells, i) => ({ number: i + 1, cells, screen: onScreen.has(i + 1) })),
    };
  }

  /** Perfil del propio alumno en una clase activa (404 si no es suyo). */
  private async ownProfile(profileId: string, userId: string) {
    const [profile] = await db.select({ id: studentProfiles.id, userId: studentProfiles.userId, isActive: studentProfiles.isActive, classroomId: studentProfiles.classroomId, classActive: classrooms.isActive })
      .from(studentProfiles)
      .innerJoin(classrooms, eq(classrooms.id, studentProfiles.classroomId))
      .where(eq(studentProfiles.id, profileId));
    if (!profile || profile.userId !== userId || !profile.isActive || !profile.classActive) throw new NotFoundError('Perfil no encontrado');
    return profile;
  }

  /** El cartón del alumno en la partida en curso de su clase (o null si no juega en pantalla). */
  async forStudent(profileId: string, userId: string) {
    const profile = await this.ownProfile(profileId, userId);
    const [session] = await db.select().from(activitySessions)
      .where(and(eq(activitySessions.classroomId, profile.classroomId), eq(activitySessions.activityType, 'BINGO'), eq(activitySessions.status, 'ACTIVE')))
      .orderBy(desc(activitySessions.createdAt))
      .limit(1);
    const state = session ? readState(session.state) : null;
    const mine = state?.screen.find((s) => s.studentId === profileId);
    if (!session || !state || !mine || mine.card > state.cardCount) return { current: null };
    const cells = generateCards(state.seed, state.size, state.answers.map((a) => a.key), mine.card)[mine.card - 1] ?? [];
    const texts = new Map(state.answers.map((a) => [a.key, a.text]));
    return {
      current: {
        sessionId: session.id,
        title: state.title,
        size: state.size,
        game: state.game,
        card: mine.card,
        cells: cells.map((key) => ({ key, text: key === FREE_CELL ? '' : texts.get(key) ?? '' })),
      },
    };
  }
}

export const bingoService = new BingoService();
