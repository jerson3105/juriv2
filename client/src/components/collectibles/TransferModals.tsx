import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { X } from 'lucide-react';
import type { AlbumWithCards, CollectibleAlbum, ImportableAlbumSource } from '../../lib/collectibleApi';
import type { Classroom } from '../../lib/classroomApi';
import { CARD_RARITY_STYLE, RARITY_FALLBACK_ICON } from './collectibleHelpers';

const selectClass = 'story-select h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
const primaryButton = 'min-h-[44px] rounded-xl bg-primary-600 px-5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300';
const cancelButton = 'min-h-[44px] rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700';

// Marco común de los tres modales (Esc cierra).
const ModalShell = ({ title, subtitle, onClose, footer, children }: { title: string; subtitle?: string; onClose: () => void; footer: ReactNode; children: ReactNode }) => {
  const isPresent = useIsPresent();
  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !event.defaultPrevented) onClose();
  }, [isPresent, onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">{footer}</div>
      </motion.div>
    </motion.div>
  );
};

export const ImportAlbumModal = ({ sources, isLoading, isSubmitting, onClose, onSubmit }: {
  sources: ImportableAlbumSource[];
  isLoading: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (albumId: string) => void;
}) => {
  const [classroomId, setClassroomId] = useState('');
  const [albumId, setAlbumId] = useState('');
  const source = sources.find((s) => s.classroomId === classroomId) ?? sources[0];
  const album = source?.albums.find((a) => a.id === albumId) ?? source?.albums[0];

  return (
    <ModalShell
      title="Importar álbum"
      subtitle="Copia un álbum de otra de tus clases (sin el progreso de sus estudiantes)"
      onClose={onClose}
      footer={<><button type="button" onClick={onClose} className={cancelButton}>Cancelar</button><button type="button" disabled={!album || isSubmitting} onClick={() => album && onSubmit(album.id)} className={primaryButton}>{isSubmitting ? 'Importando...' : 'Importar'}</button></>}
    >
      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-700 dark:text-gray-300">Cargando álbumes...</p>
      ) : sources.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-700 dark:text-gray-300">No tienes álbumes en otras clases.</p>
      ) : (
        <>
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
            Clase
            <select value={source?.classroomId ?? ''} onChange={(e) => { setClassroomId(e.target.value); setAlbumId(''); }} className={`${selectClass} mt-1.5`}>
              {sources.map((s) => <option key={s.classroomId} value={s.classroomId}>{s.classroomName}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
            Álbum
            <select value={album?.id ?? ''} onChange={(e) => setAlbumId(e.target.value)} className={`${selectClass} mt-1.5`}>
              {source?.albums.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.totalCards || 0} figuritas)</option>)}
            </select>
          </label>
        </>
      )}
    </ModalShell>
  );
};

export const ExportAlbumModal = ({ album, classrooms, isLoading, isSubmitting, onClose, onSubmit }: {
  album: CollectibleAlbum;
  classrooms: Classroom[];
  isLoading: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (targetClassroomIds: string[]) => void;
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <ModalShell
      title="Copiar a otras clases"
      subtitle={`${album.name} · ${album.totalCards || 0} figuritas`}
      onClose={onClose}
      footer={<><button type="button" onClick={onClose} className={cancelButton}>Cancelar</button><button type="button" disabled={selected.size === 0 || isSubmitting} onClick={() => onSubmit([...selected])} className={primaryButton}>{isSubmitting ? 'Copiando...' : `Copiar a ${selected.size || ''}`.trim()}</button></>}
    >
      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-700 dark:text-gray-300">Cargando clases...</p>
      ) : classrooms.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-700 dark:text-gray-300">No tienes otras clases.</p>
      ) : (
        <ul className="space-y-2">
          {classrooms.map((c) => (
            <li key={c.id}>
              <label className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 ${selected.has(c.id) ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-600'}`}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 rounded border-gray-400 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
};

export const MoveCardsModal = ({ album, targets, isSubmitting, onClose, onSubmit }: {
  album: AlbumWithCards;
  targets: CollectibleAlbum[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (targetAlbumId: string, cardIds: string[]) => void;
}) => {
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <ModalShell
      title="Mover figuritas"
      subtitle="Solo entre álbumes de esta clase que aún no tengan progreso de estudiantes"
      onClose={onClose}
      footer={<><button type="button" onClick={onClose} className={cancelButton}>Cancelar</button><button type="button" disabled={!targetId || selected.size === 0 || isSubmitting} onClick={() => onSubmit(targetId, [...selected])} className={primaryButton}>{isSubmitting ? 'Moviendo...' : `Mover ${selected.size || ''}`.trim()}</button></>}
    >
      {targets.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-700 dark:text-gray-300">Necesitas otro álbum en esta clase para mover figuritas.</p>
      ) : (
        <>
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
            Álbum destino
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={`${selectClass} mt-1.5`}>
              {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Figuritas</span>
            <button type="button" onClick={() => setSelected(selected.size === album.cards.length ? new Set() : new Set(album.cards.map((c) => c.id)))} className="min-h-[36px] rounded-lg px-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30">
              {selected.size === album.cards.length ? 'Ninguno' : 'Todos'}
            </button>
          </div>
          <ul className="space-y-1.5">
            {album.cards.map((card) => (
              <li key={card.id}>
                <label className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 ${selected.has(card.id) ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-600'}`}>
                  <input type="checkbox" checked={selected.has(card.id)} onChange={() => toggle(card.id)} className="h-4 w-4 rounded border-gray-400 text-primary-600 focus:ring-primary-500" />
                  <span className="text-xl" aria-hidden="true">{card.icon || RARITY_FALLBACK_ICON[card.rarity]}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">#{card.slotNumber} {card.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CARD_RARITY_STYLE[card.rarity].chip}`}>{CARD_RARITY_STYLE[card.rarity].label}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </ModalShell>
  );
};
