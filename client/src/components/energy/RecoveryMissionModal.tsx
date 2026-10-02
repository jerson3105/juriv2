import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import { recoveryApi } from '../../lib/recoveryApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, primaryButton } from '../home/homeHelpers';
import { errorMessage, secondaryButton } from '../gradebook/gradebookHelpers';
import { restingKey, useRestingStudents } from './energyHelpers';

const OTHER = '__other';

/**
 * Misión de recuperación para quien descansa (0 HP). Se asigna (plantilla o texto propio) y se
 * valida al cumplirla: vuelve con la mitad de su energía. En inicial, recuperación inmediata.
 */
export const RecoveryMissionModal = ({ classroomId, studentId, studentName, initial, onClose }: {
  classroomId: string;
  studentId: string;
  studentName: string;
  initial: boolean;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const { templates, byStudent } = useRestingStudents(classroomId);
  const current = byStudent.get(studentId)?.mission ?? null;
  const [changing, setChanging] = useState(false);
  const [choice, setChoice] = useState('');
  const [other, setOther] = useState('');
  const groupId = useId();
  const selected = choice || templates[0] || OTHER;
  const text = selected === OTHER ? other.trim() : selected;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['classroom', classroomId] });
    void queryClient.invalidateQueries({ queryKey: restingKey(classroomId) });
    void queryClient.invalidateQueries({ queryKey: ['history-feed', classroomId] });
  };

  const assign = useMutation({
    mutationFn: ({ missionText, complete }: { missionText: string; complete: boolean }) => recoveryApi.assign(classroomId, studentId, missionText, complete),
    onSuccess: (_data, { complete }) => {
      toast.success(complete ? `${studentName} recuperó su energía` : `Misión asignada a ${studentName}`);
      refresh();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la misión')),
  });

  const complete = useMutation({
    mutationFn: (missionId: string) => recoveryApi.complete(missionId),
    onSuccess: () => {
      toast.success(`${studentName} cumplió su misión y recuperó la mitad de su energía`);
      refresh();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo validar la misión')),
  });

  const busy = assign.isPending || complete.isPending;
  const showForm = !initial && (!current || changing);

  const footer = initial ? (
    <>
      <button type="button" onClick={onClose} disabled={busy} className={cancelButton}>Cancelar</button>
      <button type="button" onClick={() => assign.mutate({ missionText: 'Recuperación inmediata', complete: true })} disabled={busy} className={primaryButton} data-autofocus>
        {busy ? 'Guardando…' : 'Recuperar energía'}
      </button>
    </>
  ) : showForm ? (
    <>
      <button type="button" onClick={changing ? () => setChanging(false) : onClose} disabled={busy} className={cancelButton}>{changing ? 'Volver' : 'Cancelar'}</button>
      <button type="button" onClick={() => assign.mutate({ missionText: text, complete: true })} disabled={busy || text.length < 3} className={secondaryButton}>
        Asignar y ya la cumplió
      </button>
      <button type="button" onClick={() => assign.mutate({ missionText: text, complete: false })} disabled={busy || text.length < 3} className={primaryButton}>
        {busy ? 'Guardando…' : 'Asignar misión'}
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => setChanging(true)} disabled={busy} className={cancelButton}>Cambiar misión</button>
      <button type="button" onClick={() => current && complete.mutate(current.id)} disabled={busy} className={primaryButton} data-autofocus>
        {busy ? 'Guardando…' : 'Cumplió la misión'}
      </button>
    </>
  );

  return (
    <HomeModal title="Misión de recuperación" subtitle={`${studentName} · Descansando`} onClose={busy ? () => undefined : onClose} footer={footer}>
      <div className="flex gap-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-900 dark:bg-slate-700/60 dark:text-slate-100">
        <Moon size={20} className="flex-shrink-0 fill-current" aria-hidden="true" />
        <p>
          {initial
            ? `${studentName} se quedó sin energía. En inicial vuelve en cuanto esté listo: recupéralo cuando se haya calmado.`
            : `${studentName} se quedó sin energía. Mientras descansa, la tienda de premios está en pausa (sigue ganando XP y oro). Al cumplir su misión vuelve con la mitad de su energía.`}
        </p>
      </div>

      {!initial && current && !changing && (
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Misión asignada</p>
          <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">«{current.text}»</p>
        </div>
      )}

      {showForm && (
        <fieldset>
          <legend id={`${groupId}-l`} className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Elige una misión</legend>
          <div className="space-y-2">
            {[...templates, OTHER].map((option) => {
              const isSelected = selected === option;
              return (
                <label key={option} className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border-2 p-3 text-sm ${isSelected ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30' : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'}`}>
                  <input type="radio" name={`${groupId}-mission`} checked={isSelected} onChange={() => setChoice(option)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary-600" />
                  <span className="text-gray-900 dark:text-white">{option === OTHER ? 'Otra misión…' : option}</span>
                </label>
              );
            })}
          </div>
          {selected === OTHER && (
            <textarea value={other} onChange={(e) => setOther(e.target.value)} rows={2} maxLength={255}
              aria-label="Escribe la misión" placeholder="Ej.: Ordenar la biblioteca del aula con un compañero"
              className={`${inputClass} mt-2 resize-none`} />
          )}
        </fieldset>
      )}
    </HomeModal>
  );
};
