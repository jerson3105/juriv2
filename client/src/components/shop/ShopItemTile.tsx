import { useState } from 'react';
import { CATEGORY_CONFIG, shopImageUrl, type ItemCategory, type ItemRarity } from '../../lib/shopApi';
import { SHOP_RARITY_STYLE } from './shopHelpers';

const SIZES = {
  sm: 'h-11 w-11 text-2xl',
  md: 'h-14 w-14 text-3xl',
  lg: 'h-16 w-16 text-4xl',
} as const;

interface ShopItemTileProps {
  icon: string | null;
  imageUrl: string | null;
  category: ItemCategory;
  rarity: ItemRarity;
  size?: keyof typeof SIZES;
  /** Con el tinte estático de su rareza; sin él, neutra. */
  tinted?: boolean;
  /** Festejo de compra: el ícono hace un «pop» una sola vez (con menos movimiento queda quieto). */
  pop?: boolean;
}

/**
 * Imagen o ícono de un premio, con respaldo si la imagen no carga (nunca una imagen rota).
 * Decorativa: el nombre del premio siempre va al lado en texto.
 */
export const ShopItemTile = ({ icon, imageUrl, category, rarity, size = 'md', tinted = true, pop = false }: ShopItemTileProps) => {
  const [broken, setBroken] = useState(false);
  const fallback = icon || CATEGORY_CONFIG[category]?.icon || '🎁';
  const tint = tinted
    ? `bg-gradient-to-b ${SHOP_RARITY_STYLE[rarity].window}`
    : 'bg-gray-50 ring-1 ring-gray-200 dark:bg-gray-900/40 dark:ring-gray-700';

  return (
    <span aria-hidden="true" className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-xl ${SIZES[size]} ${tint}`}>
      {imageUrl && !broken ? (
        <img
          src={shopImageUrl(imageUrl)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className={`h-full w-full object-cover ${pop ? 'celebrate-pop' : ''}`}
        />
      ) : (
        <span className={`leading-none ${pop ? 'celebrate-pop' : ''}`}>{fallback}</span>
      )}
    </span>
  );
};
