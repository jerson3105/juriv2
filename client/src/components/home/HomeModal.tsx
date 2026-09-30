import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { motion, useIsPresent } from 'framer-motion';
import { X } from 'lucide-react';

interface HomeModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: 'md' | 'lg';
  header?: ReactNode; // cabecera propia (p. ej. con imagen); sustituye al título estándar
}

// Marco de los modales de Inicio: Esc cierra, el foco entra al abrir y vuelve al cerrar.
export const HomeModal = ({ title, subtitle, onClose, footer, children, size = 'md', header }: HomeModalProps) => {
  const isPresent = useIsPresent();
  const panelRef = useRef<HTMLDivElement>(null);

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        ref={panelRef}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800 ${size === 'lg' ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        {header ?? (
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
              {subtitle && <p className="text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">{footer}</div>}
      </motion.div>
    </motion.div>
  );
};
