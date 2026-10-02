import { create } from 'zustand';
import type { BadgeRarity } from '../lib/badgeApi';

export interface CelebrationLevelUp {
  key: string;
  name: string;
  /** Ícono (emoji) de su clase de personaje; si no hay, se muestra solo la inicial. */
  icon?: string | null;
  from: number;
  to: number;
}

export interface CelebrationBadge {
  key: string;
  name: string;
  icon: string;
  customImage?: string | null;
  rarity: BadgeRarity;
  /** Quiénes la ganaron (vacío en la celebración personal del alumno). */
  recipients: string[];
  /** Solo personal: por qué la ganó («Te la dio tu profe: «…»»). */
  reason?: string | null;
}

export interface Celebration {
  id: number;
  /** class = tarjeta para el profesor; personal = tarjeta del alumno (queda hasta pulsar). */
  audience: 'class' | 'personal';
  levelUps: CelebrationLevelUp[];
  badges: CelebrationBadge[];
  /** Línea secundaria: "+10 XP · Participación". */
  context?: string;
  /** Solo personal: progreso hacia el siguiente nivel (0-100). */
  progress?: number;
  /** Solo personal: un segundo botón (p. ej. «Ver mis insignias»); cierra la tarjeta y lo ejecuta. */
  action?: { label: string; run: () => void };
  onDone?: () => void;
}

type NewCelebration = Omit<Celebration, 'id'>;

interface CelebrationState {
  current: Celebration | null;
  /** En modo silencioso se acumulan aquí (solo las de clase). */
  pending: NewCelebration[];
  silent: boolean;
  sound: boolean;
  /** Escenario del Observatorio abierto: las celebraciones van por encima de él. */
  raised: boolean;
  celebrate: (celebration: NewCelebration) => void;
  dismiss: (id: number) => void;
  playPending: () => void;
  setSilent: (value: boolean) => void;
  setSound: (value: boolean) => void;
  setRaised: (value: boolean) => void;
}

// Preferencias del visitante: silencio por sesión (exámenes), sonido persistente.
const read = (storage: () => Storage, key: string, fallback: boolean) => {
  try {
    const value = storage().getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
};
const write = (storage: () => Storage, key: string, value: boolean) => {
  try {
    storage().setItem(key, value ? '1' : '0');
  } catch {
    // Sin almacenamiento (ventana privada): la preferencia dura hasta recargar.
  }
};

const merge = (items: NewCelebration[]): NewCelebration => ({
  audience: 'class',
  levelUps: items.flatMap((c) => c.levelUps),
  badges: items.flatMap((c) => c.badges),
});

let nextId = 1;

export const useCelebrationStore = create<CelebrationState>((set, get) => ({
  current: null,
  pending: [],
  silent: read(() => sessionStorage, 'juried-celebrations-silent', false),
  sound: read(() => localStorage, 'juried-celebrations-sound', true),
  raised: false,

  // Una acción = una celebración. Si llega otra, reemplaza a la visible (nunca hay cola).
  celebrate: (celebration) => {
    if (celebration.levelUps.length === 0 && celebration.badges.length === 0) return;
    if (celebration.audience === 'class' && get().silent) {
      set((state) => ({ pending: [...state.pending, celebration] }));
      return;
    }
    set({ current: { ...celebration, id: nextId++ } });
  },

  dismiss: (id) => {
    const current = get().current;
    if (!current || current.id !== id) return;
    set({ current: null });
    current.onDone?.();
  },

  playPending: () => {
    const { pending } = get();
    if (pending.length === 0) return;
    set({ pending: [], current: { ...merge(pending), id: nextId++ } });
  },

  setSilent: (value) => {
    write(() => sessionStorage, 'juried-celebrations-silent', value);
    set({ silent: value });
  },

  setSound: (value) => {
    write(() => localStorage, 'juried-celebrations-sound', value);
    set({ sound: value });
  },

  setRaised: (value) => set({ raised: value }),
}));

/** Hito: cruzar un múltiplo de 5 o una insignia legendaria → celebración grande. */
export const isMilestone = (c: Pick<Celebration, 'levelUps' | 'badges'>) =>
  c.levelUps.some((l) => Math.floor(l.to / 5) > Math.floor(l.from / 5)) || c.badges.some((b) => b.rarity === 'LEGENDARY');
