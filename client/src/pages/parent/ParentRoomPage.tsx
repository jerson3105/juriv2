import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Clock, Megaphone, WifiOff } from 'lucide-react';
import { useSelectedClassroom } from '../../contexts/SelectedClassroomContext';
import { useFamilyRoom } from '../../hooks/useFamilyRoom';
import { useAuthStore } from '../../store/authStore';
import { verificationApi } from '../../lib/verificationApi';
import type { RoomKind } from '../../lib/familyRoomApi';
import { errorMessage } from '../../components/auth/authHelpers';
import { primaryButton } from '../../components/home/homeHelpers';
import { RoomThread } from '../../components/familyRoom/RoomThread';
import { RoomComposer } from '../../components/familyRoom/RoomComposer';
import { useThreadScroll } from '../../components/familyRoom/useThreadScroll';

/**
 * La familia ve la misma sala que el docente: sus avisos y, si él la abre, la conversación. Con la sala
 * cerrada, en lugar del cuadro para escribir aparece «Por ahora solo el docente publica».
 */
export default function ParentRoomPage() {
  const userId = useAuthStore((s) => s.user?.id) ?? '';
  const { selected, children, isLoading } = useSelectedClassroom();
  const pending = useQuery({
    queryKey: ['parent-pending-links'],
    queryFn: verificationApi.getMyPendingLinks,
    enabled: !isLoading && children.length === 0,
  });
  const classroomId = selected?.classroomId;
  const room = useFamilyRoom(classroomId, { role: 'PARENT', reading: true });
  const { endRef, threadRef, followEnd } = useThreadScroll(room.messages[room.messages.length - 1]?.id, {
    active: !!classroomId,
    ready: room.query.isSuccess,
    resetKey: classroomId,
  });

  const send = async (kind: RoomKind, text: string) => {
    try {
      await room.post.mutateAsync({ kind, text });
      followEnd();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo enviar'));
      return false;
    }
  };

  if (isLoading) return <p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300">Cargando…</p>;

  if (!selected) {
    const waiting = pending.data ?? [];
    return (
      <div data-pg="" className="mx-auto max-w-xl rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
          <span className="text-4xl">📣</span><span className="text-5xl">{waiting.length > 0 ? '⏳' : '👨‍👩‍👧'}</span><span className="text-4xl">🏫</span>
        </div>
        {waiting.length > 0 ? (
          <>
            <h1 className="mt-4 flex items-center justify-center gap-2 text-lg font-bold pg-fg"><Clock size={18} aria-hidden="true" /> Esperando a su docente</h1>
            <p className="mx-auto mt-1 max-w-md text-sm pg-fg2">
              Cuando confirme que eres la familia de {waiting[0].studentName ?? 'tu hijo o hija'}, aquí verás los avisos de {waiting[0].classroomName}.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-lg font-bold pg-fg">Aquí llegarán los avisos de la clase</h1>
            <p className="mx-auto mt-1 max-w-md text-sm pg-fg2">Primero vincula a tu hijo o hija con el código o el enlace que te dio su docente.</p>
            <Link to="/parent" className={`${primaryButton} mt-5`}>Vincular a mi hijo o hija</Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div data-pg="" className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-blue-600/25" aria-hidden="true">
          <Megaphone size={22} />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold pg-fg">Avisos</h1>
          <p className="text-sm pg-fg2">{selected.classroomName}{selected.teacherName ? ` · Docente: ${selected.teacherName}` : ''}</p>
        </div>
      </div>

      <section aria-label={`Sala de ${selected.classroomName}`} className="pg-surface">
        {!room.connected && room.query.isSuccess && (
          <p className="flex items-center gap-1.5 border-b border-[var(--pg-line)] px-3 py-2 text-xs pg-fg2">
            <WifiOff size={14} aria-hidden="true" />
            Sin conexión en vivo: se actualiza cada 30 s
          </p>
        )}
        <div ref={threadRef} className="px-3 py-4 sm:px-4">
          {room.query.isLoading ? (
            <p className="py-10 text-center text-sm pg-fg2">Cargando los avisos…</p>
          ) : room.query.isError ? (
            <div className="py-10 text-center">
              <p className="text-sm pg-alert">No se pudieron cargar los avisos.</p>
              <button type="button" onClick={() => void room.query.refetch()} className="pg-btn mt-3">Reintentar</button>
            </div>
          ) : room.messages.length === 0 ? (
            <p className="py-10 text-center text-sm pg-fg2">Aún no hay avisos. Cuando su docente publique uno, lo verás aquí.</p>
          ) : (
            <RoomThread
              classroomId={selected.classroomId}
              messages={room.messages}
              viewerId={userId}
              viewerRole="PARENT"
              hasOlder={room.hasOlder}
              loadingOlder={room.loadingOlder}
              onLoadOlder={() => void room.loadOlder()}
            />
          )}
          <div ref={endRef} aria-hidden="true" />
        </div>
        <div className="sticky bottom-0 z-10 rounded-b-xl border-t border-[var(--pg-line)] bg-[var(--pg-surface)] px-3 pt-3 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
          <RoomComposer role="PARENT" isOpen={room.isOpen} familiesCount={0} sending={room.post.isPending} onSend={send} />
        </div>
      </section>
    </div>
  );
}
