import { useQuery } from '@tanstack/react-query';
import { recoveryApi } from '../../lib/recoveryApi';

// Energía (HP) = convivencia y autorregulación. Con 0 HP el alumno "descansa".
export const LOW_ENERGY_RATIO = 0.3;
export const restingKey = (classroomId: string) => ['recovery', classroomId] as const;

/** Inicial: corazones sin números, recuperación inmediata y sin pausa de tienda. */
export const isInitialLevel = (gradeLevel?: string | null) => !!gradeLevel && gradeLevel.toUpperCase().startsWith('INICIAL');

/**
 * Pequeños (inicial a 2.º de primaria): solo para lo visual (menos números, botones grandes).
 * Las reglas de energía siguen con isInitialLevel.
 */
export const isYoungLevel = (gradeLevel?: string | null) => {
  const level = gradeLevel?.toUpperCase() ?? '';
  return level.startsWith('INICIAL') || level === 'PRIMARIA_1' || level === 'PRIMARIA_2';
};

export const isResting = (student: { hp: number }) => student.hp <= 0;

/** Corazones llenos de 5 (al menos 1 mientras quede algo de energía). */
export const heartsOf = (hp: number, maxHp: number) => (hp <= 0 ? 0 : Math.max(1, Math.min(5, Math.ceil((hp / Math.max(1, maxHp)) * 5))));

/** Quién descansa en la clase, su misión pendiente y las plantillas. */
export const useRestingStudents = (classroomId: string, enabled = true) => {
  const { data } = useQuery({
    queryKey: restingKey(classroomId),
    queryFn: () => recoveryApi.listResting(classroomId),
    enabled,
    staleTime: 30_000,
  });
  const byStudent = new Map((data?.students ?? []).map((s) => [s.studentId, s]));
  return { templates: Array.isArray(data?.templates) ? data.templates : [], byStudent };
};
