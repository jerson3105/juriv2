import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { collectibleImageUrl, type CollectibleCard } from '../../lib/collectibleApi';
import { CARD_RARITY_STYLE, RARITY_FALLBACK_ICON } from './collectibleHelpers';

type CardLike = Pick<CollectibleCard, 'name' | 'rarity' | 'slotNumber' | 'imageUrl' | 'icon'> & { description?: string | null };

interface CollectibleCardViewProps {
  card: CardLike;
  size?: 'sm' | 'md';
  shiny?: boolean;
  missing?: boolean;
}

// Carta de colección: marco del color de la rareza, arte (imagen, emoji o icono de rareza),
// número de casilla y reflejo holográfico en épicos, legendarios y brillantes.
export const CollectibleCardView = ({ card, size = 'md', shiny = false, missing = false }: CollectibleCardViewProps) => {
  const style = CARD_RARITY_STYLE[card.rarity];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!card.imageUrl && failedSrc !== card.imageUrl;
  const small = size === 'sm';

  if (missing) {
    return (
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-400/70 bg-white/40 text-gray-600 dark:border-gray-500 dark:bg-black/10 dark:text-gray-300" aria-label={`Casilla ${card.slotNumber} vacía`}>
        <span className={`font-black ${small ? 'text-lg' : 'text-2xl'}`}>{card.slotNumber}</span>
        <span className="text-xs font-semibold">Falta</span>
      </div>
    );
  }

  return (
    <div className={`relative aspect-[3/4] w-full rounded-xl bg-gradient-to-br p-[3px] shadow-md ${style.frame}`}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[9px] bg-white dark:bg-gray-900">
        {/* Arte */}
        <div className={`relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br ${style.art}`}>
          {showImage ? (
            <img src={collectibleImageUrl(card.imageUrl!)} alt="" onError={() => setFailedSrc(card.imageUrl)} className="h-full w-full object-cover" />
          ) : (
            <span className={`leading-none drop-shadow-md ${small ? 'text-3xl' : 'text-5xl'}`} aria-hidden="true">
              {card.icon || RARITY_FALLBACK_ICON[card.rarity]}
            </span>
          )}
          {(style.holo || shiny) && <span className={`cc-holo pointer-events-none absolute inset-0 ${shiny ? 'cc-holo-on' : ''}`} aria-hidden="true" />}
          <span className={`absolute left-1.5 top-1.5 rounded-md bg-black/70 font-black text-white ${small ? 'px-1 text-xs' : 'px-1.5 py-0.5 text-xs'}`}>
            {card.slotNumber}
          </span>
          {shiny && (
            <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-black text-amber-950 shadow">
              <Sparkles size={11} aria-hidden="true" />
              {!small && 'Brillante'}
            </span>
          )}
        </div>
        {/* Nombre */}
        <div className={`border-t border-black/5 dark:border-white/10 ${small ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}>
          <p className={`truncate text-center font-bold text-gray-900 dark:text-white ${small ? 'text-xs leading-4' : 'text-sm'}`} title={card.name}>{card.name}</p>
          {!small && <p className={`mx-auto mt-0.5 w-fit rounded-full px-2 text-xs font-bold ${style.chip}`}>{style.label}</p>}
        </div>
      </div>
    </div>
  );
};
