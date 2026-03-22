import { useQuery } from '@tanstack/react-query';
import { characterClassApi, type CharacterClassData } from '../lib/characterClassApi';
import { CHARACTER_CLASSES } from '../lib/studentApi';

/**
 * Hook that returns character classes for a classroom.
 * Falls back to the default static CHARACTER_CLASSES if the query fails or returns empty.
 * Returns a lookup map keyed by the class `key` (e.g. "GUARDIAN").
 */
export function useCharacterClasses(classroomId: string | undefined) {
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['character-classes', classroomId],
    queryFn: () => characterClassApi.list(classroomId!),
    enabled: !!classroomId,
    staleTime: 5 * 60 * 1000,
  });

  // Build a lookup map compatible with CHARACTER_CLASSES shape
  // Indexed by both `key` (e.g. "GUARDIAN") and `id` (UUID) for custom class support
  const classMap: Record<string, { name: string; description: string; icon: string; color: string; id?: string }> =
    classes.length > 0
      ? Object.fromEntries(
          classes.flatMap((c) => {
            const entry = { name: c.name, description: c.description || '', icon: c.icon, color: c.color, id: c.id };
            return [
              [c.key, entry],
              [c.id, entry],
            ];
          })
        )
      : { ...CHARACTER_CLASSES };

  return { classMap, classes, isLoading };
}
