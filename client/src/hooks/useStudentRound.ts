import { useEffect, useState } from 'react';
import type { Behavior } from '../lib/behaviorApi';

/** «Pasar por todos»: un comportamiento positivo, un toque por alumno, con deshacer el último. */
export interface StudentRound {
  behaviorId: string;
  behaviorName: string;
  behaviorIcon: string | null;
  startedAt: number;
  updatedAt: number;
  /** Veces que cada alumno recibió el comportamiento en esta ronda. */
  awards: Record<string, number>;
  actions: { studentId: string; pointLogEntryId: string | null; timestamp: number }[];
}

const TTL_MS = 1000 * 60 * 60 * 8;
const storageKey = (classroomId: string) => `students-active-round:${classroomId}`;

type LegacyRound = {
  positiveBehavior?: { behaviorId: string; behaviorName: string; behaviorIcon: string | null } | null;
  awardsByStudent?: Record<string, number | { positive?: number }>;
  actions?: { studentId: string; behaviorId?: string; isPositive?: boolean; pointLogEntryId?: string | null; timestamp: number }[];
  behaviorId?: string;
  behaviorName?: string;
  behaviorIcon?: string | null;
  isPositive?: boolean;
};

// Lee la ronda guardada; las de versiones anteriores (con negativo o multiplicador) conservan solo lo positivo.
const readRound = (classroomId: string): StudentRound | null => {
  try {
    const raw = localStorage.getItem(storageKey(classroomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudentRound> & LegacyRound;
    if (!parsed.updatedAt || Date.now() - parsed.updatedAt > TTL_MS) return null;
    if (parsed.behaviorId && parsed.awards && parsed.behaviorName && parsed.isPositive === undefined) {
      return { ...parsed, actions: parsed.actions ?? [] } as StudentRound;
    }
    const legacy = parsed.positiveBehavior
      ?? (parsed.behaviorId && parsed.behaviorName && parsed.isPositive !== false
        ? { behaviorId: parsed.behaviorId, behaviorName: parsed.behaviorName, behaviorIcon: parsed.behaviorIcon ?? null }
        : null);
    if (!legacy) return null;
    const awards: Record<string, number> = {};
    for (const [studentId, value] of Object.entries(parsed.awardsByStudent ?? {})) {
      const count = typeof value === 'number' ? value : Number(value?.positive ?? 0);
      if (count > 0) awards[studentId] = count;
    }
    return {
      behaviorId: legacy.behaviorId,
      behaviorName: legacy.behaviorName,
      behaviorIcon: legacy.behaviorIcon ?? null,
      startedAt: parsed.startedAt ?? Date.now(),
      updatedAt: parsed.updatedAt,
      awards,
      actions: ((parsed.actions ?? []) as NonNullable<LegacyRound['actions']>)
        .filter((action) => action.isPositive !== false && (!action.behaviorId || action.behaviorId === legacy.behaviorId))
        .map(({ studentId, pointLogEntryId, timestamp }) => ({ studentId, pointLogEntryId: pointLogEntryId ?? null, timestamp })),
    };
  } catch {
    return null;
  }
};

// La página se monta por clase (key = id de la clase), así que la ronda inicial se lee una sola vez.
export const useStudentRound = (classroomId: string) => {
  const [round, setRound] = useState<StudentRound | null>(() => readRound(classroomId));

  useEffect(() => {
    try {
      if (round) localStorage.setItem(storageKey(classroomId), JSON.stringify(round));
      else localStorage.removeItem(storageKey(classroomId));
    } catch {
      // Sin almacenamiento: la ronda dura hasta recargar.
    }
  }, [round, classroomId]);

  const start = (behavior: Behavior) => {
    const now = Date.now();
    setRound({ behaviorId: behavior.id, behaviorName: behavior.name, behaviorIcon: behavior.icon, startedAt: now, updatedAt: now, awards: {}, actions: [] });
  };

  const recordAward = (studentId: string, pointLogEntryId: string | null) =>
    setRound((current) => current && {
      ...current,
      updatedAt: Date.now(),
      awards: { ...current.awards, [studentId]: (current.awards[studentId] ?? 0) + 1 },
      actions: [...current.actions, { studentId, pointLogEntryId, timestamp: Date.now() }].slice(-300),
    });

  /** Quita la última acción (ya revertida en el servidor). */
  const dropLast = () =>
    setRound((current) => {
      const last = current?.actions[current.actions.length - 1];
      if (!current || !last) return current;
      const awards = { ...current.awards };
      const count = (awards[last.studentId] ?? 0) - 1;
      if (count > 0) awards[last.studentId] = count;
      else delete awards[last.studentId];
      return { ...current, updatedAt: Date.now(), awards, actions: current.actions.slice(0, -1) };
    });

  return {
    round,
    start,
    finish: () => setRound(null),
    recordAward,
    dropLast,
    countFor: (studentId: string) => round?.awards[studentId] ?? 0,
    lastAction: round?.actions[round.actions.length - 1] ?? null,
  };
};
