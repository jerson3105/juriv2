import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { usePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface HomeModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  /** xl: para videos y tutoriales (el contenido ancho se lee mejor). */
  size?: 'md' | 'lg' | 'xl';
  header?: ReactNode; // cabecera propia (p. ej. con imagen); sustituye al título estándar
  /** «night»: panel oscuro y opaco en los dos temas (la mesa donde se abren los sobres de figuritas). */
  tone?: 'light' | 'night';
}

const TONE = {
  light: {
    panel: 'bg-white dark:bg-gray-800',
    header: 'border-gray-200 dark:border-gray-700',
    title: 'text-gray-900 dark:text-white',
    subtitle: 'text-gray-700 dark:text-gray-300',
    close: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
    footer: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40',
  },
  night: {
    panel: 'bg-stone-900 text-white',
    header: 'border-white/10',
    title: 'text-white',
    subtitle: 'text-stone-300',
    close: 'text-stone-200 hover:bg-white/10',
    footer: 'border-white/10 bg-black/25',
  },
} as const;

/**
 * Marco de los modales de Inicio: Esc cierra, el foco entra al abrir y vuelve al cerrar.
 * Animación solo en CSS (home-modal-* en index.css): al abrir, el fondo se desvanece y el panel entra
 * opaco con un leve "pop"; al cerrar, el panel se oculta al instante y el fondo se desvanece. Dentro de
 * AnimatePresence, usePresence espera esa salida para quitar el modal. Sin animaciones de framer: al
 * terminar, framer cancelaba su animación y el elemento volvía un instante a su estilo en línea (el modal
 * desaparecía un momento al abrir y el fondo volvía a oscurecerse al cerrar).
 */
export const HomeModal = ({ title, subtitle, onClose, footer, children, size = 'md', header, tone = 'light' }: HomeModalProps) => {
  const colors = TONE[tone];
  const [isPresent, safeToRemove] = usePresence();
  const panelRef = useRef<HTMLDivElement>(null);
  const removed = useRef(false);

  // Se quita una sola vez: al terminar la salida del fondo o, si el navegador no la anima (pestaña
  // oculta), por tiempo.
  const finishExit = useCallback(() => {
    if (removed.current) return;
    removed.current = true;
    safeToRemove?.();
  }, [safeToRemove]);

  useEffect(() => {
    if (isPresent) {
      removed.current = false;
      return;
    }
    const timer = window.setTimeout(finishExit, 300);
    return () => window.clearTimeout(timer);
  }, [isPresent, finishExit]);

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isPresent && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  }, [isPresent, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]')
      ?? panel?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button');
    first?.focus();
    // Devuelve el foco al cerrar, salvo que ya esté en otro sitio (p. ej. el modal siguiente).
    return () => {
      const current = document.activeElement;
      if (!current || current === document.body || panel?.contains(current)) previous?.focus?.();
    };
  }, []);

  return (
    // !m-0: dentro de un contenedor space-y-* el margen bajaba el fondo y dejaba una franja sin cubrir.
    <div className="fixed inset-0 z-[60] !m-0 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className={`home-modal-fade absolute inset-0 bg-black/60 ${isPresent ? '' : 'home-modal-out'}`}
        onClick={isPresent ? onClose : undefined}
        onAnimationEnd={(event) => { if (event.animationName === 'home-modal-fade-out') finishExit(); }}
      />
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Al cerrar se oculta al instante (invisible: ni clics ni foco mientras el fondo se desvanece).
        className={`home-modal-pop relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl shadow-2xl ${colors.panel} ${size === 'xl' ? 'max-w-6xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'} ${isPresent ? '' : 'invisible'}`}
      >
        {header ?? (
          <div className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${colors.header}`}>
            <div className="min-w-0">
              <h2 className={`text-lg font-bold ${colors.title}`}>{title}</h2>
              {subtitle && <p className={`text-sm ${colors.subtitle}`}>{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${colors.close}`}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        {footer && <div className={`flex items-center justify-end gap-2 border-t px-5 py-3 ${colors.footer}`}>{footer}</div>}
      </div>
    </div>
  );
};
