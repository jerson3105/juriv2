import type { Behavior, BehaviorUsage } from '../../lib/behaviorApi';

export type BehaviorSort = 'usage' | 'name';

export const SORT_STORAGE_KEY = 'juried:behaviors-sort';

export const readSort = (): BehaviorSort => {
  try {
    return localStorage.getItem(SORT_STORAGE_KEY) === 'name' ? 'name' : 'usage';
  } catch {
    return 'usage';
  }
};

export const saveSort = (sort: BehaviorSort) => {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, sort);
  } catch {
    // Sin almacenamiento: el orden vale solo para esta visita.
  }
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// "hoy", "ayer", "hace 5 días".
export const relativeDay = (iso: string) => {
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
};

export const usageLabel = (usage?: BehaviorUsage) => {
  if (!usage || usage.uses === 0) return 'Sin usar en 30 días';
  return `Usado ${usage.uses} ${usage.uses === 1 ? 'vez' : 'veces'} · ${relativeDay(usage.lastUsedAt)}`;
};

export const sortBehaviors = (list: Behavior[], sort: BehaviorSort, usageById: Record<string, BehaviorUsage>) => {
  const byName = (a: Behavior, b: Behavior) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  if (sort === 'name') return [...list].sort(byName);
  return [...list].sort((a, b) => {
    const ua = usageById[a.id];
    const ub = usageById[b.id];
    return (ub?.uses || 0) - (ua?.uses || 0)
      || (ub?.lastUsedAt || '').localeCompare(ua?.lastUsedAt || '')
      || byName(a, b);
  });
};
