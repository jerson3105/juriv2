import type { GradeScaleOptions, GradeScaleType } from '../../lib/gradeApi';
import { inputClass } from '../home/homeHelpers';
import { BUCKET_STYLE, bucketOfLabel } from './gradebookHelpers';

interface ScaleValuePickerProps {
  scale: GradeScaleOptions;
  scaleType: GradeScaleType | null;
  value: string | null;
  /** Letras: la etiqueta elegida. Números: el texto del campo ('' si se borra). */
  onChange: (value: string) => void;
  /** Etiqueta accesible del grupo o del campo. */
  label: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
  autoFocus?: boolean;
}

// Elegir una nota en la escala de la clase: botones para letras, campo numérico para 0-20 / 0-100.
export const ScaleValuePicker = ({ scale, scaleType, value, onChange, label, disabled, size = 'md', autoFocus }: ScaleValuePickerProps) => {
  if (scale.kind === 'letters') {
    return (
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {scale.values.map((level, index) => {
          const selected = value?.toUpperCase() === level.label.toUpperCase();
          const tone = BUCKET_STYLE[bucketOfLabel(level.label, scale, scaleType)];
          return (
            <button
              key={level.label}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              autoFocus={autoFocus && index === 0}
              onClick={() => onChange(level.label)}
              className={`${size === 'sm' ? 'min-h-[40px] min-w-[40px] px-2 text-sm' : 'min-h-[44px] min-w-[52px] px-3 text-base'} rounded-xl border-2 font-black disabled:opacity-50 ${selected ? `${tone} border-gray-900 dark:border-white` : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white'}`}
            >
              {level.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={scale.min}
      max={scale.max}
      step={scale.step}
      aria-label={`${label} (de ${scale.min} a ${scale.max})`}
      placeholder={`${scale.min}–${scale.max}`}
      value={value ?? ''}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${size === 'sm' ? 'w-24' : 'w-28'} text-center text-base font-bold`}
    />
  );
};
