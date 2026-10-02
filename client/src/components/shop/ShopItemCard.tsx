import { motion } from 'framer-motion';
import { Copy, Gift, Pencil, Trash2 } from 'lucide-react';
import { CATEGORY_CONFIG, type ShopItem } from '../../lib/shopApi';
import { PriceTag, ShopAwning, ShopDisplay } from './ShopDisplay';
import { SHOP_RARITY_STYLE } from './shopHelpers';

interface ShopItemCardProps {
  item: ShopItem;
  index: number;
  sold: number;
  /** Estudiantes que lo eligieron como meta. */
  wanted: number;
  onGive: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const iconButton =
  'flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white';

// Producto en la vitrina de la tienda: precio a la vista, stock y cuántos se vendieron.
export const ShopItemCard = ({ item, index, sold, wanted, onGive, onEdit, onDuplicate, onDelete }: ShopItemCardProps) => {
  const style = SHOP_RARITY_STYLE[item.rarity];
  const soldOut = item.stock !== null && item.stock <= 0;
  const fewLeft = item.stock !== null && item.stock > 0 && item.stock <= 3;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.25, delay: Math.min(index, 12) * 0.03 }}
      whileHover={{ y: -4 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-shadow hover:shadow-lg dark:bg-gray-800 ${style.card}`}
    >
      <ShopAwning />

      <div className="relative p-3 pb-0">
        <ShopDisplay item={item} soldOut={soldOut} />
        <span className={`absolute left-5 top-5 rounded-full px-2.5 py-0.5 text-xs font-bold ${style.chip}`}>{style.label}</span>
        {soldOut && (
          <span className="absolute right-5 top-5 -rotate-6 rounded-md border-2 border-red-700 bg-white/90 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-red-700 dark:bg-gray-900/90 dark:text-red-300 dark:border-red-400">
            Agotado
          </span>
        )}
        {fewLeft && (
          <span className="absolute right-5 top-5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
            ¡Quedan {item.stock}!
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-5 text-gray-900 dark:text-white" title={item.name}>{item.name}</h3>
          <PriceTag price={item.price} />
        </div>
        {item.description && (
          <p className="mt-1.5 line-clamp-2 text-xs text-gray-700 dark:text-gray-300" title={item.description}>{item.description}</p>
        )}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-700 dark:text-gray-300">
          <span className="font-semibold">{CATEGORY_CONFIG[item.category].icon} {CATEGORY_CONFIG[item.category].label}</span>
          <span aria-hidden="true">·</span>
          <span>{item.stock === null ? 'Sin límite' : `${item.stock} en stock`}</span>
          <span aria-hidden="true">·</span>
          <span className={sold > 0 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'italic'}>
            {sold > 0 ? `${sold} ${sold === 1 ? 'vendido' : 'vendidos'}` : 'Sin ventas'}
          </span>
          {wanted > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100" title="Estudiantes que lo eligieron como meta">
                🎯 {wanted} {wanted === 1 ? 'lo quiere' : 'lo quieren'}
              </span>
            </>
          )}
        </p>

        <div className="mt-auto space-y-2 pt-3">
          <button
            type="button"
            onClick={onGive}
            disabled={soldOut}
            className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300"
          >
            <Gift size={16} aria-hidden="true" />
            Dar o canjear
          </button>
          <div className="flex justify-center gap-1">
            <button type="button" onClick={onEdit} aria-label={`Editar ${item.name}`} title="Editar" className={iconButton}>
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={onDuplicate} aria-label={`Duplicar ${item.name}`} title="Duplicar" className={iconButton}>
              <Copy size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Quitar de la tienda ${item.name}`}
              title="Quitar de la tienda"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </motion.li>
  );
};
