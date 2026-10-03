import type { AlbumPricing, CardRarity, CollectiblePriceLevel } from '../../lib/collectibleApi';
import { gold } from '../avatar/avatarHelpers';

export const CARD_RARITY_ORDER: CardRarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

// Estilos estáticos por rareza (Tailwind no ve clases armadas dinámicamente). La rareza solo cambia el marco:
// en los sobres todas las figuritas salen igual de seguido. Etiquetas en femenino («figurita rara»).
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
    label: 'Rara',
    frame: 'from-sky-400 via-blue-200 to-blue-600',
    art: 'from-sky-100 to-blue-300 dark:from-blue-950 dark:to-blue-800',
    chip: 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100',
    holo: false,
  },
  EPIC: {
    label: 'Épica',
    frame: 'from-fuchsia-400 via-purple-300 to-violet-600',
    art: 'from-fuchsia-100 to-violet-300 dark:from-purple-950 dark:to-violet-800',
    chip: 'bg-purple-100 text-purple-900 dark:bg-purple-900/60 dark:text-purple-100',
    holo: true,
  },
  LEGENDARY: {
    label: 'Legendaria',
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

export const pricingKey = (classroomId: string, cards: number) => ['collectible-pricing', classroomId, cards] as const;
export const boxLogKey = (albumId: string) => ['collectible-box', albumId] as const;

export { gold };

/** Nivel de precio del álbum (masculino: «sobre más barato»). */
export const PACK_PRICE_LEVELS: { value: CollectiblePriceLevel; label: string }[] = [
  { value: 'LOW', label: 'Más barato' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Más caro' },
];

const weeksText = (weeks: number) => `${weeks.toLocaleString('es', { maximumFractionDigits: 1 })} ${weeks === 1 ? 'semana' : 'semanas'}`;

/** Lo que cuesta completar el álbum según el servidor (en promedio, con el sobre de bienvenida y las repetidas). */
export const completeCostText = (pricing: AlbumPricing, cards: number) => {
  if (cards === 0) return 'Cuando el álbum tenga figuritas verás cuánto cuesta completarlo.';
  if (pricing.completeCost === 0) return `El sobre de bienvenida trae las ${cards} figuritas: completarlo no cuesta oro.`;
  return `Completarlo: ${cards} figuritas, unos ${gold(pricing.completeCost)} en promedio (≈ ${weeksText(pricing.completeWeeks)} de oro), con el sobre de bienvenida gratis.`;
};
