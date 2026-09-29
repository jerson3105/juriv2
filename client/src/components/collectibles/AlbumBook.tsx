import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { AlbumWithCards, CollectibleCard } from '../../lib/collectibleApi';
import { CollectibleCardView } from './CollectibleCardView';
import { CARD_RARITY_ORDER, CARD_RARITY_STYLE } from './collectibleHelpers';

interface AlbumBookProps {
  album: AlbumWithCards;
  // Sin `owned` se muestra el álbum completo (vista previa del profesor).
  owned?: Map<string, { hasNormal: boolean; hasShiny: boolean }>;
  subtitle?: string;
  onClose: () => void;
}

const SLOTS_PER_PAGE = 6;
const FLIP_SECONDS = 0.7;

type Page = { kind: 'cover' } | { kind: 'cards'; cards: CollectibleCard[]; number: number } | { kind: 'end' };

const useIsWide = () => {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setWide(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return wide;
};

// Álbum físico: doble página que se pasa girando sobre el lomo (una página en móvil).
export const AlbumBook = ({ album, owned, subtitle, onClose }: AlbumBookProps) => {
  const wide = useIsWide();
  const reduceMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState<null | 'next' | 'prev'>(null);
  const pointerStart = useRef<number | null>(null);

  const pages: Page[] = useMemo(() => {
    const sorted = [...album.cards].sort((a, b) => a.slotNumber - b.slotNumber);
    const cardPages: Page[] = [];
    for (let i = 0; i < Math.max(sorted.length, 1); i += SLOTS_PER_PAGE) {
      cardPages.push({ kind: 'cards', cards: sorted.slice(i, i + SLOTS_PER_PAGE), number: cardPages.length + 1 });
    }
    const all: Page[] = [{ kind: 'cover' }, ...cardPages];
    // En doble página, el total debe ser par para que la última hoja cierre bien.
    if (all.length % 2 === 1) all.push({ kind: 'end' });
    return all;
  }, [album.cards]);

  const step = wide ? 2 : 1;
  const maxIndex = wide ? pages.length - 2 : pages.length - 1;
  const current = Math.min(index - (index % step), Math.max(0, maxIndex));
  const canPrev = current > 0 && !flip;
  const canNext = current < maxIndex && !flip;

  const go = useCallback((direction: 'next' | 'prev') => {
    if (flip) return;
    if (direction === 'next' && current >= maxIndex) return;
    if (direction === 'prev' && current <= 0) return;
    if (reduceMotion || !wide) {
      setIndex(current + (direction === 'next' ? step : -step));
      return;
    }
    setFlip(direction);
  }, [flip, current, maxIndex, reduceMotion, wide, step]);

  // El avance lo marca un temporizador con la duración del giro (no el fin de la animación):
  // así nunca se queda a medias si el navegador pausa las animaciones.
  useEffect(() => {
    if (!flip) return;
    const timer = setTimeout(() => {
      setIndex((value) => value - (value % 2) + (flip === 'next' ? 2 : -2));
      setFlip(null);
    }, FLIP_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [flip]);

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (!isPresent) return;
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowRight') go('next');
    else if (event.key === 'ArrowLeft') go('prev');
  }, [isPresent, onClose, go]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const collected = owned ? album.cards.filter((c) => owned.get(c.id)?.hasNormal || owned.get(c.id)?.hasShiny).length : album.cards.length;

  const renderPage = (page: Page | undefined, side: 'left' | 'right' | 'single') => {
    const paper = 'relative h-full w-full overflow-hidden bg-[#fbf6ea] dark:bg-[#2a2622]';
    const spine = side === 'left'
      ? 'shadow-[inset_-18px_0_24px_-18px_rgba(0,0,0,0.35)] rounded-l-xl'
      : side === 'right'
        ? 'shadow-[inset_18px_0_24px_-18px_rgba(0,0,0,0.35)] rounded-r-xl'
        : 'rounded-xl';
    if (!page || page.kind === 'end') {
      return <div className={`${paper} ${spine} flex items-center justify-center`}><span className="text-sm font-semibold text-stone-600 dark:text-stone-300">Fin del álbum</span></div>;
    }
    if (page.kind === 'cover') {
      const counts = CARD_RARITY_ORDER.map((rarity) => ({ rarity, count: album.cards.filter((c) => c.rarity === rarity).length })).filter((r) => r.count > 0);
      return (
        <div className={`${paper} ${spine} flex flex-col items-center justify-center gap-3 p-6 text-center`}>
          <span className="text-5xl" aria-hidden="true">📖</span>
          <h3 className="text-2xl font-black text-stone-900 dark:text-stone-50">{album.name}</h3>
          {album.description && <p className="max-w-xs text-sm text-stone-700 dark:text-stone-300">{album.description}</p>}
          <p className="rounded-full bg-stone-900/85 px-3 py-1 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900">
            {owned ? `${collected} de ${album.cards.length} cromos` : `${album.cards.length} cromos`}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {counts.map(({ rarity, count }) => (
              <span key={rarity} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CARD_RARITY_STYLE[rarity].chip}`}>
                {count} {CARD_RARITY_STYLE[rarity].label.toLowerCase()}
              </span>
            ))}
          </div>
          {(album.rewardXp > 0 || album.rewardGp > 0) && (
            <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Al completarlo: {[album.rewardXp > 0 && `+${album.rewardXp} XP`, album.rewardGp > 0 && `+${album.rewardGp} GP`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      );
    }
    return (
      <div className={`${paper} ${spine} flex flex-col p-[4%]`}>
        <div className="grid flex-1 grid-cols-3 content-center gap-[4%]">
          {Array.from({ length: SLOTS_PER_PAGE }).map((_, i) => {
            const card = page.cards[i];
            if (!card) return <div key={i} aria-hidden="true" />;
            const status = owned?.get(card.id);
            const has = !owned || status?.hasNormal || status?.hasShiny;
            return <CollectibleCardView key={card.id} card={card} size="sm" missing={!has} shiny={!!status?.hasShiny} />;
          })}
        </div>
        <p className="mt-1 text-center text-xs font-semibold text-stone-600 dark:text-stone-400">Página {page.number}</p>
      </div>
    );
  };

  const leftPage = pages[current];
  const rightPage = pages[current + 1];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Álbum ${album.name}`}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 p-3"
    >
      <div className="mb-3 flex w-full max-w-6xl items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-white">{album.name}</h2>
          {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar álbum" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25">
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="flex w-full items-center justify-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => go('prev')}
          disabled={!canPrev}
          aria-label="Página anterior"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-30"
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </button>

        <div
          className="relative select-none"
          style={wide ? { width: 'min(88vw, calc(78vh * 1.6))', aspectRatio: '1.6', perspective: '2200px' } : { width: 'min(78vw, calc(70vh * 0.8))', aspectRatio: '0.8', perspective: '1600px' }}
          onPointerDown={(e) => { pointerStart.current = e.clientX; }}
          onPointerUp={(e) => {
            if (pointerStart.current === null) return;
            const dx = e.clientX - pointerStart.current;
            pointerStart.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 'next' : 'prev');
          }}
        >
          {wide ? (
            <>
              {/* Libro abierto: páginas de fondo (durante el giro, se ve la que queda debajo) */}
              <div className="absolute inset-0 flex rounded-xl shadow-2xl shadow-black/60">
                <div className="h-full w-1/2">{renderPage(flip === 'prev' ? pages[current - 2] : leftPage, 'left')}</div>
                <div className="h-full w-1/2">{renderPage(flip === 'next' ? pages[current + 3] : rightPage, 'right')}</div>
              </div>
              {/* Hoja que gira sobre el lomo */}
              {flip && (
                <motion.div
                  className="absolute top-0 h-full w-1/2"
                  style={{
                    left: flip === 'next' ? '50%' : 0,
                    transformOrigin: flip === 'next' ? 'left center' : 'right center',
                    transformStyle: 'preserve-3d',
                  }}
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: flip === 'next' ? -180 : 180 }}
                  transition={{ duration: FLIP_SECONDS, ease: [0.45, 0.05, 0.3, 1] }}
                >
                  <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                    {renderPage(flip === 'next' ? rightPage : leftPage, flip === 'next' ? 'right' : 'left')}
                  </div>
                  <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    {renderPage(flip === 'next' ? pages[current + 2] : pages[current - 1], flip === 'next' ? 'left' : 'right')}
                  </div>
                </motion.div>
              )}
              {/* Lomo */}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-gradient-to-b from-black/30 via-black/10 to-black/30" aria-hidden="true" />
            </>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current}
                className="absolute inset-0 shadow-2xl shadow-black/60"
                style={{ transformOrigin: 'left center' }}
                initial={reduceMotion ? { opacity: 0 } : { rotateY: 70, opacity: 0.4 }}
                animate={reduceMotion ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { rotateY: -70, opacity: 0.4 }}
                transition={{ duration: 0.35 }}
              >
                {renderPage(pages[current], 'single')}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <button
          type="button"
          onClick={() => go('next')}
          disabled={!canNext}
          aria-label="Página siguiente"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-30"
        >
          <ChevronRight size={26} aria-hidden="true" />
        </button>
      </div>

      <p className="mt-3 text-sm font-semibold text-white/85" aria-live="polite">
        {wide ? `Páginas ${current + 1}–${Math.min(current + 2, pages.length)} de ${pages.length}` : `Página ${current + 1} de ${pages.length}`}
        <span className="hidden sm:inline"> · Usa ← → o desliza</span>
      </p>
    </motion.div>
  );
};
