import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi, type Classroom } from '../../lib/classroomApi';
import { ResetDataModal } from '../classroom/ResetDataModal';
import { DeleteClassModal } from '../home/ClassModals';
import { classroomsKey } from '../home/homeHelpers';
import { errorMessage, secondaryButton } from '../gradebook/gradebookHelpers';
import { SettingsCard } from './settingsUi';
import { undoToast } from './settingsHooks';

const dangerButton = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-gray-800 dark:text-red-200 dark:hover:bg-red-900/30';

// Configuración > Archivar o eliminar. Eliminar solo existe para clases archivadas (igual que en Inicio).
export const ArchiveSection = ({ classroom, studentCount }: { classroom: Classroom; studentCount: number }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const archived = classroom.isActive === false;

  const setArchived = async (archive: boolean, withUndo: boolean) => {
    setBusy(true);
    queryClient.setQueryData<Classroom>(['classroom', classroom.id], (old) => (old ? { ...old, isActive: !archive } : old));
    try {
      await (archive ? classroomApi.archive(classroom.id) : classroomApi.restore(classroom.id));
      const message = archive ? `Archivada: ${classroom.name}` : `Restaurada: ${classroom.name}`;
      if (withUndo) undoToast(message, () => void setArchived(!archive, false));
      else toast.success(message);
    } catch (error) {
      queryClient.setQueryData<Classroom>(['classroom', classroom.id], (old) => (old ? { ...old, isActive: archive } : old));
      toast.error(errorMessage(error, archive ? 'No se pudo archivar la clase' : 'No se pudo restaurar la clase'));
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      void queryClient.invalidateQueries({ queryKey: classroomsKey });
    }
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <SettingsCard
        title={archived ? 'Clase archivada' : 'Archivar la clase'}
        icon={archived ? ArchiveRestore : Archive}
        description={archived
          ? 'Está en «Archivadas» de tu Inicio y nadie puede unirse. Restáurala para volver a usarla.'
          : 'Para cuando termina el año o el curso: sale de tu Inicio (queda en «Archivadas») y nadie puede unirse. No se borra nada.'}
      >
        <div className="py-3">
          {archived ? (
            <button type="button" onClick={() => setArchived(false, false)} disabled={busy} className={secondaryButton}>
              <ArchiveRestore size={16} aria-hidden="true" /> Restaurar clase
            </button>
          ) : (
            <button type="button" onClick={() => setArchived(true, true)} disabled={busy} className={secondaryButton}>
              <Archive size={16} aria-hidden="true" /> Archivar clase
            </button>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Borrar datos de la clase" icon={RefreshCw} description="Elige qué borrar (puntos, historial, compras…). Los alumnos y la configuración se quedan.">
        <div className="py-3">
          <button type="button" onClick={() => setShowReset(true)} className={dangerButton}>
            <RefreshCw size={16} aria-hidden="true" /> Borrar datos…
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Eliminar definitivamente"
        icon={Trash2}
        description={archived
          ? 'Borra la clase con sus alumnos y todo su progreso. No se puede deshacer.'
          : 'Primero archiva la clase. Así se evita borrar una clase en uso por error.'}
      >
        {archived && (
          <div className="py-3">
            <button type="button" onClick={() => setShowDelete(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800">
              <Trash2 size={16} aria-hidden="true" /> Eliminar para siempre…
            </button>
          </div>
        )}
      </SettingsCard>

      {showReset && <ResetDataModal classroom={classroom} onClose={() => setShowReset(false)} />}
      {showDelete && (
        <DeleteClassModal
          classroom={{ ...classroom, studentCount }}
          onClose={() => setShowDelete(false)}
          onDeleted={() => navigate('/dashboard', { replace: true })}
        />
      )}
    </div>
  );
};
