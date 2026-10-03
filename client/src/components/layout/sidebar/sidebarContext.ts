import { createContext, useContext, type KeyboardEvent } from 'react';
import type { MotionLevel } from './useSidebarState';

interface SidebarUi {
  /** Carril colapsado (escritorio). */
  rail: boolean;
  /** Cajón del celular. */
  drawer: boolean;
  motion: MotionLevel;
  /** El propio <aside>: los paneles del cajón (p. ej. «Tus clases») se montan aquí, sobre todo el menú. */
  panelHost: HTMLElement | null;
  closeDrawer: () => void;
  showTip: (anchor: HTMLElement, label: string, immediate?: boolean) => void;
  hideTip: () => void;
}

export const SidebarUiContext = createContext<SidebarUi>({
  rail: false,
  drawer: false,
  motion: 'full',
  panelHost: null,
  closeDrawer: () => undefined,
  showTip: () => undefined,
  hideTip: () => undefined,
});

export const useSidebarUi = () => useContext(SidebarUiContext);

/** Navegación con flechas dentro de un menú (role=menu): ↑ ↓ Inicio Fin. */
export const handleMenuKeys = (event: KeyboardEvent<HTMLElement>, container: HTMLElement | null) => {
  if (!container) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
  if (!items.length) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const go = (next: number) => {
    event.preventDefault();
    items[(next + items.length) % items.length]?.focus();
  };
  if (event.key === 'ArrowDown') go(index + 1);
  else if (event.key === 'ArrowUp') go(index - 1);
  else if (event.key === 'Home') go(0);
  else if (event.key === 'End') go(items.length - 1);
};
