import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DoorClosed, DoorOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { classroomApi, type Classroom } from '../../lib/classroomApi';

interface ShopSettingsBarProps {
  classroom: Classroom;
  onSaved?: () => void;
}

const Switch = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-primary-600' : 'bg-gray-400 dark:bg-gray-600'}`}
  >
    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

// Ajustes de la tienda (abierta, aprobación, límite diario): solo se editan aquí.
// El padre la monta con key según el límite diario para reiniciar el borrador si cambia fuera.
export const ShopSettingsBar = ({ classroom, onSaved }: ShopSettingsBarProps) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [limitDraft, setLimitDraft] = useState(classroom.dailyPurchaseLimit ? String(classroom.dailyPurchaseLimit) : '');
  const open = classroom.shopEnabled ?? true;


  const save = async (changes: Partial<Pick<Classroom, 'shopEnabled' | 'requirePurchaseApproval' | 'dailyPurchaseLimit'>>, message: string) => {
    setSaving(true);
    try {
      await classroomApi.update(classroom.id, changes);
      queryClient.invalidateQueries({ queryKey: ['classroom', classroom.id] });
      onSaved?.();
      toast.success(message);
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo guardar el ajuste');
    } finally {
      setSaving(false);
    }
  };

  const commitLimit = () => {
    const value = parseInt(limitDraft, 10);
    const next = Number.isFinite(value) && value > 0 ? Math.min(value, 50) : null;
    if (next === (classroom.dailyPurchaseLimit ?? null)) return;
    void save({ dailyPurchaseLimit: next }, next ? `Límite: ${next} compras al día por estudiante` : 'Sin límite de compras diarias');
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border-2 px-4 py-3 ${open ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800'}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${open ? 'bg-green-700' : 'bg-gray-600'}`} aria-hidden="true">
          {open ? <DoorOpen size={18} /> : <DoorClosed size={18} />}
        </span>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{open ? 'Tienda abierta' : 'Tienda cerrada'}</p>
          <p className="text-xs text-gray-700 dark:text-gray-300">{open ? 'Tus estudiantes pueden comprar' : 'Nadie puede comprar; tú sí puedes dar artículos'}</p>
        </div>
        <Switch checked={open} disabled={saving} label="Tienda abierta" onChange={(value) => void save({ shopEnabled: value }, value ? 'Tienda abierta' : 'Tienda cerrada')} />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
        <Switch
          checked={classroom.requirePurchaseApproval ?? false}
          disabled={saving || !open}
          label="Aprobar cada compra"
          onChange={(value) => void save({ requirePurchaseApproval: value }, value ? 'Aprobarás cada compra' : 'Las compras se aprueban solas')}
        />
        Aprobar cada compra
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
        Compras por día
        <input
          type="number"
          min={1}
          max={50}
          inputMode="numeric"
          value={limitDraft}
          disabled={saving || !open}
          placeholder="Sin límite"
          onChange={(e) => setLimitDraft(e.target.value)}
          onBlur={commitLimit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-9 w-24 rounded-lg border border-gray-300 bg-white px-2 text-center text-sm font-bold text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
        />
      </label>
    </div>
  );
};
