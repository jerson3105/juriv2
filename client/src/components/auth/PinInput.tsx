import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PinInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Se llama al escribir el 4.º número (para entrar sin buscar el botón). */
  onComplete?: (value: string) => void;
  error?: string | null;
  hint?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * PIN de 4 números en cuatro casillas grandes. El campo real es de texto numérico e invisible sobre
 * las casillas: así el navegador no ofrece guardarlo como contraseña en las computadoras compartidas
 * del colegio. "Ver" muestra los números (ayuda a los más pequeños).
 */
export const PinInput = ({ label, value, onChange, onComplete, error, hint, autoFocus, disabled }: PinInputProps) => {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;

  const change = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, 4);
    onChange(next);
    if (next.length === 4 && value.length < 4) onComplete?.(next);
  };

  return (
    <div>
      <label htmlFor={id} className="block text-center text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</label>
      <div className="relative mx-auto mt-2 w-fit">
        <div className="flex gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => {
            const active = focused && (i === value.length || (i === 3 && value.length === 4));
            return (
              <span
                key={i}
                className={`flex h-16 w-14 items-center justify-center rounded-xl border-2 bg-white text-3xl font-bold text-gray-900 dark:bg-gray-900 dark:text-white ${
                  error ? 'border-red-600 dark:border-red-400'
                    : active ? 'border-primary-600 ring-2 ring-primary-500 dark:border-primary-400'
                      : value[i] ? 'border-primary-500 dark:border-primary-400' : 'border-gray-400 dark:border-gray-500'
                }`}
              >
                {value[i] ? (visible ? value[i] : '●') : ''}
              </span>
            );
          })}
        </div>
        <input
          id={id}
          value={value}
          onChange={(e) => change(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          readOnly={disabled}
          aria-busy={disabled || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="absolute inset-0 h-full w-full cursor-text rounded-xl text-transparent caret-transparent opacity-0"
        />
      </div>
      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {visible ? 'Ocultar números' : 'Ver números'}
        </button>
      </div>
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-center text-sm text-gray-700 dark:text-gray-300">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-center text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
};
