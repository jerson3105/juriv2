import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRightLeft, Eye, EyeOff, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { SideDrawer } from '../SideDrawer';
import { Input } from '../../ui/Input';
import { cancelButton, primaryButton } from '../../home/homeHelpers';
import { errorMessage } from '../../auth/authHelpers';
import { LEVEL_LABEL } from './schoolYearHelpers';
import { sectionName } from './sectionHelpers';
import {
  ageOf, DOCUMENT_TYPES, describeEvent, formatBirthDate, formatWhen, initialsOf, maskedDocument, REVEAL_REASONS, REVEAL_SECONDS, rosterName,
} from './rosterHelpers';
import {
  schoolRosterApi, schoolRosterKeys, type DocumentType, type RevealReason, type StudentDetail, type StudentInput,
} from '../../../lib/schoolRosterApi';
import type { SchoolSection } from '../../../lib/schoolSectionApi';
import { ReinstateModal, TransferModal, UndoTransfer, WithdrawModal } from './StudentMoves';

export type DrawerState = { mode: 'view' | 'edit' | 'transfer' | 'withdraw' | 'reinstate'; studentId: string } | { mode: 'create' };

interface StudentDrawerProps {
  schoolId: string;
  yearId: string;
  state: DrawerState;
  sections: SchoolSection[];
  piiReady: boolean;
  onChange: (state: DrawerState | null) => void;
}

const select = 'pg-focus mt-1 block min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const label = 'block text-sm font-medium text-gray-800 dark:text-gray-200';

/** La ficha del estudiante en un cajón lateral: ver, editar o agregar. */
export const StudentDrawer = ({ schoolId, yearId, state, sections, piiReady, onChange }: StudentDrawerProps) => {
  const studentId = state.mode === 'create' ? '' : state.studentId;
  const detail = useQuery({
    queryKey: schoolRosterKeys.detail(schoolId, yearId, studentId),
    queryFn: () => schoolRosterApi.get(schoolId, yearId, studentId),
    enabled: state.mode !== 'create',
  });
  const close = () => onChange(null);

  if (state.mode === 'create') {
    return (
      <SideDrawer title="Agregar estudiante" subtitle="Al padrón del año escolar" onClose={close}>
        <StudentForm schoolId={schoolId} yearId={yearId} sections={sections} piiReady={piiReady} onCancel={close} onSaved={(saved) => onChange({ mode: 'view', studentId: saved.student.id })} />
      </SideDrawer>
    );
  }
  const data = detail.data;
  // Trasladar, retirar o reincorporar: un modal sobre la lista en lugar del cajón; al terminar vuelve la ficha.
  if (state.mode === 'transfer' || state.mode === 'withdraw' || state.mode === 'reinstate') {
    if (!data) return null;
    const back = () => onChange({ mode: 'view', studentId });
    const props = { schoolId, yearId, detail: data, sections, onClose: back, onDone: back };
    if (state.mode === 'transfer') return <TransferModal {...props} />;
    if (state.mode === 'withdraw') return <WithdrawModal {...props} />;
    return <ReinstateModal {...props} />;
  }
  const title = data ? rosterName(data.student) : 'Ficha del estudiante';
  return (
    <SideDrawer title={title} subtitle={data ? subtitleOf(data) : undefined} onClose={close}>
      {detail.isLoading && <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Cargando la ficha…</p>}
      {detail.isError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">No se pudo cargar la ficha.</p>}
      {data && (state.mode === 'edit'
        ? <StudentForm schoolId={schoolId} yearId={yearId} sections={sections} piiReady={piiReady} detail={data} onCancel={() => onChange({ mode: 'view', studentId })} onSaved={() => onChange({ mode: 'view', studentId })} />
        : <StudentView schoolId={schoolId} yearId={yearId} detail={data} sections={sections} onMode={(mode) => onChange({ mode, studentId })} />)}
    </SideDrawer>
  );
};

const subtitleOf = (data: StudentDetail) => {
  const section = data.enrollment?.section;
  return [
    section ? `${sectionName(section)} · ${LEVEL_LABEL[section.level]}` : 'Sin sección',
    data.enrollment?.tutor ? `Tutoría: ${data.enrollment.tutor}` : null,
  ].filter(Boolean).join(' · ');
};

type ViewAction = 'edit' | 'transfer' | 'withdraw' | 'reinstate';

const StudentView = ({ schoolId, yearId, detail, sections, onMode }: { schoolId: string; yearId: string; detail: StudentDetail; sections: SchoolSection[]; onMode: (mode: ViewAction) => void }) => {
  const { student } = detail;
  const [tab, setTab] = useState<'events' | 'classes' | 'years'>('events');
  const tabsId = useId();
  const age = ageOf(student.birthDate);
  // Fecha y nota interna de cada traslado, retiro o reincorporación (la nota solo la ve la administración).
  const moves = useQuery({ queryKey: schoolRosterKeys.moves(schoolId, yearId, student.id), queryFn: () => schoolRosterApi.moves(schoolId, yearId, student.id) });
  const moveById = new Map((moves.data?.history ?? []).map((m) => [m.id, m]));
  const active = student.status === 'ACTIVE';
  const tabs = [
    { id: 'events' as const, label: 'Movimientos', count: null },
    { id: 'classes' as const, label: 'Clases', count: detail.classes.length },
    { id: 'years' as const, label: 'Años', count: detail.years.length },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-base font-black text-white" aria-hidden="true">{initialsOf(student)}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'}`}>
          {active ? 'Matrícula activa' : 'Retirado'}
        </span>
        <button type="button" className="pg-btn pg-focus ml-auto" onClick={() => onMode('edit')}><Pencil size={16} aria-hidden="true" />Editar datos</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {active && detail.enrollment?.section && <button type="button" className="pg-btn pg-focus" onClick={() => onMode('transfer')}><ArrowRightLeft size={16} aria-hidden="true" />Trasladar</button>}
        {active && detail.enrollment && <button type="button" className="pg-btn pg-btn-ghost pg-focus text-red-700 dark:text-red-300" onClick={() => onMode('withdraw')}><UserMinus size={16} aria-hidden="true" />Retirar</button>}
        {!active && <button type="button" className="pg-btn pg-focus" onClick={() => onMode('reinstate')}><UserPlus size={16} aria-hidden="true" />Reincorporar</button>}
      </div>

      {active && <UndoTransfer schoolId={schoolId} yearId={yearId} studentId={student.id} />}
      {!detail.enrollment?.section && active && <AssignSection schoolId={schoolId} yearId={yearId} studentId={student.id} sections={sections} />}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
        <div className="col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{student.documentType ? DOCUMENT_TYPES.find((d) => d.id === student.documentType)?.label : 'Documento'}</dt>
          <dd className="mt-0.5">
            {student.hasDocument ? <RevealDocument schoolId={schoolId} studentId={student.id} hint={student.documentHint} /> : <span className="font-semibold text-amber-800 dark:text-amber-200">Falta el documento</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Nacimiento</dt>
          <dd className="mt-0.5 text-gray-900 dark:text-white">{student.birthDate ? `${formatBirthDate(student.birthDate)} · ${age} años` : <span className="font-semibold text-amber-800 dark:text-amber-200">Falta la fecha</span>}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Código SIAGIE</dt>
          <dd className="mt-0.5 text-gray-900 dark:text-white">{student.siagieCode ?? <span className="text-gray-600 dark:text-gray-300">Sin registrar</span>}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Correo institucional</dt>
          <dd className="mt-0.5 break-all text-gray-900 dark:text-white">{student.email ?? <span className="text-gray-600 dark:text-gray-300">Sin correo</span>}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Acceso</dt>
          <dd className="mt-0.5 text-gray-900 dark:text-white">{student.hasAccount ? 'Tiene cuenta para entrar' : 'Aún sin cuenta propia'}</dd>
        </div>
      </dl>

      <div>
        <div className="pg-seg" role="group" aria-label="Historial del estudiante">
          {tabs.map((t) => (
            <button key={t.id} type="button" aria-pressed={tab === t.id} aria-controls={`${tabsId}-panel`} className="pg-seg-item pg-focus" onClick={() => setTab(t.id)}>
              {t.label}{t.count !== null && <span className="tabular-nums opacity-80">{t.count}</span>}
            </button>
          ))}
        </div>
        <div id={`${tabsId}-panel`} role="region" aria-label={tabs.find((t) => t.id === tab)?.label} className="mt-3">
          {tab === 'events' && (
            detail.events.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-300">Sin movimientos todavía.</p> : (
              <ol className="space-y-3 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
                {detail.events.map((event) => {
                  const { title, detail: info } = describeEvent(event);
                  const moveId = event.metadata?.moveId;
                  const move = typeof moveId === 'string' && !event.metadata?.undo ? moveById.get(moveId) : undefined;
                  return (
                    <li key={event.id}>
                      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <b className="text-gray-900 dark:text-white">{title}</b>
                        <span className="text-xs text-gray-600 dark:text-gray-300">{formatWhen(event.createdAt)}</span>
                      </p>
                      {(info || event.actor || move) && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {[info, move ? `desde el ${formatBirthDate(move.effectiveDate)}` : null, event.actor ? `por ${event.actor}` : null].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {move?.note && <p className="text-sm italic text-gray-700 dark:text-gray-300">Nota interna: {move.note}</p>}
                    </li>
                  );
                })}
              </ol>
            )
          )}
          {tab === 'classes' && (
            detail.classes.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-300">Aún no está vinculado a ninguna clase. Se vincula al armar el padrón desde las clases o con la matrícula automática.</p> : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {detail.classes.map((c) => (
                  <li key={c.profileId} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900 dark:text-white">{c.classroomName}</span>
                      <span className="block text-xs text-gray-600 dark:text-gray-300">{c.teacher ?? 'Sin docente'}{!c.isActive && ' · inactivo'}</span>
                    </span>
                    <span className="tabular-nums text-gray-700 dark:text-gray-300">Nv. {c.level} · {c.xp} XP</span>
                  </li>
                ))}
              </ul>
            )
          )}
          {tab === 'years' && (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {detail.years.map((y) => (
                <li key={y.yearId} className="flex items-center gap-3 py-2 text-sm">
                  <b className="text-gray-900 dark:text-white">{y.name}</b>
                  <span className="text-gray-700 dark:text-gray-300">{y.status === 'ACTIVE' ? (y.hasSection ? 'Matrícula activa' : 'Sin sección') : 'Retirado'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

/** «Mostrar» el documento: motivo de una lista, 30 segundos a la vista y queda registrado. El número no se guarda. */
const RevealDocument = ({ schoolId, studentId, hint }: { schoolId: string; studentId: string; hint: string | null }) => {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<RevealReason | null>(null);
  const [shown, setShown] = useState<{ document: string; until: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const groupId = useId();

  const reveal = useMutation({
    mutationFn: (why: RevealReason) => schoolRosterApi.revealDocument(schoolId, studentId, why),
    onSuccess: (data) => {
      setShown({ document: data.document, until: Date.now() + REVEAL_SECONDS * 1000 });
      setAsking(false);
      setReason(null);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo mostrar el documento')),
  });

  useEffect(() => {
    if (!shown) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= shown.until) setShown(null);
      else setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [shown]);

  if (shown) {
    const left = Math.max(0, Math.ceil((shown.until - now) / 1000));
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-bold tracking-wider text-gray-900 dark:text-white">{shown.document}</span>
        <span className="text-xs text-gray-600 dark:text-gray-300" aria-live="polite">Se oculta en {left} s</span>
        <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setShown(null)}><EyeOff size={16} aria-hidden="true" />Ocultar</button>
      </span>
    );
  }
  return (
    <div>
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base tracking-wider text-gray-900 dark:text-white">{maskedDocument(hint)}</span>
        {!asking && <button type="button" className="pg-btn pg-focus" onClick={() => setAsking(true)}><Eye size={16} aria-hidden="true" />Mostrar</button>}
      </span>
      {asking ? (
        <fieldset className="mt-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
          <legend className="sr-only">Motivo para mostrar el documento</legend>
          <p id={groupId} className="text-sm font-semibold text-gray-900 dark:text-white">¿Para qué lo necesitas?</p>
          <div className="mt-1 space-y-1" role="radiogroup" aria-labelledby={groupId}>
            {REVEAL_REASONS.map((r) => (
              <label key={r.id} className="flex min-h-[36px] cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <input type="radio" name={`${groupId}-reason`} value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="h-4 w-4" />
                {r.label}
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" className="pg-btn pg-focus" disabled={!reason || reveal.isPending} onClick={() => reason && reveal.mutate(reason)}>
              {reveal.isPending ? 'Mostrando…' : `Mostrar ${REVEAL_SECONDS} s`}
            </button>
            <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => { setAsking(false); setReason(null); }}>Cancelar</button>
          </div>
        </fieldset>
      ) : (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Solo administración · pide un motivo · queda registrado</p>
      )}
    </div>
  );
};

const AssignSection = ({ schoolId, yearId, studentId, sections }: { schoolId: string; yearId: string; studentId: string; sections: SchoolSection[] }) => {
  const queryClient = useQueryClient();
  const [sectionId, setSectionId] = useState('');
  const fieldId = useId();
  const assign = useMutation({
    mutationFn: () => schoolRosterApi.update(schoolId, yearId, studentId, { sectionId }),
    onSuccess: (detail) => {
      queryClient.setQueryData(schoolRosterKeys.detail(schoolId, yearId, studentId), detail);
      void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
      toast.success('Sección asignada');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo asignar la sección')),
  });
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-900/20">
      <label htmlFor={fieldId} className="text-sm font-semibold text-amber-950 dark:text-amber-100">Aún no tiene sección</label>
      <div className="mt-1 flex gap-2">
        <select id={fieldId} className={`${select} mt-0`} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">Elige una sección…</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{sectionName(s)} · {LEVEL_LABEL[s.level]}</option>)}
        </select>
        <button type="button" className="pg-btn pg-focus" disabled={!sectionId || assign.isPending} onClick={() => assign.mutate()}>Asignar</button>
      </div>
    </div>
  );
};

interface StudentFormProps {
  schoolId: string;
  yearId: string;
  sections: SchoolSection[];
  piiReady: boolean;
  detail?: StudentDetail;
  onCancel: () => void;
  onSaved: (detail: StudentDetail) => void;
}

/** Alta y edición. En la edición, el documento no se ve: se cambia o se quita. */
const StudentForm = ({ schoolId, yearId, sections, piiReady, detail, onCancel, onSaved }: StudentFormProps) => {
  const queryClient = useQueryClient();
  const student = detail?.student;
  const [firstNames, setFirstNames] = useState(student?.firstNames ?? '');
  const [lastNames, setLastNames] = useState(student?.lastNames ?? '');
  const [changeDocument, setChangeDocument] = useState(!student?.hasDocument);
  const [removeDocument, setRemoveDocument] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>(student?.documentType ?? 'DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [birthDate, setBirthDate] = useState(student?.birthDate ?? '');
  const [email, setEmail] = useState(student?.email ?? '');
  const [siagieCode, setSiagieCode] = useState(student?.siagieCode ?? '');
  const [sectionId, setSectionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canPickSection = !detail || !detail.enrollment?.section;
  const ids = { type: useId(), section: useId() };

  const payload = (): Partial<StudentInput> => {
    const body: Partial<StudentInput> = {};
    const put = <K extends keyof StudentInput>(key: K, value: StudentInput[K], previous: StudentInput[K] | undefined) => {
      if (!detail || value !== previous) body[key] = value;
    };
    put('firstNames', firstNames, student?.firstNames);
    put('lastNames', lastNames, student?.lastNames);
    if (removeDocument) body.document = null;
    else if (changeDocument && documentNumber.trim()) body.document = { type: documentType, number: documentNumber.trim() };
    put('birthDate', birthDate || null, student?.birthDate ?? null);
    put('email', email.trim() || null, student?.email ?? null);
    put('siagieCode', siagieCode.trim() || null, student?.siagieCode ?? null);
    if (canPickSection && sectionId) body.sectionId = sectionId;
    return body;
  };

  const save = useMutation({
    mutationFn: () => {
      const body = payload();
      return detail
        ? schoolRosterApi.update(schoolId, yearId, detail.student.id, body)
        : schoolRosterApi.create(schoolId, yearId, body as StudentInput);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(schoolRosterKeys.detail(schoolId, yearId, saved.student.id), saved);
      void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
      toast.success(detail ? 'Datos guardados' : 'Estudiante agregado al padrón');
      onSaved(saved);
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo guardar')),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!firstNames.trim() || !lastNames.trim()) return setError('Escribe los nombres y los apellidos');
    if (detail && Object.keys(payload()).length === 0) return onCancel();
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Apellidos" value={lastNames} onChange={(e) => setLastNames(e.target.value)} maxLength={100} autoComplete="off" required />
        <Input label="Nombres" value={firstNames} onChange={(e) => setFirstNames(e.target.value)} maxLength={100} autoComplete="off" required />
      </div>

      <fieldset className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">Documento de identidad</legend>
        {!piiReady ? (
          <p className="text-sm text-amber-900 dark:text-amber-100">Para guardar documentos, el servidor necesita sus llaves de cifrado. Avísale al equipo de Juried.</p>
        ) : student?.hasDocument && !changeDocument && !removeDocument ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono tracking-wider text-gray-900 dark:text-white">{maskedDocument(student.documentHint)}</span>
            <button type="button" className="pg-btn pg-focus" onClick={() => setChangeDocument(true)}>Cambiar</button>
            <button type="button" className="pg-btn pg-btn-ghost pg-focus text-red-700 dark:text-red-300" onClick={() => setRemoveDocument(true)}>Quitar</button>
          </div>
        ) : removeDocument ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
            Se quitará el documento al guardar.
            <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setRemoveDocument(false)}>Deshacer</button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
            <label htmlFor={ids.type} className={label}>
              Tipo
              <select id={ids.type} className={select} value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
                {DOCUMENT_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
            <Input label="Número" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} inputMode={documentType === 'DNI' ? 'numeric' : 'text'} maxLength={20} autoComplete="off" />
          </div>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Fecha de nacimiento" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <Input label="Código SIAGIE" value={siagieCode} onChange={(e) => setSiagieCode(e.target.value)} maxLength={20} autoComplete="off" />
      </div>
      <Input label="Correo institucional" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} autoComplete="off" />

      {canPickSection && (
        <label htmlFor={ids.section} className={label}>
          Sección
          <select id={ids.section} className={select} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Sin sección por ahora</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{sectionName(s)} · {LEVEL_LABEL[s.level]}</option>)}
          </select>
        </label>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-900 dark:bg-red-900/30 dark:text-red-100" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={cancelButton} onClick={onCancel}>Cancelar</button>
        <button type="submit" className={primaryButton} disabled={save.isPending}>{save.isPending ? 'Guardando…' : detail ? 'Guardar' : 'Agregar'}</button>
      </div>
    </form>
  );
};
