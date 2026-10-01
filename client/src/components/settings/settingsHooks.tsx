import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { classroomApi, type Classroom, type UpdateClassroomSettings } from '../../lib/classroomApi';
import { errorMessage } from '../gradebook/gradebookHelpers';

// Lógica compartida de Configuración: borradores por tarjeta, guardado con Deshacer y validación.

/** Entero dentro de un rango, o el mensaje de error para el campo. */
export const parseIntField = (value: string, min: number, max: number): { value: number | null; error: string | null } => {
  if (value.trim() === '') return { value: null, error: 'Escribe un número' };
  const n = Number(value);
  if (!Number.isInteger(n)) return { value: null, error: 'Solo números enteros' };
  if (n < min) return { value: null, error: `El mínimo es ${min}` };
  if (n > max) return { value: null, error: `El máximo es ${max}` };
  return { value: n, error: null };
};


/**
 * Borrador local de una tarjeta. Si el servidor trae valores nuevos (otra pestaña, un refetch)
 * y aquí no hay cambios sin guardar, los adopta; si los hay, se conservan.
 * Tras guardar con éxito, `markSaved` hace que el borrador tome lo guardado (ya normalizado).
 */
export function useDraft<T>(source: T) {
  const sourceKey = JSON.stringify(source);
  const [draft, setDraft] = useState<T>(source);
  const [baseKey, setBaseKey] = useState(sourceKey);
  const [syncPending, setSyncPending] = useState(false);
  if (syncPending) {
    setSyncPending(false);
    setDraft(source);
    setBaseKey(sourceKey);
  } else if (sourceKey !== baseKey) {
    if (JSON.stringify(draft) === baseKey) setDraft(source);
    setBaseKey(sourceKey);
  }
  return {
    draft,
    setDraft,
    dirty: JSON.stringify(draft) !== sourceKey,
    reset: () => setDraft(source),
    markSaved: () => setSyncPending(true),
  };
}

export const undoToast = (message: string, onUndo: () => void) =>
  toast.success(
    (t) => (
      <span className="flex items-center gap-3">
        <span>{message}</span>
        <button
          type="button"
          onClick={() => { toast.dismiss(t.id); onUndo(); }}
          className="min-h-[36px] shrink-0 rounded-lg border border-white/40 px-3 text-sm font-semibold text-white hover:bg-white/15"
        >
          Deshacer
        </button>
      </span>
    ),
    { duration: 6000 },
  );

/**
 * Guarda solo los campos cambiados. Se refleja al instante en la clase en caché y, si falla,
 * se revierten esos mismos campos. Con `undoable` el aviso ofrece Deshacer.
 */
export const useClassroomSettingsSave = (classroom: Classroom) => {
  const queryClient = useQueryClient();
  const key = ['classroom', classroom.id];
  const [saving, setSaving] = useState(false);

  const patchCache = (changes: UpdateClassroomSettings) =>
    queryClient.setQueryData<Classroom>(key, (old) => (old ? { ...old, ...changes } as Classroom : old));

  const save = async (changes: UpdateClassroomSettings, message: string, undoable = false): Promise<boolean> => {
    const current = queryClient.getQueryData<Classroom>(key) ?? classroom;
    const previous = Object.fromEntries(Object.keys(changes).map((k) => [k, current[k as keyof Classroom]])) as UpdateClassroomSettings;
    patchCache(changes);
    setSaving(true);
    try {
      await classroomApi.update(classroom.id, changes);
      if (undoable) undoToast(message, () => void save(previous, 'Cambio deshecho'));
      else toast.success(message);
      return true;
    } catch (error) {
      patchCache(previous);
      toast.error(errorMessage(error, 'No se pudo guardar el cambio'));
      return false;
    } finally {
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  return { save, saving };
};

/** Solo los campos del borrador que difieren de lo guardado. */
export const changedFields = <T extends Record<string, unknown>>(next: T, saved: T): Partial<T> =>
  Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(saved[k]))) as Partial<T>;
