import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { behaviorApi, type Behavior, type BehaviorUsage } from '../lib/behaviorApi';

export const behaviorUsageKey = (classroomId: string) => ['behavior-usage', classroomId] as const;

// Uso de cada comportamiento en la clase (últimos 30 días, calculado en el servidor: igual en
// todos los dispositivos). Sirve para mostrar "los más usados"; sin historial se respeta el
// orden configurado de la clase.
export const useBehaviorUsage = (classroomId: string) => {
  const queryClient = useQueryClient();
  const { data: usage = [] } = useQuery({
    queryKey: behaviorUsageKey(classroomId),
    queryFn: () => behaviorApi.getUsage(classroomId),
    enabled: !!classroomId,
    staleTime: 60_000,
  });

  const usageById = useMemo(() => {
    const map: Record<string, BehaviorUsage> = {};
    for (const entry of usage) map[entry.behaviorId] = entry;
    return map;
  }, [usage]);

  // Suma el uso al instante (optimista); el servidor manda en la siguiente recarga.
  const recordUse = useCallback((behaviorId: string) => {
    queryClient.setQueryData<BehaviorUsage[]>(behaviorUsageKey(classroomId), (current = []) => {
      const now = new Date().toISOString();
      const exists = current.some((entry) => entry.behaviorId === behaviorId);
      return exists
        ? current.map((entry) => (entry.behaviorId === behaviorId ? { ...entry, uses: entry.uses + 1, lastUsedAt: now } : entry))
        : [...current, { behaviorId, uses: 1, lastUsedAt: now }];
    });
  }, [classroomId, queryClient]);

  // Los `limit` más usados, desempatando por el orden original de la lista.
  const mostUsed = useCallback((behaviors: Behavior[], limit: number) =>
    behaviors
      .map((behavior, index) => ({ behavior, index, uses: usageById[behavior.id]?.uses || 0 }))
      .sort((a, b) => b.uses - a.uses || a.index - b.index)
      .slice(0, limit)
      .map((entry) => entry.behavior),
  [usageById]);

  return { recordUse, mostUsed, usageById };
};
