import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Coins } from 'lucide-react';
import { useStudentStore } from '../../store/studentStore';
import { studentApi } from '../../lib/studentApi';
import { collectibleApi, type AlbumCompletion, type OpenPackResult, type StickerView, type StudentAlbumView, type StudentCollectiblesView } from '../../lib/collectibleApi';
import type { StoryAccent } from '../../lib/storyTheme';
import { RestingBanner } from '../../components/energy/RestingBanner';
import { ErrorCard, StudentPageHeader } from '../../components/student/StudentPageHeader';
import { HomeEmptyState } from '../../components/student/home/HomeEmptyState';
import { gold, savingsTrack } from '../../components/student/shop/shopStudentHelpers';
import { StickerBook } from '../../components/collectibles/student/StickerBook';
import { AlbumPanel } from '../../components/collectibles/student/AlbumPanel';
import { OpenPackModal } from '../../components/collectibles/student/OpenPackModal';
import { CompletionCard, StickerDetailModal, StickerListsModal, WhatCanComeModal } from '../../components/collectibles/student/StickerModals';
import { myCollectiblesKey, pageOfCard, percentOf, readSavedPage, savePage, slotsPerPage } from '../../components/collectibles/student/stickerHelpers';

type MyClass = Awaited<ReturnType<typeof studentApi.getMyClasses>>[number];
type Modal =
  // El álbum y el oro de cuando se abrió la mesa: la vista se refresca detrás mientras se voltean.
  | { kind: 'open'; mode: 'pack' | 'welcome'; album: StudentAlbumView; view: StudentCollectiblesView }
  | { kind: 'detail'; card: StickerView }
  | { kind: 'lists' }
  | { kind: 'rules' }
  | null;

const tab = 'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors';
const tabOn = 'border-amber-800 bg-amber-800 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-amber-950';
const tabOff = 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

const Skeleton = () => (
  <div role="status" aria-label="Cargando tu álbum" className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="h-[26rem] rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
      <div className="h-36 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
      <div className="h-44 rounded-2xl bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700" />
    </div>
  </div>
);

const CollectiblesContent = ({ profile, storyAccent }: { profile: MyClass; storyAccent: StoryAccent | null }) => {
  const queryClient = useQueryClient();
  const [completions, setCompletions] = useState<AlbumCompletion[]>([]);
  const celebrate = useCallback((items: AlbumCompletion[]) => {
    if (items.length) setCompletions((prev) => [...prev, ...items.filter((item) => !prev.some((p) => p.albumId === item.albumId))]);
  }, []);
  // El profe da oro en clase: al volver a la pestaña se refresca. Si un álbum se completó al mirar (la última
  // figurita llegó por la Historia), se celebra aquí.
  const query = useQuery({
    queryKey: myCollectiblesKey(profile.id),
    queryFn: async () => {
      const data = await collectibleApi.getStudentView(profile.id);
      celebrate(data.justCompleted);
      // El premio pudo traer oro: la barra superior lo toma de «mis clases».
      if (data.justCompleted.length) void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      return data;
    },
    refetchOnWindowFocus: true,
  });
  const view = query.data;
  const [albumId, setAlbumId] = useState<string | null>(null);
  const album = view?.albums.find((a) => a.id === albumId) ?? view?.albums[0] ?? null;
  const [pages, setPages] = useState<Record<string, number>>({});
  const page = album ? pages[album.id] ?? readSavedPage(profile.id, album.id) : 0;
  const [modal, setModal] = useState<Modal>(null);
  const [pressIds, setPressIds] = useState<Set<string>>(() => new Set());
  const focusCardId = useRef<string | null>(null);

  const goToPage = useCallback((target: number, id = album?.id) => {
    if (!id) return;
    setPages((prev) => ({ ...prev, [id]: target }));
    savePage(profile.id, id, target);
  }, [album?.id, profile.id]);

  const onPressed = useCallback((ids: string[]) => {
    setPressIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  // Después de un sobre o de elegir un número, el foco va a la figurita en el libro.
  useEffect(() => {
    const id = focusCardId.current;
    if (!id || modal) return;
    focusCardId.current = null;
    document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)?.focus();
  }, [page, pressIds, modal]);

  const jumpToCard = (card: StickerView) => {
    if (!album) return;
    focusCardId.current = card.id;
    goToPage(pageOfCard(album.cards, card.id, slotsPerPage(!!view?.young)));
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: myCollectiblesKey(profile.id) });
    void queryClient.invalidateQueries({ queryKey: ['my-classes'] });
    void queryClient.invalidateQueries({ queryKey: ['my-progress', profile.id] });
  };

  // Al cerrar la mesa: el libro salta a la primera nueva (sin girar), las nuevas se aprietan en su casilla y,
  // si el sobre completó el álbum, se celebra en la página.
  const closePack = (result: OpenPackResult | null) => {
    setModal(null);
    refresh();
    if (!result || !album) return;
    const fresh = result.cards.filter((card) => card.isNew);
    if (fresh.length) {
      setPressIds(new Set(fresh.map((card) => card.id)));
      jumpToCard(fresh.sort((a, b) => a.slotNumber - b.slotNumber)[0]);
    }
    if (result.completed) celebrate([result.completed]);
  };

  const header = (
    <StudentPageHeader
      title="Coleccionables"
      subtitle={`${view?.classroomName ?? profile.classroom.name} · llena tu álbum de figuritas`}
      emoji="📖"
      storyAccent={storyAccent}
    />
  );

  if (query.isLoading) return <div className="space-y-5">{header}<Skeleton /></div>;
  if (query.isError || !view) {
    return (
      <div className="space-y-5">
        {header}
        <ErrorCard text="No pudimos cargar tu álbum." onRetry={() => void query.refetch()} />
      </div>
    );
  }
  if (!album) {
    return (
      <div className="space-y-5">
        {header}
        <HomeEmptyState
          emojis={['📦', '📖', '✨']}
          title="Tu profe aún no prepara un álbum"
          text="Cuando lo haga, aquí vas a juntar figuritas abriendo sobres."
          primary={{ label: 'Ver mi progreso', to: '/my-progress' }}
          secondary={{ label: 'Volver al inicio', to: '/my-class' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      {view.kiosk.reason === 'RESTING' && <RestingBanner profileId={profile.id} />}
      {completions.map((completion) => (
        <CompletionCard
          key={completion.albumId}
          completion={completion}
          onShowAlbum={() => {
            setAlbumId(completion.albumId);
            goToPage(0, completion.albumId);
          }}
          onClose={() => setCompletions((prev) => prev.filter((item) => item.albumId !== completion.albumId))}
        />
      ))}

      {view.albums.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tus álbumes">
          {view.albums.map((entry) => (
            <button key={entry.id} type="button" aria-pressed={entry.id === album.id} onClick={() => setAlbumId(entry.id)} className={`${tab} ${entry.id === album.id ? tabOn : tabOff}`}>
              {entry.name}
              <span className="font-semibold">· {entry.owned}/{entry.totalCards}</span>
              {!entry.isActive && <span className="font-semibold">(archivado)</span>}
            </button>
          ))}
        </div>
      )}

      {/* En pantallas chicas, lo esencial arriba del libro (el panel completo va debajo). */}
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800 xl:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{album.owned} de {album.totalCards}</p>
          <div className={`${savingsTrack} mt-1`} aria-hidden="true">
            <div className="h-full rounded-full bg-primary-600 dark:bg-primary-300" style={{ width: `${percentOf(album)}%` }} />
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-900 dark:text-amber-100">
          <Coins size={16} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />
          {gold(view.profile.gold)}
        </span>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <StickerBook
          key={album.id}
          album={album}
          young={view.young}
          page={page}
          onPageChange={(target) => goToPage(target)}
          pressIds={pressIds}
          onPressed={onPressed}
          onSelect={(card) => setModal({ kind: 'detail', card })}
        />
        <AlbumPanel
          view={view}
          album={album}
          onOpen={(mode) => setModal({ kind: 'open', mode, album, view })}
          onShowLists={() => setModal({ kind: 'lists' })}
          onWhatCanCome={() => setModal({ kind: 'rules' })}
        />
      </div>

      <AnimatePresence>
        {modal?.kind === 'open' && (
          <OpenPackModal
            key="open"
            profileId={profile.id}
            view={modal.view}
            album={modal.album}
            mode={modal.mode}
            onOpened={() => refresh()}
            onClose={closePack}
          />
        )}
        {modal?.kind === 'detail' && (
          <StickerDetailModal key="detail" card={modal.card} album={album} young={view.young} onClose={() => setModal(null)} />
        )}
        {modal?.kind === 'lists' && (
          <StickerListsModal
            key="lists"
            album={album}
            onPick={(card) => {
              setModal(null);
              jumpToCard(card);
            }}
            onClose={() => setModal(null)}
          />
        )}
        {modal?.kind === 'rules' && <WhatCanComeModal key="rules" album={album} dailyLimit={view.daily.limit} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
};

/** «Coleccionables»: el álbum de figuritas de la clase elegida (cada clase tiene sus álbumes y su oro). */
export const StudentCollectiblesPage = () => {
  const selectedClassIndex = useStudentStore((s) => s.selectedClassIndex);
  const { storyAccent } = useOutletContext<{ storyAccent?: StoryAccent | null }>();
  const { data: myClasses, isLoading } = useQuery({ queryKey: ['my-classes'], queryFn: studentApi.getMyClasses });
  const profile = myClasses?.[selectedClassIndex];

  if (isLoading) return <Skeleton />;
  if (!profile) return <ErrorCard text="No pudimos abrir tu clase." onRetry={() => window.location.reload()} />;
  return <CollectiblesContent key={profile.id} profile={profile} storyAccent={storyAccent ?? null} />;
};
