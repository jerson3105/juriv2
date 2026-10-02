import { Backpack, Ban, Check, Gem, Gift, Target } from 'lucide-react';
import { avatarImageUrl, type ItemRarity, type StudentAvatarItem } from '../../../lib/avatarApi';
import { SHOP_RARITY_STYLE } from '../../shop/shopHelpers';
import { PriceTag } from '../../shop/ShopDisplay';
import { noteChip } from '../../student/grades/gradesHelpers';
import { RARITY_GEMS, rarityChip } from '../../student/shop/shopStudentHelpers';
import { PRENDA_RARITY, gold } from '../avatarHelpers';
import { preloadLayer } from './closetHelpers';

/** Rareza de la prenda con su nombre y 1 a 3 gemas: se entiende sin color. */
export const PrendaRarity = ({ rarity }: { rarity: ItemRarity }) => (
  <span className={`${rarityChip} ${SHOP_RARITY_STYLE[rarity].chip}`}>
    <span className="flex" aria-hidden="true">
      {Array.from({ length: RARITY_GEMS[rarity] }, (_, index) => <Gem key={index} size={12} />)}
    </span>
    {PRENDA_RARITY[rarity]}
  </span>
);

export const giftChip = 'inline-flex items-center gap-1 rounded-full bg-fuchsia-700 px-2.5 py-1 text-sm font-bold text-white';
const seal = 'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shadow-sm';
// «Puesta»: anillo azul y sello; «Probándote»: contorno punteado ámbar y chip. Nunca solo color.
const wornRing = 'ring-2 ring-primary-600 ring-offset-2 ring-offset-stone-50 dark:ring-primary-300 dark:ring-offset-gray-900';
const tryingOutline = 'outline-dashed outline-2 outline-offset-2 outline-amber-400';
const cardBase = 'group relative flex h-full w-full flex-col rounded-2xl border-2 bg-white text-left shadow-sm transition-[transform,box-shadow] hover:shadow-lg motion-safe:hover:-translate-y-1 dark:bg-gray-800';

// Gancho de percha (en «Ropa»): cuelga de la barra.
const Hanger = () => (
  <span className="pointer-events-none absolute -top-3 left-1/2 h-4 w-6 -translate-x-1/2 rounded-t-full border-2 border-b-0 border-gray-500 dark:border-gray-400" aria-hidden="true" />
);

interface ClosetCardProps {
  item: StudentAvatarItem;
  worn: boolean;
  trying: boolean;
  forSale: boolean;
  /** Común y con el regalo disponible: es gratis. */
  giftable: boolean;
  /** Oro que le falta (0 si le alcanza). */
  missing: number;
  isGoal: boolean;
  hanger: boolean;
  young: boolean;
  onSelect: () => void;
}

/** Una prenda del clóset: toda la tarjeta es el botón (probar o poner); las acciones están en el espejo. */
export const ClosetCard = ({ item, worn, trying, forSale, giftable, missing, isGoal, hanger, young, onSelect }: ClosetCardProps) => {
  const style = SHOP_RARITY_STYLE[item.rarity];
  const retired = item.owned && !item.isDefault && !item.inShop;
  const state = [
    worn ? 'puesta' : trying ? 'te la estás probando' : null,
    item.isDefault ? 'de siempre' : item.owned ? 'es tuya' : null,
    !item.isDefault ? PRENDA_RARITY[item.rarity].toLowerCase() : null,
    forSale ? (giftable ? 'gratis: puede ser tu regalo' : gold(item.price!)) : null,
    forSale && !giftable && missing > 0 ? `te faltan ${gold(missing)}` : null,
    isGoal ? 'es tu meta' : null,
    item.isNew && !item.isDefault ? 'nueva' : null,
  ].filter(Boolean).join(', ');
  const preload = () => { void preloadLayer(item.imagePath); };

  return (
    <li className={hanger ? 'pt-3' : undefined}>
      <button
        type="button"
        data-closet-item={item.id}
        onClick={onSelect}
        onPointerEnter={preload}
        onFocus={preload}
        aria-label={`${item.name}: ${state}`}
        className={`${cardBase} ${style.card} ${worn ? wornRing : ''} ${trying ? tryingOutline : ''}`}
      >
        {hanger && <Hanger />}
        <span className={`relative flex items-center justify-center overflow-hidden rounded-t-[14px] bg-gradient-to-b ${style.window} ${young ? 'h-32' : 'h-28'}`}>
          <img
            src={avatarImageUrl(item.imagePath, 'thumb')}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className={item.slot === 'BACKGROUND' ? 'h-full w-full object-cover' : `${young ? 'max-h-28' : 'max-h-24'} max-w-[85%] object-contain`}
          />
          {worn ? (
            <span className={`${seal} bg-primary-600 text-white`}><Check size={12} aria-hidden="true" />Puesta</span>
          ) : trying ? (
            <span className={`${seal} bg-amber-400 text-amber-950`}>Probándote</span>
          ) : null}
          {/* Con «Puesta» o «Probándote» no cabe en 150 px (el lector igual oye «nueva»). */}
          {item.isNew && !item.isDefault && !worn && !trying && (
            <span className="absolute right-2 top-2 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white shadow-sm">Nueva</span>
          )}
        </span>
        <span className="flex flex-1 flex-col items-start gap-1.5 p-3">
          {!young && !item.isDefault && <PrendaRarity rarity={item.rarity} />}
          <span className={`line-clamp-2 break-words font-bold leading-snug text-gray-900 dark:text-white ${young ? 'text-base' : 'text-[15px]'}`}>{item.name}</span>
          <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
            {item.isDefault ? (
              <span className={noteChip}>De siempre</span>
            ) : item.owned ? (
              <>
                <span className={noteChip}><Backpack size={12} aria-hidden="true" />Es tuya</span>
                {retired && <span className="text-xs text-gray-700 dark:text-gray-300">Ya no se vende</span>}
              </>
            ) : forSale ? (
              giftable ? (
                <span className={giftChip}><Gift size={14} aria-hidden="true" />Gratis</span>
              ) : (
                <PriceTag price={item.price!} large={young} />
              )
            ) : null}
            {isGoal && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900 ring-1 ring-amber-700/40 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-400/50">
                <Target size={12} aria-hidden="true" />Tu meta
              </span>
            )}
          </span>
          {forSale && !giftable && missing > 0 && (
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Te faltan {gold(missing)}</span>
          )}
        </span>
      </button>
    </li>
  );
};

interface NoneCardProps {
  label: string;
  worn: boolean;
  young: boolean;
  onSelect: () => void;
}

/** «Sin sombrero», «Manos libres»…: la primera tarjeta de las ranuras que se pueden dejar vacías. */
export const NoneCard = ({ label, worn, young, onSelect }: NoneCardProps) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${label}${worn ? ': así estás' : ''}`}
      className={`relative flex h-full w-full flex-col rounded-2xl border-2 border-dashed border-gray-400 bg-white/70 text-left transition-shadow hover:shadow-lg dark:border-gray-500 dark:bg-gray-800/60 ${worn ? wornRing : ''}`}
    >
      <span className={`relative flex items-center justify-center text-gray-500 dark:text-gray-400 ${young ? 'h-32' : 'h-28'}`} aria-hidden="true">
        <Ban size={36} />
        {worn && <span className={`${seal} bg-primary-600 text-white`}><Check size={12} />Así estás</span>}
      </span>
      <span className={`p-3 font-bold text-gray-900 dark:text-white ${young ? 'text-base' : 'text-[15px]'}`}>{label}</span>
    </button>
  </li>
);
