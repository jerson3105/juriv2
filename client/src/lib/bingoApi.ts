import api from './api';
import type { ActivitySession } from './activityApi';

// Bingo Estelar (Observatorio de Jiro): el servidor arma el mazo y es la única fuente de los cartones.
export type BingoSize = 3 | 4;
export type BingoSource = { kind: 'bank'; bankId: string } | { kind: 'tables'; tables: number[] };

export interface BingoAnswer { key: string; text: string }
/** Una bola: la pregunta que se sortea y la respuesta (clave) que marca su casilla. */
export interface BingoBall { id: string; prompt: string; context: string | null; key: string; explanation: string | null }

/** Lo que guarda el servidor al crear la partida (el escenario agrega el resto en BingoState). */
export interface BingoServerState {
  version: 1;
  title: string;
  size: BingoSize;
  seed: string;
  game: number;
  answers: BingoAnswer[];
  balls: BingoBall[];
  cardCount: number;
  /** Alumnos con cuenta que juegan su cartón en pantalla (los demás números son de papel). */
  screen: { studentId: string; card: number }[];
}

export interface BingoPreview {
  title: string;
  answers: number;
  balls: number;
  /** Preguntas que no sirven (respuesta larga, sin una sola correcta…). */
  skipped: number;
  /** Preguntas de IA aún por revisar. */
  unreviewed: number;
  minimum: Record<BingoSize, number>;
}

export interface BingoCards {
  size: BingoSize;
  game: number;
  /** Casillas en orden de lectura (claves de respuesta; «*» = Jiro libre). Sin nombres. */
  cards: { number: number; cells: string[]; screen: boolean }[];
}

export interface MyBingo {
  current: {
    sessionId: string;
    title: string;
    size: BingoSize;
    game: number;
    card: number;
    cells: { key: string; text: string }[];
  } | null;
}

export const bingoKeys = {
  preview: (classroomId: string, source: BingoSource | null) => ['bingo-preview', classroomId, source] as const,
  cards: (sessionId: string, seed: string) => ['bingo-cards', sessionId, seed] as const,
  mine: (profileId: string) => ['bingo-mine', profileId] as const,
};

export const bingoApi = {
  preview: async (classroomId: string, source: BingoSource): Promise<BingoPreview> => {
    const response = await api.post(`/bingo/classroom/${classroomId}/preview`, { source });
    return response.data.data;
  },

  /** El servidor arma el mazo, reparte los cartones (en pantalla solo alumnos con cuenta) y crea la partida. */
  create: async <S extends BingoServerState>(
    classroomId: string,
    data: { source: BingoSource; size: BingoSize; paperCount: number; screenStudentIds: string[] },
  ): Promise<ActivitySession<S>> => {
    const response = await api.post(`/bingo/classroom/${classroomId}`, data);
    return response.data.data;
  },

  cards: async (sessionId: string): Promise<BingoCards> => {
    const response = await api.get(`/bingo/sessions/${sessionId}/cards`);
    return response.data.data;
  },

  mine: async (profileId: string): Promise<MyBingo> => {
    const response = await api.get(`/bingo/me/${profileId}`);
    return response.data.data;
  },
};
