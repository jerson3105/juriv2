import type { CardRarity, CollectibleCard } from '../../lib/collectibleApi';

export const CARD_RARITY_ORDER: CardRarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

// Mismas probabilidades que el servidor al abrir un sobre (collectible.service).
export const RARITY_WEIGHT: Record<CardRarity, number> = { COMMON: 50, UNCOMMON: 30, RARE: 15, EPIC: 4, LEGENDARY: 1 };

// Estilos estáticos por rareza (Tailwind no ve clases armadas dinámicamente).
export const CARD_RARITY_STYLE: Record<CardRarity, {
  label: string;
  frame: string;
  art: string;
  chip: string;
  holo: boolean;
}> = {
  COMMON: {
    label: 'Común',
    frame: 'from-slate-300 via-slate-100 to-slate-400 dark:from-slate-500 dark:via-slate-400 dark:to-slate-600',
    art: 'from-slate-100 to-slate-300 dark:from-slate-700 dark:to-slate-800',
    chip: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
    holo: false,
  },
  UNCOMMON: {
    label: 'Poco común',
    frame: 'from-emerald-400 via-emerald-200 to-emerald-500',
    art: 'from-emerald-100 to-emerald-300 dark:from-emerald-900 dark:to-emerald-800',
    chip: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100',
    holo: false,
  },
  RARE: {
    label: 'Raro',
    frame: 'from-sky-400 via-blue-200 to-blue-600',
    art: 'from-sky-100 to-blue-300 dark:from-blue-950 dark:to-blue-800',
    chip: 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100',
    holo: false,
  },
  EPIC: {
    label: 'Épico',
    frame: 'from-fuchsia-400 via-purple-300 to-violet-600',
    art: 'from-fuchsia-100 to-violet-300 dark:from-purple-950 dark:to-violet-800',
    chip: 'bg-purple-100 text-purple-900 dark:bg-purple-900/60 dark:text-purple-100',
    holo: true,
  },
  LEGENDARY: {
    label: 'Legendario',
    frame: 'from-yellow-300 via-amber-200 to-orange-500',
    art: 'from-yellow-100 to-amber-300 dark:from-amber-950 dark:to-orange-900',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
    holo: true,
  },
};

export const RARITY_FALLBACK_ICON: Record<CardRarity, string> = {
  COMMON: '⭐',
  UNCOMMON: '🍀',
  RARE: '💎',
  EPIC: '🔮',
  LEGENDARY: '👑',
};

export const albumsKey = (classroomId: string) => ['collectible-albums', classroomId] as const;
export const albumKey = (albumId: string) => ['collectible-album', albumId] as const;
export const cardOwnersKey = (albumId: string) => ['collectible-card-owners', albumId] as const;

// Probabilidad de cada cromo al sacar uno: la rareza se reparte entre sus cromos; si una rareza no
// tiene cromos, su peso se reparte entre las que sí (aproximación del reparto del servidor).
const cardProbabilities = (cards: Pick<CollectibleCard, 'rarity'>[]) => {
  const byRarity = new Map<CardRarity, number>();
  for (const card of cards) byRarity.set(card.rarity, (byRarity.get(card.rarity) ?? 0) + 1);
  const totalWeight = [...byRarity.keys()].reduce((sum, rarity) => sum + RARITY_WEIGHT[rarity], 0);
  return cards.map((card) => RARITY_WEIGHT[card.rarity] / totalWeight / (byRarity.get(card.rarity) ?? 1));
};

// Cromos que hay que sacar, en promedio, para completar el álbum (coleccionista de cupones con
// probabilidades distintas): E[T] = ∫₀^∞ (1 − Π(1 − e^(−p·t))) dt, integrado numéricamente.
export const expectedDrawsToComplete = (cards: Pick<CollectibleCard, 'rarity'>[]) => {
  if (cards.length === 0) return 0;
  const probs = cardProbabilities(cards);
  const minP = Math.min(...probs);
  const limit = 30 / minP;
  const steps = 4000;
  const dt = limit / steps;
  let total = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * dt;
    let product = 1;
    for (const p of probs) product *= 1 - Math.exp(-p * t);
    total += (1 - product) * dt;
  }
  return total;
};

// Costo medio en oro de completar el álbum comprando el sobre más barato por cromo.
export const expectedCostToComplete = (
  cards: Pick<CollectibleCard, 'rarity'>[],
  prices: { single: number; five: number; ten: number },
) => {
  const draws = expectedDrawsToComplete(cards);
  const perCard = Math.min(prices.single || Infinity, (prices.five || Infinity) / 5, (prices.ten || Infinity) / 10);
  if (!Number.isFinite(perCard)) return { draws: Math.round(draws), gp: 0 };
  return { draws: Math.round(draws), gp: Math.round(draws * perCard) };
};
