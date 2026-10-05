import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RotateCcw } from 'lucide-react';
import { errorMessage } from '../../auth/authHelpers';
import { rosterImportApi, rosterImportKeys } from '../../../lib/schoolRosterImportApi';
import { schoolRosterKeys } from '../../../lib/schoolRosterApi';
import { whenLabel } from './rosterHelpers';

/**
 * Aviso tras importar desde Excel: cuánto se importó y, mientras se pueda (24 h, sin estudiantes tocados después),
 * «Deshacer la importación», con confirmación en el mismo lugar.
 */
export const UndoImportBanner = ({ schoolId, yearId }: { schoolId: string; yearId: string }) => {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const current = useQuery({ queryKey: rosterImportKeys.current(schoolId, yearId), queryFn: () => rosterImportApi.current(schoolId, yearId) });
  const undo = useMutation({
    mutationFn: (batchId: string) => rosterImportApi.undo(schoolId, yearId, batchId),
    onSuccess: (result) => {
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
      void queryClient.invalidateQueries({ queryKey: rosterImportKeys.all(schoolId, yearId) });
      toast.success(result.message);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo deshacer la importación')),
  });

  const last = current.data?.last;
  if (!last || !last.canUndo) return null;
  const parts = [
    last.created ? `${last.created} ${last.created === 1 ? 'estudiante nuevo' : 'estudiantes nuevos'}` : '',
    last.updated ? `${last.updated} ${last.updated === 1 ? 'estudiante completado' : 'estudiantes completados'}` : '',
  ].filter(Boolean);
  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm text-primary-950 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-50">
      {confirming ? (
        <div role="alertdialog" aria-label="Deshacer la importación">
          <p>
            <b>¿Deshacer la importación?</b> Se quitarán del padrón los estudiantes nuevos y se vaciarán los datos que se completaron. Las clases, su XP y sus notas no cambian.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="pg-btn pg-focus border-red-300 text-red-800 dark:border-red-500/50 dark:text-red-100" onClick={() => undo.mutate(last.id)} disabled={undo.isPending}>
              {undo.isPending ? 'Deshaciendo…' : 'Deshacer'}
            </button>
            <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setConfirming(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1">
            Importaste desde Excel: <b>{parts.join(' y ')}</b>. Puedes deshacerlo hasta {whenLabel(last.undoableUntil)}, mientras no cambies a esos estudiantes.
          </p>
          <button type="button" className="pg-btn pg-focus" onClick={() => setConfirming(true)}>
            <RotateCcw size={16} aria-hidden="true" />
            Deshacer la importación
          </button>
        </div>
      )}
    </div>
  );
};
