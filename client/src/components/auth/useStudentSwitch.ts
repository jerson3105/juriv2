import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

/** ¿Esta cuenta de docente puede pasar a estudiante? (sin alumnos reales ni escuela) */
export const useStudentSwitch = (enabled = true) => {
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: ['student-switch'],
    queryFn: async () => (await authApi.getStudentSwitch()).data.data ?? { eligible: false },
    enabled: enabled && role === 'TEACHER',
    staleTime: 60_000,
  });
};
