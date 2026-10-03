import { useEffect } from 'react';
import { Trophy, X } from 'lucide-react';
import type { AlbumCompletion, StickerView, StudentAlbumView } from '../../../lib/collectibleApi';
import { HomeModal } from '../../home/HomeModal';
import { cardText, cardTitle, homeCard, rowButton } from '../../student/home/studentHomeHelpers';
import { CollectibleCardView, RarityGlyph } from '../CollectibleCardView';
import { CARD_RARITY_STYLE } from '../collectibleHelpers';
import { pageOfCard, slotsPerPage } from './stickerHelpers';

const closeButton = 'inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700';
const numberButton = 'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-dashed border-gray-400 px-2 text-sm font-black text-gray-800 hover:border-primary-600 hover:bg-primary-50 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-primary-900/30';

/** El detalle de una figurita: el dibujo grande, la rareza, cuántas tienes y su dato (el contenido educativo). */
export const StickerDetailModal = ({ card, album, young, onClose }: { card: StickerView; album: StudentAlbumView; young: boolean; onClose: () => void }) => {
  const page = pageOfCard(album.cards, card.id, slotsPerPage(young));
  const rarity = CARD_RARITY_STYLE[card.rarity];
  return (
    <HomeModal
      title={card.name}
      subtitle={`Figurita ${card.slotNumber} · página ${page}`}
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className={closeButton}>Cerrar</button>}
    >
      <div className="mx-auto w-48 sm:w-56">
        <CollectibleCardView card={card} size="lg" missing={!card.owned} shiny={card.shiny} isNew={card.isNew} glyph holo="static" />
      </div>
      <p className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold ${rarity.chip}`}>
          <RarityGlyph rarity={card.rarity} />
          {rarity.label}
        </span>
        {card.shiny && <span className="rounded-full bg-amber-400 px-2.5 py-0.5 font-bold text-amber-950">✦ Brillante</span>}
        {card.isNew && <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 font-bold text-white">Nueva</span>}
      </p>
      {card.owned ? (
        <>
          {!young && (
            <p className={`${cardText} text-center`}>
              {card.count > 1 ? `Tienes ${card.count} (${card.count - 1 === 1 ? '1 repetida' : `${card.count - 1} repetidas`}).` : 'La tienes pegada en tu álbum.'}
            </p>
          )}
          {card.description && (
            <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Sobre esta figurita</h3>
              <p className={`${cardText} mt-0.5`}>{card.description}</p>
            </div>
          )}
        </>
      ) : (
        <p className={`${cardText} text-center`}>Te falta. Puede salir en los sobres de este álbum.</p>
      )}
    </HomeModal>
  );
};

/** «Te faltan» y «Repetidas» como listas de números (como la que se anota en el álbum de papel). */
export const StickerListsModal = ({ album, onPick, onClose }: { album: StudentAlbumView; onPick: (card: StickerView) => void; onClose: () => void }) => {
  const sorted = [...album.cards].sort((a, b) => a.slotNumber - b.slotNumber);
  const missing = sorted.filter((card) => !card.owned);
  const repeated = sorted.filter((card) => card.count > 1);
  return (
    <HomeModal
      title={missing.length === 1 ? 'Te falta 1' : `Te faltan ${missing.length}`}
      subtitle="Toca un número para ir a su página"
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className={closeButton}>Cerrar</button>}
    >
      {missing.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Figuritas que te faltan">
          {missing.map((card) => (
            <li key={card.id}>
              <button type="button" onClick={() => onPick(card)} aria-label={`${card.slotNumber}, ${card.name}`} title={card.name} className={numberButton}>{card.slotNumber}</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cardText}>¡No te falta ninguna!</p>
      )}
      {repeated.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Repetidas</h3>
          <p className={`${cardText} mb-2`}>Las guardas para cambiarlas más adelante.</p>
          <ul className="flex flex-wrap gap-2" aria-label="Figuritas repetidas">
            {repeated.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => onPick(card)}
                  aria-label={`${card.slotNumber}, ${card.name}, tienes ${card.count}`}
                  title={card.name}
                  className="flex min-h-[44px] items-center gap-1 rounded-xl border-2 border-gray-300 px-2.5 text-sm font-black text-gray-800 hover:border-primary-600 hover:bg-primary-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-primary-900/30"
                >
                  {card.slotNumber}
                  <span className="rounded-full bg-gray-900 px-1.5 text-xs leading-5 text-white dark:bg-gray-100 dark:text-gray-900">×{card.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </HomeModal>
  );
};

/** Las reglas del sobre, publicadas (los menores no compran a ciegas). */
export const WhatCanComeModal = ({ album, dailyLimit, onClose }: { album: StudentAlbumView; dailyLimit: number; onClose: () => void }) => (
  <HomeModal title="¿Qué puede salir?" subtitle={album.name} onClose={onClose} footer={<button type="button" onClick={onClose} className={closeButton}>Entendido</button>}>
    <ul className="list-disc space-y-2 pl-5 text-sm text-gray-800 dark:text-gray-200">
      <li>Cada figurita del sobre sale de <strong>las que te faltan</strong>, y todas tienen la misma probabilidad, sea común o legendaria.</li>
      <li><strong>1 de cada 5</strong>, en promedio, es una repetida de las que ya tienes. Las repetidas se guardan para cambiarlas más adelante.</li>
      <li>El sobre trae {album.pack?.cards ?? 5} figuritas (el último, solo las que te falten) y puedes abrir {dailyLimit === 1 ? '1 al día' : `hasta ${dailyLimit} al día`}.</li>
      <li>Cuando completas el álbum, ya no hay más sobres: no gastas oro de más.</li>
    </ul>
  </HomeModal>
);

/** La celebración de completar, dentro de la página: nombra el álbum (nunca el oro) y lanza un solo confeti. */
export const CompletionCard = ({ completion, onShowAlbum, onClose }: { completion: AlbumCompletion; onShowAlbum: () => void; onClose: () => void }) => {
  useEffect(() => {
    void import('canvas-confetti').then(({ default: confetti }) => confetti({
      particleCount: 80,
      spread: 90,
      startVelocity: 38,
      ticks: 150,
      scalar: 0.9,
      origin: { x: 0.5, y: 0.25 },
      disableForReducedMotion: true,
      colors: ['#f59e0b', '#fbbf24', '#10b981', '#2563eb', '#ec4899'],
    }));
  }, []);
  return (
    <section className={`${homeCard} relative flex gap-3 pr-14`} role="status">
      <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" aria-hidden="true">
        <span className="celebrate-ring absolute inset-0 rounded-2xl border-2 border-emerald-500" />
        <span className="celebrate-pop"><Trophy size={24} /></span>
      </span>
      <div className="min-w-0">
        <h2 className={cardTitle}>¡Completaste «{completion.albumName}»!</h2>
        <p className={cardText}>
          Todas las figuritas están en su casilla.{completion.rewards.badge ? ` Ganaste la insignia «${completion.rewards.badge.name}».` : ''}
        </p>
        <button type="button" onClick={onShowAlbum} className={`${rowButton} mt-2`}>Ver mi álbum completo</button>
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white">
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  );
};
