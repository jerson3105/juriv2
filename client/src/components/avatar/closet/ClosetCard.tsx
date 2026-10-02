import { Backpack, Ban, Check, Coins, Gem, Gift, Target } from 'lucide-react';
import { avatarImageUrl, type ItemRarity, type StudentAvatarItem } from '../../../lib/avatarApi';
import { SHOP_RARITY_STYLE } from '../../shop/shopHelpers';
import { RARITY_GEMS } from '../../student/shop/shopStudentHelpers';
import { PRENDA_RARITY, gold } from '../avatarHelpers';
import { preloadLayer } from './closetHelpers';

// Tarjeta compacta (≈120×140 px, 5 por fila en una PC de 1366): la prenda, su nombre en una línea y su
// precio. La rareza va en gemas en la esquina (el nombre de la rareza, en la etiqueta para el lector).
// «Puesta»: anillo azul y sello; «Probándote»: contorno punteado ámbar y sello. Nunca solo color.
const wornRing = 'ring-2 ring-primary-600 ring-offset-2 ring-offset-stone-50 dark:ring-primary-300 dark:ring-offset-gray-900';
const tryingOutline = 'outline-dashed outline-2 outline-offset-2 outline-amber-400';
const cardBase = 'group relative flex h-full w-full flex-col rounded-xl border-2 bg-white text-left shadow-sm transition-[transform,box-shadow] hover:shadow-md motion-safe:hover:-translate-y-0.5 dark:bg-gray-800';
const seal = 'absolute bottom-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-px text-xs font-bold shadow-sm';
const chip = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold';
const ownChip = `${chip} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100`;

/** Rareza en 1 a 3 gemas (el nombre va en la etiqueta accesible de la tarjeta). */
const Gems = ({ rarity }: { rarity: ItemRarity }) => (
  <span className={`absolute left-1 top-1 inline-flex items-center rounded-full px-1 py-0.5 ${SHOP_RARITY_STYLE[rarity].chip}`} aria-hidden="true">
    {Array.from({ length: RARITY_GEMS[rarity] }, (_, index) => <Gem key={index} size={10} />)}
  </span>
);

// Etiqueta de precio pequeña, como la de la Tienda (agujero de cuerda y vaivén al pasar el ratón).
const MiniPrice = ({ price, large }: { price: number; large: boolean }) => (
  <span className={`shop-swing relative inline-flex items-center gap-1 rounded-md bg-amber-400 py-0.5 pl-3 pr-1.5 font-black text-amber-950 shadow-sm ring-1 ring-amber-500/60 ${large ? 'text-base' : 'text-sm'}`}>
    <span className="absolute left-1 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-amber-950/40" aria-hidden="true" />
    <Coins size={large ? 15 : 13} aria-hidden="true" />
    {price}
  </span>
);

// Gancho de percha (en «Ropa»): cuelga de la barra.
const Hanger = () => (
  <span className="pointer-events-none absolute -top-2.5 left-1/2 h-3 w-5 -translate-x-1/2 rounded-t-full border-2 border-b-0 border-gray-500 dark:border-gray-400" aria-hidden="true" />
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
    retired ? 'ya no se vende' : null,
    !item.isDefault ? PRENDA_RARITY[item.rarity].toLowerCase() : null,
    forSale ? (giftable ? 'gratis: puede ser tu regalo' : gold(item.price!)) : null,
    forSale && !giftable && missing > 0 ? `te faltan ${gold(missing)}` : null,
    isGoal ? 'es tu meta' : null,
    item.isNew && !item.isDefault ? 'nueva' : null,
  ].filter(Boolean).join(', ');
  const preload = () => { void preloadLayer(item.imagePath); };

  return (
    <li className={hanger ? 'pt-2.5' : undefined}>
      <button
        type="button"
        data-closet-item={item.id}
        onClick={onSelect}
        onPointerEnter={preload}
        onFocus={preload}
        title={item.name}
        aria-label={`${item.name}: ${state}`}
        className={`${cardBase} ${style.card} ${worn ? wornRing : ''} ${trying ? tryingOutline : ''}`}
      >
        {hanger && <Hanger />}
        <span className={`relative flex items-center justify-center overflow-hidden rounded-t-[10px] bg-gradient-to-b ${style.window} ${young ? 'h-24' : 'h-20'}`}>
          <img
            src={avatarImageUrl(item.imagePath, 'thumb')}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className={item.slot === 'BACKGROUND' ? 'h-full w-full object-cover' : `${young ? 'max-h-20' : 'max-h-[68px]'} max-w-[80%] object-contain`}
          />
          {/* Los pequeños ven la rareza solo en el borde. */}
          {!young && !item.isDefault && <Gems rarity={item.rarity} />}
          {isGoal && (
            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-700/50 dark:bg-amber-900 dark:text-amber-100" aria-hidden="true">
              <Target size={12} />
            </span>
          )}
          {worn ? (
            <span className={`${seal} bg-primary-600 text-white`}><Check size={11} aria-hidden="true" />Puesta</span>
          ) : trying ? (
            <span className={`${seal} bg-amber-400 text-amber-950`}>Probándote</span>
          ) : item.isNew && !item.isDefault ? (
            <span className={`${seal} bg-emerald-700 text-white`}>Nueva</span>
          ) : null}
        </span>
        <span className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-1.5">
          <span className={`truncate font-bold leading-snug text-gray-900 dark:text-white ${young ? 'text-base' : 'text-sm'}`}>{item.name}</span>
          <span className="mt-auto flex items-center">
            {item.isDefault ? (
              <span className={ownChip}>De siempre</span>
            ) : item.owned ? (
              <span className={ownChip}><Backpack size={11} aria-hidden="true" />Es tuya</span>
            ) : forSale ? (
              giftable ? (
                <span className={`${chip} bg-fuchsia-700 text-white`}><Gift size={12} aria-hidden="true" />Gratis</span>
              ) : (
                <MiniPrice price={item.price!} large={young} />
              )
            ) : null}
          </span>
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
      title={label}
      aria-label={`${label}${worn ? ': así estás' : ''}`}
      className={`relative flex h-full w-full flex-col rounded-xl border-2 border-dashed border-gray-400 bg-white/70 text-left transition-shadow hover:shadow-md dark:border-gray-500 dark:bg-gray-800/60 ${worn ? wornRing : ''}`}
    >
      <span className={`relative flex items-center justify-center text-gray-500 dark:text-gray-400 ${young ? 'h-24' : 'h-20'}`} aria-hidden="true">
        <Ban size={28} />
        {worn && <span className={`${seal} bg-primary-600 text-white`}><Check size={11} />Así estás</span>}
      </span>
      <span className={`line-clamp-2 px-2 pb-2 pt-1.5 font-bold leading-snug text-gray-900 dark:text-white ${young ? 'text-base' : 'text-sm'}`}>{label}</span>
    </button>
  </li>
);
