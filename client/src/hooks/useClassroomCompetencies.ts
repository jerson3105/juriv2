import { useQuery } from '@tanstack/react-query';
import { classroomApi } from '../lib/classroomApi';

export function useClassroomCompetencies(classroomId: string | undefined, enabled: boolean = true) {
  const query = useQuery({
    queryKey: ['classroom-competencies', classroomId],
    queryFn: () => classroomApi.getCompetencies(classroomId!),
    enabled: enabled && !!classroomId,
    staleTime: 5 * 60 * 1000,
  });

  const competencies = query.data || [];

  return {
    ...query,
    competencies,
    baseCompetencies: competencies.filter((competency) => competency.isBase),
    extraCompetencies: competencies.filter((competency) => !competency.isBase && !competency.isCustom),
    customCompetencies: competencies.filter((competency) => competency.isCustom),
  };
}