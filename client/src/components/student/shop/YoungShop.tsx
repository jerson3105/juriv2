import { useState } from 'react';
import { Check, Moon, PackageX, PiggyBank, Target } from 'lucide-react';
import type { StudentShopItem, StudentShopView } from '../../../lib/shopApi';
import { ShopItemTile } from '../../shop/ShopItemTile';
import { cardText, cardTitle, homeCard, rowButton } from '../home/studentHomeHelpers';
import { GoldChip, SavingsBar } from './ShopBits';
import { gold, goalButton, goalButtonOff, goalButtonOn, goldTile, statusLine, statusTone, type ShopGoal } from './shopStudentHelpers';

const FIRST = 6;

interface YoungShopProps {
  view: StudentShopView;
  spendable: number;
  goal: ShopGoal;
  goalBusy: boolean;
  onToggleGoal: (item: StudentShopItem) => void;
}

/**
 * Tienda de los pequeños (inicial a 2.º): una alcancía hacia su meta y pocos premios grandes, uno por
 * fila. Sin rareza ni regalos; el canje lo hace su profe en clase («Muéstrale a tu profe»).
 */
export const YoungShop = ({ view, spendable, goal, goalBusy, onToggleGoal }: YoungShopProps) => {
  const [showAll, setShowAll] = useState(false);
  const { shop } = view;
  const prizes = [...view.items].sort((a, b) => a.price - b.price);
  const visible = showAll ? prizes : prizes.slice(0, FIRST);
  const target = goal && goal.kind !== 'gone' ? goal.item : null;

  return (
    <div className="space-y-5">
      <section aria-labelledby="piggy-title" className={homeCard}>
        <h2 id="piggy-title" className={cardTitle}>Tu alcancía</h2>
        <div className="mt-2 flex items-center gap-3">
          <span className={goldTile}><PiggyBank size={24} aria-hidden="true" /></span>
          <p>
            <span className="text-3xl font-black tabular-nums text-gray-900 dark:text-white">{view.gold.toLocaleString('es')}</span>{' '}
            <span className="text-lg font-bold text-gray-700 dark:text-gray-300">de oro</span>
          </p>
        </div>
        {target && (
          <div className="mt-3">
            <p className="text-base font-bold text-gray-900 dark:text-white">
              {target.price <= spendable ? `¡Ya te alcanza para «${target.name}»!` : `Te faltan ${gold(target.price - spendable)} para «${target.name}»`}
            </p>
            <div className="mt-2"><SavingsBar have={spendable} price={target.price} label={`Oro para «${target.name}»`} /></div>
          </div>
        )}
        <p className={`${cardText} mt-3`}>Ganas oro cuando participas y ayudas en clase.</p>
      </section>

      {prizes.length > 0 && (
        <section aria-labelledby="young-prizes-title">
          <h2 id="young-prizes-title" className={cardTitle}>Premios</h2>
          <ul className="mt-2 space-y-3">
            {visible.map((item) => {
              const soldOut = item.stock !== null && item.stock <= 0;
              const reached = item.price <= spendable;
              const isGoal = view.goalItemId === item.id;
              return (
                <li key={item.id}>
                  <article aria-labelledby={`young-${item.id}`} className={`${homeCard} flex flex-wrap items-center gap-4`}>
                    <ShopItemTile icon={item.icon} imageUrl={item.imageUrl} category={item.category} rarity={item.rarity} size="lg" tinted={false} />
                    <div className="min-w-0 flex-1">
                      <h3 id={`young-${item.id}`} className="break-words text-lg font-bold text-gray-900 dark:text-white">{item.name}</h3>
                      <div className="mt-1"><GoldChip amount={item.price} /></div>
                      {shop.enabled && !soldOut && !shop.paused && !reached && (
                        <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">Te faltan {gold(item.price - spendable)}</p>
                      )}
                    </div>
                    {shop.enabled && (
                      <div className="w-full sm:w-auto">
                        {soldOut ? (
                          <p className={`${statusLine} !mt-0 ${statusTone.neutral}`}><PackageX size={16} aria-hidden="true" />Agotado por ahora</p>
                        ) : shop.paused ? (
                          <p className={`${statusLine} !mt-0 ${statusTone.resting}`}><Moon size={16} aria-hidden="true" />En pausa mientras descansas</p>
                        ) : reached ? (
                          <p className={`${statusLine} !mt-0 ${statusTone.neutral}`}><Check size={16} aria-hidden="true" />¡Te alcanza! Muéstrale a tu profe</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onToggleGoal(item)}
                            disabled={goalBusy}
                            aria-pressed={isGoal}
                            className={`${goalButton} ${isGoal ? goalButtonOn : goalButtonOff} w-full disabled:cursor-wait`}
                          >
                            {isGoal ? <Check size={16} aria-hidden="true" /> : <Target size={16} aria-hidden="true" />}
                            Elegir como meta
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
          {prizes.length > FIRST && (
            <button type="button" onClick={() => setShowAll((value) => !value)} className={`${rowButton} mt-3`}>
              {showAll ? 'Ver menos premios' : `Ver ${prizes.length - FIRST} premios más`}
            </button>
          )}
        </section>
      )}
    </div>
  );
};
