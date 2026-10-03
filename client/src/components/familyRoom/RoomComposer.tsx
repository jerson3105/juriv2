import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Lock, SendHorizontal } from 'lucide-react';
import { primaryButton } from '../home/homeHelpers';
import { MESSAGE_MAX_LENGTH, type RoomKind } from '../../lib/familyRoomApi';

interface RoomComposerProps {
  role: 'TEACHER' | 'PARENT';
  /** La conversación está abierta: las familias pueden escribir. */
  isOpen: boolean;
  /** Docente: familias vinculadas, para «Enviar a N familias». */
  familiesCount: number;
  sending: boolean;
  /** Devuelve true si se publicó (entonces se limpia el cuadro). */
  onSend: (kind: RoomKind, text: string) => Promise<boolean>;
}

const COUNTER_FROM = MESSAGE_MAX_LENGTH - 400;

/**
 * Cuadro para escribir en la sala. El docente elige «Aviso» (notifica y lleva «visto») o «Mensaje».
 * En computadora, Enter envía y Shift+Enter hace un salto de línea; en el celular, Enter es salto de línea.
 */
export const RoomComposer = ({ role, isOpen, familiesCount, sending, onSend }: RoomComposerProps) => {
  const [kind, setKind] = useState<RoomKind>(role === 'TEACHER' ? 'ANNOUNCEMENT' : 'MESSAGE');
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const hintId = useId();

  // Crece con el texto hasta ~8 líneas.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  if (role === 'PARENT' && !isOpen) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-[var(--pg-line)] bg-[var(--pg-hover)] px-4 py-3 text-sm font-medium pg-fix">
        <Lock size={16} aria-hidden="true" />
        Por ahora solo el docente publica en la sala.
      </p>
    );
  }

  const trimmed = text.trim();
  const send = async () => {
    if (!trimmed || sending) return;
    if (await onSend(kind, trimmed)) {
      setText('');
      // Sin desplazar: el cuadro está fijo abajo y el navegador movía hasta el contenedor del aula.
      area.current?.focus({ preventScroll: true });
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    event.preventDefault();
    void send();
  };

  const isNotice = kind === 'ANNOUNCEMENT';
  const sendLabel = !isNotice
    ? 'Enviar'
    : familiesCount > 0 ? `Enviar a ${familiesCount} ${familiesCount === 1 ? 'familia' : 'familias'}` : 'Publicar aviso';
  const help = role === 'PARENT'
    ? 'Lo ven el docente y las familias de la clase.'
    : isNotice
      ? 'Un aviso notifica a cada familia y muestra quién lo vio.'
      : isOpen ? 'Un mensaje no notifica a las familias.' : 'Las familias lo leen, pero no pueden responder: la conversación está cerrada.';

  return (
    <div className="space-y-2">
      {role === 'TEACHER' && (
        <div className="pg-seg" role="group" aria-label="Tipo de publicación">
          <button type="button" onClick={() => setKind('ANNOUNCEMENT')} aria-pressed={isNotice} className="pg-seg-item">Aviso</button>
          <button type="button" onClick={() => setKind('MESSAGE')} aria-pressed={!isNotice} className="pg-seg-item">Mensaje</button>
        </div>
      )}
      {/* En el celular el botón va debajo: a su lado el cuadro quedaba de tres palabras de ancho. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{isNotice ? 'Escribe un aviso' : 'Escribe un mensaje'}</span>
          <textarea
            ref={area}
            rows={1}
            value={text}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            aria-describedby={hintId}
            placeholder={isNotice ? 'Escribe un aviso para las familias…' : 'Escribe un mensaje…'}
            className="pg-focus block w-full resize-none rounded-xl border border-[var(--pg-control)] bg-[var(--pg-surface)] px-3 py-2.5 text-base leading-6 pg-fg placeholder:text-[var(--pg-fg2)] sm:text-sm"
          />
        </label>
        <button type="button" onClick={() => void send()} disabled={!trimmed || sending} className={`${primaryButton} flex-shrink-0 self-end`}>
          <SendHorizontal size={16} aria-hidden="true" />
          {sending ? 'Enviando…' : sendLabel}
        </button>
      </div>
      <p id={hintId} className="flex flex-wrap justify-between gap-x-3 text-xs pg-fg2">
        <span>{help}</span>
        <span className="hidden [@media(pointer:fine)]:inline">Enter envía · Shift + Enter, nueva línea</span>
        {text.length >= COUNTER_FROM && <span aria-live="polite">{text.length}/{MESSAGE_MAX_LENGTH}</span>}
      </p>
    </div>
  );
};
