import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Globe, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { verificationApi, type DomainPreview, type TeacherToVerify, type VerifiedDomain } from '../../lib/verificationApi';
import { adminApi, adminOverviewKey, type AdminOverview } from '../../lib/adminApi';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { primaryButton } from '../../components/admin/adminStyles';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { errorMessage } from '../../components/auth/authHelpers';

type Tab = 'PENDING' | 'UNVERIFIED' | 'DOMAINS';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const field = 'min-h-[2.5rem] w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] px-3';

/** Docentes que piden verificación, los que siguen sin verificar y los dominios de colegios. */
export default function AdminTeacherVerifications() {
  const queryClient = useQueryClient();
  // Abre en la pestaña con trabajo: si nadie pidió verificación, la de los sin verificar.
  const [tab, setTab] = useState<Tab>(() => {
    const cached = queryClient.getQueryData<AdminOverview>(adminOverviewKey);
    return cached && cached.teachers.pendingRequests === 0 ? 'UNVERIFIED' : 'PENDING';
  });
  const [search, setSearch] = useState('');
  const [approving, setApproving] = useState<TeacherToVerify | null>(null);
  const [rejecting, setRejecting] = useState<TeacherToVerify | null>(null);
  const [removing, setRemoving] = useState<VerifiedDomain | null>(null);

  const overview = useQuery({ queryKey: adminOverviewKey, queryFn: adminApi.getOverview, staleTime: 60_000 });
  const teachers = useQuery({
    queryKey: ['admin-teacher-verifications', tab],
    queryFn: () => verificationApi.listTeachers(tab === 'UNVERIFIED' ? 'UNVERIFIED' : 'PENDING'),
    enabled: tab !== 'DOMAINS',
  });
  const domains = useQuery({ queryKey: ['admin-verified-domains'], queryFn: verificationApi.listDomains });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-teacher-verifications'] });
    void queryClient.invalidateQueries({ queryKey: adminOverviewKey });
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const review = useMutation({
    mutationFn: ({ teacher, approved, reason }: { teacher: TeacherToVerify; approved: boolean; reason?: string }) =>
      verificationApi.reviewTeacher(teacher.id, approved, reason),
    onSuccess: (_, { teacher, approved }) => {
      refresh();
      setApproving(null);
      setRejecting(null);
      toast.success(approved ? `${teacher.firstName} quedó verificado` : 'Solicitud rechazada: verá el motivo en su aviso');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo revisar')),
  });
  const removeDomain = useMutation({
    mutationFn: (id: string) => verificationApi.removeDomain(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-verified-domains'] });
      setRemoving(null);
      toast.success('Dominio quitado. Quienes ya se verificaron siguen verificados.');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo quitar el dominio')),
  });

  const counts = {
    PENDING: overview.data?.teachers.pendingRequests,
    UNVERIFIED: overview.data?.teachers.unverified,
    DOMAINS: domains.data?.length,
  };
  const term = search.trim().toLowerCase();
  const list = (teachers.data ?? []).filter((teacher) => !term
    || `${teacher.firstName} ${teacher.lastName}`.toLowerCase().includes(term)
    || teacher.email.toLowerCase().includes(term));

  return (
    <div data-pg="" className="text-[var(--pg-fg)]">
      <AdminPageHeader title="Docentes por verificar" subtitle="Sin verificar usan su clase con la lista, pero no reciben alumnos con cuenta ni familias." />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="max-w-full overflow-x-auto">
        <div className="pg-seg" role="tablist" aria-label="Verificación de docentes">
          {([['PENDING', 'Piden verificación'], ['UNVERIFIED', 'Sin verificar'], ['DOMAINS', 'Dominios de colegios']] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} aria-pressed={tab === value} className="pg-seg-item" onClick={() => setTab(value)}>
              {label}{counts[value] !== undefined && <span className="pg-fg2"> {counts[value]}</span>}
            </button>
          ))}
        </div>
        </div>

        {tab === 'DOMAINS' ? (
          <DomainsPanel domains={domains.data ?? []} loading={domains.isLoading} error={domains.isError} onRetry={() => void domains.refetch()} onRemove={setRemoving} onAdded={refresh} />
        ) : (
          <section className="space-y-3" aria-label={tab === 'PENDING' ? 'Piden verificación' : 'Sin verificar'}>
            {(teachers.data?.length ?? 0) > 5 && (
              <label className="relative block max-w-md">
                <span className="sr-only">Buscar docente</span>
                <Search className="pg-fg2 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o correo…" className={`${field} pl-9`} />
              </label>
            )}
            {teachers.isError ? (
              <div role="alert" className="pg-surface p-6 text-center">
                <p className="font-semibold">No se pudo cargar la lista.</p>
                <button type="button" className="pg-btn mt-3" onClick={() => void teachers.refetch()}>Reintentar</button>
              </div>
            ) : teachers.isLoading ? (
              <div className="pg-surface h-40 animate-pulse" aria-hidden="true" />
            ) : list.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-[var(--pg-control)] p-8 text-center">
                <p className="text-3xl" aria-hidden="true">✅ 🎉</p>
                <p className="mt-2 font-semibold">{term ? 'Nadie con esa búsqueda.' : tab === 'PENDING' ? 'Nadie pidió verificación: todo al día.' : 'No hay docentes sin verificar.'}</p>
              </div>
            ) : (
              <ul className="pg-surface divide-y divide-[var(--pg-line)]">
                {list.map((teacher) => (
                  <li key={teacher.id} className="flex flex-wrap items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{teacher.firstName} {teacher.lastName}</p>
                      <p className="pg-fg2 text-sm">{teacher.email} · {teacher.provider === 'GOOGLE' ? 'Google' : 'Correo y contraseña'}</p>
                      {teacher.note && <p className="mt-2 rounded-lg bg-[var(--pg-hover)] p-2 text-sm">«{teacher.note}»</p>}
                      <p className="pg-fg2 mt-1 text-xs">
                        {teacher.requestedAt ? `Pidió el ${fmt(teacher.requestedAt)} · ` : ''}Cuenta del {fmt(teacher.createdAt)} · Último ingreso {fmt(teacher.lastLoginAt)} · {teacher.classes} {teacher.classes === 1 ? 'clase' : 'clases'}, {teacher.students} {teacher.students === 1 ? 'alumno' : 'alumnos'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {tab === 'PENDING' && <button type="button" className="pg-btn" onClick={() => setRejecting(teacher)}>Rechazar</button>}
                      <button type="button" className={primaryButton} onClick={() => setApproving(teacher)}><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Verificar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      <ConfirmModal
        isOpen={!!approving}
        onClose={() => !review.isPending && setApproving(null)}
        onConfirm={() => approving && review.mutate({ teacher: approving, approved: true })}
        isLoading={review.isPending}
        variant="info"
        title={`¿Verificar a ${approving?.firstName ?? ''} ${approving?.lastName ?? ''}?`}
        message="Podrá recibir alumnos con cuenta y familias en sus clases."
        confirmText="Verificar"
      />
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => !removeDomain.isPending && setRemoving(null)}
        onConfirm={() => removing && removeDomain.mutate(removing.id)}
        isLoading={removeDomain.isPending}
        variant="warning"
        title={`¿Quitar @${removing?.domain ?? ''}?`}
        message="Las cuentas nuevas de ese dominio ya no se verificarán solas. Quienes ya se verificaron siguen verificados."
        confirmText="Quitar"
      />
      {rejecting && (
        <RejectDialog
          teacher={rejecting}
          saving={review.isPending}
          onClose={() => setRejecting(null)}
          onConfirm={(reason) => review.mutate({ teacher: rejecting, approved: false, reason })}
        />
      )}
    </div>
  );
}

/** Rechazar con motivo: «Volver» de verdad no rechaza (antes cancelar el prompt rechazaba igual). */
const RejectDialog = ({ teacher, saving, onClose, onConfirm }: { teacher: TeacherToVerify; saving: boolean; onClose: () => void; onConfirm: (reason: string) => void }) => {
  const [reason, setReason] = useState('');
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div data-pg="" className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby={titleId} className="pg-surface w-full max-w-md space-y-3 p-5 shadow-2xl" onSubmit={(e) => { e.preventDefault(); onConfirm(reason.trim()); }}>
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">Rechazar la solicitud de {teacher.firstName}</h2>
          <button type="button" onClick={onClose} className="pg-icon-btn" aria-label="Cerrar"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <label className="block text-sm font-medium">
          Motivo <span className="pg-fg2 font-normal">(lo verá en su aviso; opcional)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={480} rows={3} autoFocus className={`${field} mt-1 py-2`} placeholder="Por ejemplo: no encontramos tu colegio, escríbenos con tu correo institucional." />
        </label>
        <p className="pg-fg2 text-xs">Seguirá usando su clase con la lista y podrá pedir revisión otra vez.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="pg-btn" onClick={onClose}>Volver</button>
          <button type="submit" className="inline-flex min-h-[2.5rem] items-center rounded-lg bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-55" disabled={saving}>{saving ? 'Rechazando…' : 'Rechazar'}</button>
        </div>
      </form>
    </div>
  );
};

/** Dominios de colegios: agregar con vista previa (solo verifica cuentas de Google) y quitar con aviso. */
const DomainsPanel = ({ domains, loading, error, onRetry, onRemove, onAdded }: {
  domains: VerifiedDomain[]; loading: boolean; error: boolean; onRetry: () => void; onRemove: (domain: VerifiedDomain) => void; onAdded: () => void;
}) => {
  const queryClient = useQueryClient();
  const ids = useId();
  const [domain, setDomain] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<DomainPreview | null>(null);
  const check = useMutation({
    mutationFn: () => verificationApi.previewDomain(domain.trim()),
    onSuccess: (data) => (data.alreadyListed ? toast.error('Ese dominio ya está en la lista') : setPreview(data)),
    onError: (err) => toast.error(errorMessage(err, 'No se pudo revisar el dominio')),
  });
  const add = useMutation({
    mutationFn: () => verificationApi.addDomain(domain.trim(), note.trim() || undefined),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-verified-domains'] });
      onAdded();
      setPreview(null);
      setDomain('');
      setNote('');
      toast.success(data.verified > 0 ? `Dominio agregado: ${data.verified} ${data.verified === 1 ? 'docente quedó verificado' : 'docentes quedaron verificados'}.` : 'Dominio agregado');
    },
    onError: (err) => toast.error(errorMessage(err, 'No se pudo agregar el dominio')),
  });

  return (
    <section className="space-y-4" aria-label="Dominios de colegios">
      <form className="pg-surface space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); if (domain.trim()) check.mutate(); }}>
        <h2 className="text-sm font-bold">Agregar el dominio de un colegio</h2>
        <p className="pg-fg2 text-sm">Los docentes que entran <strong>con Google</strong> con un correo de ese dominio quedan verificados solos. Con correo y contraseña no basta: nadie comprobó que el correo sea suyo.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium" htmlFor={`${ids}-domain`}>Dominio
            <input id={`${ids}-domain`} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="colegio.edu.pe" className={`${field} mt-1`} autoComplete="off" />
          </label>
          <label className="text-sm font-medium" htmlFor={`${ids}-note`}>Nota <span className="pg-fg2 font-normal">(opcional)</span>
            <input id={`${ids}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder="Nombre del colegio" className={`${field} mt-1`} />
          </label>
          <button type="submit" className={primaryButton} disabled={!domain.trim() || check.isPending}>{check.isPending ? 'Revisando…' : 'Revisar'}</button>
        </div>
      </form>

      {error ? (
        <div role="alert" className="pg-surface p-6 text-center">
          <p className="font-semibold">No se pudieron cargar los dominios.</p>
          <button type="button" className="pg-btn mt-3" onClick={onRetry}>Reintentar</button>
        </div>
      ) : loading ? (
        <div className="pg-surface h-24 animate-pulse" aria-hidden="true" />
      ) : domains.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[var(--pg-control)] p-6 text-center">
          <p className="text-2xl" aria-hidden="true">🏫 🌐</p>
          <p className="mt-1 font-semibold">Aún no hay dominios de colegios.</p>
        </div>
      ) : (
        <ul className="pg-surface divide-y divide-[var(--pg-line)]">
          {domains.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3">
              <Globe className="pg-fg2 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">@{item.domain}</p>
                <p className="pg-fg2 text-xs">{[item.schoolName, item.note].filter(Boolean).join(' · ') || 'Sin nota'} · desde el {fmt(item.createdAt)}</p>
              </div>
              <button type="button" className="pg-icon-btn" onClick={() => onRemove(item)} aria-label={`Quitar @${item.domain}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={!!preview}
        onClose={() => !add.isPending && setPreview(null)}
        onConfirm={() => add.mutate()}
        isLoading={add.isPending}
        variant="info"
        title={`¿Agregar @${preview?.domain ?? ''}?`}
        message={preview
          ? `${preview.google === 0 ? 'Nadie se verificará ahora' : `Se verificarán ahora ${preview.google} ${preview.google === 1 ? 'docente que entra' : 'docentes que entran'} con Google`}.${preview.local ? ` ${preview.local} con correo y contraseña ${preview.local === 1 ? 'seguirá' : 'seguirán'} sin verificar hasta entrar con Google.` : ''} Las cuentas nuevas de Google con ese correo nacerán verificadas.`
          : ''}
        confirmText="Agregar"
      />
    </section>
  );
};
