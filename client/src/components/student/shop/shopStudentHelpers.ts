import type { ItemRarity, PurchaseType, StudentAvatarGoal, StudentShopItem, StudentShopView } from '../../../lib/shopApi';

// Estilos de la tienda del alumno: el ámbar del oro de la barra superior y del inicio (sin escalas nuevas).
export const goldTile = 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
export const savingsTrack = 'h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700';
// amber-700: con amber-600 la barra no se distingue del riel.
export const savingsFill = 'h-full rounded-full bg-amber-700 dark:bg-amber-400';
export const rarityChip = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold';
export const waitingChip = 'inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-900 dark:bg-primary-900/40 dark:text-primary-100';
export const restingChip = 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100';
export const groupTitle = 'text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300';
// Pie de tarjeta sin botón, alineado con «Comprar».
export const statusLine = 'mt-3 flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold';
export const statusTone = {
  neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
  waiting: 'bg-primary-50 text-primary-900 dark:bg-primary-900/40 dark:text-primary-100',
  resting: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
} as const;
export const goalButton = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-bold transition-colors';
export const goalButtonOff = 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';
export const goalButtonOn = 'border-amber-700 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-100';

/** La rareza se lee sin color: 1, 2 o 3 gemas además del nombre. */
export const RARITY_GEMS: Record<ItemRarity, number> = { COMMON: 1, RARE: 2, LEGENDARY: 3 };

export const gold = (n: number) => `${n.toLocaleString('es')} de oro`;

/** Qué puede gastar ahora: con aprobación, lo que ya espera a tu profe no se puede volver a pedir. */
export const spendableGold = (view: Pick<StudentShopView, 'gold' | 'pendingGold'>) => Math.max(0, view.gold - view.pendingGold);

const inStock = (item: StudentShopItem) => item.stock === null || item.stock > 0;

/** «Ya te alcanza» (lo más caro primero), «Ahorra para…» (lo que menos falta primero) y «Agotados por ahora». */
export const groupPrizes = (items: StudentShopItem[], spendable: number) => ({
  affordable: items.filter((item) => inStock(item) && item.price <= spendable).sort((a, b) => b.price - a.price),
  saving: items.filter((item) => inStock(item) && item.price > spendable).sort((a, b) => a.price - b.price),
  soldOut: items.filter((item) => !inStock(item)),
});

export type ShopGoal =
  | { kind: 'chosen'; item: StudentShopItem; reached: boolean }
  /** Su meta es una prenda de «Mi personaje» (hay una sola meta para premios y prendas). */
  | { kind: 'avatar'; item: StudentAvatarGoal; reached: boolean }
  | { kind: 'nearest'; item: StudentShopItem }
  | { kind: 'gone' }
  | null;

/**
 * La meta de «Tu oro»: la que eligió el alumno (un premio o una prenda); si no eligió, el premio con stock al
 * que menos le falta. Si su meta ya no está a la venta, se le avisa para que elija otra.
 */
export const nextShopGoal = (view: Pick<StudentShopView, 'items' | 'goalItemId' | 'goalKind' | 'avatarGoal'>, spendable: number): ShopGoal => {
  if (view.goalKind === 'AVATAR') {
    return view.avatarGoal ? { kind: 'avatar', item: view.avatarGoal, reached: view.avatarGoal.price <= spendable } : { kind: 'gone' };
  }
  if (view.goalItemId) {
    const chosen = view.items.find((item) => item.id === view.goalItemId);
    if (!chosen || !inStock(chosen)) return { kind: 'gone' };
    return { kind: 'chosen', item: chosen, reached: chosen.price <= spendable };
  }
  const nearest = groupPrizes(view.items, spendable).saving[0];
  return nearest ? { kind: 'nearest', item: nearest } : null;
};

export interface PrizeContext {
  enabled: boolean;
  paused: boolean;
  spendable: number;
  /** Ya hizo hoy las compras que permite su profe. */
  limitReached: boolean;
}

export type PrizeState = 'closed' | 'soldOut' | 'paused' | 'missing' | 'limit' | 'buy';

/** Un solo estado por tarjeta; si se cumplen varios, gana el primero de esta lista. */
export const prizeState = (item: StudentShopItem, ctx: PrizeContext): PrizeState => {
  if (!ctx.enabled) return 'closed';
  if (!inStock(item)) return 'soldOut';
  if (ctx.paused) return 'paused';
  if (item.price > ctx.spendable) return 'missing';
  if (ctx.limitReached) return 'limit';
  return 'buy';
};

/** De dónde salió un premio, en palabras del alumno. */
export const originText = (origin: { kind: PurchaseType; from: string | null }) => {
  switch (origin.kind) {
    case 'SELF': return 'Lo compraste';
    case 'GIFT': return origin.from ? `Regalo de ${origin.from}` : 'Te lo regalaron';
    case 'TEACHER': return 'Te lo dio tu profe';
    case 'REDEEM': return 'Lo canjeaste con tu profe';
    case 'REWARD': return 'Premio por tu racha';
  }
};

/** «3 oct» (fechas cortas en español). */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** «hoy», «ayer», «el lunes» (esta semana) o «el 3 oct». */
export const whenText = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `el ${date.toLocaleDateString('es', { weekday: 'long' })}`;
  return `el ${shortDate(iso)}`;
};

export const myShopKey = (profileId: string) => ['my-shop', profileId] as const;
