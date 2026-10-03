import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

/** Marca de la opción elegida en un menú (además de aria-checked: no depende solo del color). */
export const MenuCheck = ({ on }: { on: boolean }) =>
  on ? <Check size={16} className="ml-auto flex-shrink-0" aria-hidden="true" /> : null;

interface PopoverProps {
  open: boolean;
  /** `restoreFocus`: Esc devuelve el foco al botón que lo abrió. */
  onClose: (restoreFocus?: boolean) => void;
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  align?: 'start' | 'end';
  /** 'top' para lo que se abre desde una barra fija al pie. */
  side?: 'bottom' | 'top';
  className?: string;
  children: ReactNode;
}

const GAP = 6;
const MARGIN = 8;

/**
 * Menú flotante en un portal (no lo recortan la tabla ni el contenido con scroll): se coloca junto a su
 * botón, se da la vuelta si no cabe y se cierra con Esc, clic fuera, al desplazar o al salir con Tab.
 * Lleva su propio `data-pg` para conservar los colores de la página.
 */
export const Popover = ({ open, onClose, anchorRef, label, align = 'end', side = 'bottom', className = '', children }: PopoverProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    if (!panel || !anchor) return;

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const maxLeft = window.innerWidth - width - MARGIN;
      const left = Math.min(Math.max(MARGIN, align === 'end' ? rect.right - width : rect.left), maxLeft);
      const below = rect.bottom + GAP;
      const above = rect.top - GAP - height;
      const fitsBelow = below + height <= window.innerHeight - MARGIN;
      const fitsAbove = above >= MARGIN;
      let top = side === 'top' ? (fitsAbove || !fitsBelow ? above : below) : (fitsBelow || !fitsAbove ? below : above);
      top = Math.min(Math.max(MARGIN, top), window.innerHeight - height - MARGIN);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(panel);

    const first = panel.querySelector<HTMLElement>('[data-autofocus], button:not(:disabled), a[href], input:not(:disabled)');
    (first ?? panel).focus({ preventScroll: true });
    return () => observer.disconnect();
  }, [open, align, side, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node && (!!panelRef.current?.contains(target) || !!anchorRef.current?.contains(target));
    const onPointer = (event: PointerEvent) => {
      if (!inside(event.target)) closeRef.current(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current(true);
    };
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node && panelRef.current?.contains(event.target))) closeRef.current(false);
    };
    const onResize = () => closeRef.current(false);
    const onFocus = (event: FocusEvent) => {
      if (!inside(event.target)) closeRef.current(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panelRef}
      data-pg=""
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      className={`pg-menu pg-menu-in fixed z-[160] outline-none ${className}`}
      style={{ top: -9999, left: -9999 }}
    >
      {children}
    </div>,
    document.body,
  );
};
