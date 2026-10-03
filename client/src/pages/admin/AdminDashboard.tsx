import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Bug, CheckCircle2, Plus, School, Shirt, ShieldCheck } from 'lucide-react';
import { adminApi, adminOverviewKey, type AdminOverview } from '../../lib/adminApi';
import type { AvatarGender, AvatarSlot } from '../../lib/avatarApi';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { primaryButton } from '../../components/admin/adminStyles';
import { BODY_NAME, SLOT_NAMES, completaPath } from '../../components/admin/avatarItems/avatarItemsHelpers';

// Recordatorio de la contraseña del admin (no hay fecha de cambio en la BD: lo descarta el dueño).
const PASSWORD_ACK = 'juried-admin-password-ack';
const readAck = () => {
  try {
    return localStorage.getItem(PASSWORD_ACK) === '1';
  } catch {
    return false;
  }
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Pending {
  id: string;
  label: string;
  count: number;
  to: string;
  icon: typeof Bug;
  detail?: string;
}

/** Inicio del panel: lo que espera una acción, el estado del catálogo y una línea de pulso con cifras reales. */
export default function AdminDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: adminOverviewKey, queryFn: adminApi.getOverview, staleTime: 60_000 });
  const [passwordAck, setPasswordAck] = useState(readAck);

  const dismissPassword = () => {
    try {
      localStorage.setItem(PASSWORD_ACK, '1');
    } catch {
      // Sin almacenamiento: se oculta hasta recargar.
    }
    setPasswordAck(true);
  };

  return (
    <div data-pg="" className="text-[var(--pg-fg)]">
      <AdminPageHeader title="Panel de administración" subtitle="Lo que espera una acción tuya y cómo va Juried" />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {isError ? (
          <div role="alert" className="pg-surface p-6 text-center">
            <p className="font-semibold">No se pudo cargar el resumen.</p>
            <button type="button" className="pg-btn mt-3" onClick={() => void refetch()}>Reintentar</button>
          </div>
        ) : isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-2" aria-hidden="true">
            {[0, 1, 2, 3].map((key) => <div key={key} className="pg-surface h-32 animate-pulse" />)}
          </div>
        ) : (
          <>
            {!passwordAck && (
              <section role="note" className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Seguridad: cambia la contraseña de esta cuenta si aún no lo hiciste.</p>
                  <p className="text-sm">La contraseña con la que se creó quedó publicada en el repositorio. Al cambiarla se cierran todas las sesiones abiertas.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to="/admin/cuenta" className="pg-btn">Cambiar contraseña</Link>
                  <button type="button" className="pg-btn pg-btn-ghost" onClick={dismissPassword}>Ya la cambié</button>
                </div>
              </section>
            )}
            <PendingSection data={data} />
            <CatalogSection data={data} />
            <PulseSection data={data} />
          </>
        )}
      </main>
    </div>
  );
}

const PendingSection = ({ data }: { data: AdminOverview }) => {
  const items: Pending[] = [
    { id: 'teachers', label: 'Docentes piden verificación', count: data.teachers.pendingRequests, to: '/admin/teacher-verifications', icon: ShieldCheck },
    { id: 'schools', label: 'Escuelas por verificar', count: data.schools.pendingVerifications, to: '/admin/school-verifications', icon: School },
    {
      id: 'reports', label: 'Reportes de error por atender', count: data.bugReports.pending, to: '/admin/bug-reports', icon: Bug,
      detail: data.bugReports.criticalPending ? plural(data.bugReports.criticalPending, 'crítico', 'críticos') : undefined,
    },
    { id: 'drafts', label: 'Prendas en borrador', count: data.avatarItems.drafts, to: '/admin/avatar-items', icon: Shirt },
  ];
  const waiting = items.filter((item) => item.count > 0);
  return (
    <section aria-labelledby="pending-title" className="pg-surface p-4">
      <h2 id="pending-title" className="text-base font-bold">Pendientes</h2>
      {waiting.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          Todo al día: nadie espera una respuesta tuya.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className={`flex min-h-[5.5rem] items-start gap-3 rounded-xl border p-3 hover:bg-[var(--pg-hover)] ${item.count > 0 ? 'border-[var(--pg-accent)]' : 'border-[var(--pg-line)]'}`}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-2xl font-bold leading-tight">{item.count}</span>
                    <span className="block text-sm">{item.label}</span>
                    {item.detail && <span className="block text-xs font-semibold text-red-700 dark:text-red-300">{item.detail}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const CatalogSection = ({ data }: { data: AdminOverview }) => {
  const { avatarItems } = data;
  return (
    <section aria-labelledby="catalog-title" className="pg-surface space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="catalog-title" className="text-base font-bold">Catálogo de avatar</h2>
        <Link to={completaPath({})} className={primaryButton}><Plus className="h-4 w-4" aria-hidden="true" /> Nueva prenda</Link>
      </div>
      <p className="text-sm">
        {plural(avatarItems.published, 'prenda a la venta', 'prendas a la venta')}
        {avatarItems.drafts > 0 && ` · ${plural(avatarItems.drafts, 'borrador', 'borradores')}`}
        {avatarItems.retired > 0 && ` · ${plural(avatarItems.retired, 'retirada', 'retiradas')}`}
      </p>
      {avatarItems.holes.length > 0 ? (
        <div>
          <p className="text-sm font-semibold">Huecos (ranuras sin prendas para un cuerpo):</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {avatarItems.holes.map((hole) => (
              <li key={`${hole.slot}:${hole.gender}`}>
                <Link to={completaPath({ slot: hole.slot as AvatarSlot, gender: hole.gender as AvatarGender })} className="pg-chip">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {SLOT_NAMES[hole.slot as AvatarSlot] ?? hole.slot} · {BODY_NAME[hole.gender]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="pg-fg2 text-sm">Cada ranura tiene prendas para los dos cuerpos.</p>
      )}
      <Link to="/admin/avatar-items" className="inline-block text-sm font-semibold text-blue-700 underline dark:text-blue-300">Ver todas las prendas</Link>
    </section>
  );
};

const PulseSection = ({ data }: { data: AdminOverview }) => {
  const { users, teachers, classrooms, schools, expeditionMaps } = data;
  const rows: { label: string; value: string; to: string }[] = [
    {
      label: 'Docentes',
      value: `${users.teachers} · ${teachers.verified} verificados, ${teachers.unverified} sin verificar${teachers.unverified ? ` (${teachers.unverifiedWithClasses} con clases)` : ''}`,
      to: '/admin/teacher-verifications',
    },
    { label: 'Alumnos con cuenta', value: String(users.students), to: '/admin/users' },
    { label: 'Familias', value: String(users.parents), to: '/admin/users' },
    { label: 'Clases', value: `${classrooms.active} activas${classrooms.archived ? ` · ${classrooms.archived} archivadas` : ''}`, to: '/admin/classrooms' },
    { label: 'Escuelas', value: `${schools.verified} verificadas${schools.unverified ? ` · ${schools.unverified} sin verificar` : ''}`, to: '/admin/school-verifications' },
    { label: 'Mapas de expedición', value: `${expeditionMaps.active} visibles${expeditionMaps.hidden ? ` · ${expeditionMaps.hidden} ocultos` : ''}`, to: '/admin/expedition-maps' },
  ];
  return (
    <section aria-labelledby="pulse-title" className="pg-surface p-4">
      <h2 id="pulse-title" className="text-base font-bold">Pulso</h2>
      <p className="pg-fg2 text-xs">{plural(users.total, 'cuenta', 'cuentas')} en total{users.inactive ? ` · ${plural(users.inactive, 'desactivada', 'desactivadas')}` : ''} · {plural(users.admins, 'administrador', 'administradores')}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col">
            <dt className="pg-fg2 text-xs font-semibold uppercase tracking-wide">{row.label}</dt>
            <dd><Link to={row.to} className="hover:underline">{row.value}</Link></dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
