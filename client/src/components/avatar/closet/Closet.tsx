import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Gift, Lock, Shirt } from 'lucide-react';
import type { StudentAvatarItem, StudentAvatarView } from '../../../lib/avatarApi';
import { cardText, cardTitle, homeCard } from '../../student/home/studentHomeHelpers';
import type { EquippedItem } from '../AvatarRenderer';
import { ClosetMirror } from './ClosetMirror';
import { ClosetWardrobe } from './ClosetWardrobe';
import { BodyModal, BuyModal, GiftModal } from './ClosetModals';
import { isForSale, isGiftable, zoneOfSlot, type ClosetFilter, type ZoneKey } from './closetHelpers';
import { useCloset } from './useCloset';

const Notice = ({ icon, tone, title, text }: { icon: ReactNode; tone: string; title: string; text: string }) => (
  <section className={`${homeCard} flex gap-3`}>
    <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tone}`} aria-hidden="true">{icon}</span>
    <div className="min-w-0">
      <h2 className={cardTitle}>{title}</h2>
      <p className={cardText}>{text}</p>
    </div>
  </section>
);

/**
 * «Mi personaje»: el espejo (fijo a la vista) y el clóset con la tienda de prendas adentro. Lo suyo se pone
 * con un toque; lo de la tienda se prueba y se compra desde el espejo. Comprar es estrenar.
 */
export const Closet = ({ view }: { view: StudentAvatarView }) => {
  const closet = useCloset(view.profile.id, view);
  const [filter, setFilter] = useState<ClosetFilter>('all');
  const [zone, setZone] = useState<ZoneKey | null>(null);
  const [buying, setBuying] = useState<StudentAvatarItem | null>(null);
  const [gifting, setGifting] = useState<StudentAvatarItem | null>(null);
  const [bodyOpen, setBodyOpen] = useState(false);
  const { young, shop } = view;
  const forSale = view.items.filter((item) => isForSale(item, view));
  const giftReady = view.giftAvailable && shop.open && forSale.some((item) => isGiftable(item, view));

  // Tras comprar, la tarjeta cambia de lugar (pasa a «lo tuyo»): se ve su compartimento y el foco va a ella.
  const { focusItem, clearFocus } = closet;
  useEffect(() => {
    if (!focusItem) return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-closet-item="${focusItem}"]`)?.focus();
      clearFocus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusItem, clearFocus]);
  const showOwned = (item: StudentAvatarItem) => {
    if (filter === 'shop') setFilter('all');
    setZone(zoneOfSlot(item.slot).key);
  };

  // El personaje con la prenda puesta (para el modal de compra o de regalo).
  const lookWith = (item: StudentAvatarItem): EquippedItem[] => [
    ...closet.layers.filter((layer) => layer.slot !== item.slot),
    { slot: item.slot, imagePath: item.imagePath, layerOrder: item.layerOrder },
  ];

  return (
    <>
      {/* Celular: columna flex (el espejo fijo necesita a todo el clóset como contenedor); escritorio: dos columnas. */}
      <div className="flex flex-col gap-5 md:grid md:grid-cols-[17rem_minmax(0,1fr)] md:items-start xl:grid-cols-[20rem_minmax(0,1fr)]">
        <ClosetMirror view={view} closet={closet} onBuy={setBuying} onGift={setGifting} onChangeBody={() => setBodyOpen(true)} />

        <div className="min-w-0 space-y-4">
          {giftReady && (
            <Notice
              icon={<Gift size={22} />}
              tone="bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200"
              title={young ? '¡Tienes un regalo!' : 'Tienes una prenda de regalo'}
              text={young
                ? 'Elige una prenda que diga «Gratis». Es tuya sin gastar oro.'
                : 'Elige una prenda común (las que dicen «Gratis»): pruébatela y es tuya sin gastar oro. Solo hay un regalo.'}
            />
          )}
          {shop.reason === 'SHOP_CLOSED' && (
            <Notice
              icon={<Lock size={20} />}
              tone="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              title="La tienda está cerrada"
              text="Tu oro se guarda. Puedes vestirte con lo tuyo y probarte la ropa, pero ahora no se compra."
            />
          )}
          {shop.reason === 'AVATAR_OFF' && (
            <Notice
              icon={<Shirt size={20} />}
              tone="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              title="Tu profe apagó la tienda de prendas"
              text="Puedes vestirte con lo tuyo cuando quieras."
            />
          )}
          {shop.reason !== 'AVATAR_OFF' && forSale.length === 0 && (
            <Notice
              icon={<Shirt size={20} />}
              tone="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              title="Aún no hay prendas a la venta"
              text="Cuando haya, aquí podrás probártelas. Mientras tanto, vístete con lo tuyo."
            />
          )}
          <ClosetWardrobe view={view} closet={closet} filter={filter} onFilter={setFilter} zone={zone} onZone={setZone} />
        </div>
      </div>

      <AnimatePresence>
        {buying && (
          <BuyModal
            key="buy"
            view={view}
            item={buying}
            look={lookWith(buying)}
            onConfirm={(equip) => closet.buy(buying, equip).then(() => showOwned(buying))}
            onClose={() => setBuying(null)}
          />
        )}
        {gifting && (
          <GiftModal
            key="gift"
            view={view}
            item={gifting}
            look={lookWith(gifting)}
            onConfirm={(equip) => closet.claimGift(gifting, equip).then(() => showOwned(gifting))}
            onClose={() => setGifting(null)}
          />
        )}
        {bodyOpen && (
          <BodyModal key="body" current={view.profile.gender} onConfirm={(gender) => void closet.changeBody(gender)} onClose={() => setBodyOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
};
