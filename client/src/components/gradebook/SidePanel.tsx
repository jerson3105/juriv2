import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SidePanelProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

// Panel lateral (hoja inferior en móvil): Esc cierra, el foco entra al abrir y vuelve al cerrar.
export const SidePanel = ({ title, subtitle, onClose, children, footer }: SidePanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;
    (panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>('button'))?.focus();
    return () => {
      const current = document.activeElement;
      if (!current || current === document.body || panel?.contains(current)) previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 lg:items-stretch lg:justify-end" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl motion-safe:animate-[slideUp_.18s_ease-out] dark:bg-gray-800 lg:max-h-none lg:w-[440px] lg:rounded-none lg:motion-safe:animate-[slideIn_.18s_ease-out]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};
