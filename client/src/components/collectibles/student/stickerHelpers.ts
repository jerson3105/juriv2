import type { StickerView, StudentAlbumView, StudentCollectiblesView } from '../../../lib/collectibleApi';
import { CARD_RARITY_STYLE } from '../collectibleHelpers';

// «Coleccionables» del alumno: páginas del álbum, textos y estado del kiosco.

export const myCollectiblesKey = (profileId: string) => ['my-collectibles', profileId] as const;

/** Casillas por página: 6 (3 × 2); en inicial a 2.º, 4 más grandes (2 × 2). */
export const slotsPerPage = (young: boolean) => (young ? 4 : 6);

export type BookPage =
  | { kind: 'cover' }
  | { kind: 'cards'; number: number; cards: StickerView[] }
  | { kind: 'end' }
  | { kind: 'blank' };

/** Portada, las páginas de figuritas y el final; a doble página, una hoja en blanco si quedan impares. */
export const buildPages = (cards: StickerView[], perPage: number, double: boolean): BookPage[] => {
  const sorted = [...cards].sort((a, b) => a.slotNumber - b.slotNumber);
  const pages: BookPage[] = [{ kind: 'cover' }];
  for (let index = 0; index < sorted.length; index += perPage) {
    pages.push({ kind: 'cards', number: pages.length, cards: sorted.slice(index, index + perPage) });
  }
  pages.push({ kind: 'end' });
  if (double && pages.length % 2 === 1) pages.push({ kind: 'blank' });
  return pages;
};

/** La hoja (índice de página) donde va una figurita. */
export const pageOfCard = (cards: StickerView[], cardId: string, perPage: number) => {
  const index = [...cards].sort((a, b) => a.slotNumber - b.slotNumber).findIndex((card) => card.id === cardId);
  return index < 0 ? 0 : 1 + Math.floor(index / perPage);
};

const rarityName = (card: Pick<StickerView, 'rarity'>) => CARD_RARITY_STYLE[card.rarity].label.toLowerCase();

/** Lo que lee el lector de pantalla en cada casilla: «14, Tiranosaurio, legendaria, tienes 2, brillante, nueva». */
export const stickerLabel = (card: StickerView, young: boolean) => {
  if (!card.owned) return `${card.slotNumber}, ${card.name}, ${rarityName(card)}, te falta`;
  return [
    card.slotNumber,
    card.name,
    rarityName(card),
    !young && card.count > 1 ? `tienes ${card.count}` : null,
    card.shiny ? 'brillante' : null,
    card.isNew ? 'nueva' : null,
  ].filter(Boolean).join(', ');
};

export const percentOf = (album: Pick<StudentAlbumView, 'owned' | 'totalCards'>) =>
  album.totalCards > 0 ? Math.round((album.owned / album.totalCards) * 100) : 0;

/** «Una insignia «Leyenda» y 20 de oro» (sin XP: lo comprado no sube de nivel). */
export const rewardsText = (album: Pick<StudentAlbumView, 'rewards'>) => {
  const parts = [
    album.rewards.badge ? `la insignia «${album.rewards.badge.name}»` : null,
    album.rewards.gp > 0 ? `${album.rewards.gp.toLocaleString('es')} de oro` : null,
    album.rewards.hp > 0 ? `${album.rewards.hp} de energía` : null,
  ].filter((part): part is string => !!part);
  return parts.length <= 1 ? (parts[0] ?? null) : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
};

export const completedDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long' });

export const spendableOf = (view: Pick<StudentCollectiblesView, 'profile'>) => Math.max(0, view.profile.gold - view.profile.pendingGold);

export type KioskState =
  | { kind: 'archived' }
  | { kind: 'complete' }
  | { kind: 'closed' }
  | { kind: 'resting' }
  | { kind: 'ready'; welcome: boolean; pack: 'buy' | 'missing' | 'limit' | null };

/** Un solo estado para el kiosco del álbum; si se cumplen varios, gana el primero. */
export const kioskStateOf = (view: StudentCollectiblesView, album: StudentAlbumView): KioskState => {
  if (!album.isActive) return { kind: 'archived' };
  if (album.completedAt || album.missing === 0) return { kind: 'complete' };
  if (view.kiosk.reason === 'SHOP_CLOSED') return { kind: 'closed' };
  if (view.kiosk.reason === 'RESTING') return { kind: 'resting' };
  const pack = !album.pack ? null
    : view.daily.left <= 0 ? 'limit'
      : album.pack.price > spendableOf(view) ? 'missing'
        : 'buy';
  return { kind: 'ready', welcome: !!album.welcome, pack };
};

/** Recordar la última página que miró de cada álbum (en este equipo; si no se puede, empieza en la portada). */
const pageKey = (profileId: string, albumId: string) => `collectibles-page-${profileId}-${albumId}`;
export const readSavedPage = (profileId: string, albumId: string) => {
  try {
    const value = Number(localStorage.getItem(pageKey(profileId, albumId)));
    return Number.isInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};
export const savePage = (profileId: string, albumId: string, page: number) => {
  try {
    localStorage.setItem(pageKey(profileId, albumId), String(page));
  } catch {
    // Sin almacenamiento: la próxima vez abre en la portada.
  }
};
