import type { AvatarGender, AvatarPriceLevel, AvatarSlot, ItemRarity } from '../../lib/avatarApi';

// Textos y claves comunes del avatar (tienda del profe y «Mi avatar»).

export const avatarCatalogKey = (classroomId: string) => ['avatar-catalog', classroomId] as const;
export const myAvatarKey = (profileId: string) => ['my-avatar', profileId] as const;

/** Rareza de una prenda (femenino: «prenda rara»). */
export const PRENDA_RARITY: Record<ItemRarity, string> = { COMMON: 'Común', RARE: 'Rara', LEGENDARY: 'Legendaria' };

export const BODY_LABEL: Record<AvatarGender, string> = { MALE: 'Chico', FEMALE: 'Chica' };

/** Ranuras con nombres para niños, en el orden en que se muestran. */
export const SLOT_NAMES: Record<AvatarSlot, string> = {
  HAIR: 'Peinados',
  HEAD: 'Sombreros',
  EYES: 'Ojos y lentes',
  TOP: 'Parte de arriba',
  BOTTOM: 'Parte de abajo',
  SHOES: 'Zapatos',
  LEFT_HAND: 'Mano izquierda',
  RIGHT_HAND: 'Mano derecha',
  BACK: 'Espalda',
  FLAG: 'Banderas',
  BACKGROUND: 'Fondos',
};
export const SLOT_SEQUENCE = Object.keys(SLOT_NAMES) as AvatarSlot[];

export const PRICE_LEVELS: { value: AvatarPriceLevel; label: string; hint: string }[] = [
  { value: 'LOW', label: 'Más barata', hint: 'la mitad' },
  { value: 'NORMAL', label: 'Normal', hint: '1, 3 y 6 semanas' },
  { value: 'HIGH', label: 'Más cara', hint: 'el doble' },
];

export const gold = (amount: number) => `${amount.toLocaleString('es')} de oro`;
