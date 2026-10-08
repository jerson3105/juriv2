import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import { HomeModal } from '../home/HomeModal';

/**
 * Tutoriales en video: páginas estáticas en public/tutoriales (se arman con tutoriales/motor/build.mjs). Apache las
 * sirve como archivos: no pasan por la API. Los de docentes explican una página; los de estudiantes, una actividad
 * del Observatorio (se proyectan en clase).
 */
export const TUTORIALS = {
  comportamientos: { title: 'Comportamientos', src: '/tutoriales/comportamientos.html', minutes: 1, audience: 'docentes' },
  insignias: { title: 'Insignias', src: '/tutoriales/insignias.html', minutes: 1, audience: 'docentes' },
  tienda: { title: 'Tienda', src: '/tutoriales/tienda.html', minutes: 1, audience: 'docentes' },
  coleccionables: { title: 'Coleccionables', src: '/tutoriales/coleccionables.html', minutes: 1, audience: 'docentes' },
  descanso: { title: 'Descanso de Jiro', src: '/tutoriales/descanso.html', minutes: 1, audience: 'estudiantes' },
  estrellas: { title: 'Estrellas en Movimiento', src: '/tutoriales/estrellas.html', minutes: 1, audience: 'estudiantes' },
  conquista: { title: 'Conquista del Cielo', src: '/tutoriales/conquista.html', minutes: 1, audience: 'estudiantes' },
  expediciones: { title: 'Expediciones', src: '/tutoriales/expediciones.html', minutes: 1, audience: 'estudiantes' },
  correo: { title: 'Correo Estelar', src: '/tutoriales/correo.html', minutes: 1, audience: 'estudiantes' },
  error: { title: 'El Error de Jiro', src: '/tutoriales/error.html', minutes: 1, audience: 'estudiantes' },
} as const;

export type TutorialId = keyof typeof TUTORIALS;

/** Reproduce un tutorial en un modal ancho. Esc lo cierra, también con el foco dentro del video. */
export const TutorialModal = ({ id, onClose }: { id: TutorialId; onClose: () => void }) => {
  const tutorial = TUTORIALS[id];
  const frameRef = useRef<HTMLIFrameElement>(null);

  // El reproductor avisa con postMessage cuando se pulsa Esc dentro de él (el teclado no sale del iframe).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if ((event.data as { type?: unknown } | null)?.type === 'juried-tutorial:close') onClose();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onClose]);

  // Encima de otro modal (p. ej. el Correo del alumno), Esc cierra solo el tutorial: se atiende en captura,
  // antes que los modales de abajo, que escuchan en la fase de burbuja.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // En body y sobre el layout de la clase (z-[100]): dentro del contenido (z-10) la barra lateral taparía el borde
  // de un modal tan ancho. El contexto de AnimatePresence pasa igual a través del portal.
  return createPortal(
    <div className="relative z-[150]">
      <HomeModal
        title={`Tutorial: ${tutorial.title}`}
        subtitle={`${tutorial.minutes} minuto · para ${tutorial.audience}`}
        onClose={onClose}
        size="xl"
        footer={(
          <a href={tutorial.src} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-900/30">
            Abrir en otra pestaña <ExternalLink size={15} aria-hidden="true" />
          </a>
        )}
      >
        {/* El alto cabe en la pantalla: el ancho se limita por la altura disponible (cabecera y pie del modal). */}
        <div className="mx-auto w-full" style={{ maxWidth: 'calc((90vh - 190px) * 1.6)' }}>
          <iframe
            ref={frameRef}
            src={tutorial.src}
            title={`Tutorial: ${tutorial.title}`}
            allow="fullscreen"
            allowFullScreen
            className="block aspect-[16/10] w-full rounded-xl border-0 bg-[#05081a]"
          />
        </div>
      </HomeModal>
    </div>,
    document.body,
  );
};
