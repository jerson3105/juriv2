import { Link } from 'react-router-dom';
import { Coins, Gift, Lock, Moon, RotateCcw, Target, Undo2, X } from 'lucide-react';
import type { StudentAvatarItem, StudentAvatarView } from '../../../lib/avatarApi';
import { cancelButton, primaryButton } from '../../home/homeHelpers';
import { cardLink, cardTitle } from '../../student/home/studentHomeHelpers';
import { SavingsBar } from '../../student/shop/ShopBits';
import { goalButton, goalButtonOff, goalButtonOn } from '../../student/shop/shopStudentHelpers';
import { AnimatedAvatar } from '../AnimatedAvatar';
import { BODY_LABEL, PRENDA_RARITY, SLOT_SEQUENCE, gold } from '../avatarHelpers';
import { isForSale, isGiftable, listNames, spendableOf } from './closetHelpers';
import type { Closet } from './useCloset';

interface ClosetMirrorProps {
  view: StudentAvatarView;
  closet: Closet;
  onBuy: (item: StudentAvatarItem) => void;
  onGift: (item: StudentAvatarItem) => void;
  onChangeBody: () => void;
}

const goalLabel = 'text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300';
const statusText = 'flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-100';
// En celular, cada parte del espejo es una tarjeta; en escritorio, todo va en un solo panel.
const mobileCard = 'max-md:rounded-3xl max-md:border max-md:border-gray-200 max-md:bg-white max-md:p-3 max-md:shadow-sm max-md:dark:border-gray-700 max-md:dark:bg-gray-800';

// Cortina fucsia del estreno y del cambio de cuerpo: cierra, se cambia detrás y abre (solo transform).
const Curtain = () => (
  <span className="pointer-events-none absolute inset-0 z-50 flex overflow-hidden" aria-hidden="true">
    <span className="closet-curtain-left h-full w-1/2 bg-[repeating-linear-gradient(90deg,#a21caf_0_10px,#86198f_10px_20px)]" />
    <span className="closet-curtain-right h-full w-1/2 bg-[repeating-linear-gradient(90deg,#86198f_0_10px,#a21caf_10px_20px)]" />
  </span>
);

/**
 * El espejo de «Mi personaje»: el personaje en la noche del Inicio con lo puesto o lo que se prueba, el oro,
 * lo que pasó (región viva) y la acción que toca: comprar, elegir de regalo, ahorrar, volver o deshacer.
 * Escritorio: el panel entero queda fijo (con tope de alto). Celular: solo el espejo queda fijo arriba,
 * con la acción de la última prenda que se prueba.
 */
export const ClosetMirror = ({ view, closet, onBuy, onGift, onChangeBody }: ClosetMirrorProps) => {
  const { young, shop } = view;
  const spendable = spendableOf(view);
  const trying = [...closet.tryOn.values()].reverse();
  const latest = trying[0];
  const idleNow = trying.length === 0;
  const goal = view.goal;
  const goalItem = goal?.kind === 'AVATAR' ? view.items.find((item) => item.id === goal.itemId && isForSale(item, view)) : undefined;
  const figure = young
    ? 'h-[224px] w-32 md:h-[min(280px,36vh)] md:w-auto md:aspect-[4/7]'
    : 'h-[182px] w-[104px] md:h-[min(336px,36vh)] md:w-auto md:aspect-[4/7]';
  const withBackground = closet.layers.some((layer) => layer.slot === 'BACKGROUND');
  // El lector lee el espejo como una imagen: lo puesto (sin lo «de siempre») y lo que se prueba.
  const wornNames = SLOT_SEQUENCE.map((slot) => closet.worn(slot)).filter((item) => item && !item.isDefault).map((item) => `«${item!.name}»`);
  const mirrorLabel = [
    wornNames.length ? `Tu personaje con ${listNames(wornNames)}` : 'Tu personaje',
    trying.length ? `probándote ${listNames(trying.map((item) => `«${item.name}»`))}` : null,
  ].filter(Boolean).join(', ');

  const idle = young
    ? 'Toca una prenda para probártela.'
    : shop.reason === 'AVATAR_OFF'
      ? 'Toca una prenda tuya para ponértela.'
      : shop.reason === 'SHOP_CLOSED'
        ? 'Puedes probarte la ropa de la tienda, pero ahora no se compra.'
        : shop.reason === 'RESTING'
          ? 'Puedes vestirte con lo tuyo y probarte la ropa de la tienda.'
          : 'Toca una prenda: si es tuya, te la pones; si es de la tienda, te la pruebas.';

  // Mientras se prueba algo, el panel muestra solo eso (en una PC de 1366×768 todo debe caber).
  const goalBlock = !!goalItem && !young && idleNow;
  const prizeGoal = goal?.kind === 'ITEM' && !young && idleNow ? goal : null;
  const undoBlock = idleNow ? closet.undo : null;
  const bodyRow = view.canChangeBody && idleNow;

  const isGoal = (item: StudentAvatarItem) => goal?.kind === 'AVATAR' && goal.itemId === item.id;
  const missingFor = (item: StudentAvatarItem) => Math.max(0, (item.price ?? 0) - spendable);

  const closedReason = shop.reason === 'RESTING'
    ? <p className={statusText}><Moon size={16} className="flex-shrink-0" aria-hidden="true" />En pausa mientras descansas</p>
    : <p className={statusText}><Lock size={16} className="flex-shrink-0" aria-hidden="true" />La tienda está cerrada. Tu oro se guarda.</p>;

  const goalToggle = (item: StudentAvatarItem, compact = false) => (
    <button
      type="button"
      onClick={() => void closet.toggleGoal(item)}
      aria-pressed={isGoal(item)}
      className={`${goalButton} ${isGoal(item) ? goalButtonOn : goalButtonOff} w-full ${compact ? 'px-2' : ''}`}
    >
      <Target size={16} aria-hidden="true" />
      {isGoal(item) ? 'Es tu meta' : compact ? 'Ahorrar' : 'Ahorrar para esta prenda'}
    </button>
  );

  const buyButton = (item: StudentAvatarItem, compact = false) => (
    <button
      type="button"
      onClick={() => onBuy(item)}
      aria-haspopup="dialog"
      aria-label={`Comprar «${item.name}» por ${gold(item.price ?? 0)}`}
      className={`${primaryButton} w-full ${compact ? 'px-2' : young ? 'min-h-[56px] text-base' : ''}`}
    >
      Comprar
    </button>
  );

  const giftButton = (item: StudentAvatarItem, compact = false) => (
    <button
      type="button"
      onClick={() => onGift(item)}
      aria-haspopup="dialog"
      className={`${primaryButton} w-full ${compact ? 'px-2' : young ? 'min-h-[56px] text-base' : ''}`}
    >
      <Gift size={compact ? 16 : 18} aria-hidden="true" />
      Elegir de regalo
    </button>
  );

  // Escritorio: una fila por prenda que se prueba, con su acción y una ✕ para quitársela.
  const tryRow = (item: StudentAvatarItem) => {
    const giftable = isGiftable(item, view);
    const missing = missingFor(item);
    return (
      <li key={item.id} className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-300 dark:bg-amber-900/20 dark:ring-amber-700">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="break-words text-sm font-bold text-gray-900 dark:text-white">{item.name}</p>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              {[young ? null : PRENDA_RARITY[item.rarity], giftable ? 'Gratis: puede ser tu regalo' : gold(item.price ?? 0)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => closet.stopTrying(item)}
            aria-label={`Quitarte «${item.name}»`}
            className="-mr-1.5 -mt-1.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-amber-100 dark:text-gray-200 dark:hover:bg-amber-900/40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {!shop.open ? (
          <>
            {closedReason}
            {!young && goalToggle(item)}
          </>
        ) : giftable ? giftButton(item) : missing === 0 ? buyButton(item) : (
          <>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Te faltan {gold(missing)}</p>
            <SavingsBar have={spendable} price={item.price ?? 0} label={`Oro para «${item.name}»`} />
            {!young && goalToggle(item)}
            {!young && !isGoal(item) && goal?.kind === 'ITEM' && (
              <p className="text-xs text-gray-700 dark:text-gray-300">Reemplaza tu meta «{goal.name}».</p>
            )}
          </>
        )}
      </li>
    );
  };

  // Celular: la acción de la última prenda que se prueba, junto al espejo.
  const compactAction = (item: StudentAvatarItem) => {
    const missing = missingFor(item);
    if (!shop.open) {
      return <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{shop.reason === 'RESTING' ? 'En pausa mientras descansas' : 'La tienda está cerrada'}</p>;
    }
    if (isGiftable(item, view)) return giftButton(item, true);
    if (missing === 0) return buyButton(item, true);
    return (
      <>
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">Te faltan {gold(missing)}</p>
        {!young && goalToggle(item, true)}
      </>
    );
  };

  return (
    // Celular: el contenedor desaparece (contents) y cada parte es su propia tarjeta.
    <div className="contents rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:top-[4.5rem] md:block md:[@media(min-height:600px)]:sticky md:[@media(min-height:600px)]:max-h-[calc(100vh-5.5rem)] md:[@media(min-height:600px)]:overflow-y-auto">
      <section
        aria-labelledby="mirror-title"
        aria-busy={closet.saving || closet.bodyBusy}
        className={`top-14 z-20 ${mobileCard} max-md:[@media(min-height:600px)]:sticky`}
      >
        <div className="flex gap-3 md:block">
          {/* Espejo: arco de madera con la noche del Inicio (estrellas quietas) */}
          <div className="flex-shrink-0">
            <div className="obs-sky relative mx-auto flex w-fit justify-center overflow-hidden rounded-t-[10rem] px-3 pb-4 pt-7 ring-4 ring-amber-800/70 dark:ring-amber-600/60 md:px-6 md:pt-8">
              <span
                className="pointer-events-none absolute inset-x-2 bottom-[6%] top-[10%] rounded-full"
                style={{ background: 'radial-gradient(closest-side, rgba(224,231,255,0.38), rgba(224,231,255,0.1) 62%, transparent)' }}
                aria-hidden="true"
              />
              <div className={`relative ${idleNow ? '' : 'rounded-xl outline-dashed outline-2 outline-offset-4 outline-amber-400'}`}>
                <AnimatedAvatar
                  gender={view.profile.gender}
                  layers={closet.layers}
                  className={`${figure} ${withBackground ? 'overflow-hidden rounded-xl' : ''}`}
                  label={mirrorLabel}
                  animate={!closet.reduced}
                />
              </div>
              <span className="pointer-events-none absolute bottom-2 left-1/2 h-3 w-[70%] -translate-x-1/2 rounded-[50%] bg-indigo-200/30 shadow-[0_0_18px_rgba(165,180,252,0.45)]" aria-hidden="true" />
              {!idleNow && (
                <span className="absolute left-1/2 top-2 z-[45] -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-950 shadow">
                  Probándote
                </span>
              )}
              {closet.curtain > 0 && <Curtain key={closet.curtain} />}
            </div>
            <div className="mx-auto h-2.5 w-[92%] rounded-b-lg bg-amber-800 dark:bg-amber-700" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1 md:mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="mirror-title" className={cardTitle}>Así te ves</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                <Coins size={16} aria-hidden="true" />
                {gold(view.profile.gold)}
              </span>
            </div>
            {view.profile.pendingGold > 0 && shop.reason !== 'AVATAR_OFF' && (
              <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                {gold(view.profile.pendingGold)} esperan a tu profe en la Tienda; para ropa tienes {gold(spendable)}.
              </p>
            )}
            {/* Mientras se prueba algo, en escritorio la fila de la prenda ya lo dice: el aviso queda para el lector. */}
            <p role="status" className={`mt-1 min-h-[2.5rem] break-words text-sm text-gray-700 dark:text-gray-300 ${idleNow ? '' : 'md:sr-only'}`}>
              {closet.message || idle}
            </p>
            {closet.alert && (
              <p role="alert" className="mt-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-100">
                {closet.alert}
              </p>
            )}
            {latest && (
              <div className="mt-2 space-y-2 md:hidden">
                {compactAction(latest)}
                <button
                  type="button"
                  onClick={closet.clearTryOn}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Como estaba
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {!idleNow && (
        <div className="mt-3 hidden space-y-2 md:block">
          <ul className="space-y-2">{trying.map(tryRow)}</ul>
          {trying.length > 1 && (
            <button type="button" onClick={closet.clearTryOn} className={`${cancelButton} inline-flex w-full items-center justify-center gap-2 border border-gray-300 dark:border-gray-600`}>
              <RotateCcw size={16} aria-hidden="true" />
              Volver a como estaba
            </button>
          )}
        </div>
      )}

      {(goalBlock || prizeGoal || undoBlock || bodyRow) && (
        <div className={`space-y-2 ${mobileCard} md:mt-3`}>
          {goalBlock && goalItem && (
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
              <p className={goalLabel}>Tu meta</p>
              <p className="mt-1 break-words text-sm font-bold text-gray-900 dark:text-white">
                {missingFor(goalItem) > 0 ? `Te faltan ${gold(missingFor(goalItem))} para «${goalItem.name}»` : `¡Ya te alcanza «${goalItem.name}»!`}
              </p>
              {missingFor(goalItem) > 0 && (
                <div className="mt-2"><SavingsBar have={spendable} price={goalItem.price ?? 0} label={`Oro para «${goalItem.name}»`} /></div>
              )}
              <button type="button" onClick={() => closet.select(goalItem)} className={cardLink}>Probármela</button>
            </div>
          )}
          {prizeGoal && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Tu meta: «{prizeGoal.name}» en la <Link to="/my-shop" className="font-semibold text-primary-700 underline dark:text-primary-300">Tienda</Link>.
            </p>
          )}
          {undoBlock && (
            <button type="button" onClick={closet.undoLast} className={`${cancelButton} inline-flex w-full items-center justify-start gap-2 border border-gray-300 text-left dark:border-gray-600`}>
              <Undo2 size={16} className="flex-shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                Deshacer
                <span className="block truncate text-xs font-normal text-gray-700 dark:text-gray-300">{undoBlock.label}</span>
              </span>
            </button>
          )}
          {bodyRow && (
            <p className={`flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-300 ${goalBlock || prizeGoal || undoBlock ? 'md:border-t md:border-gray-200 md:pt-2 md:dark:border-gray-700' : ''}`}>
              <span>Cuerpo: <strong className="text-gray-900 dark:text-white">{BODY_LABEL[view.profile.gender]}</strong></span>
              <button type="button" onClick={onChangeBody} disabled={closet.saving || closet.bodyBusy} aria-haspopup="dialog" className={`${cardLink} disabled:opacity-60`}>
                Cambiar
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
