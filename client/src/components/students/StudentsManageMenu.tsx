import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Download, Printer, Settings2, UserPlus, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentApi } from '../../lib/studentApi';
import { placeholderStudentApi } from '../../lib/placeholderStudentApi';
import { openParentFlyers } from '../../lib/parentFlyers';
import { HomeModal } from '../home/HomeModal';
import { cancelButton } from '../home/homeHelpers';
import { errorMessage } from '../gradebook/gradebookHelpers';

const item = 'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-100 dark:hover:bg-gray-700';

// Acciones de gestión de la Lista (antes en Configuración > Personas).
export const StudentsManageMenu = ({ classroomId, onAddStudents }: { classroomId: string; onAddStudents: () => void }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { data: placeholders = [] } = useQuery({
    queryKey: ['placeholder-students', classroomId],
    queryFn: () => placeholderStudentApi.getAll(classroomId),
  });
  const { data: hasDemo = false } = useQuery({
    queryKey: ['demoStudent', classroomId],
    queryFn: () => studentApi.hasDemoStudent(classroomId),
  });

  const deleteDemo = useMutation({
    mutationFn: () => studentApi.deleteDemoStudent(classroomId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
      void queryClient.invalidateQueries({ queryKey: ['demoStudent', classroomId] });
      toast.success('Alumno demo eliminado');
      setConfirmDemo(false);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo eliminar el alumno demo')),
  });

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const run = (action: () => void | Promise<void>) => async () => {
    setOpen(false);
    await action();
  };

  const downloadCards = async () => {
    setBusy(true);
    try {
      await placeholderStudentApi.downloadAllCardsPDF(classroomId);
      toast.success('Tarjetas descargadas');
    } catch {
      toast.error('No se pudieron descargar las tarjetas');
    } finally {
      setBusy(false);
    }
  };

  const flyers = async () => {
    setBusy(true);
    const result = await openParentFlyers(classroomId);
    setBusy(false);
    if ('error' in result) toast.error(result.error);
    else toast.success(`${result.count} folletos listos para imprimir`);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="students-manage-panel"
        aria-label="Gestionar alumnos"
        title="Gestionar alumnos"
        disabled={busy}
        className="pg-btn max-sm:w-11 max-sm:px-0"
      >
        <Settings2 size={18} className="sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline">Gestionar</span>
        <ChevronDown size={16} className={`hidden sm:block ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={panelRef} id="students-manage-panel" className="fixed inset-x-4 bottom-4 z-50 rounded-xl border sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-1 sm:w-72 border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <button type="button" onClick={run(onAddStudents)} className={item}>
              <UserPlus size={18} aria-hidden="true" /> Añadir alumnos sin cuenta
            </button>
            {placeholders.length > 0 && (
              <button type="button" onClick={run(downloadCards)} className={item}>
                <Download size={18} aria-hidden="true" /> Tarjetas para vincular ({placeholders.length})
              </button>
            )}
            <button type="button" onClick={run(flyers)} className={item}>
              <Printer size={18} aria-hidden="true" /> Folletos para las familias
            </button>
            {hasDemo && (
              <button type="button" onClick={run(() => setConfirmDemo(true))} className={`${item} text-red-800 dark:text-red-200`}>
                <UserX size={18} aria-hidden="true" /> Eliminar alumno demo
              </button>
            )}
          </div>
        </>
      )}
      {confirmDemo && (
        <HomeModal
          title="¿Eliminar el alumno demo?"
          onClose={deleteDemo.isPending ? () => undefined : () => setConfirmDemo(false)}
          footer={<>
            <button type="button" onClick={() => setConfirmDemo(false)} disabled={deleteDemo.isPending} className={cancelButton}>Cancelar</button>
            <button type="button" onClick={() => deleteDemo.mutate()} disabled={deleteDemo.isPending}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">
              {deleteDemo.isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>}
        >
          <p className="text-sm text-gray-800 dark:text-gray-100">Se borra el alumno de prueba con todos sus puntos e historial. Los alumnos reales no se tocan.</p>
        </HomeModal>
      )}
    </div>
  );
};
