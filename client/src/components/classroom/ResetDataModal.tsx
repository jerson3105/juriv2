import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi, type ResetOptions } from '../../lib/classroomApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, inputClass, labelClass } from '../home/homeHelpers';

type ResetKey = keyof ResetOptions;

const OPTIONS: { key: ResetKey; label: string; description: string }[] = [
  { key: 'points', label: 'Puntos (XP, HP, oro y nivel)', description: 'Vuelven a los valores iniciales de la clase y nivel 1.' },
  { key: 'history', label: 'Historial de puntos', description: 'Borra lo que se dio y quitó (el registro de actividad).' },
  { key: 'purchases', label: 'Compras de la tienda', description: 'Borra compras y usos de objetos.' },
  { key: 'badges', label: 'Insignias', description: 'Quita insignias ganadas y su progreso.' },
  { key: 'attendance', label: 'Asistencia', description: 'Borra todos los registros de asistencia.' },
  { key: 'streaks', label: 'Rachas', description: 'Reinicia rachas de ingreso y de actividad.' },
  { key: 'clans', label: 'Clanes', description: 'XP, oro, victorias y derrotas de clanes a cero (los clanes se mantienen).' },
  { key: 'scrolls', label: 'Pergaminos', description: 'Borra los pergaminos del mural y sus reacciones.' },
  { key: 'powerUsages', label: 'Uso de poderes', description: 'Borra el registro de poderes usados.' },
];

// Borrado selectivo de datos de la clase: irreversible, se confirma escribiendo el nombre de la clase.
export const ResetDataModal = ({ classroom, onClose }: { classroom: { id: string; name: string }; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<ResetKey>>(new Set());
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const all = selected.size === OPTIONS.length;
  const toggle = (key: ResetKey) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const canConfirm = selected.size > 0 && confirmText.trim() === classroom.name.trim() && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      const options = Object.fromEntries(OPTIONS.map((o) => [o.key, selected.has(o.key)])) as ResetOptions;
      const result = await classroomApi.resetClassroomSelective(classroom.id, options);
      for (const key of ['classroom', 'students', 'history', 'history-feed', 'history-summary', 'history-stats', 'clans']) {
        queryClient.invalidateQueries({ queryKey: [key, classroom.id] });
      }
      const count = result.cleaned.length;
      toast.success(`${count} ${count === 1 ? 'categoría borrada' : 'categorías borradas'}`);
      onClose();
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudieron borrar los datos');
    } finally {
      setBusy(false);
    }
  };

  return (
    <HomeModal
      title="Borrar datos de la clase"
      subtitle="Los alumnos, comportamientos y la configuración se mantienen."
      size="lg"
      onClose={() => !busy && onClose()}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={cancelButton}>Cancelar</button>
        <button type="button" onClick={confirm} disabled={!canConfirm}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-700 dark:disabled:bg-gray-700 dark:disabled:text-gray-300">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
          {selected.size === 0 ? 'Borrar' : `Borrar ${selected.size} ${selected.size === 1 ? 'categoría' : 'categorías'}`}
        </button>
      </>}
    >
      <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-900 dark:bg-red-900/30 dark:text-red-100">
        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        No se puede deshacer. Se borra para todos los alumnos de la clase.
      </p>
      <fieldset>
        <div className="flex items-center justify-between gap-2">
          <legend className={labelClass}>¿Qué quieres borrar?</legend>
          <button type="button" onClick={() => setSelected(all ? new Set() : new Set(OPTIONS.map((o) => o.key)))}
            className="min-h-[40px] rounded-lg px-2 text-sm font-semibold text-primary-800 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-900/30">
            {all ? 'Quitar todo' : 'Seleccionar todo'}
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <label key={o.key} className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${selected.has(o.key) ? 'border-red-600 bg-red-50 dark:border-red-400 dark:bg-red-900/25' : 'border-gray-200 dark:border-gray-700'}`}>
              <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} className="mt-0.5 h-5 w-5 flex-shrink-0 accent-red-700" />
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{o.label}</span>
                <span className="block text-sm text-gray-700 dark:text-gray-300">{o.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="reset-confirm" className={labelClass}>Escribe «{classroom.name}» para confirmar</label>
        <input id="reset-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className={`${inputClass} mt-1`} />
      </div>
    </HomeModal>
  );
};
