import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RotateCcw } from 'lucide-react';
import { errorMessage } from '../../auth/authHelpers';
import { rosterBuilderApi, rosterBuilderKeys } from '../../../lib/schoolRosterBuilderApi';
import { schoolRosterKeys } from '../../../lib/schoolRosterApi';
import { whenLabel } from './rosterHelpers';

/**
 * Aviso tras «Armar desde clases»: cuánto se armó y, mientras se pueda (24 h, sin estudiantes tocados), «Deshacer el
 * armado». Al deshacer, el borrador vuelve para corregir y confirmar otra vez.
 */
export const UndoBuildBanner = ({ schoolId, yearId }: { schoolId: string; yearId: string }) => {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [undone, setUndone] = useState(false);
  const last = useQuery({ queryKey: rosterBuilderKeys.last(schoolId, yearId), queryFn: () => rosterBuilderApi.lastBuild(schoolId, yearId) });
  const undo = useMutation({
    mutationFn: (buildId: string) => rosterBuilderApi.undo(schoolId, yearId, buildId),
    onSuccess: (result) => {
      setConfirming(false);
      setUndone(true);
      void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
      void queryClient.invalidateQueries({ queryKey: ['roster-builder', schoolId, yearId] });
      toast.success(result.message);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo deshacer el armado')),
  });

  if (undone) {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" role="status">
        Armado deshecho. Tu borrador sigue guardado:
        <Link to={`/escuela/${schoolId}/estudiantes/armar`} className="font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">volver al asistente</Link>
      </p>
    );
  }
  const build = last.data;
  if (!build || !build.canUndo) return null;
  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm text-primary-950 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-50">
      {confirming ? (
        <div role="alertdialog" aria-label="Deshacer el armado">
          <p>
            <b>¿Deshacer el armado?</b> Se quitarán {build.created} {build.created === 1 ? 'estudiante' : 'estudiantes'} del padrón y sus perfiles volverán a como estaban. Las clases, su XP y sus notas no cambian.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="pg-btn pg-focus border-red-300 text-red-800 dark:border-red-500/50 dark:text-red-100" onClick={() => undo.mutate(build.id)} disabled={undo.isPending}>
              {undo.isPending ? 'Deshaciendo…' : 'Deshacer'}
            </button>
            <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setConfirming(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1">
            Armaste el padrón desde las clases: <b>{build.created} {build.created === 1 ? 'estudiante nuevo' : 'estudiantes nuevos'}</b> y {build.linked} {build.linked === 1 ? 'perfil vinculado' : 'perfiles vinculados'}. Puedes deshacerlo hasta {whenLabel(build.undoableUntil)}, mientras no cargues datos ni hagas cambios.
          </p>
          <button type="button" className="pg-btn pg-focus" onClick={() => setConfirming(true)}>
            <RotateCcw size={16} aria-hidden="true" />
            Deshacer el armado
          </button>
        </div>
      )}
    </div>
  );
};
