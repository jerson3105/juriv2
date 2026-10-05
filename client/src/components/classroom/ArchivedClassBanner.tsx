import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Archive, RotateCcw } from 'lucide-react';
import { errorMessage } from '../auth/authHelpers';
import { classroomApi, type Classroom } from '../../lib/classroomApi';

/**
 * Una clase archivada se consulta pero no cambia (el servidor rechaza los cambios). La de un año escolar cerrado queda así;
 * las demás se restauran para volver a usarlas.
 */
export const ArchivedClassBanner = ({ classroom, onRestored }: { classroom: Classroom; onRestored: () => void }) => {
  const queryClient = useQueryClient();
  const [restoring, setRestoring] = useState(false);
  const closedYear = classroom.context?.yearStatus === 'CLOSED';
  const restore = async () => {
    setRestoring(true);
    try {
      await classroomApi.restore(classroom.id);
      toast.success('Clase restaurada');
      // Las listas de clases del docente (Inicio y selectores).
      void queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      void queryClient.invalidateQueries({ queryKey: ['my-classrooms'] });
      onRestored();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo restaurar la clase'));
    } finally {
      setRestoring(false);
    }
  };
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-50 sm:flex-row sm:items-center" role="status">
      <Archive size={18} className="hidden flex-shrink-0 sm:block" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        {closedYear
          ? <><strong>Clase del año {classroom.context?.year}, que ya cerró.</strong> Queda para consultar y exportar; sus estudiantes y familias ya no la ven.</>
          : <><strong>Esta clase está archivada.</strong> Puedes consultarla y exportar, pero no hacer cambios; sus estudiantes y familias no la ven.</>}
      </p>
      {!closedYear && (
        <button type="button" className="pg-btn pg-focus flex-shrink-0" disabled={restoring} onClick={() => void restore()}>
          <RotateCcw size={16} aria-hidden="true" />{restoring ? 'Restaurando…' : 'Restaurar'}
        </button>
      )}
    </div>
  );
};
