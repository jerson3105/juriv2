import { useId, type ReactNode } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { cancelButton, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { card } from '../gradebook/gradebookHelpers';

// ── Interruptor accesible: role=switch, 44 px de área táctil, marca ✓ cuando está activo ──
export const Switch = ({ checked, onChange, disabled, labelledBy, describedBy, label }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  labelledBy?: string;
  describedBy?: string;
  label?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelledBy}
    aria-describedby={describedBy}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="group inline-flex min-h-[44px] min-w-[56px] flex-shrink-0 items-center justify-center rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-60"
  >
    <span
      aria-hidden="true"
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary-500 group-focus-visible:ring-offset-2 dark:group-focus-visible:ring-offset-gray-800 ${
        checked ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-500 dark:bg-gray-400'
      }`}
    >
      <span className={`absolute left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}>
        {checked && <Check size={14} strokeWidth={3} className="text-primary-700" />}
      </span>
    </span>
  </button>
);

// Fila con título, explicación y un interruptor conectado a ambos.
export const SwitchRow = ({ title, description, checked, onChange, disabled }: {
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p id={`${id}-t`} className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
        {description && <p id={`${id}-d`} className="text-sm text-gray-700 dark:text-gray-300">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} labelledBy={`${id}-t`} describedBy={description ? `${id}-d` : undefined} />
    </div>
  );
};

export const SettingsCard = ({ title, description, icon: Icon, children, footer, className = '' }: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) => {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`${card} min-w-0 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200" aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
          {description && <p className="text-sm text-gray-700 dark:text-gray-300">{description}</p>}
        </div>
      </div>
      <div className="mt-2">{children}</div>
      {footer}
    </section>
  );
};

// Campo numérico con unidad. El valor es texto para que vaciarlo no salte a otro número.
export const NumberField = ({ label, unit, value, onChange, min, max, hint, error }: {
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  hint?: string;
  error?: string | null;
}) => {
  const id = useId();
  const describedBy = [hint ? `${id}-h` : '', error ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${inputClass} min-w-0 max-w-[9rem] ${error ? 'border-red-600 dark:border-red-400' : ''}`}
        />
        {unit && <span className="text-sm text-gray-700 dark:text-gray-300">{unit}</span>}
      </div>
      {hint && <p id={`${id}-h`} className="mt-1 text-sm text-gray-700 dark:text-gray-300">{hint}</p>}
      {error && <p id={`${id}-e`} className="mt-1 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
};

// Pie de una tarjeta con campos: solo aparece si hay cambios sin guardar.
export const SaveBar = ({ dirty, saving, invalid, onSave, onDiscard, note }: {
  dirty: boolean;
  saving: boolean;
  invalid?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  note?: ReactNode;
}) => {
  if (!dirty) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
      <p className="mr-auto text-sm font-semibold text-amber-800 dark:text-amber-200" role="status">{note ?? 'Cambios sin guardar'}</p>
      <button type="button" onClick={onDiscard} disabled={saving} className={cancelButton}>Descartar</button>
      <button type="button" onClick={onSave} disabled={saving || invalid} className={primaryButton}>{saving ? 'Guardando…' : 'Guardar'}</button>
    </div>
  );
};
