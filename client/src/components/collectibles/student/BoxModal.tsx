import { useState } from 'react';
import type { StickerView, StudentAlbumView } from '../../../lib/collectibleApi';
import { HomeModal } from '../../home/HomeModal';
import { cardText, rowButton } from '../../student/home/studentHomeHelpers';
import { CollectibleCardView } from '../CollectibleCardView';
import { CARD_RARITY_STYLE } from '../collectibleHelpers';

interface BoxModalProps {
  album: StudentAlbumView;
  /** Devuelven el mensaje para el alumno (o lanzan con el del servidor). */
  onTake: (card: StickerView) => Promise<string>;
  onDonate: (card: StickerView) => Promise<string>;
  onClose: () => void;
}

const closeButton = 'inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700';
const sectionTitle = 'text-sm font-bold text-gray-900 dark:text-white';
const serverMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

/** Una fila de la caja: la figurita (número y nombre; el dibujo si ya es tuya), un dato y su botón. */
const Row = ({ card, detail, action, disabled, onAction }: { card: StickerView; detail: string; action: string; disabled: boolean; onAction: () => void }) => (
  <li className="flex items-center gap-3 py-2">
    <span className="w-12 flex-shrink-0">
      <CollectibleCardView card={card} size="sm" missing={!card.owned} shiny={card.shiny} holo="static" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{card.slotNumber} · {card.name}</span>
      <span className="block text-sm text-gray-700 dark:text-gray-300">{CARD_RARITY_STYLE[card.rarity].label} · {detail}</span>
    </span>
    <button type="button" onClick={onAction} disabled={disabled} className={`${rowButton} disabled:cursor-not-allowed disabled:opacity-60`}>{action}</button>
  </li>
);

/**
 * La caja de la clase: arriba lo que te falta y alguien donó (tomas hasta 3 al día) y abajo tus repetidas para
 * donar. Es anónima: nunca se ve quién donó. El álbum se refresca detrás después de cada cambio.
 */
export const BoxModal = ({ album, onTake, onDonate, onClose }: BoxModalProps) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const box = album.box;
  const sorted = [...album.cards].sort((a, b) => a.slotNumber - b.slotNumber);
  const takeable = sorted.filter((card) => !card.owned && card.inBox > 0);
  const donatable = sorted.filter((card) => card.donatable > 0);
  const takesLeft = box?.takesLeft ?? 0;

  const run = async (card: StickerView, action: (card: StickerView) => Promise<string>) => {
    setBusy(card.id);
    try {
      setMessage({ text: await action(card), error: false });
    } catch (error) {
      setMessage({ text: serverMessage(error) ?? 'No se pudo. Intenta otra vez.', error: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <HomeModal
      title="Caja de la clase"
      subtitle="Dona tus repetidas y toma las que te faltan. Nadie ve quién dona."
      size="lg"
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className={closeButton}>Listo</button>}
    >
      <p className={`min-h-[1.25rem] text-sm font-semibold ${message?.error ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'}`} role="status" aria-live="polite">
        {message?.text}
      </p>

      <section aria-labelledby="box-take-title">
        <h3 id="box-take-title" className={sectionTitle}>Te faltan y están en la caja</h3>
        <p className={cardText}>{takesLeft > 0 ? `Hoy puedes tomar ${takesLeft === 1 ? '1 más' : `${takesLeft} más`}.` : 'Hoy ya tomaste 3. Mañana puedes tomar más.'}</p>
        {takeable.length === 0 ? (
          <p className={`${cardText} mt-2`}>Ahora no hay ninguna que te falte. Vuelve más tarde: tus compañeros donan sus repetidas.</p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-200 dark:divide-gray-700">
            {takeable.map((card) => (
              <Row
                key={card.id}
                card={card}
                detail={card.inBox === 1 ? 'queda 1' : `quedan ${card.inBox}`}
                action="Tomar"
                disabled={!!busy || takesLeft === 0}
                onAction={() => void run(card, onTake)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="box-donate-title">
        <h3 id="box-donate-title" className={sectionTitle}>Tus repetidas</h3>
        <p className={cardText}>Donas una copia y te quedas con la tuya. Las brillantes no se donan.</p>
        {donatable.length === 0 ? (
          <p className={`${cardText} mt-2`}>No tienes repetidas para donar.</p>
        ) : (
          <ul className="mt-1 divide-y divide-gray-200 dark:divide-gray-700">
            {donatable.map((card) => (
              <Row
                key={card.id}
                card={card}
                detail={card.donatable === 1 ? 'puedes donar 1' : `puedes donar ${card.donatable}`}
                action="Donar una"
                disabled={!!busy}
                onAction={() => void run(card, onDonate)}
              />
            ))}
          </ul>
        )}
      </section>
    </HomeModal>
  );
};
