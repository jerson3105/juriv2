import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Copy, Link2, RefreshCw, Shield, UserMinus, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { schoolApi, type MySchool, type SchoolClassroom, type SchoolMember, type SchoolTeacher } from '../../lib/schoolApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, errorMessage, gradeLabel, inputClass, labelClass, primaryButton, relativeTime } from '../home/homeHelpers';
import { inviteLink, mySchoolsKey, pendingRequestsKey, schoolDetailKey, schoolTeachersKey } from './schoolHelpers';

const card = 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800';
const secondaryButton = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

// ── Invitación por enlace (solo responsable) ───────────────────────────────
const InviteCard = ({ school, inviteCode, inviteExpiresAt }: { school: MySchool; inviteCode: string | null; inviteExpiresAt: string | null }) => {
  const expires = inviteExpiresAt ? new Date(inviteExpiresAt) : null;
  const expired = !!expires && expires.getTime() < Date.now();
  const queryClient = useQueryClient();
  const [confirmRenew, setConfirmRenew] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: schoolDetailKey(school.id) });

  const regenerate = useMutation({
    mutationFn: () => schoolApi.regenerateInvite(school.id),
    onSuccess: () => { refresh(); setConfirmRenew(false); toast.success(inviteCode ? 'Enlace renovado: el anterior ya no funciona' : 'Enlace de invitación creado'); },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo generar el enlace')),
  });
  const disable = useMutation({
    mutationFn: () => schoolApi.disableInvite(school.id),
    onSuccess: () => { refresh(); toast.success('Enlace desactivado'); },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo desactivar')),
  });

  const copy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteLink(inviteCode));
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <section className={`${card} space-y-3`} aria-labelledby="invite-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200" aria-hidden="true">
          <Link2 size={20} />
        </span>
        <div>
          <h3 id="invite-title" className="font-bold text-gray-900 dark:text-white">Invita a tus profesores</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">Quien abra el enlace entra directamente a la escuela. También pueden buscarla y enviarte una solicitud.</p>
        </div>
      </div>
      {inviteCode ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-900 dark:bg-gray-900/60 dark:text-gray-100" title={inviteLink(inviteCode)}>
              {inviteLink(inviteCode)}
            </code>
            <button type="button" onClick={copy} className={`${primaryButton} min-h-[40px]`}>
              <Copy size={16} aria-hidden="true" />
              Copiar enlace
            </button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">Código: <strong className="font-mono tracking-wider text-gray-900 dark:text-white">{inviteCode}</strong></p>
          {expires && (
            <p className={`text-sm ${expired ? 'font-semibold text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>
              {expired ? 'Este enlace caducó el ' : 'Vence el '}{expires.toLocaleDateString('es', { day: 'numeric', month: 'long' })}. {expired ? 'Renuévalo para invitar a más profesores.' : 'Quien entra con él queda verificado como docente de tu escuela.'}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {confirmRenew ? (
              <>
                <span className="self-center text-sm font-semibold text-gray-800 dark:text-gray-100">El enlace actual dejará de funcionar.</span>
                <button type="button" onClick={() => regenerate.mutate()} disabled={regenerate.isPending} className={secondaryButton}>Sí, renovar</button>
                <button type="button" onClick={() => setConfirmRenew(false)} className={cancelButton}>Cancelar</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setConfirmRenew(true)} className={secondaryButton}>
                  <RefreshCw size={16} aria-hidden="true" />
                  Renovar enlace
                </button>
                <button type="button" onClick={() => disable.mutate()} disabled={disable.isPending} className={`${secondaryButton} text-red-700 dark:text-red-300`}>
                  Desactivar
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <button type="button" onClick={() => regenerate.mutate()} disabled={regenerate.isPending} className={primaryButton}>
          <Link2 size={16} aria-hidden="true" />
          {regenerate.isPending ? 'Creando...' : 'Crear enlace de invitación'}
        </button>
      )}
    </section>
  );
};

// ── Solicitudes pendientes (solo responsable) ───────────────────────────────
export const PendingRequests = ({ schoolId, requests }: { schoolId: string; requests: SchoolMember[] }) => {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<SchoolMember | null>(null);
  const [reason, setReason] = useState('');

  const review = useMutation({
    mutationFn: ({ member, approved, why }: { member: SchoolMember; approved: boolean; why?: string }) => schoolApi.reviewJoinRequest(member.id, approved, why),
    onSuccess: (_, { member, approved }) => {
      queryClient.invalidateQueries({ queryKey: pendingRequestsKey(schoolId) });
      queryClient.invalidateQueries({ queryKey: schoolTeachersKey(schoolId) });
      queryClient.invalidateQueries({ queryKey: mySchoolsKey });
      toast.success(approved ? `${member.firstName} ya es parte de la escuela` : 'Solicitud rechazada');
      setRejecting(null);
      setReason('');
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo procesar la solicitud')),
  });

  if (requests.length === 0) return null;
  return (
    <section className={`${card} border-amber-300 dark:border-amber-500/40`} aria-labelledby="requests-title">
      <h3 id="requests-title" className="mb-3 flex items-center gap-2 font-bold text-gray-900 dark:text-white">
        <UserPlus size={18} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />
        Solicitudes para unirse ({requests.length})
      </h3>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">{r.firstName} {r.lastName}</p>
              <p className="truncate text-sm text-gray-700 dark:text-gray-300">{r.email} · {relativeTime(r.createdAt) ?? ''}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => review.mutate({ member: r, approved: true })} disabled={review.isPending} className={`${primaryButton} min-h-[40px]`}>
                <Check size={16} aria-hidden="true" />
                Aceptar
              </button>
              <button type="button" onClick={() => setRejecting(r)} disabled={review.isPending} className={secondaryButton}>
                <X size={16} aria-hidden="true" />
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {rejecting && (
          <HomeModal
            title="Rechazar solicitud"
            subtitle={`${rejecting.firstName} ${rejecting.lastName}`}
            onClose={() => setRejecting(null)}
            footer={<><button type="button" onClick={() => setRejecting(null)} className={cancelButton}>Cancelar</button><button type="button" onClick={() => review.mutate({ member: rejecting, approved: false, why: reason.trim() || undefined })} disabled={review.isPending} className="inline-flex min-h-[44px] items-center rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">Rechazar</button></>}
          >
            <label className={labelClass}>
              Motivo <span className="font-normal text-gray-700 dark:text-gray-300">(opcional, lo verá el profesor)</span>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ej: No trabaja en esta sede" data-autofocus className={`${inputClass} mt-1.5`} />
            </label>
          </HomeModal>
        )}
      </AnimatePresence>
    </section>
  );
};

// ── Lista de profesores ─────────────────────────────────────────────────────
interface TeachersTabProps {
  school: MySchool;
  manage: boolean;
  currentUserId?: string;
  teachers: SchoolTeacher[];
  classrooms: SchoolClassroom[];
  requests: SchoolMember[];
  inviteCode: string | null;
  inviteExpiresAt?: string | null;
  isLoading: boolean;
}

export const TeachersTab = ({ school, manage, currentUserId, teachers, classrooms, requests, inviteCode, inviteExpiresAt = null, isLoading }: TeachersTabProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SchoolTeacher | null>(null);

  const remove = useMutation({
    mutationFn: (t: SchoolTeacher) => schoolApi.removeTeacher(school.id, t.id),
    onSuccess: (data, t) => {
      queryClient.invalidateQueries({ queryKey: schoolTeachersKey(school.id) });
      queryClient.invalidateQueries({ queryKey: schoolDetailKey(school.id) });
      queryClient.invalidateQueries({ queryKey: mySchoolsKey });
      const n = data.unassignedClassrooms;
      toast.success(`${t.firstName} ya no es parte de la escuela${n === 1 ? '; su clase volvió a ser personal' : n > 1 ? `; sus ${n} clases volvieron a ser personales` : ''}`);
      setRemoving(null);
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo retirar al profesor')),
  });

  const classesOf = (userId: string) => classrooms.filter((c) => c.teacherId === userId);
  const removingClasses = removing ? classesOf(removing.userId) : [];

  return (
    <div className="space-y-4">
      {manage && <PendingRequests schoolId={school.id} requests={requests} />}
      {manage && <InviteCard school={school} inviteCode={inviteCode} inviteExpiresAt={inviteExpiresAt} />}

      <section aria-labelledby="teachers-title" className="space-y-3">
        <h3 id="teachers-title" className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">Profesores ({teachers.length})</h3>
        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />)
        ) : (
          <ul className="space-y-3">
            {teachers.map((t) => {
              const mine = classesOf(t.userId);
              const students = mine.reduce((s, c) => s + c.studentCount, 0);
              const lastIso = mine.map((c) => c.lastActivityAt).filter(Boolean).sort().pop() ?? null;
              const expanded = open === t.id;
              // A un administrador solo lo retira el responsable.
              const canRemove = manage && t.role !== 'OWNER' && t.userId !== currentUserId && (t.role !== 'ADMIN' || school.memberRole === 'OWNER');
              return (
                <li key={t.id} className={card}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-black text-white" aria-hidden="true">
                      {initials(t.firstName, t.lastName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900 dark:text-white">
                        {t.firstName} {t.lastName}
                        {(t.role === 'OWNER' || t.role === 'ADMIN') && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-800 dark:bg-primary-900/50 dark:text-primary-100">
                            <Shield size={12} aria-hidden="true" />
                            {t.role === 'OWNER' ? 'Responsable' : 'Administración'}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-gray-700 dark:text-gray-300">
                        {mine.length} {mine.length === 1 ? 'clase' : 'clases'} · {students} estudiantes · {lastIso ? `activo ${relativeTime(lastIso)}` : 'sin actividad reciente'}
                      </p>
                    </div>
                    {canRemove && (
                      <button type="button" onClick={() => setRemoving(t)} aria-label={`Retirar a ${t.firstName} ${t.lastName}`} title="Retirar de la escuela" className="flex h-10 w-10 items-center justify-center rounded-xl text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30">
                        <UserMinus size={18} aria-hidden="true" />
                      </button>
                    )}
                    <button type="button" onClick={() => setOpen(expanded ? null : t.id)} aria-expanded={expanded} aria-label={`${expanded ? 'Ocultar' : 'Ver'} clases de ${t.firstName}`} className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
                      <ChevronDown size={18} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                  </div>
                  {expanded && (
                    <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                      {mine.length === 0 ? (
                        <li className="text-sm text-gray-700 dark:text-gray-300">Aún no tiene clases en la escuela.</li>
                      ) : mine.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{c.name}</span>
                            <span className="block text-xs text-gray-700 dark:text-gray-300">{[gradeLabel(c.gradeLevel), `${c.studentCount} estudiantes`].filter(Boolean).join(' · ')}</span>
                          </span>
                          <span className="flex-shrink-0 text-xs text-gray-700 dark:text-gray-300">{c.lastActivityAt ? relativeTime(c.lastActivityAt) : 'sin actividad'}</span>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AnimatePresence>
        {removing && (
          <HomeModal
            title="Retirar de la escuela"
            subtitle={`${removing.firstName} ${removing.lastName}`}
            onClose={() => setRemoving(null)}
            footer={<><button type="button" onClick={() => setRemoving(null)} className={cancelButton}>Cancelar</button><button type="button" onClick={() => remove.mutate(removing)} disabled={remove.isPending} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60"><UserMinus size={16} aria-hidden="true" />{remove.isPending ? 'Retirando...' : 'Retirar'}</button></>}
          >
            <p className="text-sm text-gray-800 dark:text-gray-200">
              Dejará de ver la escuela y su biblioteca.{' '}
              {removingClasses.length > 0
                ? removingClasses.length === 1
                  ? <>Su <strong>clase vuelve a ser personal</strong>: conserva estudiantes y progreso, pero ya no aparecerá en los informes de la escuela.</>
                  : <>Sus <strong>{removingClasses.length} clases vuelven a ser personales</strong>: conserva estudiantes y progreso, pero ya no aparecerán en los informes de la escuela.</>
                : 'No tiene clases en la escuela.'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">Podrá volver a unirse con el enlace de invitación o enviando una solicitud.</p>
          </HomeModal>
        )}
      </AnimatePresence>
    </div>
  );
};
