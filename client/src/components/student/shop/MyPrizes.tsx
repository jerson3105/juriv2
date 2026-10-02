import { forwardRef, useState } from 'react';
import { Check, Clock3, Infinity as InfinityIcon, Moon } from 'lucide-react';
import type { StudentShopOwned, StudentShopWaiting } from '../../../lib/shopApi';
import { ShopItemTile } from '../../shop/ShopItemTile';
import { noteChip } from '../grades/gradesHelpers';
import { cardText, cardTitle, homeCard, rowButton } from '../home/studentHomeHelpers';
import { gold, originText, restingChip, waitingChip, whenText } from './shopStudentHelpers';

const PAGE = 5;
const rowName = 'break-words text-sm font-bold text-gray-900 dark:text-white';

/** Lo que espera a su profe: compras, regalos que paga y usos pedidos. Solo aparece si hay algo. */
export const WaitingCard = ({ waiting, paused }: { waiting: StudentShopWaiting[]; paused: boolean }) => {
  const paysLater = waiting.some((entry) => entry.kind !== 'use');
  return (
    <section aria-labelledby="waiting-title" className={homeCard}>
      <h2 id="waiting-title" className={cardTitle}>Esperando a tu profe</h2>
      {paused && <p className={`${cardText} mt-1`}>Tus pedidos esperan a que vuelvas de tu descanso.</p>}
      <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-700">
        {waiting.map((entry) => (
          <li key={`${entry.kind}:${entry.id}`} className="flex items-center gap-3 py-3">
            <ShopItemTile icon={entry.icon} imageUrl={entry.imageUrl} category={entry.category} rarity={entry.rarity} size="sm" />
            <div className="min-w-0">
              <p className={rowName}>
                «{entry.name}»{entry.kind === 'gift' && entry.toName ? ` para ${entry.toName}` : ''}
              </p>
              <p className={cardText}>
                {entry.kind === 'purchase' && `Pediste comprarlo ${whenText(entry.at)} · ${gold(entry.price)}`}
                {entry.kind === 'gift' && `Regalo pedido ${whenText(entry.at)} · ${gold(entry.price)}`}
                {entry.kind === 'use' && `Pediste usarlo ${whenText(entry.at)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {paysLater && <p className={`${cardText} mt-1`}>El oro se descuenta cuando tu profe lo apruebe. Si no lo aprueba, no se descuenta nada.</p>}
    </section>
  );
};

/** Para usar → esperando → para siempre → usados; dentro de cada grupo, lo más reciente primero. */
const rank = (prize: StudentShopOwned) =>
  prize.consumable && prize.available > 0 ? 0 : prize.waitingUses > 0 ? 1 : !prize.consumable ? 2 : 3;

interface MyPrizesCardProps {
  mine: StudentShopOwned[];
  paused: boolean;
  /** Pequeños: el uso lo hace su profe en clase («Muéstrale a tu profe»). */
  young: boolean;
  onUse: (prize: StudentShopOwned) => void;
}

/** «Mis premios»: su colección, con de dónde salió cada premio y qué puede hacer con él. */
export const MyPrizesCard = forwardRef<HTMLHeadingElement, MyPrizesCardProps>(({ mine, paused, young, onUse }, titleRef) => {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...mine].sort((a, b) => rank(a) - rank(b) || b.lastAt.localeCompare(a.lastAt));
  const visible = showAll ? sorted : sorted.slice(0, PAGE);

  return (
    <section id="mis-premios" aria-labelledby="mine-title" className={`${homeCard} scroll-mt-20`}>
      <h2 id="mine-title" ref={titleRef} tabIndex={-1} className={`${cardTitle} outline-none`}>
        Mis premios · {mine.length}
      </h2>
      <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-700">
        {visible.map((prize) => {
          const canUse = prize.consumable && prize.available > 0 && !!prize.usePurchaseId;
          const origins = prize.origins.map(originText).join(' · ');
          return (
            <li key={prize.itemId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <ShopItemTile icon={prize.icon} imageUrl={prize.imageUrl} category={prize.category} rarity={prize.rarity} size="sm" />
                <div className="min-w-0">
                  <p className={rowName}>{prize.name}</p>
                  <p className={cardText}>
                    {prize.consumable && prize.available > 0 && `${prize.available === 1 ? 'Te queda 1' : `Te quedan ${prize.available}`} · `}
                    {origins} · {whenText(prize.lastAt)}
                  </p>
                  {prize.giftMessage && (
                    <p className="mt-1 w-fit rounded-lg bg-gray-50 px-2 py-1 text-sm italic text-gray-800 dark:bg-gray-900/40 dark:text-gray-100">
                      «{prize.giftMessage}»
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {prize.waitingUses > 0 && <span className={waitingChip}><Clock3 size={12} aria-hidden="true" />Esperando a tu profe</span>}
                {!prize.consumable && <span className={noteChip}><InfinityIcon size={12} aria-hidden="true" />Para siempre</span>}
                {prize.consumable && prize.available === 0 && prize.waitingUses === 0 && (
                  <span className={noteChip}><Check size={12} aria-hidden="true" />{prize.lastUsedAt ? `Lo usaste ${whenText(prize.lastUsedAt)}` : 'Usado'}</span>
                )}
                {canUse && young && <span className={noteChip}>Muéstrale a tu profe</span>}
                {canUse && !young && paused && (
                  <span className={restingChip}><Moon size={12} aria-hidden="true" />En pausa</span>
                )}
                {canUse && !young && !paused && (
                  <button
                    type="button"
                    onClick={() => onUse(prize)}
                    aria-haspopup="dialog"
                    aria-label={`Pedir usar «${prize.name}»`}
                    className={rowButton}
                  >
                    Pedir usar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {sorted.length > PAGE && (
        <button type="button" onClick={() => setShowAll((value) => !value)} className={`${rowButton} mt-2`}>
          {showAll ? 'Mostrar menos' : `Mostrar ${sorted.length - PAGE} más`}
        </button>
      )}
    </section>
  );
});
MyPrizesCard.displayName = 'MyPrizesCard';
