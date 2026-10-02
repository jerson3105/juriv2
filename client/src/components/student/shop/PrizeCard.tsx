import { Backpack, Check, Clock3, Moon, PackageX, Target } from 'lucide-react';
import type { StudentShopItem } from '../../../lib/shopApi';
import { ShopItemTile } from '../../shop/ShopItemTile';
import { primaryButton } from '../../home/homeHelpers';
import { noteChip } from '../grades/gradesHelpers';
import { cardText, homeCard } from '../home/studentHomeHelpers';
import { GoldChip, KindChip, RarityChip, SavingsBar } from './ShopBits';
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

/** Un premio: nombre, rareza, tipo, precio y un solo estado en el pie (nunca se apaga la tarjeta). */
export const PrizeCard = ({ item, state, spendable, isGoal, canChooseGoal, goalBusy, waiting, owned, onBuy, onToggleGoal }: PrizeCardProps) => {
  const titleId = `prize-${item.id}`;
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
      <article aria-labelledby={titleId} className={`${homeCard} flex h-full flex-col`}>
        <div className="flex gap-3">
          <ShopItemTile icon={item.icon} imageUrl={item.imageUrl} category={item.category} rarity={item.rarity} />
          <div className="min-w-0">
            <h3 id={titleId} className="break-words text-base font-bold text-gray-900 dark:text-white">{item.name}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <RarityChip rarity={item.rarity} />
              <KindChip category={item.category} />
            </div>
          </div>
        </div>
        {item.description && <p className={`${cardText} mt-2 line-clamp-3`}>{item.description}</p>}

        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <GoldChip amount={item.price} />
            {owned && (owned.forever || owned.available > 0) && (
              <span className={noteChip}><Backpack size={12} aria-hidden="true" />{owned.forever ? 'Ya lo tienes' : `Tienes ${owned.available}`}</span>
            )}
            {lowStock && <span className={noteChip}>Quedan {item.stock}</span>}
            {isGoal && <span className={noteChip}><Target size={12} aria-hidden="true" />Tu meta</span>}
            {waiting > 0 && (
              <span className={waitingChip}><Clock3 size={12} aria-hidden="true" />Esperando a tu profe</span>
            )}
          </div>

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
          {state === 'soldOut' && (
            <p className={`${statusLine} ${statusTone.neutral}`}><PackageX size={16} aria-hidden="true" />Agotado por ahora</p>
          )}
          {state === 'paused' && (
            <p className={`${statusLine} ${statusTone.resting}`}><Moon size={16} aria-hidden="true" />En pausa mientras descansas</p>
          )}
          {(state === 'missing' || state === 'paused') && goalToggle}
        </div>
      </article>
    </li>
  );
};
