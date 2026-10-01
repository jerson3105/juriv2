import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { classroomApi } from '../../lib/classroomApi';
import { questionBankApi, type TeacherBank } from '../../lib/questionBankApi';
import { cancelButton, primaryButton } from '../home/homeHelpers';
import { BankDialog } from './BankDialog';
import { errorMessage } from './bankHelpers';

interface DuplicateBankDialogProps {
  bank: Pick<TeacherBank, 'id' | 'name' | 'classroomId' | 'questionCount'>;
  /** Clase en la que está el docente (opción por defecto). */
  currentClassroomId: string;
  onClose: () => void;
  onDone?: (created: { id: string; classroomId: string }) => void;
}

/** Copia independiente del banco en una clase del docente (editar la copia no cambia el original). */
export const DuplicateBankDialog = ({ bank, currentClassroomId, onClose, onDone }: DuplicateBankDialogProps) => {
  const queryClient = useQueryClient();
  const ids = useId();
  const [target, setTarget] = useState(currentClassroomId);
  const { data: classrooms = [], isLoading } = useQuery({ queryKey: ['my-classrooms'], queryFn: classroomApi.getMyClassrooms });
  const options = classrooms.filter((c) => c.isActive || c.id === currentClassroomId);

  const duplicate = useMutation({
    mutationFn: () => questionBankApi.duplicateBank(bank.id, target),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] });
      const where = classrooms.find((c) => c.id === created.classroomId)?.name;
      toast.success(`Copia creada${where ? ` en ${where}` : ''}: ${created.name}`);
      onDone?.(created);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo duplicar el banco')),
  });

  return (
    <BankDialog
      title="Duplicar banco"
      subtitle={`${bank.name} · ${bank.questionCount} ${bank.questionCount === 1 ? 'pregunta' : 'preguntas'}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          <button type="button" onClick={() => duplicate.mutate()} disabled={duplicate.isPending || isLoading} className={primaryButton}>
            {duplicate.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Duplicar
          </button>
        </>
      )}
    >
      <p className="text-sm text-gray-800 dark:text-gray-100">La copia es independiente: si la cambias, el banco original queda igual.</p>
      <fieldset>
        <legend className="block text-sm font-semibold text-gray-800 dark:text-gray-100">¿En qué clase?</legend>
        {isLoading ? (
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300" role="status">Cargando tus clases…</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {options.map((c) => (
              <li key={c.id}>
                <label className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-2 px-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${target === c.id ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/15' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'}`}>
                  <input type="radio" name={`${ids}-target`} checked={target === c.id} onChange={() => setTarget(c.id)} className="h-4 w-4 accent-primary-600" />
                  <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{c.name}</span>
                  {c.id === bank.classroomId && <span className="text-xs text-gray-700 dark:text-gray-300">Está aquí</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </BankDialog>
  );
};
