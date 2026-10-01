import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// Campo con etiqueta ligada (el lector anuncia "Correo electrónico", no el placeholder), error y
// ayuda referenciados con aria-describedby, y botón de mostrar contraseña con nombre y 44 px.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      type = 'text',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-help`;
    const describedBy = [error ? errorId : null, helperText && !error ? helperId : null, props['aria-describedby']]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-100">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" aria-hidden="true">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={isPassword && showPassword ? 'text' : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`
              min-h-[44px] w-full rounded-xl border px-4 py-2.5
              bg-white text-gray-900 dark:bg-gray-800 dark:text-white
              placeholder:text-gray-500 dark:placeholder:text-gray-400
              outline-none focus:ring-2 focus:ring-primary-500
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon || isPassword ? 'pr-12' : ''}
              ${error
                ? 'border-red-600 focus:ring-red-500 dark:border-red-400'
                : 'border-gray-300 focus:border-primary-500 dark:border-gray-600'
              }
              ${className}
            `}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
              className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          )}
          {rightIcon && !isPassword && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" aria-hidden="true">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-gray-700 dark:text-gray-300">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
