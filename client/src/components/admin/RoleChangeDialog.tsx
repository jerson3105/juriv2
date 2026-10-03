import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, UserCog, GraduationCap, X } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import type { AdminUser, AssignableRole } from '../../lib/adminApi';

const OPTIONS: { value: AssignableRole; label: string; icon: typeof Shield; effect: string }[] = [
  {
    value: 'TEACHER',
    label: 'Profesor',
    icon: UserCog,
    effect: 'Quedará como docente verificado: podrá crear clases y recibir alumnos con cuenta y familias.',
  },
  {
    value: 'STUDENT',
    label: 'Estudiante',
    icon: GraduationCap,
    effect: 'Perderá las herramientas de profesor.',
  },
  {
    value: 'ADMIN',
    label: 'Administrador',
    icon: Shield,
    effect: 'Tendrá acceso total: usuarios, verificaciones, catálogo y todas las clases.',
  },
];

interface RoleChangeDialogProps {
  user: AdminUser;
  onClose: () => void;
  onChanged: (role: AssignableRole) => void;
}

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo cambiar el rol. Inténtalo otra vez.';

/**
 * Cambiar el rol de una cuenta: dice qué implica cada rol, cierra sus sesiones y, para dar acceso
 * total, pide escribir su correo y la contraseña de quien lo da (el servidor la vuelve a revisar).
 */
export const RoleChangeDialog = ({ user, onClose, onChanged }: RoleChangeDialogProps) => {
  const [role, setRole] = useState<AssignableRole | null>(null);
  const [typedEmail, setTypedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const giving = role === 'ADMIN';
  // Las cuentas con PIN no tienen correo real (y el servidor no las deja ser docentes ni administración).
  const emailOk = !!user.email && typedEmail.trim().toLowerCase() === user.email.toLowerCase();
  const canSubmit = !!role && role !== user.role && !saving && (!giving || (emailOk && password.length > 0));
  const chosen = OPTIONS.find((option) => option.value === role);
  // El foco va a la primera opción que se puede elegir (la del rol actual está deshabilitada).
  const firstEnabled = OPTIONS.findIndex((option) => option.value !== user.role);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !role) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateUserRole(user.id, role, giving ? password : undefined);
      onChanged(role);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return createPortal(
    <div data-pg="" className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="pg-surface w-full max-w-md p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold">Cambiar el rol de {fullName}</h2>
            <p className="pg-fg2 truncate text-sm">{user.email ?? 'Entra con el PIN de su clase'}</p>
          </div>
          <button type="button" onClick={onClose} className="pg-icon-btn" aria-label="Cerrar">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Nuevo rol</legend>
          <div className="mt-2 grid gap-2">
            {OPTIONS.map((option, index) => {
              const Icon = option.icon;
              const current = option.value === user.role;
              return (
                <label
                  key={option.value}
                  className={`flex min-h-[2.75rem] items-center gap-3 rounded-lg border px-3 ${current ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${role === option.value ? 'border-[var(--pg-accent)] bg-[var(--pg-select)]' : 'pg-line'}`}
                >
                  <input
                    ref={index === firstEnabled ? firstRef : undefined}
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    disabled={current || saving}
                    onChange={() => { setRole(option.value); setError(null); }}
                    className="pg-check"
                  />
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="font-medium">{option.label}</span>
                  {current && <span className="pg-fg2 ml-auto text-xs">Rol actual</span>}
                </label>
              );
            })}
          </div>
        </fieldset>

        {chosen && (
          <p className="mt-3 text-sm">
            {chosen.effect} <span className="pg-fg2">Se cerrarán sus sesiones abiertas.</span>
          </p>
        )}

        {giving && (
          <div className="mt-4 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <label className="block text-sm font-medium">
              Escribe su correo para confirmar
              <input
                type="email"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <label className="block text-sm font-medium">
              Tu contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
          </div>
        )}

        {error && <p role="alert" className="pg-alert mt-3 text-sm font-medium">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="pg-btn">Cancelar</button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-h-[2.5rem] items-center rounded-lg bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {saving ? 'Cambiando…' : chosen ? `Cambiar a ${chosen.label}` : 'Cambiar rol'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};
