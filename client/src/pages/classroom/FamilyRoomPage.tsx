import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { HeartHandshake, KeyRound, Printer, WifiOff } from 'lucide-react';
import { classroomApi } from '../../lib/classroomApi';
import { familyRoomApi, familyRoomKeys, type RoomKind, type RoomMessage } from '../../lib/familyRoomApi';
import { openParentFlyers } from '../../lib/parentFlyers';
import { useFamilyRoom } from '../../hooks/useFamilyRoom';
import { useAuthStore } from '../../store/authStore';
import { useProjectorStore } from '../../store/projectorStore';
import { Switch } from '../../components/settings/settingsUi';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { primaryButton } from '../../components/home/homeHelpers';
import { secondaryButton } from '../../components/gradebook/gradebookHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import { RoomThread } from '../../components/familyRoom/RoomThread';
import { RoomComposer } from '../../components/familyRoom/RoomComposer';
import { FamiliesTab } from '../../components/familyRoom/FamiliesTab';
import { familyOfMap } from '../../components/familyRoom/roomFormat';

type Tab = 'room' | 'families';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lleva al final el contenedor que desplaza la página: así el cuadro fijo de abajo no tapa lo último. */
const scrollToEnd = (from: HTMLElement | null, smooth: boolean) => {
  let node = from?.parentElement ?? null;
  while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) node = node.parentElement;
  const target = node ?? document.scrollingElement;
  target?.scrollTo({ top: target.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
};

/**
 * «Familias» del docente: una sola sala con sus avisos (con «visto por») y, si él la abre, la conversación
 * con las familias; y la pestaña Familias para invitar, aprobar y ver los códigos.
 */
export const FamilyRoomPage = () => {
  const { id: classroomId } = useParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id) ?? '';
  const projecting = useProjectorStore((s) => s.projecting);
  const setProjecting = useProjectorStore((s) => s.setProjecting);
  const [tab, setTab] = useState<Tab>('room');
  const [onlyNotices, setOnlyNotices] = useState(false);
  const [toDelete, setToDelete] = useState<RoomMessage | null>(null);
  const switchLabel = useId();

  const { data: classroom } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: () => classroomApi.getById(classroomId!),
    enabled: !!classroomId,
  });
  const families = useQuery({
    queryKey: familyRoomKeys.families(classroomId ?? ''),
    queryFn: () => familyRoomApi.families(classroomId!),
    enabled: !!classroomId && !projecting,
  });
  const room = useFamilyRoom(classroomId, { role: 'TEACHER', reading: tab === 'room' && !projecting });
  const familyOf = useMemo(() => familyOfMap(families.data), [families.data]);
  const familiesCount = families.data?.totals.families ?? 0;
  const pending = families.data?.totals.pending ?? 0;
  const hasMessages = room.messages.some((m) => m.kind === 'MESSAGE');
  const shown = onlyNotices ? room.messages.filter((m) => m.kind === 'ANNOUNCEMENT') : room.messages;

  // Al final del hilo: al entrar y cuando llega algo nuevo, si ya se estaba mirando el final.
  const endRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  const firstScroll = useRef(true);
  useEffect(() => {
    const end = endRef.current;
    const thread = threadRef.current;
    if (!end || !thread) return;
    const observer = new IntersectionObserver(([entry]) => { nearEnd.current = entry.isIntersecting; }, { rootMargin: '0px 0px 200px 0px' });
    observer.observe(end);
    // El hilo crece después del primer dibujo (letras, nombres de las familias): si se miraba el final, seguirlo.
    const growth = new ResizeObserver(() => { if (nearEnd.current) scrollToEnd(end, false); });
    growth.observe(thread);
    return () => {
      observer.disconnect();
      growth.disconnect();
    };
  }, [tab, room.query.isSuccess]);
  // Antes que el efecto de abajo: al volver a la Sala (o cambiar de clase) se baja de nuevo al final.
  useEffect(() => { firstScroll.current = true; }, [tab, classroomId]);
  const latestId = room.messages[room.messages.length - 1]?.id;
  useEffect(() => {
    if (!latestId || tab !== 'room') return;
    if (firstScroll.current || nearEnd.current) {
      scrollToEnd(endRef.current, !firstScroll.current && !reducedMotion());
      firstScroll.current = false;
    }
  }, [latestId, tab]);

  const send = async (kind: RoomKind, text: string) => {
    try {
      await room.post.mutateAsync({ kind, text });
      nearEnd.current = true;
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo publicar'));
      return false;
    }
  };
  const toggleOpen = (next: boolean) => {
    room.setOpen.mutate(next, {
      onSuccess: () => toast.success(next ? 'Las familias ya pueden escribir' : 'Conversación cerrada: solo tú publicas'),
      onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar la sala')),
    });
  };
  const confirmDelete = () => {
    if (!toDelete) return;
    room.remove.mutate(toDelete.id, {
      onSuccess: () => { setToDelete(null); toast.success('Borrado para todos'); },
      onError: (error) => toast.error(errorMessage(error, 'No se pudo borrar')),
    });
  };
  const printFlyers = async () => {
    const result = await openParentFlyers(classroomId!);
    if ('error' in result) toast.error(result.error);
    void families.refetch();
  };

  // Proyectando: aquí hay códigos, nombres de familias y mensajes privados. No se muestra nada.
  if (projecting) {
    return (
      <div data-pg="" className="mx-auto mt-6 max-w-lg rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
          <span className="text-4xl">📽️</span><span className="text-5xl">🙈</span><span className="text-4xl">🔒</span>
        </div>
        <h1 className="mt-4 text-lg font-bold pg-fg">Familias está oculta mientras proyectas</h1>
        <p className="mx-auto mt-1 max-w-md text-sm pg-fg2">Aquí hay códigos, nombres de las familias y mensajes que no son para la clase.</p>
        <button type="button" onClick={() => setProjecting(false)} className={`${primaryButton} mt-5`}>Dejar de proyectar</button>
      </div>
    );
  }

  return (
    <div data-pg="" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-blue-600/25" aria-hidden="true">
            <HeartHandshake size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold pg-fg">Familias</h1>
            <p className="text-sm pg-fg2">Avisos y conversación con las familias{classroom?.name ? ` de ${classroom.name}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--pg-line)] bg-[var(--pg-surface)] py-0.5 pl-3 pr-1 sm:justify-start">
          <span id={switchLabel} className="text-sm font-semibold pg-fg">Las familias pueden escribir</span>
          <Switch checked={room.isOpen} onChange={toggleOpen} disabled={!room.query.isSuccess || room.setOpen.isPending} labelledBy={switchLabel} />
        </div>
      </div>

      <div className="pg-seg" role="group" aria-label="Sección">
        <button type="button" onClick={() => setTab('room')} aria-pressed={tab === 'room'} className="pg-seg-item">Sala</button>
        <button type="button" onClick={() => setTab('families')} aria-pressed={tab === 'families'} className="pg-seg-item">
          Familias {families.data ? `${families.data.totals.withFamily}/${families.data.totals.students}` : ''}
          {pending > 0 && <span className="pg-gold px-2 text-xs font-bold">{pending} por aprobar</span>}
        </button>
      </div>

      {tab === 'families' ? (
        <FamiliesTab classroomId={classroomId!} classroomName={classroom?.name ?? 'la clase'} data={families.data} isLoading={families.isLoading} isError={families.isError} />
      ) : (
        <div className="space-y-3">
          {families.isSuccess && familiesCount === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-10 text-center dark:border-gray-600 dark:bg-gray-800/60">
              <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
                <span className="text-4xl">🏡</span><span className="text-5xl">👨‍👩‍👧</span><span className="text-4xl">📣</span>
              </div>
              <h2 className="mt-4 text-lg font-bold pg-fg">Invita a las familias{classroom?.name ? ` de ${classroom.name}` : ''}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm pg-fg2">
                Cada familia se une con el código de su hijo o hija y tú la apruebas. Desde ahí recibe tus avisos y ve su progreso.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => void printFlyers()} className={primaryButton}>
                  <Printer size={16} aria-hidden="true" />
                  Imprimir folletos
                </button>
                <button type="button" onClick={() => setTab('families')} className={secondaryButton}>
                  <KeyRound size={16} aria-hidden="true" />
                  Ver códigos
                </button>
              </div>
            </div>
          )}

          <section aria-label="Sala de familias" className="pg-surface">
            {(hasMessages || !room.connected) && (
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--pg-line)] px-3 py-2">
                {hasMessages && (
                  <button type="button" onClick={() => setOnlyNotices((value) => !value)} aria-pressed={onlyNotices} className="pg-chip">Solo avisos</button>
                )}
                {!room.connected && room.query.isSuccess && (
                  <p className="ml-auto inline-flex items-center gap-1.5 text-xs pg-fg2">
                    <WifiOff size={14} aria-hidden="true" />
                    Sin conexión en vivo: se actualiza cada 30 s
                  </p>
                )}
              </div>
            )}
            <div ref={threadRef} className="px-3 py-4 sm:px-4">
              {room.query.isLoading ? (
                <p className="py-10 text-center text-sm pg-fg2">Cargando la sala…</p>
              ) : room.query.isError ? (
                <div className="py-10 text-center">
                  <p className="text-sm pg-alert">No se pudo cargar la sala.</p>
                  <button type="button" onClick={() => void room.query.refetch()} className="pg-btn mt-3">Reintentar</button>
                </div>
              ) : shown.length === 0 ? (
                <p className="py-10 text-center text-sm pg-fg2">
                  Aún no hay avisos. Escribe el primero abajo{familiesCount > 0 ? ': le llegará a cada familia.' : ': lo verán las familias al unirse.'}
                </p>
              ) : (
                <RoomThread
                  classroomId={classroomId!}
                  messages={shown}
                  viewerId={userId}
                  viewerRole="TEACHER"
                  familyOf={familyOf}
                  onDelete={setToDelete}
                  hasOlder={room.hasOlder}
                  loadingOlder={room.loadingOlder}
                  onLoadOlder={() => void room.loadOlder()}
                />
              )}
              <div ref={endRef} aria-hidden="true" />
            </div>
            {/* Pegado al borde de abajo: el desfase negativo cubre el relleno del contenedor que desplaza
                (p-4 / md:p-6), si no el hilo se vería pasar por debajo del cuadro. */}
            <div className="sticky -bottom-4 z-10 rounded-b-xl border-t border-[var(--pg-line)] bg-[var(--pg-surface)] px-3 pt-3 [padding-bottom:calc(1.75rem+env(safe-area-inset-bottom))] sm:px-4 md:-bottom-6 md:[padding-bottom:calc(2.25rem+env(safe-area-inset-bottom))]">
              <RoomComposer role="TEACHER" isOpen={room.isOpen} familiesCount={familiesCount} sending={room.post.isPending} onSend={send} />
            </div>
          </section>
        </div>
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="¿Borrar para todos?"
        message={toDelete?.kind === 'ANNOUNCEMENT'
          ? 'El aviso desaparece para todas las familias; en su lugar queda «Aviso retirado».'
          : 'El mensaje desaparece para todos; en su lugar queda «Mensaje borrado».'}
        confirmText="Borrar"
        isLoading={room.remove.isPending}
      />
    </div>
  );
};

export default FamilyRoomPage;
