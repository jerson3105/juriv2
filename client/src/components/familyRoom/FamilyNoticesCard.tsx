import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Megaphone } from 'lucide-react';
import { familyRoomApi } from '../../lib/familyRoomApi';
import { dayLabel, timeLabel } from './roomFormat';

/**
 * Inicio de la familia: lo primero es saber si hay algo nuevo de la clase. Último aviso y cuántos
 * mensajes nuevos hay, con el acceso a la sala.
 */
export const FamilyNoticesCard = ({ classroomId, classroomName }: { classroomId: string; classroomName: string }) => {
  const latest = useQuery({
    queryKey: ['family-room-latest', classroomId],
    queryFn: () => familyRoomApi.page(classroomId, null, 20),
    staleTime: 30_000,
  });
  const unread = useQuery({
    queryKey: ['family-room-unread', classroomId],
    queryFn: () => familyRoomApi.unread(classroomId),
    staleTime: 30_000,
  });
  const notice = [...(latest.data?.messages ?? [])].reverse().find((m) => m.kind === 'ANNOUNCEMENT' && !m.isDeleted);
  const count = unread.data ?? 0;

  return (
    <section data-pg="" aria-labelledby="family-notices" className="pg-surface p-4">
      <div className="flex items-center gap-2">
        <Megaphone size={18} className="text-[var(--pg-accent-fg)]" aria-hidden="true" />
        <h2 id="family-notices" className="flex-1 font-bold pg-fg">Avisos de {classroomName}</h2>
        {count > 0 && <span className="pg-gold px-2.5 py-0.5 text-xs font-bold">{count === 1 ? '1 nuevo' : `${count} nuevos`}</span>}
      </div>
      {latest.isLoading ? (
        <p className="mt-2 text-sm pg-fg2">Cargando…</p>
      ) : notice ? (
        <div className="mt-2">
          <p className="line-clamp-2 whitespace-pre-wrap text-sm pg-fg [overflow-wrap:anywhere]">{notice.message}</p>
          <p className="mt-1 text-xs pg-fg2">{notice.senderName} · {dayLabel(notice.createdAt)}, {timeLabel(notice.createdAt)}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm pg-fg2">Aún no hay avisos. Cuando su docente publique uno, lo verás aquí.</p>
      )}
      <Link to="/parent/avisos" className="pg-row-link mt-2 inline-flex min-h-[2.75rem] items-center gap-1 text-sm font-semibold text-[var(--pg-accent-fg)]">
        Ver todos los avisos <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
};
