import { useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCheck, ChevronRight, Copy, Ellipsis, Megaphone, Trash2 } from 'lucide-react';
import { Popover } from '../ui/Popover';
import { familyRoomApi, familyRoomKeys, RELATIONSHIP_LABEL, type RoomMessage } from '../../lib/familyRoomApi';
import { dayLabel, fullDateLabel, joinNames, sameDay, timeLabel } from './roomFormat';

const GROUP_MS = 5 * 60 * 1000;

interface RoomThreadProps {
  classroomId: string;
  messages: RoomMessage[];
  viewerId: string;
  viewerRole: 'TEACHER' | 'PARENT';
  /** Solo docente: «familia de Benja» por cada familia. */
  familyOf?: Map<string, string>;
  /** Solo docente: «Borrar para todos». */
  onDelete?: (message: RoomMessage) => void;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

/** Hilo de la sala: avisos como tarjeta con franja, mensajes como burbujas, días separados. */
export const RoomThread = ({ classroomId, messages, viewerId, viewerRole, familyOf, onDelete, hasOlder, loadingOlder, onLoadOlder }: RoomThreadProps) => {
  const items: ReactNode[] = [];
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    if (!previous || !sameDay(previous.createdAt, message.createdAt)) {
      items.push(<li key={`day-${message.id}`} className="pg-day py-1">{dayLabel(message.createdAt)}</li>);
    }
    const own = message.senderId === viewerId;
    if (message.kind === 'ANNOUNCEMENT') {
      items.push(
        <li key={message.id}>
          {message.isDeleted
            ? <p className="pg-tombstone w-fit">Aviso retirado · {timeLabel(message.createdAt)}</p>
            : (
              <NoticeCard
                message={message}
                showAuthor={viewerRole === 'PARENT'}
                actions={onDelete ? <MessageActions message={message} onDelete={onDelete} /> : null}
                footer={viewerRole === 'TEACHER' ? <ReadersButton classroomId={classroomId} message={message} /> : null}
              />
            )}
        </li>,
      );
      return;
    }
    const startsGroup = !previous
      || previous.kind !== 'MESSAGE'
      || previous.senderId !== message.senderId
      || !sameDay(previous.createdAt, message.createdAt)
      || new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > GROUP_MS;
    const who = own
      ? 'Tú'
      : message.senderRole === 'TEACHER'
        ? `${message.senderName} · docente`
        : `${message.senderName}${familyOf?.get(message.senderId) ? ` · ${familyOf.get(message.senderId)}` : ' · familia'}`;
    items.push(
      <li key={message.id} className={`flex flex-col ${own ? 'items-end' : 'items-start'} ${startsGroup ? 'pt-1' : ''}`}>
        {startsGroup && (
          <p className="mb-1 px-1 text-xs font-semibold pg-fg2">
            {who} · <time dateTime={message.createdAt} title={fullDateLabel(message.createdAt)}>{timeLabel(message.createdAt)}</time>
          </p>
        )}
        <div className={`flex max-w-full items-center gap-1 ${own ? 'flex-row-reverse' : ''}`}>
          {message.isDeleted ? (
            <p className="pg-tombstone">Mensaje borrado</p>
          ) : (
            <p className={`pg-bubble ${own ? 'pg-bubble-own' : message.senderRole === 'TEACHER' ? 'pg-bubble-teacher' : ''}`}>
              {!startsGroup && <span className="sr-only">{who}: </span>}
              {message.message}
            </p>
          )}
          {onDelete && !message.isDeleted && <MessageActions message={message} onDelete={onDelete} />}
        </div>
      </li>,
    );
  });

  return (
    <div className="space-y-3">
      {hasOlder && (
        <div className="flex justify-center">
          <button type="button" onClick={onLoadOlder} disabled={loadingOlder} className="pg-btn">
            {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
          </button>
        </div>
      )}
      <ol role="log" aria-label="Mensajes de la sala" className="space-y-2">
        {items}
      </ol>
    </div>
  );
};

export const NoticeCard = ({ message, showAuthor, actions, footer }: {
  message: RoomMessage;
  showAuthor: boolean;
  actions?: ReactNode;
  footer?: ReactNode;
}) => (
  <article className="pg-notice px-4 py-3" aria-label={`Aviso del ${fullDateLabel(message.createdAt)}`}>
    <div className="flex items-start gap-2">
      <p className="flex min-h-[2.5rem] flex-1 flex-wrap items-center gap-x-1.5 text-xs font-bold uppercase tracking-wide text-[var(--pg-accent-fg)]">
        <Megaphone size={14} aria-hidden="true" />
        <span>Aviso</span>
        {showAuthor && <span className="normal-case tracking-normal">· {message.senderName}</span>}
        <span aria-hidden="true">·</span>
        <time dateTime={message.createdAt} className="normal-case tracking-normal">{timeLabel(message.createdAt)}</time>
      </p>
      {actions}
    </div>
    <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed [overflow-wrap:anywhere]">{message.message}</p>
    {footer}
  </article>
);

const MessageActions = ({ message, onDelete }: { message: RoomMessage; onDelete: (message: RoomMessage) => void }) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const label = message.kind === 'ANNOUNCEMENT' ? 'Opciones del aviso' : 'Opciones del mensaje';
  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="pg-icon-btn"
      >
        <Ellipsis size={18} aria-hidden="true" />
      </button>
      <Popover open={open} onClose={(restore) => { setOpen(false); if (restore) anchor.current?.focus(); }} anchorRef={anchor} label={label}>
        <button type="button" className="pg-menu-item pg-alert" onClick={() => { setOpen(false); onDelete(message); }}>
          <Trash2 size={16} aria-hidden="true" />
          Borrar para todos
        </button>
      </Popover>
    </>
  );
};

/** «Visto por 18 de 25 · Faltan 7 ›»: escrito, y al tocarlo, quiénes faltan (solo lo ve el docente). */
const ReadersButton = ({ classroomId, message }: { classroomId: string; message: RoomMessage }) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const { seen = 0, total = 0 } = message.seen ?? {};
  if (total === 0) return <p className="mt-2 text-sm pg-fg2">Aún no hay familias en la sala: lo verán al unirse.</p>;
  const missing = Math.max(total - seen, 0);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="pg-row-link mt-1 inline-flex min-h-[2.75rem] items-center gap-1.5 text-sm font-semibold pg-fg2"
      >
        <CheckCheck size={16} aria-hidden="true" />
        {missing === 0 ? `Visto por todas (${total})` : `Visto por ${seen} de ${total} · Faltan ${missing}`}
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      <Popover open={open} onClose={(restore) => { setOpen(false); if (restore) anchor.current?.focus(); }} anchorRef={anchor} label="Quién vio el aviso" align="start">
        <ReadersPanel classroomId={classroomId} message={message} />
      </Popover>
    </>
  );
};

const ReadersPanel = ({ classroomId, message }: { classroomId: string; message: RoomMessage }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: familyRoomKeys.readers(classroomId, message.id),
    queryFn: () => familyRoomApi.readers(classroomId, message.id),
  });
  if (isLoading) return <p className="px-3 py-2 text-sm pg-fg2">Cargando…</p>;
  if (isError || !data) return <p className="px-3 py-2 text-sm pg-alert">No se pudo cargar quién lo vio.</p>;

  const copy = () => {
    void navigator.clipboard.writeText(message.message ?? '')
      .then(() => toast.success('Aviso copiado: pégalo en el chat de quienes faltan'))
      .catch(() => toast.error('No se pudo copiar'));
  };
  const row = (family: (typeof data.seen)[number]) => (
    <li key={family.userId} className="px-3 py-1.5 text-sm">
      <span className="font-semibold">{family.name}</span>
      <span className="pg-fg2"> · {RELATIONSHIP_LABEL[family.relationship]} de {joinNames(family.students)}</span>
    </li>
  );
  return (
    <div className="w-[min(20rem,calc(100vw-2rem))]">
      <p className="pg-menu-label">Faltan ({data.missing.length})</p>
      {data.missing.length === 0
        ? <p className="px-3 pb-2 text-sm pg-fg2">Todas las familias lo vieron.</p>
        : <ul>{data.missing.map(row)}</ul>}
      {data.seen.length > 0 && (
        <>
          <div className="pg-menu-sep" />
          <p className="pg-menu-label">Lo vieron ({data.seen.length})</p>
          <ul>{data.seen.map(row)}</ul>
        </>
      )}
      {data.missing.length > 0 && (
        <>
          <div className="pg-menu-sep" />
          <button type="button" className="pg-menu-item" onClick={copy}>
            <Copy size={16} aria-hidden="true" />
            Copiar el aviso para recordárselo
          </button>
        </>
      )}
    </div>
  );
};
