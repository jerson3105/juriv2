import { Backpack, Check, Clock3, Moon, PackageX, Target } from 'lucide-react';
import type { StudentShopItem } from '../../../lib/shopApi';
import { PriceTag, ShopAwning, ShopDisplay } from '../../shop/ShopDisplay';
import { SHOP_RARITY_STYLE } from '../../shop/shopHelpers';
import { primaryButton } from '../../home/homeHelpers';
import { noteChip } from '../grades/gradesHelpers';
import { cardText } from '../home/studentHomeHelpers';
import { KindChip, RarityChip, SavingsBar } from './ShopBits';
import { gold, goalButton, goalButtonOff, goalButtonOn, statusLine, statusTone, waitingChip, type PrizeState } from './shopStudentHelpers';

interface PrizeCardProps {
  item: StudentShopItem;
  state: PrizeState;
  spendable: number;
  isGoal: boolean;
  /** Elegir meta: no con la tienda cerrada (escaparate sin botones). */
  canChooseGoal: boolean;
  goalBusy: boolean;
  /** Pedidos suyos de este premio que esperan a su profe. */
  waiting: number;
  /** Lo que ya tiene: unidades por usar o, si es para siempre, que ya lo tiene. */
  owned: { available: number; forever: boolean } | null;
  onBuy: () => void;
  onToggleGoal: () => void;
}

/**
 * Un premio en la vitrina, con el aspecto de la tienda del profe (toldo, vitrina, etiqueta de precio y
 * borde de su rareza) y un solo estado en el pie: comprar, cuánto falta, agotado, en pausa o mañana.
 */
export const PrizeCard = ({ item, state, spendable, isGoal, canChooseGoal, goalBusy, waiting, owned, onBuy, onToggleGoal }: PrizeCardProps) => {
  const titleId = `prize-${item.id}`;
  const soldOut = state === 'soldOut';
  const lowStock = item.stock !== null && item.stock > 0 && item.stock <= 3;
  const missing = Math.max(0, item.price - spendable);
  const showSavings = state === 'missing' || (state === 'paused' && missing > 0);

  const goalToggle = canChooseGoal && missing > 0 && (
    <button
      type="button"
      onClick={onToggleGoal}
      disabled={goalBusy}
      aria-pressed={isGoal}
      className={`${goalButton} ${isGoal ? goalButtonOn : goalButtonOff} mt-3 w-full disabled:cursor-wait`}
    >
      {isGoal ? <Check size={16} aria-hidden="true" /> : <Target size={16} aria-hidden="true" />}
      Elegir como meta
    </button>
  );

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className={`group flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-lg motion-safe:hover:-translate-y-1 dark:bg-gray-800 ${SHOP_RARITY_STYLE[item.rarity].card}`}
      >
        <ShopAwning />

        <div className="relative p-3 pb-0">
          <ShopDisplay item={item} soldOut={soldOut} />
          <span className="absolute left-5 top-5"><RarityChip rarity={item.rarity} /></span>
          {soldOut ? (
            <span aria-hidden="true" className="absolute right-5 top-5 -rotate-6 rounded-md border-2 border-red-700 bg-white/90 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-red-700 dark:border-red-400 dark:bg-gray-900/90 dark:text-red-300">
              Agotado
            </span>
          ) : lowStock && (
            <span className="absolute right-5 top-5 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-gray-900 shadow-sm dark:bg-gray-900/90 dark:text-white">
              Quedan {item.stock}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
          <div className="flex items-start justify-between gap-2">
            <h3 id={titleId} className="break-words text-base font-bold leading-5 text-gray-900 dark:text-white">{item.name}</h3>
            <PriceTag price={item.price} />
          </div>
          {item.description && <p className={`${cardText} mt-1.5 line-clamp-2`}>{item.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <KindChip category={item.category} />
            {owned && (owned.forever || owned.available > 0) && (
              <span className={noteChip}><Backpack size={12} aria-hidden="true" />{owned.forever ? 'Ya lo tienes' : `Tienes ${owned.available}`}</span>
            )}
            {isGoal && <span className={noteChip}><Target size={12} aria-hidden="true" />Tu meta</span>}
            {waiting > 0 && <span className={waitingChip}><Clock3 size={12} aria-hidden="true" />Esperando a tu profe</span>}
          </div>

          <div className="mt-auto">
            {showSavings && (
              <div className="mt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Te faltan {gold(missing)}</p>
                  <p className={`${cardText} tabular-nums`}>{spendable.toLocaleString('es')} de {item.price.toLocaleString('es')}</p>
                </div>
                <div className="mt-1.5">
                  <SavingsBar have={spendable} price={item.price} label={`Oro para «${item.name}»`} />
                </div>
              </div>
            )}

            {state === 'buy' && (
              <button
                type="button"
                onClick={onBuy}
                aria-haspopup="dialog"
                aria-label={`Comprar «${item.name}» por ${gold(item.price)}`}
                className={`${primaryButton} mt-3 w-full`}
              >
                Comprar
              </button>
            )}
            {state === 'limit' && (
              <p className={`${statusLine} ${statusTone.neutral}`}><Clock3 size={16} aria-hidden="true" />Mañana puedes comprar otra vez</p>
            )}
            {soldOut && (
              <p className={`${statusLine} ${statusTone.neutral}`}><PackageX size={16} aria-hidden="true" />Agotado por ahora</p>
            )}
            {state === 'paused' && (
              <p className={`${statusLine} ${statusTone.resting}`}><Moon size={16} aria-hidden="true" />En pausa mientras descansas</p>
            )}
            {(state === 'missing' || state === 'paused') && goalToggle}
          </div>
        </div>
      </article>
    </li>
  );
};
