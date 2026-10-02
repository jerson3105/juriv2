import { ArrowDown, Clock3, Coins, Moon, ShoppingBag } from 'lucide-react';
import type { StudentShopView } from '../../../lib/shopApi';
import { primaryButton } from '../../home/homeHelpers';
import { cardLink, cardText, cardTitle, homeCard, plural } from '../home/studentHomeHelpers';
import { SavingsBar } from './ShopBits';
import { gold, goldTile, type ShopGoal } from './shopStudentHelpers';

interface GoldCardProps {
  view: StudentShopView;
  spendable: number;
  goal: ShopGoal;
  affordable: number;
  inStock: number;
  /** El premio de su meta se puede comprar ahora mismo. */
  canBuyGoal: boolean;
  goalBusy: boolean;
  onBuyGoal: () => void;
  onClearGoal: () => void;
  onShowMine: () => void;
}

const noteRow = 'flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300';
const goalLabel = 'text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300';
const clearButton = 'inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700';

/** «Tu oro»: cuánto tiene, qué le alcanza, su meta con la barra de ahorro y las reglas que aplican. */
export const GoldCard = ({ view, spendable, goal, affordable, inStock, canBuyGoal, goalBusy, onBuyGoal, onClearGoal, onShowMine }: GoldCardProps) => {
  const { shop } = view;
  const affordText = view.gold === 0
    ? 'Aún no tienes oro.'
    : inStock > 0 && affordable === inStock
      ? 'Te alcanza para todos los premios.'
      : affordable > 0
        ? `Te alcanza para ${plural(affordable, 'premio', 'premios')}.`
        : null;
  const limitReached = !!shop.dailyLimit && shop.boughtToday >= shop.dailyLimit;
  const ownedCount = view.mine.length;

  const progress = (price: number, name: string) => (
    <>
      <div className="mt-2">
        <SavingsBar have={spendable} price={price} label={`Oro para «${name}»`} />
      </div>
      <p className={`${cardText} mt-1 text-right tabular-nums`}>{Math.min(spendable, price).toLocaleString('es')} de {price.toLocaleString('es')}</p>
    </>
  );

  return (
    <section aria-labelledby="gold-title" className={`${homeCard} grid gap-5 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:items-start`}>
      <div>
        <h2 id="gold-title" className={cardTitle}>Tu oro</h2>
        <div className="mt-2 flex items-center gap-3">
          <span className={goldTile}><Coins size={22} aria-hidden="true" /></span>
          <p>
            <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{view.gold.toLocaleString('es')}</span>{' '}
            <span className="text-base font-bold text-gray-700 dark:text-gray-300">de oro</span>
          </p>
        </div>
        {affordText && <p className={`${cardText} mt-2`}>{affordText}</p>}

        <div className="mt-3 space-y-1.5">
          {view.pendingGold > 0 && (
            <p className={noteRow}>
              <Clock3 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {gold(view.pendingGold)} esperan a tu profe; para otros premios tienes {gold(spendable)}.
            </p>
          )}
          {shop.enabled && shop.requiresApproval && (
            <p className={noteRow}>
              <Clock3 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              Tu profe aprueba cada compra: el oro se descuenta cuando la apruebe.
            </p>
          )}
          {shop.enabled && shop.dailyLimit && (
            <p className={noteRow}>
              <ShoppingBag size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {limitReached
                ? 'Ya compraste hoy. Mañana puedes comprar otra vez.'
                : `Tu profe permite ${plural(shop.dailyLimit, 'compra', 'compras')} al día.`}
            </p>
          )}
          {shop.paused && (
            <p className={noteRow}>
              <Moon size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              Tu oro se guarda mientras descansas.
            </p>
          )}
        </div>

        <p className={`${cardText} mt-3`}>Ganas oro cuando participas y cumples en clase.</p>
        {ownedCount > 0 && (
          <button type="button" onClick={onShowMine} className={cardLink}>
            Ver mis premios ({ownedCount})
            <ArrowDown size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {goal && (
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
          {goal.kind === 'gone' ? (
            <>
              <p className={goalLabel}>Tu meta</p>
              <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">Tu meta ya no está a la venta</p>
              <p className={`${cardText} mt-1`}>Elige otra con «Elegir como meta» en un premio.</p>
              <button type="button" onClick={onClearGoal} disabled={goalBusy} className={`${clearButton} mt-2 -ml-3`}>Quitar meta</button>
            </>
          ) : goal.kind === 'chosen' && goal.reached ? (
            <>
              <p className={goalLabel}>Tu meta</p>
              <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">¡Ya te alcanza tu meta!</p>
              <p className={`${cardText} mt-1`}>«{goal.item.name}» · {gold(goal.item.price)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canBuyGoal && (
                  <button
                    type="button"
                    onClick={onBuyGoal}
                    aria-haspopup="dialog"
                    aria-label={`Comprar «${goal.item.name}» por ${gold(goal.item.price)}`}
                    className={primaryButton}
                  >
                    Comprar
                  </button>
                )}
                <button type="button" onClick={onClearGoal} disabled={goalBusy} className={clearButton}>Quitar meta</button>
              </div>
            </>
          ) : (
            <>
              <p className={goalLabel}>{goal.kind === 'chosen' ? 'Tu meta' : 'Lo más cerca'}</p>
              <p className="mt-1 text-base font-bold text-gray-900 dark:text-white">
                Te faltan {gold(goal.item.price - spendable)} para «{goal.item.name}»
              </p>
              {progress(goal.item.price, goal.item.name)}
              {goal.kind === 'chosen' ? (
                <button type="button" onClick={onClearGoal} disabled={goalBusy} className={`${clearButton} -ml-3`}>Quitar meta</button>
              ) : (
                <p className={`${cardText} mt-1`}>Elige un premio como tu meta y mira cuánto te falta.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};
