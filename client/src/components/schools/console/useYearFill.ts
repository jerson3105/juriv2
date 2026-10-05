import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { errorMessage } from '../../auth/authHelpers';
import { schoolYearApi } from '../../../lib/schoolYearApi';

/**
 * Llena las clases del año en curso de a pocas (el servidor dice cuántas quedan) y avisa al terminar. Se detiene si una
 * vuelta no hace entrar a nadie (una clase archivada, por ejemplo): lo que falte se ve en Asignaciones.
 */
export const useYearFill = (schoolId: string, yearId: string | null) => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ classes: number; entered: number } | null>(null);
  const run = async () => {
    if (!yearId || progress) return;
    let classes = 0;
    let entered = 0;
    setProgress({ classes, entered });
    try {
      for (let round = 0; round < 200; round++) {
        const batch = await schoolYearApi.fill(schoolId, yearId);
        classes += batch.classes;
        entered += batch.entered;
        setProgress({ classes, entered });
        if (batch.remaining === 0 || batch.entered === 0) break;
      }
      toast.success(entered > 0
        ? `${entered} ${entered === 1 ? 'estudiante entró' : 'estudiantes entraron'} a sus clases`
        : 'Las clases ya tenían a todos sus estudiantes');
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron llenar las clases'));
    } finally {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: ['school-assignments', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['school-roster', schoolId] });
    }
  };
  return { run, progress };
};
