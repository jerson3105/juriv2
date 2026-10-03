import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { collectibleImageUrl, type StickerView, type StudentAlbumView } from '../../../lib/collectibleApi';
import { CollectibleCardView } from '../CollectibleCardView';
import { CARD_RARITY_ORDER, CARD_RARITY_STYLE } from '../collectibleHelpers';
import { buildPages, completedDate, percentOf, rewardsText, slotsPerPage, stickerLabel, type BookPage } from './stickerHelpers';

interface StickerBookProps {
  album: StudentAlbumView;
  young: boolean;
  /** Hoja que se ve (0 = portada). La controla la página para saltar a una figurita. */
  page: number;
  onPageChange: (page: number) => void;
  /** Figuritas recién pegadas: se «aprietan» en su casilla cuando su página está a la vista. */
  pressIds: Set<string>;
  onPressed: (ids: string[]) => void;
  onSelect: (card: StickerView) => void;
}

const navButton = (young: boolean) =>
  `flex ${young ? 'h-14 w-14' : 'h-11 w-11'} flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-50 hover:bg-white/20 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100`;
const paper = 'relative flex min-w-0 flex-1 flex-col bg-[#fbf6ea] p-3 dark:bg-[#2a2622] sm:p-4';
const DOUBLE_MIN_WIDTH = 640;
const PRESS_MS = 320;
const PRESS_STAGGER_MS = 70;

/** Lo que dice el índice: «Portada y página 1», «Páginas 2 y 3 de 7», «Página 7 y final» (o una sola página). */
const spreadLabel = (left: BookPage | undefined, right: BookPage | undefined, total: number) => {
  const number = (page: BookPage | undefined) => (page?.kind === 'cards' ? page.number : null);
  const a = number(left);
  const b = number(right);
  if (left?.kind === 'cover') return b ? `Portada y página ${b}` : 'Portada';
  if (a && b) return `Páginas ${a} y ${b} de ${total}`;
  if (a) return right?.kind === 'end' ? `Página ${a} y final` : `Página ${a} de ${total}`;
  return 'Final';
};

// El libro dentro de la página: tapa de cuero, papel crema y la barra de navegación en el borde de la tapa.
// A doble página si el contenedor mide 640 px o más (nunca en inicial a 2.º). Las flechas del teclado
// solo pasan de página con el foco dentro del libro (con un modal abierto encima no hacen nada).
export const StickerBook = ({ album, young, page, onPageChange, pressIds, onPressed, onSelect }: StickerBookProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);
  const pointerStart = useRef<number | null>(null);
  // Al pasar de página con el teclado, la página se vuelve a montar: el foco va a su primera figurita.
  const keyboardTurn = useRef<'next' | 'prev' | null>(null);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const double = !young && width >= DOUBLE_MIN_WIDTH;
  const perPage = slotsPerPage(young);
  const pages = useMemo(() => buildPages(album.cards, perPage, double), [album.cards, perPage, double]);
  const cardPages = pages.filter((p) => p.kind === 'cards').length;
  const step = double ? 2 : 1;
  const last = double ? pages.length - 2 : pages.length - 1;
  const current = Math.max(0, Math.min(page - (page % step), last));
  const visible = double ? [pages[current], pages[current + 1]] : [pages[current]];

  const go = (target: number) => {
    const next = Math.max(0, Math.min(target - (target % step), last));
    if (next === current) return;
    setDirection(next > current ? 'next' : 'prev');
    onPageChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).tagName === 'SELECT') return;
    if (event.key === 'ArrowRight') { event.preventDefault(); keyboardTurn.current = 'next'; go(current + step); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); keyboardTurn.current = 'prev'; go(current - step); }
  };

  useEffect(() => {
    const turn = keyboardTurn.current;
    if (!turn) return;
    keyboardTurn.current = null;
    const root = rootRef.current;
    const target = root?.querySelector<HTMLElement>('[data-card-id]')
      ?? root?.querySelector<HTMLElement>(`[data-nav="${turn}"]:not(:disabled)`)
      ?? root?.querySelector<HTMLElement>('[data-nav]:not(:disabled)');
    target?.focus();
  }, [current]);

  // Las recién pegadas de las páginas a la vista se aprietan una tras otra; después se dan por pegadas.
  const visibleIds = visible.flatMap((p) => (p?.kind === 'cards' ? p.cards.map((card) => card.id) : []));
  const pressing = visibleIds.filter((id) => pressIds.has(id));
  const pressingKey = pressing.join(',');
  useEffect(() => {
    if (!pressingKey) return;
    const ids = pressingKey.split(',');
    const timer = window.setTimeout(() => onPressed(ids), PRESS_MS + PRESS_STAGGER_MS * ids.length + 100);
    return () => window.clearTimeout(timer);
  }, [pressingKey, onPressed]);

  // Imágenes livianas: solo se cargan las páginas a la vista; las de la hoja siguiente se piden por adelantado.
  useEffect(() => {
    const upcoming = pages.slice(current + step, current + step * 2);
    for (const p of upcoming) {
      if (p.kind !== 'cards') continue;
      for (const card of p.cards) if (card.imageUrl) new Image().src = collectibleImageUrl(card.imageUrl, 'sm');
    }
  }, [pages, current, step]);

  const renderCards = (p: Extract<BookPage, { kind: 'cards' }>) => (
    <>
      <ul className={`grid flex-1 content-center ${young ? 'grid-cols-2 gap-4' : 'grid-cols-3 gap-2.5 sm:gap-3'}`}>
        {Array.from({ length: perPage }).map((_, index) => {
          const card = p.cards[index];
          if (!card) return <li key={`empty-${index}`} aria-hidden="true" />;
          const order = pressing.indexOf(card.id);
          return (
            <li key={card.id}>
              <button
                type="button"
                data-card-id={card.id}
                onClick={() => onSelect(card)}
                aria-label={stickerLabel(card, young)}
                className={`block w-full rounded-xl transition-transform hover:-translate-y-0.5 ${order >= 0 ? 'cc-press' : ''}`}
                style={order >= 0 ? { animationDelay: `${order * PRESS_STAGGER_MS}ms` } : undefined}
              >
                <CollectibleCardView
                  card={card}
                  size="sm"
                  missing={!card.owned}
                  shiny={card.shiny}
                  count={young ? 0 : card.count}
                  isNew={card.isNew}
                  glyph
                  holo="static"
                />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-center text-xs font-semibold text-stone-600 dark:text-stone-400">Página {p.number}</p>
    </>
  );

  const renderCover = () => {
    const counts = CARD_RARITY_ORDER
      .map((rarity) => ({ rarity, total: album.cards.filter((c) => c.rarity === rarity).length, owned: album.cards.filter((c) => c.rarity === rarity && c.owned).length }))
      .filter((r) => r.total > 0);
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <span className="text-4xl" aria-hidden="true">📖</span>
        <h3 className="text-xl font-black text-stone-900 dark:text-stone-50 sm:text-2xl">{album.name}</h3>
        {album.description && <p className="max-w-xs text-sm text-stone-700 dark:text-stone-300">{album.description}</p>}
        <p className="rounded-full bg-stone-900/85 px-3 py-1 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900">
          {album.owned} de {album.totalCards} {young ? '' : `· ${percentOf(album)} %`}
        </p>
        {!young && (
          <ul className="flex max-w-xs flex-wrap justify-center gap-1.5">
            {counts.map(({ rarity, total, owned }) => (
              <li key={rarity} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CARD_RARITY_STYLE[rarity].chip}`}>
                {owned} de {total} {CARD_RARITY_STYLE[rarity].label.toLowerCase()}
              </li>
            ))}
          </ul>
        )}
        {album.completedAt ? (
          <p className="mt-1 rotate-[-8deg] border-4 border-emerald-700 px-3 py-0.5 text-lg font-black uppercase tracking-wider text-emerald-800 dark:border-emerald-300 dark:text-emerald-300">
            ¡Completo! <span className="block text-xs font-bold normal-case tracking-normal">{completedDate(album.completedAt)}</span>
          </p>
        ) : album.owned === 0 ? (
          <p className="max-w-xs text-sm font-semibold text-stone-700 dark:text-stone-300">Abre tu primer sobre: cada figurita se pega sola en su casilla.</p>
        ) : null}
      </div>
    );
  };

  const renderEnd = () => {
    const rewards = rewardsText(album);
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <span className="text-3xl" aria-hidden="true">{album.completedAt ? '🏆' : '🔖'}</span>
        {album.completedAt ? (
          <>
            <p className="text-lg font-black text-stone-900 dark:text-stone-50">¡Lo completaste!</p>
            {rewards && <p className="max-w-xs text-sm text-stone-700 dark:text-stone-300">Ganaste {rewards}.</p>}
          </>
        ) : (
          <>
            <p className="text-lg font-black text-stone-900 dark:text-stone-50">{album.missing === 1 ? 'Te falta 1 figurita' : `Te faltan ${album.missing} figuritas`}</p>
            {rewards && <p className="max-w-xs text-sm text-stone-700 dark:text-stone-300">Al completarlo ganas {rewards}.</p>}
          </>
        )}
      </div>
    );
  };

  const renderPage = (p: BookPage | undefined, side: 'left' | 'right' | 'single') => {
    const spine = side === 'left'
      ? 'rounded-l-xl shadow-[inset_-18px_0_24px_-18px_rgba(0,0,0,0.35)]'
      : side === 'right' ? 'rounded-r-xl shadow-[inset_18px_0_24px_-18px_rgba(0,0,0,0.35)]' : 'rounded-xl';
    return (
      <div className={`${paper} ${spine}`}>
        {p?.kind === 'cover' && renderCover()}
        {p?.kind === 'cards' && renderCards(p)}
        {p?.kind === 'end' && renderEnd()}
      </div>
    );
  };

  const optionLabel = (index: number) => spreadLabel(pages[index], double ? pages[index + 1] : undefined, cardPages);
  const options = Array.from({ length: Math.floor(last / step) + 1 }, (_, i) => i * step);
  const animation = direction === 'next' ? 'cc-page-next' : direction === 'prev' ? 'cc-page-prev' : '';

  return (
    // Se mide el ancho disponible (el de afuera); el libro se centra con su ancho máximo adentro.
    <div ref={rootRef} onKeyDown={onKeyDown} className="w-full">
      <div className={`mx-auto rounded-2xl bg-gradient-to-br from-amber-800 via-orange-900 to-red-950 p-1.5 shadow-md sm:p-2 ${double ? 'max-w-[60rem]' : young ? 'max-w-[28rem]' : 'max-w-[30rem]'}`}>
        <div
          key={current}
          className={`flex select-none ${animation}`}
          // Solo se anima al pasar de página con los botones, el índice, el teclado o deslizando; un salto
          // a una figurita (al volver de un sobre) no gira.
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) setDirection(null); }}
          onPointerDown={(e) => { pointerStart.current = e.clientX; }}
          onPointerUp={(e) => {
            if (pointerStart.current === null) return;
            const dx = e.clientX - pointerStart.current;
            pointerStart.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? current + step : current - step);
          }}
        >
          {double ? (
            <>
              {renderPage(visible[0], 'left')}
              <div className="w-1 flex-shrink-0 bg-gradient-to-b from-black/30 via-black/10 to-black/30" aria-hidden="true" />
              {renderPage(visible[1], 'right')}
            </>
          ) : renderPage(visible[0], 'single')}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 sm:mt-2">
          <button type="button" data-nav="prev" onClick={() => go(current - step)} disabled={current <= 0} aria-label="Página anterior" className={navButton(young)}>
            <ChevronLeft size={young ? 28 : 22} aria-hidden="true" />
          </button>
          <label className="min-w-0">
            <span className="sr-only">Ir a la página</span>
            <select
              value={current}
              onChange={(e) => go(Number(e.target.value))}
              className="min-h-[44px] max-w-full cursor-pointer truncate rounded-lg border-0 bg-transparent px-2 text-center text-sm font-semibold text-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-100 [&>option]:text-gray-900"
            >
              {options.map((index) => <option key={index} value={index}>{optionLabel(index)}</option>)}
            </select>
          </label>
          <button type="button" data-nav="next" onClick={() => go(current + step)} disabled={current >= last} aria-label="Página siguiente" className={navButton(young)}>
            <ChevronRight size={young ? 28 : 22} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
