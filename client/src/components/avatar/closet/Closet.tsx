import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Gift, Lock, Shirt, X } from 'lucide-react';
import type { StudentAvatarItem, StudentAvatarView } from '../../../lib/avatarApi';
import { cardText, cardTitle, homeCard } from '../../student/home/studentHomeHelpers';
import type { EquippedItem } from '../AvatarRenderer';
import { ClosetMirror } from './ClosetMirror';
import { ClosetWardrobe } from './ClosetWardrobe';
import { BodyModal, BuyModal, GiftModal } from './ClosetModals';
import { isForSale, isGiftable, zoneOfSlot, type ClosetFilter, type ZoneKey } from './closetHelpers';
import { useCloset } from './useCloset';

interface NoticeProps {
  icon: ReactNode;
  tone: string;
  title: string;
  text: string;
  /** Con onClose, el aviso lleva una ✕ en la esquina para quitarlo. */
  onClose?: () => void;
  closeLabel?: string;
}

const Notice = ({ icon, tone, title, text, onClose, closeLabel }: NoticeProps) => (
  <section className={`${homeCard} relative flex gap-3 ${onClose ? 'pr-12 sm:pr-14' : ''}`}>
    <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tone}`} aria-hidden="true">{icon}</span>
    <div className="min-w-0">
      <h2 className={cardTitle}>{title}</h2>
      <p className={cardText}>{text}</p>
    </div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel ?? 'Cerrar aviso'}
        className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
      >
        <X size={18} aria-hidden="true" />
      </button>
    )}
  </section>
);

// El aviso del regalo se puede quitar; se recuerda por perfil en este equipo. El regalo sigue disponible
// (las comunes dicen «Gratis» y el espejo ofrece «Elegir de regalo»).
const giftNoticeKey = (profileId: string) => `closet-gift-notice-hidden-${profileId}`;
const readGiftNoticeHidden = (profileId: string) => {
  try {
    return localStorage.getItem(giftNoticeKey(profileId)) === '1';
  } catch {
    return false;
  }
};

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
  const [giftNoticeHidden, setGiftNoticeHidden] = useState(() => readGiftNoticeHidden(view.profile.id));
  const wardrobeRef = useRef<HTMLDivElement>(null);
  const { young, shop } = view;
  const forSale = view.items.filter((item) => isForSale(item, view));
  const giftReady = view.giftAvailable && shop.open && forSale.some((item) => isGiftable(item, view));

  const hideGiftNotice = () => {
    setGiftNoticeHidden(true);
    try {
      localStorage.setItem(giftNoticeKey(view.profile.id), '1');
    } catch {
      // Sin almacenamiento (ventana privada): se oculta solo hasta salir de la página.
    }
    // El botón desaparece: el foco pasa al clóset en vez de perderse.
    wardrobeRef.current?.querySelector<HTMLElement>('#closet-title')?.focus();
  };

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

        <div ref={wardrobeRef} className="min-w-0 space-y-4">
          {giftReady && !giftNoticeHidden && (
            <Notice
              icon={<Gift size={22} />}
              tone="bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200"
              title={young ? '¡Tienes un regalo!' : 'Tienes una prenda de regalo'}
              text={young
                ? 'Elige una prenda que diga «Gratis». Es tuya sin gastar oro.'
                : 'Elige una prenda común (las que dicen «Gratis»): pruébatela y es tuya sin gastar oro. Solo hay un regalo.'}
              onClose={hideGiftNotice}
              closeLabel="Cerrar el aviso del regalo"
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
