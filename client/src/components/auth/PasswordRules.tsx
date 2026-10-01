import { Check, X } from 'lucide-react';
import { passwordChecks } from './authHelpers';

/** Requisitos de la contraseña a la vista, marcados en vivo (las mismas reglas del servidor). */
export const PasswordRules = ({ id, password }: { id: string; password: string }) => (
  <ul id={id} className="mt-2 grid gap-1 text-sm sm:grid-cols-2" aria-label="Requisitos de la contraseña">
    {passwordChecks(password).map((c) => (
      <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'}`}>
        {c.ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
        <span>{c.label}<span className="sr-only">{c.ok ? ': cumplido' : ': falta'}</span></span>
      </li>
    ))}
  </ul>
);
