import type { ItemRarity, ShopItem } from '../../lib/shopApi';

export const SHOP_RARITY_ORDER: ItemRarity[] = ['COMMON', 'RARE', 'LEGENDARY'];

// Estilos estáticos por rareza (Tailwind no ve clases armadas dinámicamente).
export const SHOP_RARITY_STYLE: Record<ItemRarity, {
  label: string;
  chip: string;
  card: string;
  window: string;
  rays: string | null;
  sparkles: boolean;
}> = {
  COMMON: {
    label: 'Común',
    chip: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
    card: 'border-slate-200 dark:border-slate-700',
    window: 'from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900',
    rays: null,
    sparkles: false,
  },
  RARE: {
    label: 'Raro',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100',
    card: 'border-blue-200 dark:border-blue-900',
    window: 'from-sky-100 to-blue-50 dark:from-blue-950 dark:to-slate-900',
    rays: null,
    sparkles: true,
  },
  LEGENDARY: {
    label: 'Legendario',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
    card: 'border-amber-300 dark:border-amber-800',
    window: 'from-amber-100 to-yellow-50 dark:from-amber-950 dark:to-slate-900',
    rays: 'repeating-conic-gradient(from 0deg, rgba(251,191,36,0.45) 0deg 12deg, transparent 12deg 30deg)',
    sparkles: true,
  },
};

// Precio sugerido al elegir rareza (el profesor puede cambiarlo).
export const PRICE_PRESETS: Record<ItemRarity, number> = { COMMON: 25, RARE: 75, LEGENDARY: 200 };
export const PRICE_CHIPS = [10, 25, 50, 100, 200];

export const shopInventoryKey = (classroomId: string) => ['shop-inventory', classroomId] as const;

export const ITEM_EXAMPLES: { icon: string; name: string; description: string; category: ShopItem['category']; rarity: ItemRarity; price: number }[] = [
  { icon: '💺', name: 'Elegir asiento', description: 'Elige dónde sentarte por un día', category: 'CONSUMABLE', rarity: 'COMMON', price: 25 },
  { icon: '🎵', name: 'DJ por un día', description: 'Elige la música de fondo durante el trabajo', category: 'CONSUMABLE', rarity: 'COMMON', price: 30 },
  { icon: '📝', name: 'Entregar tarde', description: 'Entrega una tarea con 1 día de retraso sin penalización', category: 'CONSUMABLE', rarity: 'RARE', price: 75 },
  { icon: '⏰', name: '+5 min en examen', description: '5 minutos extra en cualquier evaluación', category: 'CONSUMABLE', rarity: 'RARE', price: 100 },
  { icon: '🛡️', name: 'Escudo protector', description: 'Tu profesor anula tu próxima pérdida de HP', category: 'CONSUMABLE', rarity: 'LEGENDARY', price: 150 },
  { icon: '⭐', name: 'Punto extra', description: '+1 punto en una tarea o examen', category: 'CONSUMABLE', rarity: 'LEGENDARY', price: 200 },
];
