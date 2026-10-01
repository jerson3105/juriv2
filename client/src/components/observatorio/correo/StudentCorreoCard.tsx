import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Send } from 'lucide-react';
import { correoApi, correoKeys } from '../../../lib/correoApi';

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });

/**
 * Correo Estelar para el alumno: a quién escribirle (si hay Correo abierto en su clase) y las
 * cartas aprobadas que recibió, sin autor. `embedded`: dentro de un modal (sin marco ni título).
 * El nombre del destinatario queda oculto hasta pedirlo (el compañero de al lado podría leerlo).
 */
export const StudentCorreoCard = ({ profileId, embedded = false }: { profileId: string; embedded?: boolean }) => {
  const queryClient = useQueryClient();
  const textareaId = useId();
  const [message, setMessage] = useState('');
  const [showName, setShowName] = useState(false);
  const { data } = useQuery({
    queryKey: correoKeys.mine(profileId),
    queryFn: () => correoApi.mine(profileId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const send = useMutation({
    mutationFn: () => correoApi.send(profileId, message.trim()),
    onSuccess: () => {
      setMessage('');
      toast.success('¡Carta enviada! Tu profe la revisará.');
      void queryClient.invalidateQueries({ queryKey: correoKeys.mine(profileId) });
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo enviar tu carta')),
  });

  if (!data || (!data.current && data.received.length === 0)) return null;
  const current = data.current;
  const canWrite = !!current && (!current.sent || current.sent.status === 'REJECTED');

  return (
    <section
      aria-labelledby={embedded ? undefined : 'correo-title'}
      aria-label={embedded ? 'Correo Estelar' : undefined}
      className={embedded ? '' : 'mb-4 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm dark:border-indigo-400/30 dark:bg-gray-900'}
    >
      {!embedded && <h2 id="correo-title" className="text-base font-bold text-gray-900 dark:text-white">💌 Correo Estelar</h2>}

      {current && (
        <div className={embedded ? '' : 'mt-2'}>
          {showName ? (
            <p className="text-sm text-gray-800 dark:text-gray-100">
              Tu estrella secreta es <strong className="text-indigo-800 dark:text-indigo-200">{current.recipientName}</strong>. ¡Es un secreto!
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setShowName(true)}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-50 px-4 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-100 dark:hover:bg-indigo-500/25"
            >
              Ver a quién le escribes
            </button>
          )}
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">«{current.prompt}»</p>
          {current.sent && current.sent.status !== 'REJECTED' ? (
            <p className="mt-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100" role="status">
              {current.sent.status === 'APPROVED' ? '✨ ¡Tu carta ya llegó!' : '✉️ Enviaste tu carta. Tu profe la está revisando.'}
            </p>
          ) : null}
          {current.sent?.status === 'REJECTED' && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-100" role="status">
              Tu profe te pide escribirla de nuevo, con un mensaje amable.
            </p>
          )}
          {canWrite && (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (message.trim().length >= 5 && !send.isPending) send.mutate();
              }}
            >
              <label htmlFor={textareaId} className="text-sm font-semibold text-gray-800 dark:text-gray-100">Tu carta</label>
              <textarea
                id={textareaId}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 800))}
                rows={4}
                className="mt-1 block w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-700 dark:text-gray-200">{message.length}/800 · Solo tu profe sabrá que fuiste tú.</span>
                <button
                  type="submit"
                  disabled={message.trim().length < 5 || send.isPending}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {send.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                  Enviar carta
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {data.received.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Cartas que recibiste</h3>
          <ul className="mt-2 space-y-2">
            {data.received.map((letter) => (
              <li key={letter.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-400/10">
                <p className="text-sm text-gray-900 dark:text-white">«{letter.message}»</p>
                <p className="mt-1 text-xs font-semibold text-gray-700 dark:text-gray-200">De: tu estrella secreta ✨ · {formatDate(letter.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
