import { useState } from 'react';
import { Coins } from 'lucide-react';
import { shopImageUrl, CATEGORY_CONFIG, type ShopItem } from '../../lib/shopApi';
import { SHOP_RARITY_STYLE } from './shopHelpers';

type DisplayItem = Pick<ShopItem, 'icon' | 'imageUrl' | 'rarity' | 'category' | 'name'>;

interface ShopDisplayProps {
  item: DisplayItem;
  size?: 'sm' | 'md' | 'lg';
  soldOut?: boolean;
  animated?: boolean;
}

const SIZES = {
  sm: { box: 'h-20', item: 'h-12 w-12 text-3xl', pedestal: 'w-12' },
  md: { box: 'h-32', item: 'h-20 w-20 text-5xl', pedestal: 'w-20' },
  lg: { box: 'h-40', item: 'h-24 w-24 text-6xl', pedestal: 'w-24' },
};

// Vitrina: el artículo flota sobre un pedestal con su sombra; los legendarios tienen rayos de luz
// girando detrás y los raros destellos. Distinto del medallón de las insignias: aquí es un producto.
export const ShopDisplay = ({ item, size = 'md', soldOut = false, animated = true }: ShopDisplayProps) => {
  const style = SHOP_RARITY_STYLE[item.rarity];
  const dims = SIZES[size];
  const live = animated && !soldOut;
  // Imágenes antiguas (guardadas truncadas) no cargan: se muestra el icono.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!item.imageUrl && failedSrc !== item.imageUrl;

  return (
    <div className={`relative flex items-end justify-center overflow-hidden rounded-xl bg-gradient-to-b ${style.window} ${dims.box}`} aria-hidden="true">
      {style.rays && live && (
        // Centrado con inset (no con translate): la animación de giro reemplaza `transform`.
        <span className="shop-rays pointer-events-none absolute -inset-[60%]" style={{ background: style.rays }} />
      )}
      {style.sparkles && live && (
        <>
          <span className="badge-twinkle absolute left-[22%] top-3 text-sm text-amber-400">✦</span>
          <span className="badge-twinkle absolute right-[20%] top-6 text-xs text-sky-400 [animation-delay:0.8s]">✦</span>
          <span className="badge-twinkle absolute right-[30%] top-2 text-[10px] text-white [animation-delay:1.6s]">✦</span>
        </>
      )}
      <div className={`relative mb-3 flex flex-col items-center ${soldOut ? 'grayscale' : ''}`}>
        <div className={`${live ? 'shop-bob' : ''} relative flex items-center justify-center ${dims.item}`}>
          {showImage ? (
            <img src={shopImageUrl(item.imageUrl!)} alt="" onError={() => setFailedSrc(item.imageUrl)} className="h-full w-full rounded-xl object-cover shadow-lg" />
          ) : (
            <span className="leading-none drop-shadow-lg">{item.icon || CATEGORY_CONFIG[item.category]?.icon || '🎁'}</span>
          )}
        </div>
        {/* Pedestal con sombra que respira al ritmo de la flotación */}
        <span className={`${live ? 'shop-shadow' : ''} mt-1 h-2 rounded-full bg-black/30 blur-[2px] dark:bg-black/60 ${dims.pedestal}`} />
      </div>
    </div>
  );
};

// Etiqueta de precio con agujero de cuerda; se balancea al pasar el ratón por la tarjeta.
export const PriceTag = ({ price, large = false }: { price: number; large?: boolean }) => (
  <span className={`shop-swing relative inline-flex items-center gap-1.5 rounded-lg bg-amber-400 font-black text-amber-950 shadow-md ring-1 ring-amber-500/60 ${large ? 'py-1.5 pl-5 pr-3 text-lg' : 'py-1 pl-4 pr-2.5 text-base'}`}>
    <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-950/40" aria-hidden="true" />
    <Coins size={large ? 18 : 16} aria-hidden="true" />
    {price}
    <span className="text-xs font-bold">GP</span>
  </span>
);
