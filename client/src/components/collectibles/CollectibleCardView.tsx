import { useState } from 'react';
import { Circle, Crown, Diamond, Sparkles, Star } from 'lucide-react';
import { collectibleImageUrl, type CardRarity, type CollectibleCard } from '../../lib/collectibleApi';
import { CARD_RARITY_STYLE, RARITY_FALLBACK_ICON } from './collectibleHelpers';

type CardLike = Pick<CollectibleCard, 'name' | 'rarity' | 'slotNumber' | 'imageUrl' | 'icon'> & { description?: string | null };

interface CollectibleCardViewProps {
  card: CardLike;
  size?: 'sm' | 'md' | 'lg';
  shiny?: boolean;
  /** Casilla vacía: número y nombre impresos, como en el álbum de papel. */
  missing?: boolean;
  /** Copias que tiene: desde 2 se ve «×N». */
  count?: number;
  /** Sello «Nueva» (la consiguió hace poco). */
  isNew?: boolean;
  /** Glifo de rareza en la carta (la rareza se lee sin depender del color). */
  glyph?: boolean;
  /** «static»: el reflejo de la brillante queda quieto (vista del alumno, sin bucles). */
  holo?: 'loop' | 'static';
}

/** Glifo de cada rareza: ● común, ◆ poco común, ★ rara, ★★ épica, ♛ legendaria. */
export const RarityGlyph = ({ rarity, size = 11 }: { rarity: CardRarity; size?: number }) => {
  if (rarity === 'COMMON') return <Circle size={size - 2} fill="currentColor" aria-hidden="true" />;
  if (rarity === 'UNCOMMON') return <Diamond size={size} fill="currentColor" aria-hidden="true" />;
  if (rarity === 'RARE') return <Star size={size} fill="currentColor" aria-hidden="true" />;
  if (rarity === 'EPIC') return <span className="inline-flex" aria-hidden="true"><Star size={size} fill="currentColor" /><Star size={size} fill="currentColor" /></span>;
  return <Crown size={size} fill="currentColor" aria-hidden="true" />;
};

const SIZE = {
  sm: { emoji: 'text-3xl', slot: 'px-1 text-xs', name: 'text-xs leading-4', footer: 'px-1.5 py-1', missingNumber: 'text-lg' },
  md: { emoji: 'text-5xl', slot: 'px-1.5 py-0.5 text-xs', name: 'text-sm', footer: 'px-2 py-1.5', missingNumber: 'text-2xl' },
  lg: { emoji: 'text-7xl', slot: 'px-2 py-0.5 text-sm', name: 'text-base', footer: 'px-3 py-2', missingNumber: 'text-4xl' },
} as const;

// Carta de colección: marco del color de la rareza, arte (imagen, emoji o icono de rareza),
// número de casilla y reflejo holográfico en épicos, legendarios y brillantes.
export const CollectibleCardView = ({
  card, size = 'md', shiny = false, missing = false, count = 0, isNew = false, glyph = false, holo = 'loop',
}: CollectibleCardViewProps) => {
  const style = CARD_RARITY_STYLE[card.rarity];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!card.imageUrl && failedSrc !== card.imageUrl;
  const small = size === 'sm';
  const sizes = SIZE[size];

  if (missing) {
    return (
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-gray-400/80 bg-white/40 px-1 text-center text-gray-700 dark:border-gray-500 dark:bg-black/10 dark:text-gray-300">
        <span className={`font-black leading-none ${sizes.missingNumber}`}>{card.slotNumber}</span>
        <span className={`line-clamp-2 font-semibold ${small ? 'text-xs leading-4' : 'text-sm'}`}>{card.name}</span>
        {glyph && <span className="mt-0.5 opacity-60"><RarityGlyph rarity={card.rarity} /></span>}
      </div>
    );
  }

  const holoClass = holo === 'static' ? (shiny ? 'cc-holo-static' : null) : style.holo || shiny ? `cc-holo ${shiny ? 'cc-holo-on' : ''}` : null;
  return (
    <div className={`relative aspect-[3/4] w-full rounded-xl bg-gradient-to-br p-[3px] shadow-md ${style.frame}`}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[9px] bg-white dark:bg-gray-900">
        {/* Arte */}
        <div className={`relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br ${style.art}`}>
          {showImage ? (
            <img src={collectibleImageUrl(card.imageUrl!)} alt="" loading="lazy" decoding="async" onError={() => setFailedSrc(card.imageUrl)} className="h-full w-full object-cover" />
          ) : (
            <span className={`leading-none drop-shadow-md ${sizes.emoji}`} aria-hidden="true">
              {card.icon || RARITY_FALLBACK_ICON[card.rarity]}
            </span>
          )}
          {holoClass && <span className={`pointer-events-none absolute inset-0 ${holoClass}`} aria-hidden="true" />}
          <span className={`absolute left-1.5 top-1.5 rounded-md bg-black/70 font-black text-white ${sizes.slot}`}>
            {card.slotNumber}
          </span>
          {(count > 1 || shiny) && (
            <span className="absolute right-1.5 top-1.5 flex items-center gap-1" aria-hidden="true">
              {count > 1 && <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-xs font-black leading-none text-white">×{count}</span>}
              {shiny && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-black leading-none text-amber-950 shadow">
                  <Sparkles size={11} aria-hidden="true" />
                  {!small && 'Brillante'}
                </span>
              )}
            </span>
          )}
          {glyph && (
            <span className="absolute bottom-1.5 left-1.5 inline-flex items-center rounded-md bg-black/60 px-1 py-0.5 text-white" aria-hidden="true">
              <RarityGlyph rarity={card.rarity} />
            </span>
          )}
          {isNew && (
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-emerald-700 px-1.5 py-0.5 text-xs font-bold leading-none text-white" aria-hidden="true">
              Nueva
            </span>
          )}
        </div>
        {/* Nombre */}
        <div className={`border-t border-black/5 dark:border-white/10 ${sizes.footer}`}>
          <p className={`truncate text-center font-bold text-gray-900 dark:text-white ${sizes.name}`} title={card.name}>{card.name}</p>
          {!small && <p className={`mx-auto mt-0.5 w-fit rounded-full px-2 text-xs font-bold ${style.chip}`}>{style.label}</p>}
        </div>
      </div>
    </div>
  );
};

/** El dorso: la tapa del álbum en chiquito (cuero, borde punteado y 📖). */
export const CollectibleCardBack = () => (
  <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-gradient-to-br from-amber-700 via-orange-800 to-red-900 p-1.5 shadow-md">
    <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-amber-200/50">
      <span className="text-3xl" aria-hidden="true">📖</span>
    </div>
  </div>
);
