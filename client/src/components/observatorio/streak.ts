// Rondas con estrellas de la clase (Estrellas en Movimiento, El Error de Jiro): cada acierto de la
// mayoría enciende una estrella y cada 3 aciertos seguidos dan una extra. Fallar no resta.

export interface StreakState {
  index: number;
  marks: boolean[];
  stars: number;
  streak: number;
  bestStreak: number;
}

export const BONUS_EVERY = 3;

export const maxStars = (rounds: number) => rounds + Math.floor(rounds / BONUS_EVERY);

export const initialStreak = (): StreakState => ({ index: 0, marks: [], stars: 0, streak: 0, bestStreak: 0 });

/** Marca la ronda actual y avanza. `bonus` = esta marca completó una racha de 3. */
export const applyMark = <T extends StreakState>(state: T, correct: boolean): { next: T; bonus: boolean } => {
  const streak = correct ? state.streak + 1 : 0;
  const bonus = correct && streak % BONUS_EVERY === 0;
  return {
    bonus,
    next: {
      ...state,
      marks: [...state.marks, correct],
      stars: state.stars + (correct ? 1 + (bonus ? 1 : 0) : 0),
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      index: state.index + 1,
    },
  };
};

/** XP sugerido según la proporción de aciertos. */
export const suggestedXpFor = (correct: number, rounds: number) => {
  if (rounds <= 0) return 10;
  const ratio = correct / rounds;
  return ratio >= 0.8 ? 20 : ratio >= 0.5 ? 15 : 10;
};
