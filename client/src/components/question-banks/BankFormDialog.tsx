import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Loader2 } from 'lucide-react';
import { BANK_COLORS, BANK_ICONS, questionBankApi, type QuestionBank, type TeacherBank } from '../../lib/questionBankApi';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { BankDialog } from './BankDialog';
import { errorMessage } from './bankHelpers';

interface BankFormDialogProps {
  /** Clase donde se crea (solo al crear). */
  classroomId: string;
  bank?: Pick<TeacherBank, 'id' | 'name' | 'description' | 'icon' | 'color'> | null;
  onClose: () => void;
  onSaved?: (bank: QuestionBank) => void;
}

/** Crear o editar un banco: nombre, descripción, emoji y color. */
export const BankFormDialog = ({ classroomId, bank, onClose, onSaved }: BankFormDialogProps) => {
  const queryClient = useQueryClient();
  const ids = useId();
  const editing = !!bank;
  const [name, setName] = useState(bank?.name ?? '');
  const [description, setDescription] = useState(bank?.description ?? '');
  const [icon, setIcon] = useState(bank?.icon ?? 'book');
  // Al crear sin elegir color, el servidor asigna uno que no se repita en la clase.
  const [color, setColor] = useState<string | null>(bank?.color ?? null);
  const [touched, setTouched] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), description: description.trim(), icon, ...(color ? { color } : {}) };
      return editing ? questionBankApi.updateBank(bank!.id, data) : questionBankApi.createBank(classroomId, data);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['question-banks-mine'] });
      void queryClient.invalidateQueries({ queryKey: ['question-bank', saved.id] });
      toast.success(editing ? 'Banco guardado' : 'Banco creado');
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar el banco')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    save.mutate();
  };

  return (
    <BankDialog
      title={editing ? 'Editar banco' : 'Nuevo banco'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
          <button type="submit" form={`${ids}-form`} disabled={save.isPending} className={primaryButton}>
            {save.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {editing ? 'Guardar' : 'Crear banco'}
          </button>
        </>
      )}
    >
      <form id={`${ids}-form`} onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor={`${ids}-name`} className={labelClass}>Nombre</label>
          <input
            id={`${ids}-name`}
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 100))}
            placeholder="Ej.: Fracciones"
            aria-invalid={touched && !name.trim()}
            aria-describedby={touched && !name.trim() ? `${ids}-name-error` : undefined}
            className={`${inputClass} mt-1`}
          />
          {touched && !name.trim() && <p id={`${ids}-name-error`} className="mt-1 text-sm font-semibold text-red-700 dark:text-red-300">Escribe un nombre para el banco.</p>}
        </div>
        <div>
          <label htmlFor={`${ids}-description`} className={labelClass}>Descripción <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span></label>
          <textarea id={`${ids}-description`} value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={2} placeholder="Unidad, tema o para qué lo usas" className={`${inputClass} mt-1`} />
        </div>
        <fieldset>
          <legend className={labelClass}>Ícono</legend>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {BANK_ICONS.map((option) => (
              <label key={option.id} className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border-2 text-2xl has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${icon === option.id ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/15' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'}`}>
                <input type="radio" name={`${ids}-icon`} value={option.id} checked={icon === option.id} onChange={() => setIcon(option.id)} className="sr-only" aria-label={option.label} />
                <span aria-hidden="true">{option.emoji}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={labelClass}>Color</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {BANK_COLORS.map((option) => (
              <label key={option.value} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 has-[:focus-visible]:ring-offset-2 dark:has-[:focus-visible]:ring-offset-gray-800" style={{ backgroundColor: option.value }}>
                <input type="radio" name={`${ids}-color`} value={option.value} checked={color === option.value} onChange={() => setColor(option.value)} className="sr-only" aria-label={option.label} />
                {color === option.value && <Check size={20} className="text-white drop-shadow" aria-hidden="true" />}
              </label>
            ))}
          </div>
          {!editing && !color && <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">Si no eliges, le damos uno distinto a los de tus otros bancos.</p>}
        </fieldset>
      </form>
    </BankDialog>
  );
};
