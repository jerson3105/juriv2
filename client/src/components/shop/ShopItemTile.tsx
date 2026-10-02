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
}

/**
 * Imagen o ícono de un premio en filas compactas, con el tinte de su rareza y respaldo si la imagen
 * no carga (nunca una imagen rota). Decorativa: el nombre del premio siempre va al lado en texto.
 */
export const ShopItemTile = ({ icon, imageUrl, category, rarity, size = 'md' }: ShopItemTileProps) => {
  const [broken, setBroken] = useState(false);
  const fallback = icon || CATEGORY_CONFIG[category]?.icon || '🎁';

  return (
    <span aria-hidden="true" className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b ${SHOP_RARITY_STYLE[rarity].window} ${SIZES[size]}`}>
      {imageUrl && !broken ? (
        <img src={shopImageUrl(imageUrl)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="leading-none">{fallback}</span>
      )}
    </span>
  );
};
