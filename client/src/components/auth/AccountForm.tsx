import { useId, useState } from 'react';
import { Check, Lock, Mail, User, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { primaryButton } from '../home/homeHelpers';
import { isPasswordValid, passwordChecks } from './authHelpers';

export interface AccountFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface AccountFormProps {
  submitLabel: string;
  onSubmit: (values: AccountFormValues) => Promise<void>;
  busy?: boolean;
  error?: string | null;
  /** Casilla obligatoria (por ejemplo, la declaración del docente). */
  declaration?: string;
}

/** Nombre, correo y contraseña con las reglas a la vista (las mismas del servidor). */
export const AccountForm = ({ submitLabel, onSubmit, busy, error, declaration }: AccountFormProps) => {
  const ids = useId();
  const [values, setValues] = useState<AccountFormValues>({ firstName: '', lastName: '', email: '', password: '' });
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = (key: keyof AccountFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const checks = passwordChecks(values.password);
  const problems = {
    firstName: values.firstName.trim().length < 2 ? 'Escribe tu nombre' : undefined,
    lastName: values.lastName.trim().length < 2 ? 'Escribe tu apellido' : undefined,
    email: /^\S+@\S+\.\S+$/.test(values.email.trim()) ? undefined : 'Escribe un correo válido',
    password: isPasswordValid(values.password) ? undefined : 'La contraseña no cumple los requisitos',
    confirm: confirm && confirm === values.password ? undefined : 'Las contraseñas no coinciden',
    declaration: declaration && !accepted ? 'Marca la casilla para continuar' : undefined,
  };
  const valid = Object.values(problems).every((p) => !p);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    await onSubmit({ ...values, email: values.email.trim(), firstName: values.firstName.trim(), lastName: values.lastName.trim() });
  };
  const show = (key: keyof typeof problems) => (touched ? problems[key] : undefined);

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre" name="firstName" autoComplete="given-name" value={values.firstName} onChange={set('firstName')} leftIcon={<User size={18} />} error={show('firstName')} required />
        <Input label="Apellido" name="lastName" autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={show('lastName')} required />
      </div>
      <Input label="Correo electrónico" type="email" name="email" autoComplete="email" inputMode="email" placeholder="tu@correo.com" value={values.email} onChange={set('email')} leftIcon={<Mail size={18} />} error={show('email')} required />
      <div>
        <Input label="Contraseña" type="password" name="password" autoComplete="new-password" value={values.password} onChange={set('password')} leftIcon={<Lock size={18} />} error={show('password')} aria-describedby={`${ids}-rules`} required />
        <ul id={`${ids}-rules`} className="mt-2 grid gap-1 text-sm sm:grid-cols-2" aria-label="Requisitos de la contraseña">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'}`}>
              {c.ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
              <span>{c.label}<span className="sr-only">{c.ok ? ': cumplido' : ': falta'}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <Input label="Repite la contraseña" type="password" name="confirmPassword" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} leftIcon={<Lock size={18} />} error={show('confirm')} required />
      {declaration && (
        <div>
          <label htmlFor={`${ids}-decl`} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-600">
            <input id={`${ids}-decl`} type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary-600" aria-describedby={show('declaration') ? `${ids}-decl-error` : undefined} />
            <span className="text-sm text-gray-800 dark:text-gray-100">{declaration}</span>
          </label>
          {show('declaration') && <p id={`${ids}-decl-error`} role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">{problems.declaration}</p>}
        </div>
      )}
      {error && <p className="text-sm font-medium text-red-700 dark:text-red-300" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
        {busy ? 'Creando cuenta…' : submitLabel}
      </button>
    </form>
  );
};
