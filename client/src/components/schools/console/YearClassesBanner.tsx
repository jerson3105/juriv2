import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, School } from 'lucide-react';
import { errorMessage } from '../../auth/authHelpers';
import { primaryButton } from '../../home/homeHelpers';
import { assignmentApi } from '../../../lib/schoolAssignmentApi';

interface YearClassesBannerProps {
  schoolId: string;
  yearId: string;
  yearName: string;
  /** Asignaciones y talleres del año que aún no tienen clase. */
  withoutClass: number;
}

/**
 * Año en preparación: crea de una vez las clases de las asignaciones y talleres que aún no tienen, a nombre de su
 * docente y copiadas de su clase del año anterior en la misma área. Van de a pocas (el servidor dice cuántas quedan).
 * Sus estudiantes entran cuando el año empieza.
 */
export const YearClassesBanner = ({ schoolId, yearId, yearName, withoutClass }: YearClassesBannerProps) => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const run = async () => {
    let created = 0;
    let cloned = 0;
    let remaining = withoutClass;
    setProgress({ done: 0, total: withoutClass });
    try {
      for (let round = 0; round < 60 && remaining > 0; round++) {
        const batch = await assignmentApi.createYearClasses(schoolId, yearId);
        created += batch.created;
        cloned += batch.cloned;
        remaining = batch.remaining;
        setProgress({ done: created, total: created + remaining });
        if (batch.created === 0) break;
      }
      toast.success(`${created} ${created === 1 ? 'clase creada' : 'clases creadas'}${cloned ? ` · ${cloned} con la configuración del año anterior` : ''}`);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron crear las clases'));
    } finally {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: ['school-assignments', schoolId] });
    }
  };

  if (withoutClass === 0) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-900/30 dark:text-emerald-100" role="status">
        <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        Cada asignación y taller de {yearName} tiene su clase. Sus docentes ya pueden prepararlas; los estudiantes entran cuando el año empiece.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-500/40 dark:bg-primary-900/20 sm:flex-row sm:items-center">
      <School size={22} className="hidden flex-shrink-0 text-primary-700 dark:text-primary-300 sm:block" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">
        <strong>{withoutClass} {withoutClass === 1 ? 'asignación o taller' : 'asignaciones y talleres'} de {yearName} sin clase.</strong>{' '}
        Cada una recibe su clase a nombre de su docente, con la configuración de su clase del año anterior en la misma área (comportamientos, insignias, tienda y bancos de preguntas). Los estudiantes entran cuando {yearName} empiece.
      </p>
      <button type="button" className={`${primaryButton} flex-shrink-0`} disabled={!!progress} onClick={() => void run()} aria-live="polite">
        {progress ? `Creando… ${progress.done} de ${progress.total}` : 'Crear las clases'}
      </button>
    </div>
  );
};
