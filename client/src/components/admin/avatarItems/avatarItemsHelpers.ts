import type { AvatarGender, AvatarSlot, ItemRarity } from '../../../lib/avatarApi';
import type { AdminAvatarItem, AvatarItemStatus } from '../../../lib/adminAvatarItemsApi';
import { SLOT_NAMES, SLOT_SEQUENCE } from '../../avatar/avatarHelpers';

export { SLOT_NAMES, SLOT_SEQUENCE };

export const BODY_NAME: Record<AvatarGender, string> = { MALE: 'Chico', FEMALE: 'Chica' };
export const otherBody = (gender: AvatarGender): AvatarGender => (gender === 'MALE' ? 'FEMALE' : 'MALE');

export const RARITY_NAME: Record<ItemRarity, string> = { COMMON: 'Común', RARE: 'Rara', LEGENDARY: 'Legendaria' };
export const RARITY_SEQUENCE: ItemRarity[] = ['COMMON', 'RARE', 'LEGENDARY'];
/** Chips de rareza con contraste AA en claro y oscuro. */
export const RARITY_CHIP: Record<ItemRarity, string> = {
  COMMON: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
  RARE: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100',
  LEGENDARY: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
};

export const STATUS_NAME: Record<AvatarItemStatus, string> = { DRAFT: 'Borrador', PUBLISHED: 'Publicada', RETIRED: 'Retirada' };
export const STATUS_CHIP: Record<AvatarItemStatus, string> = {
  DRAFT: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
  RETIRED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
};

/** Una prenda = sus versiones (una por cuerpo); sin par, una sola. */
export interface Garment {
  key: string;
  slot: AvatarSlot;
  versions: Partial<Record<AvatarGender, AdminAvatarItem>>;
  /** La versión que da nombre y rareza (la publicada, si hay). */
  main: AdminAvatarItem;
}

const STATUS_RANK: Record<AvatarItemStatus, number> = { PUBLISHED: 0, DRAFT: 1, RETIRED: 2 };

export const groupGarments = (items: AdminAvatarItem[]): Garment[] => {
  const byKey = new Map<string, AdminAvatarItem[]>();
  items.forEach((item) => {
    const key = item.pairKey ?? `solo:${item.id}`;
    byKey.set(key, [...(byKey.get(key) ?? []), item]);
  });
  return [...byKey.entries()].map(([key, versions]) => {
    const sorted = [...versions].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
    return {
      key,
      slot: sorted[0].slot,
      versions: Object.fromEntries(versions.map((item) => [item.gender, item])) as Garment['versions'],
      main: sorted[0],
    };
  });
};

export const garmentStatuses = (garment: Garment) =>
  [...new Set(Object.values(garment.versions).filter(Boolean).map((item) => item!.status))];

/** Prendas a la venta por ranura y cuerpo (lo que ve el alumno). */
export const coverage = (items: AdminAvatarItem[]) => {
  const counts = new Map<AvatarSlot, Record<AvatarGender, number>>();
  SLOT_SEQUENCE.forEach((slot) => counts.set(slot, { MALE: 0, FEMALE: 0 }));
  items.forEach((item) => {
    if (item.status === 'PUBLISHED') counts.get(item.slot)![item.gender] += 1;
  });
  return counts;
};

export const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/** Ruta del editor «Completa». */
export const completaPath = (params: { slot?: AvatarSlot; gender?: AvatarGender; pair?: string }) => {
  const search = new URLSearchParams();
  if (params.slot) search.set('ranura', params.slot);
  if (params.gender) search.set('cuerpo', params.gender);
  if (params.pair) search.set('par', params.pair);
  const query = search.toString();
  return `/admin/avatar-items/nueva${query ? `?${query}` : ''}`;
};
