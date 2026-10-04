import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '../../auth/authHelpers';

const DELAY_MS = 5000;

interface Pending {
  timer: number;
  fire: () => Promise<void>;
}

/**
 * «Deshacer» sin revertir puntos: la acción se envía a los 5 s salvo que el docente la deshaga. Así el alumno
 * nunca ve XP que aparece y desaparece. Si el docente sale antes, lo pendiente se envía al desmontar; al cerrar
 * o recargar la pestaña, el navegador pregunta antes de salir y lo pendiente se intenta enviar.
 */
export const useUndoable = () => {
  const pending = useRef(new Map<number, Pending>());
  const seq = useRef(0);

  useEffect(() => {
    const queue = pending.current;
    const flushAll = () => {
      for (const entry of queue.values()) {
        window.clearTimeout(entry.timer);
        void entry.fire();
      }
      queue.clear();
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (queue.size === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', flushAll);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', flushAll);
      flushAll();
    };
  }, []);

  return useCallback((options: { message: string; action: () => Promise<unknown>; onUndo?: () => void; onDone?: () => void; errorText: string }) => {
    const id = ++seq.current;
    const fire = async () => {
      pending.current.delete(id);
      try {
        await options.action();
        options.onDone?.();
      } catch (error) {
        options.onUndo?.();
        toast.error(errorMessage(error, options.errorText));
      }
    };
    const toastId = toast((t) => (
      <span className="flex items-center gap-3">
        <span>{options.message}</span>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-sm font-bold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/40"
          onClick={() => {
            const entry = pending.current.get(id);
            if (entry) window.clearTimeout(entry.timer);
            pending.current.delete(id);
            toast.dismiss(t.id);
            options.onUndo?.();
          }}
        >
          Deshacer
        </button>
      </span>
    ), { duration: DELAY_MS });
    const timer = window.setTimeout(() => {
      toast.dismiss(toastId);
      void fire();
    }, DELAY_MS);
    pending.current.set(id, { timer, fire });
  }, []);
};
