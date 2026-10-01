import type { Question, QuestionDifficulty, TeacherBank } from '../../../lib/questionBankApi';
import { shuffle } from '../../classroom/utilities/helpers';
import { answerOf } from '../questionHelpers';

// Conquista del Cielo: la Niebla cubre las regiones del cielo. Todos los equipos responden a la vez;
// cada acierto enciende estrellas del equipo en la región. Al despejarse una región (meta común),
// el equipo con más estrellas ahí la conquista (+3). Nadie pierde estrellas ni territorio.

export interface Team {
  id: string;
  name: string;
  emblem: string;
  color: string;
  memberIds: string[];
}

export interface Region {
  id: string;
  name: string;
  subtitle: string;
  questionIds: string[];
  used: string[];
  goal: number;
  /** Estrellas por equipo. */
  stars: Record<string, number>;
  /** Estrellas de todos (Viento solar). */
  neutral: number;
  cleared: boolean;
  /** Equipos que la conquistaron (empate = varios). */
  conquerors: string[];
}

export type CardId = 'lluvia' | 'alianza' | 'viento' | 'segunda' | 'telescopio';

export interface ActiveCard {
  id: CardId;
  /** Alianza: los dos equipos con menos estrellas responden juntos. */
  pair?: [string, string];
}

export interface Round {
  regionId: string;
  questionId: string;
  phase: 'ask' | 'reveal';
  /** Opción oculta por el Telescopio. */
  hiddenOption?: number;
  /** Segunda oportunidad ya usada. */
  retried?: boolean;
}

export interface ConquistaState {
  teams: Team[];
  /** Bancos de la partida (para traer sus preguntas al reanudar). */
  bankIds: string[];
  regions: Region[];
  roundNumber: number;
  bonus: Record<string, number>;
  card: ActiveCard | null;
  /** Rondas jugadas desde la última carta. */
  sinceCard: number;
  round: Round | null;
  usedCards: CardId[];
}

export const CARD_EVERY = 3;
export const CONQUEST_BONUS = 3;

export const CARDS: Record<CardId, { icon: string; title: string; text: string }> = {
  lluvia: { icon: '🌠', title: 'Lluvia de estrellas', text: 'Esta ronda, cada acierto vale doble.' },
  alianza: { icon: '🤝', title: 'Alianza estelar', text: 'Los dos equipos con menos estrellas responden juntos: si uno acierta, ganan los dos.' },
  viento: { icon: '🌬️', title: 'Viento solar', text: 'La Niebla retrocede: todas las regiones ganan una estrella para la clase.' },
  segunda: { icon: '🔁', title: 'Segunda oportunidad', text: 'Quien falle puede conversar y responder otra vez.' },
  telescopio: { icon: '🔭', title: 'Telescopio de Jiro', text: 'Jiro descarta una opción incorrecta.' },
};

export const QUICK_TEAMS = [
  { name: 'Cometas', emblem: '☄️', color: '#f97316' },
  { name: 'Nebulosas', emblem: '🌌', color: '#8b5cf6' },
  { name: 'Meteoros', emblem: '🌠', color: '#0ea5e9' },
  { name: 'Auroras', emblem: '🌈', color: '#10b981' },
  { name: 'Galaxias', emblem: '🌀', color: '#ec4899' },
  { name: 'Eclipses', emblem: '🌑', color: '#eab308' },
];

const REGION_NAMES = ['Orión', 'Casiopea', 'Lira', 'Cisne', 'Leo', 'Escorpio'];
const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = { EASY: 'Fácil', MEDIUM: 'Media', HARD: 'Difícil' };

/** Preguntas que se pueden responder levantando una tarjeta A–D (o V/F). */
export const isPlayable = (q: Question) => answerOf(q) !== null;

/**
 * Regiones: una por banco; con un solo banco, por dificultad (o en tres partes si todas son
 * de la misma dificultad).
 */
export const buildRegions = (banks: TeacherBank[], questionsByBank: Map<string, Question[]>, teamCount: number): Region[] => {
  const goal = Math.max(4, teamCount * 2);
  const groups: { subtitle: string; questions: Question[] }[] = [];
  if (banks.length === 1) {
    const all = (questionsByBank.get(banks[0].id) ?? []).filter(isPlayable);
    const byDifficulty = (['EASY', 'MEDIUM', 'HARD'] as QuestionDifficulty[])
      .map((d) => ({ subtitle: `${banks[0].name} · ${DIFFICULTY_LABEL[d]}`, questions: all.filter((q) => q.difficulty === d) }))
      .filter((g) => g.questions.length > 0);
    if (byDifficulty.length >= 2) {
      // Las de dificultad "sin definir" se reparten entre las regiones (sin cambiar su nombre).
      shuffle(all.filter((q) => !q.difficulty)).forEach((q, i) => byDifficulty[i % byDifficulty.length].questions.push(q));
      groups.push(...byDifficulty);
    }
    else {
      const mixed = shuffle(all);
      const size = Math.max(1, Math.ceil(mixed.length / 3));
      for (let i = 0; i < mixed.length; i += size) groups.push({ subtitle: banks[0].name, questions: mixed.slice(i, i + size) });
    }
  } else {
    for (const bank of banks) groups.push({ subtitle: bank.name, questions: (questionsByBank.get(bank.id) ?? []).filter(isPlayable) });
  }
  return groups
    .filter((g) => g.questions.length > 0)
    .slice(0, REGION_NAMES.length)
    .map((g, i) => ({
      id: `r${i}`,
      name: `Región de ${REGION_NAMES[i]}`,
      subtitle: g.subtitle,
      questionIds: shuffle(g.questions).map((q) => q.id),
      used: [],
      goal,
      stars: {},
      neutral: 0,
      cleared: false,
      conquerors: [],
    }));
};

export const regionTotal = (region: Region) => Object.values(region.stars).reduce((a, b) => a + b, 0) + region.neutral;

export const teamTotal = (state: ConquistaState, teamId: string) =>
  state.regions.reduce((sum, r) => sum + (r.stars[teamId] ?? 0), 0) + (state.bonus[teamId] ?? 0);

/** Equipo(s) con más estrellas en la región (vacío si nadie tiene). */
export const regionLeaders = (region: Region) => {
  const entries = Object.entries(region.stars).filter(([, n]) => n > 0);
  if (entries.length === 0) return [] as string[];
  const max = Math.max(...entries.map(([, n]) => n));
  return entries.filter(([, n]) => n === max).map(([id]) => id);
};

/** Siguiente pregunta de la región (sin repetir hasta agotarlas). */
export const nextQuestion = (region: Region) => {
  const fresh = region.questionIds.filter((id) => !region.used.includes(id));
  return fresh[0] ?? region.questionIds[0] ?? null;
};

export const startRound = (state: ConquistaState, regionId: string): ConquistaState => {
  const region = state.regions.find((r) => r.id === regionId);
  const questionId = region ? nextQuestion(region) : null;
  if (!region || !questionId) return state;
  return {
    ...state,
    round: { regionId, questionId, phase: 'ask' },
    regions: state.regions.map((r) => (r.id === regionId
      ? { ...r, used: r.used.length >= r.questionIds.length ? [questionId] : [...r.used, questionId] }
      : r)),
  };
};

/** Suma las estrellas de la ronda, despeja la región si llega a la meta y prepara la próxima carta. */
export const scoreRound = (state: ConquistaState, correctTeamIds: string[]): { state: ConquistaState; cleared: Region | null; gained: number } => {
  if (!state.round) return { state, cleared: null, gained: 0 };
  const { regionId } = state.round;
  const scoring = new Set(correctTeamIds);
  const pair = state.card?.id === 'alianza' ? state.card.pair : undefined;
  if (pair && (scoring.has(pair[0]) || scoring.has(pair[1]))) {
    scoring.add(pair[0]);
    scoring.add(pair[1]);
  }
  const value = state.card?.id === 'lluvia' ? 2 : 1;
  let cleared: Region | null = null;
  let bonus = state.bonus;
  const regions = state.regions.map((r) => {
    if (r.id !== regionId) return r;
    const stars = { ...r.stars };
    scoring.forEach((id) => { stars[id] = (stars[id] ?? 0) + value; });
    const next: Region = { ...r, stars };
    if (!r.cleared && regionTotal(next) >= r.goal) {
      const leaders = regionLeaders(next);
      next.cleared = true;
      next.conquerors = leaders;
      bonus = { ...bonus };
      leaders.forEach((id) => { bonus[id] = (bonus[id] ?? 0) + CONQUEST_BONUS; });
      cleared = next;
    }
    return next;
  });
  return {
    state: { ...state, regions, bonus, round: null, card: null, roundNumber: state.roundNumber + 1, sinceCard: state.sinceCard + 1 },
    cleared,
    gained: scoring.size * value,
  };
};

/** Carta de Jiro (solo positivas). Viento solar se aplica al momento. */
export const drawCard = (state: ConquistaState): ConquistaState => {
  const pool = (Object.keys(CARDS) as CardId[]).filter((id) => id !== 'alianza' || state.teams.length >= 3);
  const fresh = pool.filter((id) => !state.usedCards.slice(-2).includes(id));
  const id = shuffle(fresh.length ? fresh : pool)[0];
  const next: ConquistaState = { ...state, sinceCard: 0, usedCards: [...state.usedCards, id] };
  if (id === 'viento') {
    const bonus = { ...state.bonus };
    const regions = state.regions.map((r) => {
      if (r.cleared) return r;
      const raised = { ...r, neutral: r.neutral + 1 };
      if (regionTotal(raised) < r.goal) return raised;
      // El viento puede despejar una región: quien lidera la conquista.
      const leaders = regionLeaders(raised);
      leaders.forEach((t) => { bonus[t] = (bonus[t] ?? 0) + CONQUEST_BONUS; });
      return { ...raised, cleared: true, conquerors: leaders };
    });
    return { ...next, card: { id }, regions, bonus };
  }
  if (id === 'alianza') {
    const weakest = [...state.teams].sort((a, b) => teamTotal(state, a.id) - teamTotal(state, b.id)).slice(0, 2);
    return { ...next, card: { id, pair: [weakest[0].id, weakest[1].id] } };
  }
  return { ...next, card: { id } };
};

export const podium = (state: ConquistaState) =>
  [...state.teams]
    .map((t) => ({ team: t, total: teamTotal(state, t.id), conquered: state.regions.filter((r) => r.conquerors.includes(t.id)).length }))
    .sort((a, b) => b.total - a.total || b.conquered - a.conquered);
