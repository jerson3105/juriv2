import { useCallback, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import {
  collectibleApi,
  type AlbumWithCards,
  type CollectibleAlbum,
  type CollectibleCard,
  type CreateAlbumData,
  type CreateCardData,
  type GeneratedCard,
} from '../../lib/collectibleApi';
import { studentLabel } from '../../components/badges/badgeHelpers';
import { AlbumListView } from '../../components/collectibles/AlbumListView';
import { AlbumDetailView } from '../../components/collectibles/AlbumDetailView';
import { ProgressView } from '../../components/collectibles/ProgressView';
import { AlbumBook } from '../../components/collectibles/AlbumBook';
import { AlbumFormModal, type AlbumFormTarget } from '../../components/collectibles/AlbumFormModal';
import { CardFormModal, type CardFormTarget } from '../../components/collectibles/CardFormModal';
import { AICollectiblesModal } from '../../components/collectibles/AICollectiblesModal';
import { ExportAlbumModal, ImportAlbumModal, MoveCardsModal } from '../../components/collectibles/TransferModals';
import { albumKey, albumsKey, cardOwnersKey } from '../../components/collectibles/collectibleHelpers';

type View = { kind: 'list' } | { kind: 'album'; albumId: string } | { kind: 'progress'; albumId: string };
type BookState = { album: AlbumWithCards; owned?: Map<string, { hasNormal: boolean; hasShiny: boolean }>; subtitle?: string };

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const undoToast = (text: string, onUndo: () => void) =>
  toast.success(
    (t) => (
      <span className="flex items-center gap-3">
        <span>{text}</span>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id);
            onUndo();
          }}
          className="shrink-0 min-h-[36px] rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
        >
          Deshacer
        </button>
      </span>
    ),
    { duration: 8000 },
  );

export const CollectiblesPage = () => {
  const { classroom } = useOutletContext<{ classroom: Classroom }>();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [book, setBook] = useState<BookState | null>(null);
  const [albumForm, setAlbumForm] = useState<AlbumFormTarget | null>(null);
  const [cardForm, setCardForm] = useState<CardFormTarget | null>(null);
  const [aiMode, setAiMode] = useState<'album' | 'cards' | null>(null);
  const [transfer, setTransfer] = useState<'import' | 'export' | 'move' | null>(null);
  const [saving, setSaving] = useState(false);

  const albumId = view.kind === 'list' ? null : view.albumId;
  const { data: albums = [], isLoading } = useQuery({
    queryKey: albumsKey(classroom.id),
    queryFn: () => collectibleApi.getAlbums(classroom.id),
  });
  const { data: album } = useQuery({
    queryKey: albumKey(albumId ?? ''),
    queryFn: () => collectibleApi.getAlbumById(albumId!),
    enabled: !!albumId,
  });
  const { data: owners = [] } = useQuery({
    queryKey: cardOwnersKey(albumId ?? ''),
    queryFn: () => collectibleApi.getCardOwners(albumId!),
    enabled: view.kind === 'album',
  });
  const { data: classroomData } = useQuery({
    queryKey: ['classroom', classroom.id],
    queryFn: () => classroomApi.getById(classroom.id),
  });
  const { data: importSources = [], isLoading: loadingSources } = useQuery({
    queryKey: ['collectible-importable-albums', classroom.id],
    queryFn: () => collectibleApi.getImportableAlbums(classroom.id),
    enabled: transfer === 'import',
  });
  const { data: myClassrooms = [], isLoading: loadingClassrooms } = useQuery({
    queryKey: ['my-classrooms'],
    queryFn: () => classroomApi.getMyClassrooms(),
    enabled: transfer === 'export',
  });

  const showCharacterName = classroom.showCharacterName ?? true;
  const studentsById = useMemo(() => new Map((classroomData?.students ?? []).map((s) => [s.id, s])), [classroomData]);
  const nameOf = useCallback((studentId: string, fallback: string) => {
    const student = studentsById.get(studentId);
    return student ? studentLabel(student, showCharacterName) : fallback;
  }, [studentsById, showCharacterName]);

  const refreshAlbum = (id: string | null = albumId) => {
    queryClient.invalidateQueries({ queryKey: albumsKey(classroom.id) });
    if (id) {
      queryClient.invalidateQueries({ queryKey: albumKey(id) });
      queryClient.invalidateQueries({ queryKey: cardOwnersKey(id) });
    }
  };

  const openBook = async (target: CollectibleAlbum) => {
    try {
      const full = await queryClient.fetchQuery({ queryKey: albumKey(target.id), queryFn: () => collectibleApi.getAlbumById(target.id) });
      setBook({ album: full, subtitle: 'Vista previa: así se ve con todas las figuritas' });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo abrir el álbum'));
    }
  };

  // ── Álbumes ──
  const saveAlbum = async (data: CreateAlbumData & { isActive?: boolean }) => {
    setSaving(true);
    try {
      if (albumForm?.kind === 'edit') {
        await collectibleApi.updateAlbum(albumForm.album.id, data);
        toast.success('Álbum guardado');
        refreshAlbum(albumForm.album.id);
      } else {
        const created = await collectibleApi.createAlbum(classroom.id, data);
        toast.success(`Álbum creado: ${created.name}`);
        refreshAlbum(null);
        setView({ kind: 'album', albumId: created.id });
      }
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar el álbum'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const setAlbumActive = async (target: CollectibleAlbum, isActive: boolean, silent = false) => {
    try {
      await collectibleApi.updateAlbum(target.id, { isActive });
      refreshAlbum(target.id);
      if (!silent) {
        if (isActive) toast.success(`De vuelta a la venta: ${target.name}`);
        else undoToast(`Archivado: ${target.name}. Tus estudiantes conservan sus figuritas.`, () => void setAlbumActive(target, true));
      }
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo actualizar el álbum'));
    }
  };

  // ── Figuritas ──
  const saveCard = async (data: CreateCardData, another: boolean) => {
    if (!album) return false;
    setSaving(true);
    try {
      if (cardForm?.kind === 'edit') {
        await collectibleApi.updateCard(cardForm.card.id, data);
        toast.success(`Guardado: ${data.name}`);
      } else {
        await collectibleApi.createCard(album.id, data);
        toast.success(`Pegado en el álbum: ${data.name}`);
      }
      refreshAlbum(album.id);
      if (!another) setCardForm(null);
      else setCardForm({ kind: 'create', nextSlot: album.cards.length + 2 });
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar la figurita'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async (card: CollectibleCard) => {
    if (!album) return;
    try {
      await collectibleApi.deleteCard(card.id);
      refreshAlbum(album.id);
      undoToast(`Borrado: ${card.name}`, async () => {
        try {
          await collectibleApi.createCard(album.id, {
            name: card.name,
            description: card.description,
            rarity: card.rarity,
            icon: card.icon,
            ...(card.imageUrl?.startsWith('/api/') ? { imageUrl: card.imageUrl } : {}),
            slotNumber: card.slotNumber,
          });
          toast.success(`Recuperado: ${card.name}`);
        } catch (error) {
          toast.error(errorMessage(error, 'No se pudo recuperar la figurita'));
        } finally {
          refreshAlbum(album.id);
        }
      });
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo borrar la figurita'));
      refreshAlbum(album.id);
    }
  };

  // ── IA ──
  const confirmAI = async (albumInfo: { name: string; description: string } | null, cards: GeneratedCard[]) => {
    const toCard = (card: GeneratedCard) => ({ name: card.name, description: card.description || null, rarity: card.rarity, icon: card.icon ?? null });
    try {
      if (albumInfo) {
        // El precio sale solo del oro de la clase; el premio (una insignia) se elige luego en «Configurar».
        const created = await collectibleApi.createAlbum(classroom.id, {
          name: albumInfo.name,
          description: albumInfo.description || null,
        });
        await collectibleApi.createManyCards(created.id, cards.map(toCard));
        toast.success(`Álbum creado con ${cards.length} figuritas`);
        refreshAlbum(created.id);
        setView({ kind: 'album', albumId: created.id });
      } else if (album) {
        await collectibleApi.createManyCards(album.id, cards.map(toCard));
        toast.success(`${cards.length} figurita${cards.length !== 1 ? 's' : ''} añadida${cards.length !== 1 ? 's' : ''}`);
        refreshAlbum(album.id);
      }
      setAiMode(null);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar lo generado'));
    }
  };

  // ── Copiar / mover ──
  const cloneAlbum = async (sourceId: string, targets: string[]) => {
    setSaving(true);
    try {
      const result = await collectibleApi.cloneAlbum(sourceId, targets);
      toast.success(`${result.sourceAlbumName} copiado a ${result.created.length} clase${result.created.length !== 1 ? 's' : ''}${result.skippedRewardBadge ? ' (sin la insignia, que es de esta clase)' : ''}`);
      refreshAlbum(null);
      setTransfer(null);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo copiar el álbum'));
    } finally {
      setSaving(false);
    }
  };

  const moveCards = async (targetAlbumId: string, cardIds: string[]) => {
    if (!album) return;
    setSaving(true);
    try {
      const result = await collectibleApi.moveCards(album.id, targetAlbumId, cardIds);
      toast.success(`${result.movedCount} figurita${result.movedCount !== 1 ? 's' : ''} movida${result.movedCount !== 1 ? 's' : ''} a ${result.targetAlbumName}`);
      refreshAlbum(album.id);
      queryClient.invalidateQueries({ queryKey: albumKey(targetAlbumId) });
      setTransfer(null);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron mover las figuritas'));
    } finally {
      setSaving(false);
    }
  };

  let content;
  if (view.kind === 'list') {
    content = isLoading ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/60 dark:bg-gray-800/60" />)}
      </div>
    ) : (
      <AlbumListView
        albums={albums}
        onOpen={(a) => setView({ kind: 'album', albumId: a.id })}
        onBrowse={(a) => void openBook(a)}
        onCreate={() => setAlbumForm({ kind: 'create' })}
        onCreateWithAI={() => setAiMode('album')}
        onImport={() => setTransfer('import')}
        onRestore={(a) => void setAlbumActive(a, true)}
      />
    );
  } else if (!album) {
    content = <div className="h-64 animate-pulse rounded-2xl bg-white/60 dark:bg-gray-800/60" />;
  } else if (view.kind === 'album') {
    content = (
      <AlbumDetailView
        album={album}
        owners={owners}
        onBack={() => setView({ kind: 'list' })}
        onBrowse={() => setBook({ album, subtitle: 'Vista previa: así se ve con todas las figuritas' })}
        onProgress={() => setView({ kind: 'progress', albumId: album.id })}
        onAddCard={() => setCardForm({ kind: 'create', nextSlot: album.cards.length + 1 })}
        onAddWithAI={() => setAiMode('cards')}
        onEditCard={(card, count) => setCardForm({ kind: 'edit', card, owners: count })}
        onDeleteCard={(card) => void deleteCard(card)}
        onConfigure={() => setAlbumForm({ kind: 'edit', album })}
        onExport={() => setTransfer('export')}
        onMove={() => setTransfer('move')}
        onArchive={() => void setAlbumActive(album, false)}
      />
    );
  } else {
    content = (
      <ProgressView
        album={album}
        classroomId={classroom.id}
        nameOf={nameOf}
        onBack={() => setView({ kind: 'album', albumId: album.id })}
        onBrowseStudent={(_, owned, name) => setBook({ album, owned, subtitle: `Álbum de ${name}` })}
      />
    );
  }

  return (
    <>
      {content}

      <AnimatePresence>
        {book && <AlbumBook key="book" album={book.album} owned={book.owned} subtitle={book.subtitle} onClose={() => setBook(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {albumForm && (
          <AlbumFormModal
            key={albumForm.kind === 'edit' ? `edit-${albumForm.album.id}` : 'create'}
            target={albumForm}
            classroomId={classroom.id}
            isSaving={saving}
            onClose={() => setAlbumForm(null)}
            onSubmit={saveAlbum}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cardForm && (
          <CardFormModal
            key={cardForm.kind === 'edit' ? `edit-${cardForm.card.id}` : 'create'}
            target={cardForm}
            isSaving={saving}
            onClose={() => setCardForm(null)}
            onSubmit={saveCard}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {aiMode && (
          <AICollectiblesModal
            key={aiMode}
            mode={aiMode}
            classroomId={classroom.id}
            albumName={album?.name}
            firstSlot={aiMode === 'cards' && album ? album.cards.length + 1 : 1}
            onClose={() => setAiMode(null)}
            onConfirm={confirmAI}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {transfer === 'import' && (
          <ImportAlbumModal key="import" sources={importSources} isLoading={loadingSources} isSubmitting={saving} onClose={() => setTransfer(null)} onSubmit={(id) => void cloneAlbum(id, [classroom.id])} />
        )}
        {transfer === 'export' && album && (
          <ExportAlbumModal key="export" album={album} classrooms={myClassrooms.filter((c) => c.id !== classroom.id)} isLoading={loadingClassrooms} isSubmitting={saving} onClose={() => setTransfer(null)} onSubmit={(targets) => void cloneAlbum(album.id, targets)} />
        )}
        {transfer === 'move' && album && (
          <MoveCardsModal key="move" album={album} targets={albums.filter((a) => a.id !== album.id)} isSubmitting={saving} onClose={() => setTransfer(null)} onSubmit={(target, ids) => void moveCards(target, ids)} />
        )}
      </AnimatePresence>
    </>
  );
};
