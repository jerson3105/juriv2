import { useEffect, useState } from 'react';
import type { Behavior } from '../lib/behaviorApi';

type QuickBehaviorIds = { positiveId: string | null; negativeId: string | null };

const storageKey = (classroomId: string) => `juried:quick-behaviors:${classroomId}`;

const readStored = (classroomId: string): QuickBehaviorIds => {
  try {
    const raw = localStorage.getItem(storageKey(classroomId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return { positiveId: parsed.positiveId ?? null, negativeId: parsed.negativeId ?? null };
    }
  } catch {
    // Sin almacenamiento disponible: se usan los predeterminados.
  }
  return { positiveId: null, negativeId: null };
};

// Comportamientos de la acción rápida por fila (uno positivo y uno negativo), recordados por clase
// en este navegador. Si no hay elección guardada (o ya no existe), se usa el primero de cada tipo.
export const useQuickBehaviors = (classroomId: string, positives: Behavior[], negatives: Behavior[]) => {
  const [ids, setIds] = useState<QuickBehaviorIds>(() => readStored(classroomId));

  useEffect(() => {
    setIds(readStored(classroomId));
  }, [classroomId]);

  const save = (next: QuickBehaviorIds) => {
    setIds(next);
    try {
      localStorage.setItem(storageKey(classroomId), JSON.stringify(next));
    } catch {
      // Ignorar: la elección vale solo para esta sesión.
    }
  };

  return {
    positive: positives.find((behavior) => behavior.id === ids.positiveId) ?? positives[0] ?? null,
    negative: negatives.find((behavior) => behavior.id === ids.negativeId) ?? negatives[0] ?? null,
    setPositiveId: (id: string) => save({ ...ids, positiveId: id }),
    setNegativeId: (id: string) => save({ ...ids, negativeId: id }),
  };
};
