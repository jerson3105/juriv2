import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface SidebarFlyoutProps {
  anchorRef: RefObject<HTMLElement>;
  /** restoreFocus: devolver el foco al disparador (Esc o al elegir). */
  onClose: (restoreFocus: boolean) => void;
  label: string;
  children: ReactNode;
  width?: number;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Panel flotante junto al carril o a la tarjeta de clase (fuera del scroll del menú, posición fija).
 * Se cierra con Esc, al tocar fuera, al salir con Tab o al navegar; el foco entra al abrirlo.
 */
export const SidebarFlyout = ({ anchorRef, onClose, label, children, width = 288, onKeyDown }: SidebarFlyoutProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!panel || !rect) return;
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - panel.offsetHeight - 8));
    panel.style.top = `${top}px`;
    panel.style.left = `${rect.right + 8}px`;
    const first = panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel.querySelector<HTMLElement>('[role^="menuitem"]');
    first?.focus();
  }, [anchorRef]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onCloseRef.current(false);
    };
    const onResize = () => onCloseRef.current(false);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onResize);
    };
  }, [anchorRef]);

  return (
    <div
      ref={panelRef}
      data-sb="light"
      role="group"
      aria-label={label}
      className="sb-surface sb-flyout fixed z-[70] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-2xl border sb-line p-2 shadow-2xl shadow-slate-900/20"
      style={{ width }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose(true);
        }
      }}
      onBlur={(event) => {
        // Tab fuera del panel: se cierra (el foco sigue su camino).
        const next = event.relatedTarget as Node | null;
        if (next && !panelRef.current?.contains(next) && !anchorRef.current?.contains(next)) onClose(false);
      }}
    >
      {children}
    </div>
  );
};
