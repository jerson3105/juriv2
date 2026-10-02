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

export const shopInventoryKey = (classroomId: string) => ['shop-inventory', classroomId] as const;
export const shopEconomyKey = (classroomId: string) => ['shop-economy', classroomId] as const;

/** Sin datos de ingreso, el servidor calcula con 10 de oro por semana (DEFAULT_WEEKLY_GOLD). */
export const DEFAULT_WEEKLY_GOLD = 10;

/** Precio de «N semanas de oro» de la clase. */
export const weeksPrice = (weeks: number, weekly: number) => Math.max(1, Math.round(weeks * weekly));

/** «menos de una semana», «≈ 1 semana», «≈ 3 semanas». */
export const weeksText = (price: number, weekly: number) => {
  const weeks = price / Math.max(0.1, weekly);
  if (weeks < 0.75) return 'menos de una semana';
  const rounded = Math.max(1, Math.round(weeks));
  return `≈ ${rounded} ${rounded === 1 ? 'semana' : 'semanas'}`;
};

// Ideas con propósito: privilegios, responsabilidades y experiencias. Nada que cambie notas, plazos,
// XP o energía, ni golosinas. El precio sale de lo que gana la clase en una semana.
export const ITEM_EXAMPLES: { icon: string; name: string; description: string; category: ShopItem['category']; weeks: number }[] = [
  { icon: '💺', name: 'Elegir asiento', description: 'Elige dónde sentarte por un día', category: 'CONSUMABLE', weeks: 1 },
  { icon: '🎵', name: 'DJ por un día', description: 'Elige la música de fondo durante el trabajo', category: 'CONSUMABLE', weeks: 1.5 },
  { icon: '🎲', name: 'Elegir el juego', description: 'Elige el juego de los últimos minutos de clase', category: 'CONSUMABLE', weeks: 2 },
  { icon: '🧑‍🏫', name: 'Ayudante del profe', description: 'Sé el ayudante del profe por un día', category: 'CONSUMABLE', weeks: 3 },
  { icon: '📖', name: 'Elegir el cuento', description: 'Elige el cuento o la lectura de la semana', category: 'CONSUMABLE', weeks: 4 },
  { icon: '💌', name: 'Carta a tu familia', description: 'Tu profe le escribe a tu familia contando algo que hiciste bien', category: 'CONSUMABLE', weeks: 8 },
];

/**
 * Palabras de premios que mandan otro mensaje (notas, plazos, XP, energía o golosinas). Solo avisa:
 * el docente decide.
 */
export const OFF_MESSAGE_PATTERN = /\b(notas?|calificaci\w*|puntos? extra|ex[aá]men(es)?|evaluaci\w*|entreg\w* tarde|plazos?|xp|energ[ií]a|hp|escudo|dulces?|golosinas?|caramelos?|chocolates?|chicles?|snacks?|comida)\b/i;
