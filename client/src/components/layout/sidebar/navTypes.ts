import type { ReactNode } from 'react';

/**
 * Indicadores del menú (uno por ítem, en este orden de prioridad):
 * número = te espera una acción · chip = un estado («Revelar», «Nuevo») · oro · punto = hay algo nuevo.
 */
export type NavBadge =
  | { kind: 'count'; value: number; label: string }
  | { kind: 'chip'; text: string; label: string }
  | { kind: 'gold'; value: number }
  | { kind: 'dot'; label: string };

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: ReactNode;
  active: boolean;
  badge?: NavBadge;
  /** Al elegirlo (p. ej. quitar el «Nuevo» del onboarding). */
  onSelect?: () => void;
}

/** Grupo plegable (profe). */
export interface NavGroup {
  kind: 'group';
  id: string;
  label: string;
  icon: ReactNode;
  items: NavItem[];
}

/** Sección con título siempre visible (alumno). */
export interface NavSection {
  kind: 'section';
  id: string;
  label: string;
  /** Ícono del carril colapsado. */
  icon: ReactNode;
  items: NavItem[];
}

/** Ítem suelto. */
export interface NavLink {
  kind: 'link';
  item: NavItem;
}

export type NavNode = NavGroup | NavSection | NavLink;

/** Lo que el grupo muestra cuando está cerrado o en el carril: el número si es una acción; si no, un punto. */
export const groupBadge = (items: NavItem[]): NavBadge | undefined => {
  const count = items.reduce((sum, item) => sum + (item.badge?.kind === 'count' ? item.badge.value : 0), 0);
  const first = items.find((item) => item.badge?.kind === 'count')?.badge;
  if (count > 0 && first?.kind === 'count') return { kind: 'count', value: count, label: first.label };
  const flagged = items.find((item) => item.badge && item.badge.kind !== 'gold');
  if (flagged) return { kind: 'dot', label: `Hay algo nuevo en ${flagged.label}` };
  return undefined;
};
