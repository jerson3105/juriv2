import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { TUTORIALS, type TutorialId } from '../tutorials/TutorialModal';

/**
 * Tutorial de una actividad a pantalla completa sobre el escenario: lo ve toda la clase en el proyector. Arranca solo
 * (?auto=1, lo abrió un clic del docente) y conserva sus controles. Esc o «Cerrar» vuelve a la actividad; mientras
 * está abierto, ninguna tecla llega al escenario (Espacio empezaría la actividad y Esc la cerraría).
 */
export const StageTutorial = ({ id, onClose }: { id: TutorialId; onClose: () => void }) => {
  const tutorial = TUTORIALS[id];
  const frameRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const done = useRef(onClose);
  useLayoutEffect(() => {
    done.current = onClose;
  });

  useEffect(() => {
    // El reproductor avisa con postMessage cuando se pulsa Esc dentro de él (el teclado no sale del iframe).
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if ((event.data as { type?: unknown } | null)?.type === 'juried-tutorial:close') done.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        done.current();
        return;
      }
      // El botón «Cerrar» se usa con Enter o Espacio; cualquier otra tecla no pasa al escenario.
      if (event.target === closeRef.current && (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab')) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[190] bg-[#05081a]" role="dialog" aria-modal="true" aria-label={`Tutorial: ${tutorial.title}`}>
      <iframe
        ref={frameRef}
        src={`${tutorial.src}?auto=1`}
        title={`Tutorial: ${tutorial.title}`}
        allow="autoplay; fullscreen"
        allowFullScreen
        // Con el foco dentro, Espacio y las flechas manejan el video.
        onLoad={() => frameRef.current?.contentWindow?.focus()}
        className="block h-full w-full border-0"
      />
      <button
        ref={closeRef}
        type="button"
        onClick={() => done.current()}
        className="absolute right-3 top-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0b1026]/85 px-3 text-sm font-bold text-white ring-1 ring-white/25 hover:bg-[#1e2a5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        <X size={18} aria-hidden="true" /> Cerrar <span className="text-xs font-semibold opacity-70">(Esc)</span>
      </button>
    </div>,
    document.body,
  );
};
