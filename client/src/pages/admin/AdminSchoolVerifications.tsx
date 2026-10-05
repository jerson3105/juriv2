import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, MapPin, Pencil, Plus, School, X } from 'lucide-react';
import { CreateSchoolDialog } from '../../components/admin/CreateSchoolDialog';
import { EditSchoolDialog } from '../../components/admin/EditSchoolDialog';
import { schoolApi, type PendingVerification } from '../../lib/schoolApi';
import { adminOverviewKey } from '../../lib/adminApi';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { primaryButton } from '../../components/admin/adminStyles';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { errorMessage } from '../../components/auth/authHelpers';

type Tab = 'requests' | 'schools';

const MEMBER_STATUS: Record<string, { label: string; chip: string }> = {
  VERIFIED: { label: 'Verificado', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100' },
  PENDING_ADMIN: { label: 'Espera al equipo de Juried', chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100' },
  PENDING_OWNER: { label: 'Espera al responsable', chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100' },
  REJECTED: { label: 'Rechazado', chip: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
};
const fmt = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

/** Escuelas: verificaciones que pide su responsable (con el contexto para decidir) y las escuelas registradas. */
export default function AdminSchoolVerifications() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('requests');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [approving, setApproving] = useState<PendingVerification | null>(null);
  const [rejecting, setRejecting] = useState<PendingVerification | null>(null);
  const requests = useQuery({ queryKey: ['admin-school-verifications'], queryFn: schoolApi.getAdminPendingVerifications });
  const schools = useQuery({ queryKey: ['admin-schools'], queryFn: schoolApi.getAllSchoolsWithMembers, enabled: tab === 'schools' });

  const review = useMutation({
    mutationFn: ({ request, approved, note }: { request: PendingVerification; approved: boolean; note?: string }) =>
      schoolApi.reviewVerification(request.id, approved, note),
    onSuccess: (_, { approved }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-school-verifications'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-schools'] });
      void queryClient.invalidateQueries({ queryKey: adminOverviewKey });
      setApproving(null);
      setRejecting(null);
      toast.success(approved ? 'Escuela verificada' : 'Solicitud rechazada');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo revisar la solicitud')),
  });

  const pending = requests.data ?? [];
  // El colegio que se edita, siempre con los datos de la lista (se refresca al guardar cada parte).
  const editingSchool = editing ? schools.data?.find((s) => s.id === editing) ?? null : null;

  return (
    <div data-pg="" className="text-[var(--pg-fg)]">
      <AdminPageHeader
        title="Escuelas"
        subtitle="Créalas aquí ya verificadas, o aprueba la verificación que pide quien registró la suya."
        actions={<button type="button" className={primaryButton} onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden="true" />Crear colegio</button>}
      />
      {creating && <CreateSchoolDialog onClose={() => { setCreating(false); setTab('schools'); }} />}
      {editingSchool && <EditSchoolDialog school={editingSchool} onClose={() => setEditing(null)} />}
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="pg-seg" role="tablist" aria-label="Escuelas">
          <button type="button" role="tab" aria-selected={tab === 'requests'} aria-pressed={tab === 'requests'} className="pg-seg-item" onClick={() => setTab('requests')}>
            Piden verificación{requests.data && <span className="pg-fg2"> {pending.length}</span>}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'schools'} aria-pressed={tab === 'schools'} className="pg-seg-item" onClick={() => setTab('schools')}>
            Escuelas registradas{schools.data && <span className="pg-fg2"> {schools.data.length}</span>}
          </button>
        </div>

        {tab === 'requests' ? (
          requests.isError ? (
            <ErrorBox onRetry={() => void requests.refetch()} />
          ) : requests.isLoading ? (
            <div className="pg-surface h-40 animate-pulse" aria-hidden="true" />
          ) : pending.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[var(--pg-control)] p-8 text-center">
              <p className="text-3xl" aria-hidden="true">🏫 ✅</p>
              <p className="mt-2 font-semibold">Ninguna escuela espera verificación: todo al día.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.map((request) => <RequestCard key={request.id} request={request} onApprove={() => setApproving(request)} onReject={() => setRejecting(request)} />)}
            </ul>
          )
        ) : schools.isError ? (
          <ErrorBox onRetry={() => void schools.refetch()} />
        ) : schools.isLoading ? (
          <div className="pg-surface h-40 animate-pulse" aria-hidden="true" />
        ) : (schools.data ?? []).length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[var(--pg-control)] p-8 text-center">
            <p className="text-3xl" aria-hidden="true">🏫</p>
            <p className="mt-2 font-semibold">Aún no hay escuelas registradas.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {(schools.data ?? []).map((school) => (
              <li key={school.id} className="pg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <School className="pg-fg2 h-4 w-4" aria-hidden="true" />
                  <h2 className="font-semibold">{school.name}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${school.isVerified ? MEMBER_STATUS.VERIFIED.chip : MEMBER_STATUS.PENDING_ADMIN.chip}`}>
                    {school.isVerified ? 'Verificada' : 'Sin verificar'}
                  </span>
                  <span className="flex-1" />
                  <button type="button" className="pg-btn" onClick={() => setEditing(school.id)} aria-label={`Editar ${school.name}`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />Editar
                  </button>
                </div>
                <p className="pg-fg2 mt-0.5 text-xs">
                  {[school.modularCode ? `Código modular ${school.modularCode}` : null, [school.city, school.province, school.country].filter(Boolean).join(', '), `registrada el ${fmt(school.createdAt)}`].filter(Boolean).join(' · ')}
                </p>
                <p className="pg-fg2 mt-0.5 text-xs">
                  {school.domains.length > 0
                    ? `Correo institucional: ${school.domains.map((d) => `@${d.domain}`).join(', ')}`
                    : 'Sin dominio de correo: agrégalo en «Editar» para que su administración cree las cuentas de sus docentes'}
                </p>
                {school.members.length === 0 ? (
                  <p className="pg-fg2 mt-3 text-sm">Sin miembros activos.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-[var(--pg-line)]">
                    {school.members.map((member) => (
                      <li key={member.id} className="flex flex-wrap items-center gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{member.firstName} {member.lastName}</p>
                          <p className="pg-fg2 truncate text-xs">{member.email}</p>
                        </div>
                        {member.role === 'OWNER' && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-900 dark:text-violet-100">Responsable</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${MEMBER_STATUS[member.status]?.chip ?? ''}`}>{MEMBER_STATUS[member.status]?.label ?? member.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <ConfirmModal
        isOpen={!!approving}
        onClose={() => !review.isPending && setApproving(null)}
        onConfirm={() => approving && review.mutate({ request: approving, approved: true })}
        isLoading={review.isPending}
        variant="info"
        title={`¿Verificar «${approving?.schoolName ?? ''}»?`}
        message={`${approving?.userFirstName ?? ''} ${approving?.userLastName ?? ''} quedará como responsable verificado: verá a los docentes de la escuela con sus clases y los reportes de esas clases, y su cuenta de docente quedará verificada.`}
        confirmText="Verificar escuela"
      />
      {rejecting && (
        <RejectDialog
          request={rejecting}
          saving={review.isPending}
          onClose={() => setRejecting(null)}
          onConfirm={(note) => review.mutate({ request: rejecting, approved: false, note })}
        />
      )}
    </div>
  );
}

const ErrorBox = ({ onRetry }: { onRetry: () => void }) => (
  <div role="alert" className="pg-surface p-6 text-center">
    <p className="font-semibold">No se pudo cargar la información.</p>
    <button type="button" className="pg-btn mt-3" onClick={onRetry}>Reintentar</button>
  </div>
);

/** La solicitud con lo que hace falta para decidir: quién la pide dentro de la escuela y qué usa ya en Juried. */
const RequestCard = ({ request, onApprove, onReject }: { request: PendingVerification; onApprove: () => void; onReject: () => void }) => {
  const isOwner = request.requesterRole === 'OWNER';
  return (
    <li className="pg-surface space-y-3 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <School className="pg-fg2 h-4 w-4" aria-hidden="true" />
          <h2 className="font-semibold">{request.schoolName}</h2>
          {request.schoolVerified && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${MEMBER_STATUS.VERIFIED.chip}`}>Ya verificada</span>}
        </div>
        {(request.schoolAddress || request.schoolCity) && (
          <p className="pg-fg2 mt-0.5 flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3" aria-hidden="true" /> {[request.schoolAddress, request.schoolCity, request.schoolCountry].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
      <div className="rounded-lg bg-[var(--pg-hover)] p-3 text-sm">
        <p className="font-medium">{request.userFirstName} {request.userLastName} · {request.position}</p>
        <p className="pg-fg2">{request.userEmail}</p>
        <p className="mt-1">
          {isOwner ? 'Registró la escuela (responsable)' : 'No es el responsable de la escuela'}
          {request.requesterStatus && ` · ${MEMBER_STATUS[request.requesterStatus]?.label ?? request.requesterStatus}`}
          {' · '}{request.requesterClasses === 1 ? '1 clase activa' : `${request.requesterClasses} clases activas`}
          {' · '}Docente {request.userTeacherStatus === 'VERIFIED' ? 'verificado' : 'sin verificar'}
        </p>
        {request.details && <p className="mt-2">«{request.details}»</p>}
      </div>
      <p className="pg-fg2 flex items-center gap-1 text-xs"><Clock className="h-3 w-3" aria-hidden="true" /> Enviada el {fmt(request.createdAt)}</p>
      {!isOwner && <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Esta solicitud no viene del responsable: recházala.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButton} onClick={onApprove} disabled={!isOwner || request.schoolVerified}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Verificar escuela
        </button>
        <button type="button" className="pg-btn" onClick={onReject}>Rechazar</button>
      </div>
    </li>
  );
};

const RejectDialog = ({ request, saving, onClose, onConfirm }: { request: PendingVerification; saving: boolean; onClose: () => void; onConfirm: (note: string) => void }) => {
  const [note, setNote] = useState('');
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div data-pg="" className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby={titleId} className="pg-surface w-full max-w-md space-y-3 p-5 shadow-2xl" onSubmit={(e) => { e.preventDefault(); onConfirm(note.trim()); }}>
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">Rechazar la verificación de «{request.schoolName}»</h2>
          <button type="button" onClick={onClose} className="pg-icon-btn" aria-label="Cerrar"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <label className="block text-sm font-medium">
          Motivo <span className="pg-fg2 font-normal">(opcional; lo verá quien la pidió)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} autoFocus className="mt-1 w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] px-3 py-2" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="pg-btn" onClick={onClose}>Volver</button>
          <button type="submit" className="inline-flex min-h-[2.5rem] items-center rounded-lg bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-55" disabled={saving}>{saving ? 'Rechazando…' : 'Rechazar'}</button>
        </div>
      </form>
    </div>
  );
};
