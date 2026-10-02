import { avatarImageUrl, type AvatarSlot, type StudentAvatarItem, type StudentAvatarView, type StudentEquipped } from '../../../lib/avatarApi';
import { gold } from '../avatarHelpers';

// «Mi personaje»: zonas del clóset, estados de cada prenda y utilidades del espejo.

/** Lo que muestra una ranura del espejo (puesto o probándose). */
export interface SlotItem {
  id: string;
  name: string;
  imagePath: string;
  layerOrder: number;
  isDefault: boolean;
}

export type ZoneKey = 'head' | 'clothes' | 'shoes' | 'extras' | 'backgrounds';

export interface ClosetGroup {
  key: string;
  label: string;
  slots: AvatarSlot[];
  /** Tarjeta para no llevar nada (solo en ranuras opcionales sin prenda «de siempre»). */
  none?: string;
}

export interface ClosetZone {
  key: ZoneKey;
  label: string;
  /** Palabra corta para los pequeños. */
  short: string;
  emoji: string;
  groups: ClosetGroup[];
}

// El mueble sigue al cuerpo, de la repisa alta al zapatero. Las dos manos van juntas: la mano izquierda
// del personaje sale a la derecha de la pantalla y «izquierda/derecha» confunde.
export const ZONES: ClosetZone[] = [
  {
    key: 'head', label: 'Cabeza', short: 'Cabeza', emoji: '🧢',
    groups: [
      { key: 'HAIR', label: 'Peinados', slots: ['HAIR'] },
      { key: 'HEAD', label: 'Sombreros', slots: ['HEAD'], none: 'Sin sombrero' },
      { key: 'EYES', label: 'Ojos y lentes', slots: ['EYES'], none: 'Sin lentes' },
    ],
  },
  {
    key: 'clothes', label: 'Ropa', short: 'Ropa', emoji: '👕',
    groups: [
      { key: 'TOP', label: 'Parte de arriba', slots: ['TOP'] },
      { key: 'BOTTOM', label: 'Parte de abajo', slots: ['BOTTOM'] },
    ],
  },
  { key: 'shoes', label: 'Zapatos', short: 'Zapatos', emoji: '👟', groups: [{ key: 'SHOES', label: 'Zapatos', slots: ['SHOES'] }] },
  {
    key: 'extras', label: 'Accesorios', short: 'Cosas', emoji: '🎒',
    groups: [
      { key: 'HANDS', label: 'En las manos', slots: ['LEFT_HAND', 'RIGHT_HAND'], none: 'Manos libres' },
      { key: 'BACK', label: 'En la espalda', slots: ['BACK'], none: 'Nada en la espalda' },
      { key: 'FLAG', label: 'Banderas', slots: ['FLAG'], none: 'Sin bandera' },
    ],
  },
  { key: 'backgrounds', label: 'Fondos', short: 'Fondos', emoji: '🖼️', groups: [{ key: 'BACKGROUND', label: 'Fondos', slots: ['BACKGROUND'], none: 'Sin fondo' }] },
];

export const zoneOfSlot = (slot: AvatarSlot) => ZONES.find((zone) => zone.groups.some((group) => group.slots.includes(slot)))!;

/** Altura del destello (en % del dibujo de 395×959) según la ranura; los fondos solo se funden. */
export const SPARKLE_Y: Partial<Record<AvatarSlot, number>> = {
  HAIR: 8, HEAD: 8, EYES: 13, FLAG: 22, BACK: 33, TOP: 35, LEFT_HAND: 50, RIGHT_HAND: 50, BOTTOM: 60, SHOES: 93,
};

export type ClosetFilter = 'all' | 'mine' | 'shop';
export const FILTERS: { value: ClosetFilter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'mine', label: 'Lo mío' },
  { value: 'shop', label: 'Para comprar' },
];

export const toSlotItem = (item: StudentAvatarItem | StudentEquipped): SlotItem => ({
  id: 'itemId' in item ? item.itemId : item.id,
  name: item.name,
  imagePath: item.imagePath,
  layerOrder: item.layerOrder,
  isDefault: item.isDefault,
});

/** Oro que puede gastar: lo que espera a su profe en la Tienda no se puede gastar en ropa. */
export const spendableOf = (view: StudentAvatarView) => Math.max(0, view.profile.gold - view.profile.pendingGold);

/** Se vende y aún no es suya (con la tienda de prendas apagada no se muestra: solo lo suyo). */
export const isForSale = (item: StudentAvatarItem, view: StudentAvatarView) =>
  item.inShop && !item.owned && item.price !== null && view.shop.reason !== 'AVATAR_OFF';

/** Puede elegirla de regalo: común, a la venta y con la tienda abierta. */
export const isGiftable = (item: StudentAvatarItem, view: StudentAvatarView) =>
  view.giftAvailable && view.shop.open && item.rarity === 'COMMON' && isForSale(item, view);

/** Cada grupo en orden fijo: «de siempre», lo suyo (por nombre) y la tienda (por precio). */
export const groupItems = (items: StudentAvatarItem[], group: ClosetGroup, view: StudentAvatarView, filter: ClosetFilter) => {
  const inGroup = items.filter((item) => group.slots.includes(item.slot));
  const defaults = inGroup.filter((item) => item.isDefault);
  const mine = inGroup.filter((item) => !item.isDefault && item.owned).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const shop = inGroup.filter((item) => isForSale(item, view)).sort((a, b) => a.price! - b.price! || a.name.localeCompare(b.name, 'es'));
  const showNone = !!group.none && defaults.length === 0;
  if (filter === 'shop') return { none: false, items: shop };
  if (filter === 'mine') return { none: showNone, items: [...defaults, ...mine] };
  return { none: showNone, items: [...defaults, ...mine, ...shop] };
};

/** Un toque en una prenda: la suya se pone; la de la tienda se prueba. */
export const priceText = (item: StudentAvatarItem, view: StudentAvatarView) => {
  if (isGiftable(item, view)) return 'Gratis: puede ser tu regalo';
  const missing = (item.price ?? 0) - spendableOf(view);
  return missing > 0 ? `Cuesta ${gold(item.price!)}. Te faltan ${gold(missing)}` : `Cuesta ${gold(item.price!)}`;
};

// Capas ya decodificadas: el cambio no deja un instante la ranura vacía.
const decoded = new Set<string>();

/** Precarga y decodifica la capa del espejo (como mucho `max` ms; si tarda más, se cambia igual). */
export const preloadLayer = (imagePath: string, max = 300): Promise<void> => {
  const url = avatarImageUrl(imagePath, 'md');
  if (decoded.has(url)) return Promise.resolve();
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  const done = image.decode().then(() => { decoded.add(url); }).catch(() => undefined);
  return Promise.race([done, new Promise<void>((resolve) => { window.setTimeout(resolve, max); })]);
};

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** «Gorra roja», «Gorra roja y Botas», «Gorra roja, Botas y Capa». */
export const listNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
