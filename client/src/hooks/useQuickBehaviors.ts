import { useState } from 'react';
import type { Behavior } from '../lib/behaviorApi';

const storageKey = (classroomId: string) => `juried:quick-behaviors:${classroomId}`;

// Guardado como { positiveId, negativeId } (el negativo ya no tiene botón propio: se conserva por compatibilidad).
const readPinned = (classroomId: string): string | null => {
  try {
    const raw = localStorage.getItem(storageKey(classroomId));
    if (raw) return JSON.parse(raw).positiveId ?? null;
  } catch {
    // Sin almacenamiento disponible: el más usado.
  }
  return null;
};

// Comportamiento del botón de cada fila, fijado por clase en este navegador. Sin fijar (o si ya no existe),
// el más usado de la clase (`fallback`). La Lista se monta por clase, así que se lee una vez.
export const useQuickBehaviors = (classroomId: string, positives: Behavior[], fallback: Behavior | null) => {
  const [pinnedId, setPinnedId] = useState<string | null>(() => readPinned(classroomId));

  const pin = (id: string | null) => {
    setPinnedId(id);
    try {
      localStorage.setItem(storageKey(classroomId), JSON.stringify({ positiveId: id, negativeId: null }));
    } catch {
      // Ignorar: la elección vale solo para esta sesión.
    }
  };

  const pinned = positives.find((behavior) => behavior.id === pinnedId) ?? null;
  return { rowBehavior: pinned ?? fallback, pinnedId: pinned?.id ?? null, pin };
};
