import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { useProjectorStore } from '../../../store/projectorStore';

// Preferencias del menú en este navegador (claves juried-*: se borran al cerrar sesión).
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: dura hasta recargar.
  }
};

type SidebarRole = 'teacher' | 'student' | 'admin';
const collapsedKey = (role: SidebarRole) => `juried-sb-collapsed:${role}`;

// Compartido: el layout de la clase y el del Inicio del profe están montados a la vez.
const useCollapsedStore = create<{ collapsed: Record<SidebarRole, boolean>; setCollapsed: (role: SidebarRole, value: boolean) => void }>((set) => ({
  collapsed: {
    teacher: read(collapsedKey('teacher')) === '1',
    student: read(collapsedKey('student')) === '1',
    admin: read(collapsedKey('admin')) === '1',
  },
  setCollapsed: (role, value) => {
    write(collapsedKey(role), value ? '1' : '0');
    set((state) => ({ collapsed: { ...state.collapsed, [role]: value } }));
  },
}));

/** Menú colapsado (solo escritorio), recordado por rol: el profe lo conserva entre la clase y su Inicio. */
export const useSidebarCollapsed = (role: SidebarRole) => {
  const collapsed = useCollapsedStore((state) => state.collapsed[role]);
  const setCollapsed = useCollapsedStore((state) => state.setCollapsed);
  const update = useCallback((value: boolean) => setCollapsed(role, value), [role, setCollapsed]);
  return [collapsed, update] as const;
};

/**
 * Grupos abiertos: los que el profe dejó abiertos (recordados) más el de la página actual, que se abre
 * al entrar y se puede cerrar durante esa visita.
 */
export const useOpenGroups = (scope: string, activeGroupId: string | null) => {
  const key = `juried-sb-groups:${scope}`;
  const [open, setOpen] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(read(key) ?? 'null');
      if (Array.isArray(saved)) return saved.filter((id): id is string => typeof id === 'string');
    } catch {
      // Valor dañado: se empieza de cero.
    }
    return [];
  });
  // El grupo actual que cerró a mano; vuelve a abrirse al entrar de nuevo desde otro grupo.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [lastActive, setLastActive] = useState(activeGroupId);
  if (lastActive !== activeGroupId) {
    setLastActive(activeGroupId);
    setDismissed(null);
  }

  const isOpen = (id: string) => open.includes(id) || (id === activeGroupId && dismissed !== id);
  const persist = (next: string[]) => {
    write(key, JSON.stringify(next));
    setOpen(next);
  };
  const toggle = (id: string) => {
    if (isOpen(id)) {
      if (open.includes(id)) persist(open.filter((item) => item !== id));
      if (id === activeGroupId) setDismissed(id);
    } else {
      persist([...open, id]);
      if (dismissed === id) setDismissed(null);
    }
  };

  return { isOpen, toggle };
};

export type MotionLevel = 'full' | 'calm' | 'off';

const REDUCE = '(prefers-reduced-motion: reduce)';

/**
 * Presupuesto de movimiento del menú: «off» si el sistema pide reducir el movimiento; «calm» mientras
 * está «Proyectando» (nada titila ni brilla frente al curso); «full» en lo demás.
 */
export const useMotionBudget = (): MotionLevel => {
  const projecting = useProjectorStore((state) => state.projecting);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(REDUCE).matches === true);
  useEffect(() => {
    const query = window.matchMedia?.(REDUCE);
    if (!query) return;
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  if (reduced) return 'off';
  return projecting ? 'calm' : 'full';
};

/** Escritorio (≥ 1024 px): el menú es fijo; debajo, un cajón modal. */
export const useIsDesktop = () => {
  const query = '(min-width: 1024px)';
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const onChange = () => setDesktop(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return desktop;
};
