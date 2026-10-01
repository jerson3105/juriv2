import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BankDialogProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  /** false = ni Esc ni clic fuera cierran (hay trabajo sin guardar). */
  dismissable?: boolean;
}

const WIDTH = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

// Diálogo del banco de preguntas: fondo sólido (sin desenfoque), Esc cierra, el foco entra y vuelve.
export const BankDialog = ({ title, subtitle, onClose, children, footer, size = 'md', dismissable = true }: BankDialogProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && dismissable && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  }, [dismissable, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;
    (panel?.querySelector<HTMLElement>('[data-autofocus]')
      ?? panel?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button'))?.focus();
    return () => {
      const current = document.activeElement;
      if (!current || current === document.body || panel?.contains(current)) previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={dismissable ? onClose : undefined}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-gray-800 sm:rounded-2xl ${WIDTH[size]}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900/40">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};
