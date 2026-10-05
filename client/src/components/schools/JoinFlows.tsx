import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Building2, CheckCircle2, Clock, KeyRound, MapPin, School, Search, Send, Shield, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { schoolApi, type MySchool } from '../../lib/schoolApi';
import { HomeModal } from '../home/HomeModal';
import { cancelButton, errorMessage, inputClass, labelClass, primaryButton } from '../home/homeHelpers';
import { MEMBER_STATUS_LABEL, canViewSchool, mySchoolsKey } from './schoolHelpers';

const card = 'rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800';
const secondaryButton = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700';

export const StepHeader = ({ title, subtitle, onBack, icon }: { title: string; subtitle?: string; onBack?: () => void; icon?: ReactNode }) => (
  <div className="flex items-center gap-3">
    {onBack && (
      <button type="button" onClick={onBack} aria-label="Volver" className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
        <ArrowLeft size={20} aria-hidden="true" />
      </button>
    )}
    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md" aria-hidden="true">{icon ?? <School size={22} />}</span>
    <div className="min-w-0">
      <h1 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h1>
      {subtitle && <p className="text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>}
    </div>
  </div>
);

// ── Código de invitación (entrada manual o desde el enlace) ─────────────────
export const InviteCodeForm = ({ onSubmit }: { onSubmit: (code: string) => void }) => {
  const [code, setCode] = useState('');
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (clean.length >= 6) onSubmit(clean); }} className="flex flex-col gap-2 sm:flex-row">
      <label className="flex-1">
        <span className="sr-only">Código de invitación</span>
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de invitación (ej: XJLFPTBY)" maxLength={16} autoComplete="off" className={`${inputClass} font-mono uppercase tracking-wider`} />
      </label>
      <button type="submit" disabled={clean.length < 6} className={primaryButton}>
        <KeyRound size={16} aria-hidden="true" />
        Usar código
      </button>
    </form>
  );
};

export const InviteLanding = ({ code, onDone, onCancel }: { code: string; onDone: (schoolId: string) => void; onCancel: () => void }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['school-invite', code], queryFn: () => schoolApi.previewInvite(code), retry: false });
  const join = useMutation({
    mutationFn: () => schoolApi.joinByInvite(code),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: mySchoolsKey });
      toast.success(res.alreadyMember ? 'Ya eras parte de esta escuela' : `¡Te uniste a ${res.school.name}!`);
      onDone(res.school.id);
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo usar la invitación')),
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <StepHeader title="Invitación a una escuela" onBack={onCancel} icon={<KeyRound size={22} />} />
      <div className={card}>
        {isLoading ? <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Comprobando el enlace...</p>
          : isError || !data ? (
            <div className="space-y-3" role="alert">
              <p className="font-semibold text-gray-900 dark:text-white">Este enlace no es válido o fue desactivado.</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{errorMessage(error, 'Pide al responsable de tu escuela un enlace nuevo.')}</p>
              <button type="button" onClick={onCancel} className={secondaryButton}>Volver</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200" aria-hidden="true"><Building2 size={24} /></span>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{data.school.name}</p>
                  <p className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300"><MapPin size={14} aria-hidden="true" />{[data.school.city, data.school.country].filter(Boolean).join(', ')}</p>
                </div>
              </div>
              {data.memberStatus === 'VERIFIED' ? (
                <>
                  <p className="text-sm text-gray-800 dark:text-gray-200">Ya eres parte de esta escuela.</p>
                  <button type="button" onClick={() => onDone(data.school.id)} className={primaryButton}>Ir a la escuela</button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-800 dark:text-gray-200">Al unirte podrás asignar tus clases a la escuela y usar su biblioteca de comportamientos e insignias. El responsable verá los informes de esas clases.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => join.mutate()} disabled={join.isPending} className={primaryButton}>{join.isPending ? 'Uniéndote...' : 'Unirme a la escuela'}</button>
                    <button type="button" onClick={onCancel} className={cancelButton}>Ahora no</button>
                  </div>
                </>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

// ── Buscar escuela y pedir unirse (con confirmación) ────────────────────────
export const SearchStep = ({ mySchools, onBack }: { mySchools: MySchool[]; onBack: () => void }) => {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const term = query.trim();
  const { data: results = [], isFetching } = useQuery({ queryKey: ['school-search', term], queryFn: () => schoolApi.search(term), enabled: term.length >= 2 });
  const statusById = new Map(mySchools.map((s) => [s.id, s.memberStatus]));

  const join = useMutation({
    mutationFn: (id: string) => schoolApi.requestJoin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mySchoolsKey });
      toast.success('Solicitud enviada al responsable de la escuela');
      setConfirm(null);
      onBack();
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo enviar la solicitud')),
  });

  return (
    <div className="space-y-4">
      <StepHeader title="Buscar mi escuela" subtitle="Solo aparecen escuelas verificadas por Juried" onBack={onBack} icon={<Search size={22} />} />
      <div className={card}>
        <label className="relative block">
          <span className="sr-only">Nombre de la escuela</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Escribe al menos 2 letras del nombre" autoFocus className={`${inputClass} pl-10`} />
        </label>
      </div>
      {term.length >= 2 && (
        <div className={`${card} p-0`} aria-live="polite">
          {isFetching ? <p className="p-5 text-sm text-gray-700 dark:text-gray-300">Buscando...</p> : results.length === 0 ? (
            <p className="p-5 text-sm text-gray-700 dark:text-gray-300">No encontramos "{term}". Si tu colegio ya usa Juried, pídele a su dirección el enlace o el código de invitación.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {results.map((s) => {
                const status = statusById.get(s.id);
                return (
                  <li key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">{s.name}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{[s.address, s.city, s.country].filter(Boolean).join(', ')} · {s.memberCount} profesores</p>
                    </div>
                    {status ? (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-800 dark:bg-gray-700 dark:text-gray-100">{MEMBER_STATUS_LABEL[status]}</span>
                    ) : (
                      <button type="button" onClick={() => setConfirm({ id: s.id, name: s.name })} className={secondaryButton}>
                        <Send size={16} aria-hidden="true" />
                        Solicitar unirme
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <AnimatePresence>
        {confirm && (
          <HomeModal
            title="Solicitar unirme"
            subtitle={confirm.name}
            onClose={() => setConfirm(null)}
            footer={<><button type="button" onClick={() => setConfirm(null)} className={cancelButton}>Cancelar</button><button type="button" onClick={() => join.mutate(confirm.id)} disabled={join.isPending} className={primaryButton}>{join.isPending ? 'Enviando...' : 'Enviar solicitud'}</button></>}
          >
            <p className="text-sm text-gray-800 dark:text-gray-200">El responsable de la escuela recibirá tu solicitud con tu nombre y correo. Cuando la acepte podrás asignar tus clases a la escuela.</p>
          </HomeModal>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Verificación del responsable ────────────────────────────────────────────
const POSITIONS = ['Director(a)', 'Subdirector(a)', 'Coordinador(a) académico', 'Profesor(a)', 'Auxiliar', 'Tutor(a)'];

export const VerificationStep = ({ school, onBack, onSent }: { school: { id: string; name: string }; onBack: () => void; onSent: () => void }) => {
  const queryClient = useQueryClient();
  const [position, setPosition] = useState('');
  const [details, setDetails] = useState('');
  const send = useMutation({
    mutationFn: () => schoolApi.createVerification({ schoolId: school.id, position, details: details.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mySchoolsKey });
      toast.success('Verificación enviada. Te avisaremos cuando la revisemos.');
      onSent();
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo enviar la verificación')),
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <StepHeader title="Verificar mi rol" subtitle={school.name} onBack={onBack} icon={<Shield size={22} />} />
      <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">Por seguridad, un miembro del equipo de Juried confirma que eres parte de la escuela antes de activar su gestión.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (position) send.mutate(); }} className={`${card} space-y-4`}>
        <label className={labelClass}>Tu cargo en la escuela
          <select value={position} onChange={(e) => setPosition(e.target.value)} required className={`${inputClass} mt-1.5`}>
            <option value="">Elige tu cargo</option>
            {POSITIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className={labelClass}>Detalles que ayuden a verificarte <span className="font-normal text-gray-700 dark:text-gray-300">(opcional)</span>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={2000} placeholder="Ej: área que enseñas, años en la escuela, un teléfono de la institución" className={`${inputClass} mt-1.5 resize-none`} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onBack} className={cancelButton}>Más tarde</button>
          <button type="submit" disabled={!position || send.isPending} className={primaryButton}><Send size={16} aria-hidden="true" />{send.isPending ? 'Enviando...' : 'Enviar verificación'}</button>
        </div>
      </form>
    </div>
  );
};

// ── Lista "Mis escuelas" (varias escuelas o estados pendientes) ─────────────
export const SchoolList = ({ schools, onOpen, onSearch, onInvite, onVerify }: {
  schools: MySchool[];
  onOpen: (s: MySchool) => void;
  onSearch: () => void;
  onInvite: (code: string) => void;
  onVerify: (s: MySchool) => void;
}) => {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: (memberId: string) => schoolApi.cancelJoinRequest(memberId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: mySchoolsKey }); toast.success('Listo'); },
    onError: (e) => toast.error(errorMessage(e, 'No se pudo cancelar')),
  });
  const statusIcon = { VERIFIED: CheckCircle2, PENDING_ADMIN: Clock, PENDING_OWNER: Clock, REJECTED: XCircle } as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StepHeader title="Mi escuela" subtitle="Únete con el enlace o código de tu escuela, o búscala" />
        <button type="button" onClick={onSearch} className={secondaryButton}><Search size={16} aria-hidden="true" />Buscar escuela</button>
      </div>

      <section className={`${card} space-y-3`} aria-labelledby="invite-code-title">
        <h2 id="invite-code-title" className="font-bold text-gray-900 dark:text-white">¿Te enviaron una invitación?</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">Abre el enlace que te compartió el responsable o escribe aquí el código.</p>
        <InviteCodeForm onSubmit={onInvite} />
      </section>

      {schools.length > 0 && (
        <ul className="space-y-3">
          {schools.map((s) => {
            const Icon = statusIcon[s.memberStatus];
            const viewable = canViewSchool(s);
            return (
              <li key={s.id} className={card}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-gray-900 dark:text-white">
                      {s.name}
                      {s.memberRole === 'OWNER' && <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-800 dark:bg-primary-900/50 dark:text-primary-100"><Shield size={12} aria-hidden="true" />Responsable</span>}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                      <Icon size={14} aria-hidden="true" />
                      {MEMBER_STATUS_LABEL[s.memberStatus]}
                      {s.memberStatus === 'VERIFIED' && ` · ${s.memberCount} profesores · ${s.classroomCount} clases`}
                    </p>
                    {s.memberStatus === 'REJECTED' && s.rejectionReason && <p className="mt-1 text-sm text-red-800 dark:text-red-200">Motivo: {s.rejectionReason}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {viewable && <button type="button" onClick={() => onOpen(s)} className={primaryButton}>Abrir</button>}
                    {s.memberStatus === 'PENDING_ADMIN' && <button type="button" onClick={() => onVerify(s)} className={secondaryButton}>Enviar verificación</button>}
                    {s.memberStatus !== 'VERIFIED' && (
                      <button type="button" onClick={() => cancel.mutate(s.memberId)} disabled={cancel.isPending} className={`${secondaryButton} text-red-700 dark:text-red-300`}>
                        {s.memberStatus === 'REJECTED' ? 'Quitar de mi lista' : s.memberRole === 'OWNER' ? 'Cancelar registro' : 'Cancelar solicitud'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
