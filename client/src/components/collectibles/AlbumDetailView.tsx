import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import type { AlbumWithCards, CardOwners, CollectibleCard } from '../../lib/collectibleApi';
import { CollectibleCardView } from './CollectibleCardView';
import { expectedCostToComplete } from './collectibleHelpers';

interface AlbumDetailViewProps {
  album: AlbumWithCards;
  owners: CardOwners[];
  onBack: () => void;
  onBrowse: () => void;
  onProgress: () => void;
  onAddCard: () => void;
  onAddWithAI: () => void;
  onEditCard: (card: CollectibleCard, owners: number) => void;
  onDeleteCard: (card: CollectibleCard) => void;
  onConfigure: () => void;
  onExport: () => void;
  onMove: () => void;
  onArchive: () => void;
}

const secondaryButton = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

// Menú "Más" con las acciones poco frecuentes (Esc o clic fuera lo cierran).
const MoreMenu = ({ items }: { items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className={secondaryButton}>
        <MoreHorizontal size={16} aria-hidden="true" />
        Más
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            role="menu"
            className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-600 dark:bg-gray-800"
          >
            {items.map((item) => (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => { setOpen(false); item.onClick(); }}
                  className={`flex min-h-[40px] w-full items-center px-4 text-left text-sm font-semibold disabled:cursor-not-allowed disabled:text-gray-500 ${item.danger ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30' : 'text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700'}`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export const AlbumDetailView = ({
  album, owners, onBack, onBrowse, onProgress, onAddCard, onAddWithAI, onEditCard, onDeleteCard, onConfigure, onExport, onMove, onArchive,
}: AlbumDetailViewProps) => {
  const ownersById = useMemo(() => new Map(owners.map((o) => [o.cardId, o.owners])), [owners]);
  const cards = useMemo(() => [...album.cards].sort((a, b) => a.slotNumber - b.slotNumber), [album.cards]);
  const cost = useMemo(
    () => (cards.length > 0 ? expectedCostToComplete(cards, { single: album.singlePackPrice, five: album.fivePackPrice, ten: album.tenPackPrice }) : null),
    [cards, album.singlePackPrice, album.fivePackPrice, album.tenPackPrice],
  );
  const pages = Math.max(1, Math.ceil(cards.length / 6));

  const stats = [
    { label: 'Cromos', value: `${cards.length}`, hint: `${pages} ${pages === 1 ? 'página' : 'páginas'}` },
    { label: 'Sobres', value: `${album.singlePackPrice} · ${album.fivePackPrice} · ${album.tenPackPrice}`, hint: 'GP por ×1 · ×5 · ×10' },
    { label: 'Completarlo', value: cost ? `~${cost.gp} GP` : '—', hint: cost ? `unos ${cost.draws} cromos con repetidos` : 'añade cromos' },
    { label: 'Premio', value: [album.rewardXp > 0 && `+${album.rewardXp} XP`, album.rewardGp > 0 && `+${album.rewardGp} GP`].filter(Boolean).join(' ') || 'Sin premio', hint: album.rewardBadgeId ? '+ insignia' : 'al completarlo' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Volver a los álbumes" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
              <span className="truncate">{album.name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${album.isActive ? 'bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>
                {album.isActive ? 'A la venta' : 'Archivado'}
              </span>
            </h1>
            {album.description && <p className="truncate text-sm text-gray-700 dark:text-gray-300">{album.description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onBrowse} disabled={cards.length === 0} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-md shadow-primary-600/25 hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none dark:disabled:bg-gray-700 dark:disabled:text-gray-300">
            <BookOpen size={16} aria-hidden="true" />
            Hojear álbum
          </button>
          <button type="button" onClick={onProgress} className={secondaryButton}>
            <Users size={16} aria-hidden="true" />
            Progreso
          </button>
          <MoreMenu items={[
            { label: 'Configurar álbum', onClick: onConfigure },
            { label: 'Copiar a otras clases', onClick: onExport },
            { label: 'Mover cromos a otro álbum', onClick: onMove, disabled: cards.length === 0 },
            { label: album.isActive ? 'Archivar álbum' : 'Ya está archivado', onClick: onArchive, danger: true, disabled: !album.isActive },
          ]} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{stat.label}</p>
            <p className="mt-0.5 break-words text-base font-black leading-6 text-gray-900 dark:text-white sm:text-lg">{stat.value}</p>
            <p className="text-xs text-gray-700 dark:text-gray-300">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onAddCard} className={secondaryButton}>
          <Plus size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
          Añadir cromo
        </button>
        <button type="button" onClick={onAddWithAI} className={secondaryButton}>
          <Sparkles size={16} className="text-primary-600 dark:text-primary-300" aria-hidden="true" />
          Añadir con IA
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <p className="text-4xl" aria-hidden="true">🃏</p>
          <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">El álbum está vacío</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Añade cromos uno a uno o deja que la IA proponga una colección con su emoji.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          <AnimatePresence initial={false}>
            {cards.map((card) => {
              const count = ownersById.get(card.id) ?? 0;
              return (
                <motion.li key={card.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="group flex flex-col gap-2">
                  <CollectibleCardView card={card} />
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs ${count > 0 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'italic text-gray-700 dark:text-gray-300'}`}>
                      {count > 0 ? `${count} lo ${count === 1 ? 'tiene' : 'tienen'}` : 'Nadie aún'}
                    </span>
                    <span className="flex">
                      <button type="button" onClick={() => onEditCard(card, count)} aria-label={`Editar ${card.name}`} title="Editar" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white">
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCard(card)}
                        disabled={count > 0}
                        aria-label={count > 0 ? `${card.name}: no se puede borrar porque ya lo tienen estudiantes` : `Borrar ${card.name}`}
                        title={count > 0 ? 'Ya lo tienen estudiantes: no se puede borrar' : 'Borrar'}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent dark:text-red-300 dark:hover:bg-red-900/30 dark:disabled:text-gray-500"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
};
