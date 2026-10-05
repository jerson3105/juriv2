import { useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Undo2 } from 'lucide-react';
import { HomeModal } from '../../home/HomeModal';
import { cancelButton, errorMessage, inputClass, primaryButton } from '../../home/homeHelpers';
import { localDay } from '../schoolHelpers';
import { LEVEL_LABEL } from './schoolYearHelpers';
import { sectionName } from './sectionHelpers';
import { formatWhen, reasonLabel, rosterName, TRANSFER_REASONS, WITHDRAWAL_REASONS } from './rosterHelpers';
import {
  schoolRosterApi, schoolRosterKeys, type StudentDetail, type TransferPreview, type TransferReason, type WithdrawalReason,
} from '../../../lib/schoolRosterApi';
import { assignmentKeys } from '../../../lib/schoolAssignmentApi';
import type { SchoolLevel } from '../../../lib/schoolYearApi';
import type { SchoolSection } from '../../../lib/schoolSectionApi';

/** Traslado (con «Qué cambia» y deshacer), retiro y reincorporación desde la ficha del estudiante. */

const select = 'pg-focus mt-1 block min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const field = 'block text-sm font-medium text-gray-800 dark:text-gray-200';
const dangerButton = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-700 dark:disabled:text-gray-300';
const LEVEL_ORDER: SchoolLevel[] = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'];

interface MoveModalProps {
  schoolId: string;
  yearId: string;
  detail: StudentDetail;
  sections: SchoolSection[];
  onClose: () => void;
  onDone: () => void;
}

/** Después de un movimiento: la ficha nueva y lo que cuenta estudiantes por sección o por clase. */
const useAfterMove = (schoolId: string, yearId: string, studentId: string) => {
  const queryClient = useQueryClient();
  return (saved: StudentDetail) => {
    queryClient.setQueryData(schoolRosterKeys.detail(schoolId, yearId, studentId), saved);
    void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.all(schoolId, yearId) });
  };
};

/** Secciones agrupadas por nivel y en orden, para un <select>. */
const SectionOptions = ({ sections, exclude }: { sections: SchoolSection[]; exclude?: string }) => {
  const groups = useMemo(() => LEVEL_ORDER
    .map((level) => [level, sections
      .filter((s) => s.level === level && s.id !== exclude)
      .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, 'es'))] as const)
    .filter(([, list]) => list.length > 0), [sections, exclude]);
  return (
    <>
      {groups.map(([level, list]) => (
        <optgroup key={level} label={LEVEL_LABEL[level]}>
          {list.map((s) => <option key={s.id} value={s.id}>{sectionName(s)}</option>)}
        </optgroup>
      ))}
    </>
  );
};

const progress = (p: { level: number; xp: number; gp: number }) => `Nv. ${p.level} · ${p.xp} XP · ${p.gp} oro`;
const listText = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const TransferModal = ({ schoolId, yearId, detail, sections, onClose, onDone }: MoveModalProps) => {
  const current = detail.enrollment?.section ?? null;
  const [sectionId, setSectionId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => localDay());
  const [reason, setReason] = useState<TransferReason>('FAMILY');
  const [note, setNote] = useState('');
  const ids = { section: useId(), date: useId(), reason: useId(), note: useId(), impact: useId() };
  const after = useAfterMove(schoolId, yearId, detail.student.id);
  const preview = useQuery({
    queryKey: schoolRosterKeys.transferPreview(schoolId, yearId, detail.student.id, sectionId),
    queryFn: () => schoolRosterApi.transferPreview(schoolId, yearId, detail.student.id, sectionId),
    enabled: !!sectionId,
    retry: false,
  });
  const p = preview.data;
  const transfer = useMutation({
    mutationFn: () => schoolRosterApi.transfer(schoolId, yearId, detail.student.id, { sectionId, effectiveDate, reason, note: note.trim() || null }),
    onSuccess: (saved) => {
      after(saved);
      toast.success(`Listo: ya está en ${p?.to.label ?? 'su sección nueva'}`);
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo trasladar')),
  });

  return (
    <HomeModal
      size="lg"
      title="Trasladar a otra sección"
      subtitle={`${rosterName(detail.student)} · hoy en ${current ? sectionName(current) : 'sin sección'}`}
      onClose={onClose}
      footer={(
        <>
          {p && <p className="mr-auto text-xs text-gray-700 dark:text-gray-300">Podrás deshacerlo hasta que reciba puntos o notas en {p.to.label}.</p>}
          <button type="button" className={cancelButton} onClick={onClose}>Cancelar</button>
          <button type="button" className={primaryButton} disabled={!p || !effectiveDate || transfer.isPending} onClick={() => transfer.mutate()}>
            {transfer.isPending ? 'Trasladando…' : p ? `Trasladar a ${p.to.label}` : 'Trasladar'}
          </button>
        </>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={ids.section} className={field}>
          Sección nueva
          <select id={ids.section} className={select} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Elige la sección…</option>
            <SectionOptions sections={sections} exclude={current?.id} />
          </select>
          {p && <span className="mt-1 block text-xs text-gray-600 dark:text-gray-300">{plural(p.to.students, 'estudiante', 'estudiantes')}{p.to.tutor ? ` · Tutoría: ${p.to.tutor}` : ''}</span>}
        </label>
        <label htmlFor={ids.date} className={field}>
          Desde
          <input id={ids.date} type="date" className={`${inputClass} mt-1`} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
        </label>
        <label htmlFor={ids.reason} className={field}>
          Motivo
          <select id={ids.reason} className={select} value={reason} onChange={(e) => setReason(e.target.value as TransferReason)}>
            {TRANSFER_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <label htmlFor={ids.note} className={field}>
          Nota <span className="font-normal text-gray-600 dark:text-gray-300">(opcional, solo la ve la administración)</span>
          <input id={ids.note} className={`${inputClass} mt-1`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder="Ej.: acordado con la familia en la reunión del 18/10" autoComplete="off" />
        </label>
      </div>

      {sectionId && (
        <section aria-labelledby={ids.impact} className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <h3 id={ids.impact} className="font-bold text-gray-900 dark:text-white">Qué cambia para {detail.student.firstNames.split(' ')[0]}</h3>
          {preview.isLoading && <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Calculando el traslado…</p>}
          {preview.isError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{errorMessage(preview.error, 'No se pudo calcular el traslado')}</p>}
          {p && <TransferImpact preview={p} />}
        </section>
      )}
    </HomeModal>
  );
};

const TransferImpact = ({ preview: p }: { preview: TransferPreview }) => {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? p.areas : p.areas.slice(0, 3);
  const workshops = [
    ...p.workshops.leaving.map((name) => `sale de ${name}`),
    ...p.workshops.entering.map((name) => `entra a ${name}`),
  ];
  return (
    <>
      <p className="text-sm text-gray-800 dark:text-gray-200">
        <b className="text-gray-900 dark:text-white">Clases</b> · Sale de {plural(p.classes.leaving, 'clase', 'clases')} de {p.from.label} y entra a {p.classes.entering} de {p.to.label} por matrícula automática.
      </p>
      {p.areas.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">XP y oro, convertidos a la economía de cada clase nueva</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
                <tr>
                  <th scope="col" className="py-1 pr-3 font-semibold">Área</th>
                  <th scope="col" className="py-1 pr-3 font-semibold">En {p.from.label}</th>
                  <th scope="col" className="py-1 pr-3 font-semibold"><span className="sr-only">pasa a</span></th>
                  <th scope="col" className="py-1 font-semibold">En {p.to.label}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((a) => (
                  <tr key={a.areaId}>
                    <th scope="row" className="py-2 pr-3 font-semibold text-gray-900 dark:text-white">{a.areaName}</th>
                    <td className="py-2 pr-3 tabular-nums text-gray-800 dark:text-gray-200">{progress(a.from)}</td>
                    <td className="py-2 pr-3 text-gray-500 dark:text-gray-400" aria-hidden="true">→</td>
                    <td className="py-2 tabular-nums text-gray-900 dark:text-white">
                      {!a.to ? <span className="font-semibold text-amber-800 dark:text-amber-200">Espera su clase</span> : a.to.same ? 'Igual (misma economía)' : progress(a.to)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.areas.length > 3 && !showAll && (
            <button type="button" className="pg-btn pg-btn-ghost pg-focus mt-1" onClick={() => setShowAll(true)}>Ver las otras {plural(p.areas.length - 3, 'clase', 'clases')}</button>
          )}
        </div>
      )}
      {p.waiting.length > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-900/20 dark:text-amber-100">
          <b>{listText(p.waiting)}:</b> {p.to.label} aún no tiene docente. Su progreso queda guardado y se aplica cuando se cree la clase.
        </p>
      )}
      {workshops.length > 0 && <p className="text-sm text-gray-800 dark:text-gray-200"><b className="text-gray-900 dark:text-white">Talleres</b> · {listText(workshops)}.</p>}
      <ul className="grid gap-x-4 gap-y-1 text-sm text-gray-800 dark:text-gray-200 sm:grid-cols-2">
        <li><b className="text-gray-900 dark:text-white">Avatar y prendas:</b> se mantienen</li>
        <li><b className="text-gray-900 dark:text-white">Insignias:</b> {p.badges > 0 ? `se ven como «traídas de ${p.from.label}»` : 'aún no tiene'}</li>
        <li><b className="text-gray-900 dark:text-white">Energía:</b> empieza llena</li>
        <li><b className="text-gray-900 dark:text-white">Clan:</b> elige uno nuevo; su aporte queda en el anterior</li>
        <li><b className="text-gray-900 dark:text-white">Notas y asistencia de {p.from.label}:</b> quedan en su historial</li>
        {p.families > 0 && <li><b className="text-gray-900 dark:text-white">Familia:</b> sigue vinculada</li>}
      </ul>
    </>
  );
};

export const WithdrawModal = ({ schoolId, yearId, detail, onClose, onDone }: MoveModalProps) => {
  const section = detail.enrollment?.section ?? null;
  const [effectiveDate, setEffectiveDate] = useState(() => localDay());
  const [reason, setReason] = useState<WithdrawalReason | ''>('');
  const [note, setNote] = useState('');
  const ids = { date: useId(), reason: useId(), note: useId() };
  const active = detail.classes.filter((c) => c.isActive).length;
  const after = useAfterMove(schoolId, yearId, detail.student.id);
  const withdraw = useMutation({
    mutationFn: () => schoolRosterApi.withdraw(schoolId, yearId, detail.student.id, { effectiveDate, reason: reason as WithdrawalReason, note: note.trim() || null }),
    onSuccess: (saved) => {
      after(saved);
      toast.success('Retiro registrado');
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo registrar el retiro')),
  });

  return (
    <HomeModal
      title="Retirar del colegio"
      subtitle={`${rosterName(detail.student)} · ${section ? sectionName(section) : 'sin sección'}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className={cancelButton} onClick={onClose}>Cancelar</button>
          <button type="button" className={dangerButton} disabled={!reason || !effectiveDate || withdraw.isPending} onClick={() => withdraw.mutate()}>
            {withdraw.isPending ? 'Retirando…' : 'Retirar'}
          </button>
        </>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={ids.date} className={field}>
          Desde
          <input id={ids.date} type="date" className={`${inputClass} mt-1`} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
        </label>
        <label htmlFor={ids.reason} className={field}>
          Motivo
          <select id={ids.reason} className={select} value={reason} onChange={(e) => setReason(e.target.value as WithdrawalReason)}>
            <option value="">Elige el motivo…</option>
            {WITHDRAWAL_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <label htmlFor={ids.note} className={`${field} sm:col-span-2`}>
          Nota <span className="font-normal text-gray-600 dark:text-gray-300">(opcional, solo la ve la administración)</span>
          <input id={ids.note} className={`${inputClass} mt-1`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} autoComplete="off" />
        </label>
      </div>
      <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-800 dark:border-gray-700 dark:text-gray-200">
        <p className="font-bold text-gray-900 dark:text-white">Qué pasa</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Sale de {plural(active, 'clase', 'clases')}: sus docentes y su familia dejan de verlo ahí.</li>
          <li>Nada se borra: notas, asistencia y progreso quedan en su historial.</li>
          <li>Si vuelve, lo reincorporas y recupera sus clases tal como las dejó.</li>
        </ul>
      </div>
    </HomeModal>
  );
};

export const ReinstateModal = ({ schoolId, yearId, detail, sections, onClose, onDone }: MoveModalProps) => {
  const previous = detail.enrollment?.section ?? null;
  const [sectionId, setSectionId] = useState(previous?.id ?? '');
  const [effectiveDate, setEffectiveDate] = useState(() => localDay());
  const [note, setNote] = useState('');
  const ids = { section: useId(), date: useId(), note: useId() };
  const chosen = sections.find((s) => s.id === sectionId) ?? null;
  const after = useAfterMove(schoolId, yearId, detail.student.id);
  const reinstate = useMutation({
    mutationFn: () => schoolRosterApi.reinstate(schoolId, yearId, detail.student.id, { sectionId: sectionId || null, effectiveDate, note: note.trim() || null }),
    onSuccess: (saved) => {
      after(saved);
      toast.success('Volvió al colegio');
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo reincorporar')),
  });

  return (
    <HomeModal
      title="Reincorporar"
      subtitle={rosterName(detail.student)}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className={cancelButton} onClick={onClose}>Cancelar</button>
          <button type="button" className={primaryButton} disabled={!sectionId || !effectiveDate || reinstate.isPending} onClick={() => reinstate.mutate()}>
            {reinstate.isPending ? 'Reincorporando…' : 'Reincorporar'}
          </button>
        </>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={ids.section} className={field}>
          Sección
          <select id={ids.section} className={select} value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Elige la sección…</option>
            <SectionOptions sections={sections} />
          </select>
        </label>
        <label htmlFor={ids.date} className={field}>
          Desde
          <input id={ids.date} type="date" className={`${inputClass} mt-1`} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
        </label>
        <label htmlFor={ids.note} className={`${field} sm:col-span-2`}>
          Nota <span className="font-normal text-gray-600 dark:text-gray-300">(opcional, solo la ve la administración)</span>
          <input id={ids.note} className={`${inputClass} mt-1`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} autoComplete="off" />
        </label>
      </div>
      {chosen && (
        <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-800 dark:bg-gray-900/40 dark:text-gray-200">
          {previous && chosen.id === previous.id
            ? `Vuelve a sus clases de ${sectionName(chosen)} tal como las dejó.`
            : `Entra a las clases de ${sectionName(chosen)} con su progreso convertido, como en un traslado.`}
        </p>
      )}
    </HomeModal>
  );
};

/** Su último traslado, mientras se pueda deshacer (hasta que reciba puntos o notas en la sección nueva). */
export const UndoTransfer = ({ schoolId, yearId, studentId }: { schoolId: string; yearId: string; studentId: string }) => {
  const [confirming, setConfirming] = useState(false);
  const moves = useQuery({ queryKey: schoolRosterKeys.moves(schoolId, yearId, studentId), queryFn: () => schoolRosterApi.moves(schoolId, yearId, studentId) });
  const after = useAfterMove(schoolId, yearId, studentId);
  const undo = useMutation({
    mutationFn: (moveId: string) => schoolRosterApi.undoTransfer(schoolId, yearId, studentId, moveId),
    onSuccess: (saved) => {
      after(saved);
      setConfirming(false);
      toast.success('Traslado deshecho: volvió a su sección');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo deshacer el traslado')),
  });
  const state = moves.data?.undo;
  const last = moves.data?.history[0];
  if (!state?.canUndo || !last || last.kind !== 'TRANSFER' || last.id !== state.moveId) return null;
  const why = reasonLabel(last.reason);

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-primary-500/40 dark:bg-primary-900/20">
      <p className="text-sm text-gray-900 dark:text-white">
        <b>Trasladado de {last.from} a {last.to}</b> · {formatWhen(last.createdAt)}{why ? ` · ${why.toLowerCase()}` : ''}
      </p>
      {confirming ? (
        <div className="mt-2">
          <p className="text-sm text-gray-800 dark:text-gray-200">Vuelve a {last.from} con sus clases de antes; las de {last.to} se quitan.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="pg-btn pg-focus" disabled={undo.isPending} onClick={() => undo.mutate(state.moveId)}>{undo.isPending ? 'Deshaciendo…' : 'Sí, deshacer'}</button>
            <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setConfirming(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" className="pg-btn pg-focus" onClick={() => setConfirming(true)}><Undo2 size={16} aria-hidden="true" />Deshacer</button>
          <span className="text-xs text-gray-700 dark:text-gray-300">Hasta que reciba puntos o notas en {last.to}.</span>
        </div>
      )}
    </div>
  );
};
