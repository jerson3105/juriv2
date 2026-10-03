import { useEffect, useId, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ban, ChevronDown, ChevronLeft, ChevronRight, Plus, RotateCcw, Search, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  adminApi, adminOverviewKey, type AdminUser, type AdminUserFilters, type UserRole,
} from '../../lib/adminApi';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { primaryButton } from '../../components/admin/adminStyles';
import { RoleChangeDialog } from '../../components/admin/RoleChangeDialog';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { passwordChecks } from '../../components/auth/authHelpers';

const ROLE_NAME: Record<UserRole, string> = { ADMIN: 'Administración', TEACHER: 'Docente', STUDENT: 'Alumno', PARENT: 'Familia' };
const ROLE_FILTERS: { value: UserRole | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  { value: 'TEACHER', label: 'Docentes' },
  { value: 'STUDENT', label: 'Alumnos' },
  { value: 'PARENT', label: 'Familias' },
  { value: 'ADMIN', label: 'Administración' },
];
const ROLE_CHIP: Record<UserRole, string> = {
  ADMIN: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100',
  TEACHER: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100',
  STUDENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
  PARENT: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
};
const PROVIDER_NAME: Record<AdminUser['provider'], string> = { LOCAL: 'Correo y contraseña', GOOGLE: 'Google', PIN: 'PIN de su clase' };
const VERIFICATION_NAME = { VERIFIED: 'Verificado', PENDING: 'Pidió verificación', UNVERIFIED: 'Sin verificar' } as const;

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const lastSeen = (value: string | null) => {
  if (!value) return 'Nunca';
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days > -1) return 'Hoy';
  if (days > -30) return relative.format(days, 'day');
  if (days > -365) return relative.format(Math.round(days / 30), 'month');
  return relative.format(Math.round(days / 365), 'year');
};

/** Usuarios: búsqueda, filtros y páginas en el servidor; rol con diálogo; desactivar de verdad. */
export default function AdminUsers() {
  const me = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState<UserRole | undefined>();
  const [status, setStatus] = useState<'active' | 'inactive' | undefined>();
  const [page, setPage] = useState(1);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  // La búsqueda va al servidor un momento después de dejar de escribir.
  useEffect(() => {
    const timer = window.setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters: AdminUserFilters = { q: q || undefined, role, status, page };
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () => adminApi.getUsers(filters),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    void queryClient.invalidateQueries({ queryKey: adminOverviewKey });
  };

  const toggleStatus = useMutation({
    mutationFn: (target: AdminUser) => adminApi.updateUserStatus(target.id, !target.isActive),
    onSuccess: (_data, target) => {
      refresh();
      setStatusTarget(null);
      toast.success(target.isActive ? 'Cuenta desactivada. Sus sesiones se cerraron.' : 'Cuenta reactivada');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar el estado de la cuenta')),
  });

  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
  const users = data?.users ?? [];
  const pagination = data?.pagination;

  return (
    <div data-pg="" className="text-[var(--pg-fg)]">
      <AdminPageHeader
        title="Usuarios"
        subtitle={data ? `${total} cuentas · ${pagination?.total ?? 0} con estos filtros` : 'Cargando…'}
        actions={<button type="button" className={primaryButton} onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Crear docente</button>}
      />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {ROLE_FILTERS.map((option) => (
            <button
              key={option.label}
              type="button"
              className="pg-chip"
              aria-pressed={role === option.value}
              onClick={() => { setRole(option.value); setPage(1); }}
            >
              {option.label} <span className="pg-fg2">{option.value ? counts[option.value] ?? 0 : total}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Buscar por nombre o correo</span>
            <Search className="pg-fg2 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              className="min-h-[2.5rem] w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] pl-9 pr-3"
            />
          </label>
          <div className="pg-seg" role="group" aria-label="Estado de la cuenta">
            {([[undefined, 'Todas'], ['active', 'Activas'], ['inactive', 'Desactivadas']] as const).map(([value, label]) => (
              <button key={label} type="button" className="pg-seg-item" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>
            ))}
          </div>
        </div>

        {isError ? (
          <div role="alert" className="pg-surface p-6 text-center">
            <p className="font-semibold">No se pudieron cargar los usuarios.</p>
            <button type="button" className="pg-btn mt-3" onClick={() => void refetch()}>Reintentar</button>
          </div>
        ) : isLoading ? (
          <div className="pg-surface h-64 animate-pulse" aria-hidden="true" />
        ) : users.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[var(--pg-control)] p-8 text-center">
            <p className="text-3xl" aria-hidden="true">🔍 👤</p>
            <p className="mt-2 font-semibold">Ninguna cuenta con estos filtros.</p>
            <button type="button" className="pg-btn mt-3" onClick={() => { setSearch(''); setRole(undefined); setStatus(undefined); }}>Quitar filtros</button>
          </div>
        ) : (
          <section aria-label="Cuentas" className={`pg-surface overflow-hidden ${isFetching ? 'opacity-70' : ''}`} aria-busy={isFetching}>
            <ul className="divide-y divide-[var(--pg-line)]">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isMe={user.id === me?.id}
                  onRole={() => setRoleTarget(user)}
                  onStatus={() => setStatusTarget(user)}
                />
              ))}
            </ul>
            {pagination && pagination.totalPages > 1 && (
              <nav aria-label="Páginas" className="flex items-center justify-between gap-2 border-t border-[var(--pg-line)] p-3 text-sm">
                <button type="button" className="pg-btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
                </button>
                <span>Página {pagination.page} de {pagination.totalPages}</span>
                <button type="button" className="pg-btn" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>
                  Siguiente <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            )}
          </section>
        )}
      </main>

      {roleTarget && (
        <RoleChangeDialog
          user={roleTarget}
          onClose={() => setRoleTarget(null)}
          onChanged={() => { setRoleTarget(null); refresh(); toast.success('Rol actualizado. Sus sesiones se cerraron.'); }}
        />
      )}
      <ConfirmModal
        isOpen={!!statusTarget}
        onClose={() => !toggleStatus.isPending && setStatusTarget(null)}
        onConfirm={() => statusTarget && toggleStatus.mutate(statusTarget)}
        isLoading={toggleStatus.isPending}
        variant={statusTarget?.isActive ? 'danger' : 'info'}
        title={statusTarget?.isActive
          ? `¿Desactivar la cuenta de ${statusTarget.firstName} ${statusTarget.lastName}?`
          : `¿Reactivar la cuenta de ${statusTarget?.firstName ?? ''} ${statusTarget?.lastName ?? ''}?`}
        message={statusTarget?.isActive
          ? 'No podrá entrar y se cerrarán sus sesiones abiertas. Sus datos no se borran: puedes reactivarla cuando quieras.'
          : 'Podrá volver a entrar con sus datos de siempre.'}
        confirmText={statusTarget?.isActive ? 'Desactivar' : 'Reactivar'}
      />
      {creating && <CreateTeacherDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} />}
    </div>
  );
}

const UserRow = ({ user, isMe, onRole, onStatus }: { user: AdminUser; isMe: boolean; onRole: () => void; onStatus: () => void }) => {
  const name = `${user.firstName} ${user.lastName}`.trim();
  const fixedRole = isMe || user.role === 'PARENT';
  const roleChip = `inline-flex min-h-[2rem] items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${ROLE_CHIP[user.role]}`;
  return (
    <li className={`grid gap-2 p-3 sm:grid-cols-[minmax(0,2fr)_auto_minmax(0,1.3fr)_auto] sm:items-center sm:gap-4 ${user.isActive ? '' : 'bg-red-50/60 dark:bg-red-950/20'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-800 dark:bg-slate-600 dark:text-slate-100" aria-hidden="true">
          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {name}{isMe && <span className="pg-fg2 font-normal"> (tú)</span>}
          </p>
          <p className="pg-fg2 truncate text-sm">{user.email ?? 'Entra con el PIN de su clase'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {fixedRole ? (
          <span className={roleChip} title={isMe ? 'Tu propio rol no se cambia desde aquí' : 'El rol de una familia no se cambia desde aquí'}>{ROLE_NAME[user.role]}</span>
        ) : (
          <button type="button" onClick={onRole} className={`${roleChip} hover:opacity-80`} aria-label={`Cambiar el rol de ${name} (ahora: ${ROLE_NAME[user.role]})`}>
            {ROLE_NAME[user.role]} <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
        {!user.isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-100">Desactivada</span>}
      </div>
      <p className="pg-fg2 text-sm">
        {PROVIDER_NAME[user.provider]}
        {user.role === 'TEACHER' && ` · ${VERIFICATION_NAME[user.teacherStatus ?? 'UNVERIFIED']} · ${user.classes === 1 ? '1 clase' : `${user.classes ?? 0} clases`}`}
        {user.role === 'STUDENT' && ` · ${user.enrolledIn === 1 ? 'en 1 clase' : `en ${user.enrolledIn ?? 0} clases`}`}
        {' · '}Último ingreso: {lastSeen(user.lastLoginAt)}
      </p>
      <div className="flex justify-end">
        {!isMe && (
          <button
            type="button"
            onClick={onStatus}
            className="pg-icon-btn"
            aria-label={`${user.isActive ? 'Desactivar' : 'Reactivar'} la cuenta de ${name}`}
            title={user.isActive ? 'Desactivar cuenta' : 'Reactivar cuenta'}
          >
            {user.isActive ? <Ban className="h-4 w-4" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
    </li>
  );
};

/** Alta de un docente por el admin: queda verificado; contraseña con la política común. */
const CreateTeacherDialog = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const checks = passwordChecks(form.password);
  const valid = form.firstName.trim() && form.lastName.trim() && /\S+@\S+\.\S+/.test(form.email) && checks.every((check) => check.ok);
  const create = useMutation({
    mutationFn: () => adminApi.createTeacher({ ...form, email: form.email.trim() }),
    onSuccess: () => { toast.success('Docente creado y verificado'); onCreated(); },
    onError: (err) => setError(errorMessage(err, 'No se pudo crear el docente')),
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const field = 'mt-1 min-h-[2.5rem] w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] px-3';
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => { setForm({ ...form, [key]: event.target.value }); setError(null); };
  return (
    <div data-pg="" className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pg-surface w-full max-w-md space-y-3 p-5 shadow-2xl"
        onSubmit={(e) => { e.preventDefault(); if (valid && !create.isPending) create.mutate(); }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">Crear docente</h2>
          <button type="button" onClick={onClose} className="pg-icon-btn" aria-label="Cerrar"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <p className="pg-fg2 text-sm">Queda verificado: podrá recibir alumnos con cuenta y familias. Si tiene Gmail o un correo de su colegio con Google, es mejor que entre con Google.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">Nombre<input value={form.firstName} onChange={set('firstName')} maxLength={100} autoFocus className={field} /></label>
          <label className="text-sm font-medium">Apellido<input value={form.lastName} onChange={set('lastName')} maxLength={100} className={field} /></label>
        </div>
        <label className="block text-sm font-medium">Correo<input type="email" value={form.email} onChange={set('email')} maxLength={255} autoComplete="off" className={field} /></label>
        <label className="block text-sm font-medium">Contraseña temporal<input type="text" value={form.password} onChange={set('password')} maxLength={128} autoComplete="new-password" spellCheck={false} className={field} /></label>
        <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-label="Requisitos de la contraseña">
          {checks.map((check) => (
            <li key={check.label} className={check.ok ? 'text-emerald-700 dark:text-emerald-400' : 'pg-fg2'}>{check.ok ? '✓' : '○'} {check.label}</li>
          ))}
        </ul>
        <p className="pg-fg2 text-xs">Pásasela por un canal privado y pídele que la cambie en Configuración → Seguridad.</p>
        {error && <p role="alert" className="pg-alert text-sm font-medium">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="pg-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className={primaryButton} disabled={!valid || create.isPending}>{create.isPending ? 'Creando…' : 'Crear docente'}</button>
        </div>
      </form>
    </div>
  );
};

