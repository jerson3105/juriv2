import { useCallback, useEffect, useState } from 'react';
import type { Behavior } from '../lib/behaviorApi';

type UsageCounts = Record<string, number>;

const storageKey = (classroomId: string) => `juried:behavior-usage:${classroomId}`;

const readCounts = (classroomId: string): UsageCounts => {
  try {
    const raw = localStorage.getItem(storageKey(classroomId));
    return raw ? (JSON.parse(raw) as UsageCounts) : {};
  } catch {
    return {};
  }
};

// Cuántas veces se aplicó cada comportamiento en esta clase desde este navegador. Sirve para
// mostrar "los más usados"; sin historial, se respeta el orden configurado de la clase.
export const useBehaviorUsage = (classroomId: string) => {
  const [counts, setCounts] = useState<UsageCounts>(() => readCounts(classroomId));

  useEffect(() => {
    setCounts(readCounts(classroomId));
  }, [classroomId]);

  const recordUse = useCallback((behaviorId: string) => {
    setCounts((current) => {
      const next = { ...current, [behaviorId]: (current[behaviorId] || 0) + 1 };
      try {
        localStorage.setItem(storageKey(classroomId), JSON.stringify(next));
      } catch {
        // Sin almacenamiento: el orden vale solo para esta sesión.
      }
      return next;
    });
  }, [classroomId]);

  // Los `limit` más usados, desempatando por el orden original de la lista.
  const mostUsed = useCallback((behaviors: Behavior[], limit: number) =>
    behaviors
      .map((behavior, index) => ({ behavior, index, uses: counts[behavior.id] || 0 }))
      .sort((a, b) => b.uses - a.uses || a.index - b.index)
      .slice(0, limit)
      .map((entry) => entry.behavior),
  [counts]);

  return { recordUse, mostUsed };
};
