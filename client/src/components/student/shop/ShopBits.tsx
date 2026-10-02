import { Gem, Infinity as InfinityIcon, Ticket } from 'lucide-react';
import type { ItemCategory, ItemRarity } from '../../../lib/shopApi';
import { SHOP_RARITY_STYLE } from '../../shop/shopHelpers';
import { noteChip } from '../grades/gradesHelpers';
import { RARITY_GEMS, rarityChip, savingsFill, savingsTrack } from './shopStudentHelpers';

/** Rareza con su nombre y 1 a 3 gemas: se entiende sin color. */
export const RarityChip = ({ rarity }: { rarity: ItemRarity }) => (
  <span className={`${rarityChip} ${SHOP_RARITY_STYLE[rarity].chip}`}>
    <span className="flex" aria-hidden="true">
      {Array.from({ length: RARITY_GEMS[rarity] }, (_, index) => <Gem key={index} size={12} />)}
    </span>
    {SHOP_RARITY_STYLE[rarity].label}
  </span>
);

/** «Se usa una vez» o «Para siempre» (las palabras del docente son «Consumible» y «Permanente»). */
export const KindChip = ({ category }: { category: ItemCategory }) =>
  category === 'CONSUMABLE' ? (
    <span className={noteChip}><Ticket size={12} aria-hidden="true" />Se usa una vez</span>
  ) : (
    <span className={noteChip}><InfinityIcon size={12} aria-hidden="true" />Para siempre</span>
  );

/** Barra de ahorro dorada: se pinta con su ancho final (nada se anima solo). */
export const SavingsBar = ({ have, price, label }: { have: number; price: number; label: string }) => {
  const now = Math.min(have, price);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={price}
      aria-valuenow={now}
      aria-valuetext={`${now.toLocaleString('es')} de ${price.toLocaleString('es')}`}
      className={savingsTrack}
    >
      <div className={savingsFill} style={{ width: `${price > 0 ? Math.round((now / price) * 100) : 100}%` }} />
    </div>
  );
};
