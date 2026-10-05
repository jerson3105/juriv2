import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Info, Pencil, Upload, X } from 'lucide-react';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { cancelButton, primaryButton } from '../../components/home/homeHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import { LEVEL_LABEL } from '../../components/schools/console/schoolYearHelpers';
import { DOCUMENT_TYPES, formatBirthDate, whenLabel } from '../../components/schools/console/rosterHelpers';
import { byAttention, FIELD_OPTIONS, FIX_FIELD_LABEL, importable, rowOutcome, SOURCE_LABEL } from '../../components/schools/console/rosterImportHelpers';
import {
  rosterImportApi, rosterImportKeys, type FixValueField, type ImportBatch, type ImportField, type ImportIssue, type ImportRow, type RowFixPatch,
} from '../../lib/schoolRosterImportApi';
import { schoolRosterKeys } from '../../lib/schoolRosterApi';
import { schoolSectionApi, schoolSectionKeys } from '../../lib/schoolSectionApi';

const MAX_BYTES = 2 * 1024 * 1024;
const PAGE = 60;
const IDENTITY: ImportField[] = ['juriedCode', 'fullName', 'lastNames', 'lastName1', 'firstNames', 'documentNumber'];
const select = 'pg-focus min-h-[40px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const input = 'pg-focus min-h-[40px] rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
type Step = 1 | 2 | 3 | 4;
type Filter = 'all' | ImportRow['status'];
type ConfirmResult = Awaited<ReturnType<typeof rosterImportApi.confirm>>;

const sentence = (text: string) => (/[.!?»)]$/.test(text) ? text : `${text}.`);
const columnLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`);
const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

/** Importar el padrón desde Excel: archivo, columnas, revisar filas y confirmar (se puede deshacer 24 h). */
export const SchoolRosterImportPage = () => {
  const { school, selectedYear, yearsLoading } = useSchoolConsole();
  const [params, setParams] = useSearchParams();
  const batchId = params.get('lote');
  const setBatch = (id: string | null) => setParams(id ? { lote: id } : {}, { replace: true });

  if (yearsLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando" />;
  if (!selectedYear) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">Primero prepara el año escolar.</p>
        <Link to={`/escuela/${school.id}/anio`} className="pg-btn pg-focus mt-3">Preparar el año</Link>
      </div>
    );
  }
  return batchId
    ? <Wizard key={batchId} schoolId={school.id} yearId={selectedYear.id} batchId={batchId} onRestart={() => setBatch(null)} />
    : <FileStep schoolId={school.id} yearId={selectedYear.id} yearName={selectedYear.name} onReady={setBatch} />;
};

const PageHeader = ({ schoolId, subtitle, action }: { schoolId: string; subtitle: string; action?: ReactNode }) => (
  <header className="flex flex-wrap items-start gap-3">
    <Link to={`/escuela/${schoolId}/estudiantes`} className="pg-icon-btn pg-focus" aria-label="Volver a Estudiantes"><ArrowLeft size={20} aria-hidden="true" /></Link>
    <div className="min-w-0 flex-1">
      <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Importar estudiantes</h1>
      <p className="mt-0.5 break-words text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>
    </div>
    {action}
  </header>
);

const Steps = ({ step, details }: { step: Step; details: string[] }) => (
  <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Pasos">
    {['Archivo', 'Columnas', 'Revisar filas', 'Confirmar'].map((title, i) => {
      const n = (i + 1) as Step;
      return (
        <li key={title} className="flex items-center gap-2" aria-current={step === n ? 'step' : undefined}>
          {i > 0 && <span className="h-0.5 w-6 rounded bg-gray-300 dark:bg-gray-600" aria-hidden="true" />}
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step > n ? 'bg-emerald-600 text-white' : step === n ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
            {step > n ? <Check size={14} aria-hidden="true" /> : n}
          </span>
          <span>
            <span className="block font-semibold text-gray-900 dark:text-white">{title}</span>
            <span className="block text-xs text-gray-600 dark:text-gray-300">{details[i]}</span>
          </span>
        </li>
      );
    })}
  </ol>
);

// ==================== 1 · ARCHIVO ====================

const FileStep = ({ schoolId, yearId, yearName, onReady }: { schoolId: string; yearId: string; yearName: string; onReady: (batchId: string) => void }) => {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const current = useQuery({ queryKey: rosterImportKeys.current(schoolId, yearId), queryFn: () => rosterImportApi.current(schoolId, yearId) });
  const upload = useMutation({
    mutationFn: (file: File) => rosterImportApi.upload(schoolId, yearId, file),
    onSuccess: (batch) => {
      queryClient.setQueryData(rosterImportKeys.batch(schoolId, yearId, batch.id), batch);
      void queryClient.invalidateQueries({ queryKey: rosterImportKeys.current(schoolId, yearId) });
      onReady(batch.id);
    },
    onError: (error) => setProblem(errorMessage(error, 'No se pudo leer el archivo')),
  });
  const discard = useMutation({
    mutationFn: (batchId: string) => rosterImportApi.discard(schoolId, yearId, batchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rosterImportKeys.current(schoolId, yearId) });
      toast.success('Importación descartada');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo descartar la importación')),
  });
  const template = useMutation({
    mutationFn: () => rosterImportApi.downloadTemplate(schoolId, yearId, yearName),
    onError: (error) => toast.error(errorMessage(error, 'No se pudo descargar la plantilla')),
  });
  const pick = (file: File | undefined) => {
    setProblem(null);
    if (!file) return;
    if (/\.xls$/i.test(file.name)) return setProblem('Es un Excel antiguo (.xls): ábrelo y guárdalo como «Libro de Excel (.xlsx)».');
    if (!/\.xlsx$/i.test(file.name)) return setProblem('Elige un archivo de Excel (.xlsx).');
    if (file.size > MAX_BYTES) return setProblem('El archivo pesa más de 2 MB: deja solo la hoja del padrón.');
    upload.mutate(file);
  };
  const pending = current.data?.pending;

  return (
    <div className="space-y-5">
      <PageHeader schoolId={schoolId} subtitle={`Padrón ${yearName} · la plantilla de Juried o la nómina del SIAGIE`} />
      <Steps step={1} details={['Elige el archivo', '—', '—', 'y deshacer 24 h']} />

      {pending && (
        <div className="pg-surface flex flex-wrap items-center gap-3 p-4" role="status">
          <FileSpreadsheet size={20} className="flex-shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-100">
            Tienes una importación sin terminar: <b>{pending.rowCount} {pending.rowCount === 1 ? 'fila' : 'filas'}</b>, subida {whenLabel(pending.createdAt)}. Se borra {whenLabel(pending.expiresAt)}.
          </p>
          <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => discard.mutate(pending.id)} disabled={discard.isPending}>Descartar</button>
          <button type="button" className={primaryButton} onClick={() => onReady(pending.id)}>Continuar</button>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]" aria-label="Elegir el archivo">
        <div
          className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10' : 'border-gray-300 bg-white/70 dark:border-gray-600 dark:bg-gray-800/60'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
        >
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">📄</span><span className="text-5xl">📥</span><span className="text-4xl">🎒</span></div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Sube la lista de estudiantes</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Arrastra aquí el archivo o elígelo. Excel (.xlsx), hasta 2 MB.</p>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button type="button" className={`${primaryButton} mt-5`} onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
            <Upload size={16} aria-hidden="true" />
            {upload.isPending ? 'Leyendo el archivo…' : 'Elegir archivo'}
          </button>
          {problem && <p className="mx-auto mt-4 max-w-md rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-900/30 dark:text-red-100" role="alert">{problem}</p>}
        </div>
        <aside className="pg-surface space-y-3 p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">¿Qué archivo sirve?</h2>
          <ul className="space-y-2 text-sm text-gray-800 dark:text-gray-100">
            <li><b>La nómina del SIAGIE.</b> Si secretaría la exporta, completa los DNI y las fechas de nacimiento de un golpe.</li>
            <li><b>La plantilla de Juried.</b> Trae a tus estudiantes del año: completa lo que falta o agrega filas para los nuevos.</li>
          </ul>
          <button type="button" className="pg-btn pg-focus" onClick={() => template.mutate()} disabled={template.isPending}>
            <Download size={16} aria-hidden="true" />
            {template.isPending ? 'Preparando…' : 'Descargar plantilla (.xlsx)'}
          </button>
          <p className="text-xs text-gray-600 dark:text-gray-300">Nada cambia en el padrón hasta que confirmes. El archivo se borra del servidor a las 24 horas.</p>
        </aside>
      </section>
    </div>
  );
};

// ==================== EL ASISTENTE ====================

const Wizard = ({ schoolId, yearId, batchId, onRestart }: { schoolId: string; yearId: string; batchId: string; onRestart: () => void }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const key = rosterImportKeys.batch(schoolId, yearId, batchId);
  const batch = useQuery({ queryKey: key, queryFn: () => rosterImportApi.get(schoolId, yearId, batchId), staleTime: 30_000, retry: false });
  const [step, setStep] = useState<Exclude<Step, 1>>(2);
  const [discarding, setDiscarding] = useState(false);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const update = (next: ImportBatch) => queryClient.setQueryData(key, next);
  const discard = useMutation({
    mutationFn: () => rosterImportApi.discard(schoolId, yearId, batchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rosterImportKeys.current(schoolId, yearId) });
      toast.success('Importación descartada');
      navigate(`/escuela/${schoolId}/estudiantes`);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo descartar la importación')),
  });

  if (batch.isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Abriendo la importación" />;
  if (batch.isError || !batch.data) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">{errorMessage(batch.error, 'No se pudo abrir la importación')}</p>
        <button type="button" onClick={onRestart} className="pg-btn pg-focus mt-3">Subir un archivo</button>
      </div>
    );
  }
  const data = batch.data;
  if (data.status !== 'REVIEW' || !data.review) return <DoneView schoolId={schoolId} yearId={yearId} batch={data} result={result} onRestart={onRestart} />;
  const review = data.review;
  const used = review.mapping.filter(Boolean).length;

  return (
    <div className="space-y-5">
      <PageHeader
        schoolId={schoolId}
        subtitle={`${review.fileName} · ${data.rowCount} ${data.rowCount === 1 ? 'fila' : 'filas'} · ${SOURCE_LABEL[data.source]}`}
        action={discarding ? (
          <div className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Cancelar la importación">
            <span className="text-sm text-gray-800 dark:text-gray-100">¿Descartar el archivo y sus correcciones?</span>
            <button type="button" className="pg-btn pg-focus border-red-300 text-red-800 dark:border-red-500/50 dark:text-red-100" onClick={() => discard.mutate()} disabled={discard.isPending}>Descartar</button>
            <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setDiscarding(false)}>Seguir</button>
          </div>
        ) : <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setDiscarding(true)}>Cancelar importación</button>}
      />
      <Steps step={step} details={[`${data.rowCount} ${data.rowCount === 1 ? 'fila' : 'filas'}`, `${used} de ${review.headers.length} usadas`, step >= 3 ? (review.counts.error ? `${review.counts.error} con error` : 'sin errores') : '—', 'y deshacer 24 h']} />
      {step === 2 && <ColumnsStep schoolId={schoolId} yearId={yearId} batch={data} onSaved={update} onBack={onRestart} onContinue={() => setStep(3)} />}
      {step === 3 && <RowsStep schoolId={schoolId} yearId={yearId} batch={data} onSaved={update} onBack={() => setStep(2)} onContinue={() => setStep(4)} />}
      {step === 4 && (
        <ConfirmStep
          schoolId={schoolId}
          yearId={yearId}
          batch={data}
          onBack={() => setStep(3)}
          onDone={(r) => { setResult(r); void queryClient.invalidateQueries({ queryKey: key }); }}
          onStale={() => { setStep(3); void queryClient.invalidateQueries({ queryKey: key }); }}
        />
      )}
    </div>
  );
};

// ==================== 2 · COLUMNAS ====================

const ColumnsStep = ({ schoolId, yearId, batch, onSaved, onBack, onContinue }: {
  schoolId: string; yearId: string; batch: ImportBatch; onSaved: (b: ImportBatch) => void; onBack: () => void; onContinue: () => void;
}) => {
  const review = batch.review!;
  const [mapping, setMapping] = useState(review.mapping);
  const changed = mapping.some((field, i) => field !== review.mapping[i]);
  const save = useMutation({
    mutationFn: () => rosterImportApi.saveMapping(schoolId, yearId, batch.id, mapping),
    onSuccess: (next) => { onSaved(next); onContinue(); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron guardar las columnas')),
  });
  // Un dato va en una sola columna: elegirlo en otra lo quita de donde estaba.
  const setField = (index: number, field: ImportField | null) =>
    setMapping((current) => current.map((f, i) => (i === index ? field : field && f === field ? null : f)));
  const used = mapping.filter(Boolean).length;
  const hasIdentity = mapping.some((f) => f && IDENTITY.includes(f));

  return (
    <section className="space-y-3" aria-labelledby="columns-title">
      <div>
        <h2 id="columns-title" className="text-base font-bold text-gray-900 dark:text-white">¿Qué dato es cada columna?</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">Las reconocimos por sus encabezados. Las columnas que no uses no se importan.</p>
      </div>
      {review.notes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-900/30 dark:text-amber-50">
          {review.notes.map((note) => <li key={note} className="flex items-start gap-2"><Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{note}.</li>)}
        </ul>
      )}
      <div className="pg-surface overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:text-gray-300">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Columna del archivo</th>
              <th scope="col" className="px-3 py-2 font-semibold">Ejemplos</th>
              <th scope="col" className="px-3 py-2 font-semibold">Es</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {review.headers.map((header, i) => {
              const name = header || `Columna ${columnLetter(i)}`;
              const examples = review.samples.map((s) => s[i]).filter(Boolean);
              return (
                <tr key={i} className={mapping[i] ? undefined : 'text-gray-500 dark:text-gray-400'}>
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{name}</td>
                  <td className="max-w-[22rem] px-3 py-2.5"><span className="line-clamp-2 break-words">{examples.length ? examples.join(' · ') : '—'}</span></td>
                  <td className="px-3 py-2.5">
                    <select aria-label={`Qué dato es «${name}»`} value={mapping[i] ?? ''} onChange={(e) => setField(i, (e.target.value || null) as ImportField | null)} className={select}>
                      <option value="">No usar</option>
                      {FIELD_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-sm text-gray-600 dark:text-gray-300">
          {hasIdentity ? `Se usarán ${used} de ${review.headers.length} columnas.` : 'Elige al menos la columna de los nombres, del DNI o del Código Juried.'}
        </p>
        <button type="button" className={cancelButton} onClick={onBack}>Subir otro archivo</button>
        <button type="button" className={primaryButton} disabled={!hasIdentity || save.isPending} onClick={() => (changed ? save.mutate() : onContinue())}>
          {save.isPending ? 'Guardando…' : 'Continuar'}<ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

// ==================== 3 · REVISAR FILAS ====================

const StatusPill = ({ status }: { status: ImportRow['status'] }) => {
  const look = {
    READY: { text: 'Lista', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100', icon: <Check size={12} aria-hidden="true" /> },
    WARNING: { text: 'Aviso', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100', icon: <AlertTriangle size={12} aria-hidden="true" /> },
    ERROR: { text: 'Error', cls: 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100', icon: <X size={12} aria-hidden="true" /> },
    SKIPPED: { text: 'Omitida', cls: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100', icon: null },
  }[status];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${look.cls}`}>{look.icon}{look.text}</span>;
};

const RowsStep = ({ schoolId, yearId, batch, onSaved, onBack, onContinue }: {
  schoolId: string; yearId: string; batch: ImportBatch; onSaved: (b: ImportBatch) => void; onBack: () => void; onContinue: () => void;
}) => {
  const queryClient = useQueryClient();
  const review = batch.review!;
  const counts = review.counts;
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<{ line: number; field: FixValueField } | null>(null);
  const [busyLine, setBusyLine] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const sorted = useMemo(() => [...review.rows].sort(byAttention), [review.rows]);
  const shown = filter === 'all' ? sorted : sorted.filter((r) => r.status === filter);

  const fix = useMutation({
    mutationFn: ({ line, patch }: { line: number; patch: RowFixPatch }) => rosterImportApi.fixRow(schoolId, yearId, batch.id, line, patch),
    onMutate: ({ line }) => setBusyLine(line),
    onSuccess: (next) => { onSaved(next); setEditing(null); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo corregir la fila')),
    onSettled: () => setBusyLine(null),
  });
  const createSection = useMutation({
    mutationFn: (section: NonNullable<ImportIssue['createSection']>) =>
      schoolSectionApi.createMany(schoolId, yearId, [{ level: section.level, grade: section.grade, name: section.name }]),
    onSuccess: async (result) => {
      toast.success(result.message);
      void queryClient.invalidateQueries({ queryKey: schoolSectionKeys.list(schoolId, yearId) });
      onSaved(await rosterImportApi.get(schoolId, yearId, batch.id));
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo crear la sección')),
  });
  const errors = useMutation({
    mutationFn: () => rosterImportApi.downloadErrors(schoolId, yearId, batch.id),
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron descargar las filas con error')),
  });

  // «Ir a la fila 46»: se muestra, se lleva a la vista y se resalta un momento.
  const goTo = (line: number) => {
    const index = sorted.findIndex((r) => r.line === line);
    setFilter('all');
    if (index >= limit) setLimit(index + 1);
    setHighlight(line);
  };
  useEffect(() => {
    if (highlight === null) return;
    const row = document.getElementById(`fila-${highlight}`);
    row?.scrollIntoView({ block: 'center' });
    row?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setHighlight(null), 2500);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  const chips: { id: Filter; label: string; n: number; icon?: ReactNode }[] = [
    { id: 'all', label: 'Todas', n: counts.total },
    { id: 'READY', label: 'Listas', n: counts.ready, icon: <Check size={14} className="text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> },
    { id: 'WARNING', label: 'Con aviso', n: counts.warning, icon: <AlertTriangle size={14} className="text-amber-700 dark:text-amber-300" aria-hidden="true" /> },
    { id: 'ERROR', label: 'Con error', n: counts.error, icon: <X size={14} className="text-red-700 dark:text-red-300" aria-hidden="true" /> },
    { id: 'SKIPPED', label: 'Omitidas', n: counts.skipped },
  ];
  const willImport = importable(counts);
  const changes = counts.create + counts.update;

  return (
    <section className="space-y-4" aria-label="Revisar filas">
      <p className="flex items-start gap-2 rounded-xl border border-gray-200 border-l-4 border-l-primary-600 bg-white p-3 text-sm text-gray-800 dark:border-gray-700 dark:border-l-primary-400 dark:bg-gray-800 dark:text-gray-100">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
        <span>
          <b>{counts.update} {counts.update === 1 ? 'fila completa datos' : 'filas completan datos'}</b> de estudiantes del padrón
          {counts.unchanged > 0 && ` (${counts.unchanged} ya estaban completas)`} y <b>{counts.create} {counts.create === 1 ? 'es un estudiante nuevo' : 'son estudiantes nuevos'}</b>.
          {' '}Corrige aquí mismo o descarga las filas con error, arréglalas en Excel y vuelve a subirlas.
        </span>
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar filas">
        {chips.filter((c) => c.id !== 'SKIPPED' || c.n > 0 || filter === 'SKIPPED').map((c) => (
          <button key={c.id} type="button" className="pg-chip pg-focus" aria-pressed={filter === c.id} onClick={() => { setFilter(c.id); setLimit(PAGE); }}>
            {c.icon}{c.label} <span className="tabular-nums opacity-80">{c.n}</span>
          </button>
        ))}
      </div>

      <div className="pg-surface overflow-hidden">
        {shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-700 dark:text-gray-300">Ninguna fila con ese estado.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Filas del archivo, errores primero</caption>
            <thead className="hidden border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:text-gray-300 md:table-header-group">
              <tr>
                <th scope="col" className="w-14 px-4 py-2 font-semibold">Fila</th>
                <th scope="col" className="px-3 py-2 font-semibold">Apellidos y nombres</th>
                <th scope="col" className="px-3 py-2 font-semibold">DNI</th>
                <th scope="col" className="px-3 py-2 font-semibold">Sección</th>
                <th scope="col" className="px-3 py-2 font-semibold">Nacimiento</th>
                <th scope="col" className="px-3 py-2 font-semibold">Resultado</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Arreglar</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {shown.slice(0, limit).map((row) => (
                <RowItem
                  key={row.line}
                  row={row}
                  sections={review.sections}
                  manyLevels={review.levels.length > 1}
                  busy={busyLine === row.line || fix.isPending}
                  highlight={highlight === row.line}
                  editing={editing?.line === row.line ? editing.field : null}
                  creating={createSection.isPending}
                  onEdit={(field) => setEditing(field ? { line: row.line, field } : null)}
                  onFix={(patch) => fix.mutate({ line: row.line, patch })}
                  onGoTo={goTo}
                  onCreateSection={(section) => createSection.mutate(section)}
                />
              ))}
            </tbody>
          </table>
        )}
        {shown.length > limit && (
          <div className="border-t border-gray-200 p-3 text-center text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
            {shown.length - limit} {shown.length - limit === 1 ? 'fila más' : 'filas más'} ·{' '}
            <button type="button" className="pg-focus rounded font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300" onClick={() => setLimit(limit + PAGE * 4)}>Mostrar más</button>
          </div>
        )}
        <footer className="flex flex-wrap items-center gap-2 border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
          <p className="mr-auto text-sm text-gray-800 dark:text-gray-100">
            <b>Se importarán {willImport}</b> ({counts.ready} {counts.ready === 1 ? 'lista' : 'listas'} + {counts.warning} con aviso)
            {counts.error > 0 && <> · <span className="text-red-800 dark:text-red-200"><b>{counts.error} con error</b> no se importan</span></>}
          </p>
          {counts.error > 0 && (
            <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => errors.mutate()} disabled={errors.isPending}>
              <Download size={16} aria-hidden="true" />Descargar filas con error
            </button>
          )}
          <button type="button" className={cancelButton} onClick={onBack}><ChevronLeft size={16} className="mr-1 inline" aria-hidden="true" />Volver</button>
          <button type="button" className={primaryButton} disabled={changes === 0} onClick={onContinue}>Continuar<ChevronRight size={16} aria-hidden="true" /></button>
        </footer>
      </div>
      {changes === 0 && <p className="text-right text-xs text-gray-600 dark:text-gray-300">No hay nada que importar todavía: corrige las filas con error o sube otro archivo.</p>}
    </section>
  );
};

const RowItem = ({ row, sections, manyLevels, busy, highlight, editing, creating, onEdit, onFix, onGoTo, onCreateSection }: {
  row: ImportRow;
  sections: NonNullable<ImportBatch['review']>['sections'];
  manyLevels: boolean;
  busy: boolean;
  highlight: boolean;
  editing: FixValueField | null;
  creating: boolean;
  onEdit: (field: FixValueField | null) => void;
  onFix: (patch: RowFixPatch) => void;
  onGoTo: (line: number) => void;
  onCreateSection: (section: NonNullable<ImportIssue['createSection']>) => void;
}) => {
  const documentProblem = row.issues.some((i) => i.severity === 'error' && (i.code === 'document_invalid' || i.code === 'document_type'));
  const sectionProblem = row.issues.find((i) => i.code === 'section_unknown' || i.code === 'section_ambiguous');
  const tone = row.status === 'ERROR' ? 'md:shadow-[inset_3px_0_0_#dc2626]' : row.status === 'WARNING' ? 'md:shadow-[inset_3px_0_0_#d97706]' : '';
  const showSectionSource = !!row.section && !!row.sectionText && plain(row.sectionText) !== plain(row.section.label);
  return (
    <>
      <tr id={`fila-${row.line}`} tabIndex={-1} className={`block outline-none md:table-row ${highlight ? 'bg-primary-50 dark:bg-primary-500/10' : ''}`}>
        <td className={`block px-4 pt-3 text-xs tabular-nums text-gray-600 dark:text-gray-300 md:table-cell md:py-2.5 md:align-top md:text-sm ${tone}`}>
          <span className="md:hidden">Fila </span>{row.line}
        </td>
        <td className="block px-4 md:table-cell md:px-3 md:py-2.5 md:align-top">
          <b className={row.status === 'SKIPPED' ? 'text-gray-600 line-through dark:text-gray-300' : 'text-gray-900 dark:text-white'}>{row.name || 'Sin nombre'}</b>
          {row.match && (
            <span className="block text-xs text-gray-600 dark:text-gray-300">
              En el padrón{row.match.section ? ` · ${row.match.section}` : ''} · por {row.match.by === 'CODE' ? 'Código Juried' : row.match.by === 'DOCUMENT' ? 'DNI' : 'nombre'}
            </span>
          )}
          {row.fix?.newPerson && <span className="block text-xs font-semibold text-primary-800 dark:text-primary-200">Elegiste: es otra persona</span>}
        </td>
        <td className="inline-block px-4 py-1 md:table-cell md:px-3 md:py-2.5 md:align-top">
          {documentProblem
            ? <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-red-700 dark:text-red-300"><X size={14} aria-hidden="true" />Revisar</span>
            : row.document ? <span className="font-mono tracking-wider text-gray-800 dark:text-gray-100">{row.document}</span>
              : <span className="text-gray-500 dark:text-gray-400">—</span>}
        </td>
        <td className="inline-block px-2 py-1 md:table-cell md:px-3 md:py-2.5 md:align-top">
          {row.section ? (
            <span className="whitespace-nowrap text-gray-900 dark:text-white">
              {row.section.label}
              {showSectionSource && <span className="block text-xs text-gray-600 dark:text-gray-300">de «{row.sectionText}»</span>}
            </span>
          ) : sectionProblem && row.sectionText
            ? <span className="whitespace-nowrap text-[13px] font-semibold text-red-700 dark:text-red-300">«{row.sectionText}»</span>
            : <span className="text-gray-500 dark:text-gray-400">—</span>}
        </td>
        <td className="inline-block px-2 py-1 tabular-nums md:table-cell md:px-3 md:py-2.5 md:align-top">
          {row.birthDate ? <span className="text-gray-800 dark:text-gray-100">{formatBirthDate(row.birthDate)}</span> : <span className="text-gray-500 dark:text-gray-400">—</span>}
        </td>
        <td className="block px-4 py-1 md:table-cell md:px-3 md:py-2.5 md:align-top">
          <StatusPill status={row.status} />
          {row.status !== 'SKIPPED' && row.issues.map((issue, i) => (
            <span key={`${issue.code}-${i}`} className="mt-1 block text-[13px] text-gray-700 dark:text-gray-200">{sentence(issue.message)}</span>
          ))}
          {row.status !== 'ERROR' && <span className="mt-1 block text-[13px] text-gray-600 dark:text-gray-300">{rowOutcome(row)}</span>}
        </td>
        <td className="block px-4 pb-3 md:table-cell md:px-3 md:py-2.5 md:align-top">
          <FixActions row={row} sections={sections} manyLevels={manyLevels} busy={busy} creating={creating} onEdit={onEdit} onFix={onFix} onGoTo={onGoTo} onCreateSection={onCreateSection} />
        </td>
      </tr>
      {editing && (
        <tr className="block md:table-row">
          <td colSpan={7} className="block md:table-cell">
            <FixEditor row={row} field={editing} busy={busy} onSave={(values) => onFix({ values })} onCancel={() => onEdit(null)} />
          </td>
        </tr>
      )}
    </>
  );
};

const FixActions = ({ row, sections, manyLevels, busy, creating, onEdit, onFix, onGoTo, onCreateSection }: {
  row: ImportRow;
  sections: NonNullable<ImportBatch['review']>['sections'];
  manyLevels: boolean;
  busy: boolean;
  creating: boolean;
  onEdit: (field: FixValueField) => void;
  onFix: (patch: RowFixPatch) => void;
  onGoTo: (line: number) => void;
  onCreateSection: (section: NonNullable<ImportIssue['createSection']>) => void;
}) => {
  if (row.status === 'SKIPPED') {
    return <div className="flex md:justify-end"><button type="button" className="pg-btn pg-focus" disabled={busy} onClick={() => onFix({ skip: false })}>Incluir otra vez</button></div>;
  }
  const hasError = row.issues.some((i) => i.severity === 'error');
  const editable = row.issues.find((i) => i.field && (i.severity === 'error' || i.code === 'name_order' || i.code.endsWith('_invalid')));
  const duplicate = row.issues.find((i) => i.duplicateOf);
  const sectionProblem = row.issues.find((i) => i.code === 'section_unknown' || i.code === 'section_ambiguous' || i.code === 'section_missing');
  const link ='pg-focus rounded text-xs font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300';
  return (
    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
      {editable?.field && (
        <button type="button" className="pg-btn pg-focus" disabled={busy} onClick={() => onEdit(editable.field!)}>
          <Pencil size={14} aria-hidden="true" />Corregir
        </button>
      )}
      {duplicate?.duplicateOf && <button type="button" className="pg-btn pg-focus" onClick={() => onGoTo(duplicate.duplicateOf!)}>Ir a la fila {duplicate.duplicateOf}</button>}
      {sectionProblem && (
        <select aria-label={`Sección de la fila ${row.line}`} className={select} value="" disabled={busy} onChange={(e) => e.target.value && onFix({ sectionId: e.target.value === 'none' ? null : e.target.value })}>
          <option value="">Elegir sección…</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.label}{manyLevels ? ` · ${LEVEL_LABEL[s.level]}` : ''}</option>)}
          <option value="none">Sin sección</option>
        </select>
      )}
      {sectionProblem?.createSection && (
        <button type="button" className="pg-btn pg-btn-ghost pg-focus text-primary-800 dark:text-primary-200" disabled={creating} onClick={() => onCreateSection(sectionProblem.createSection!)}>
          Crear {sectionProblem.createSection.label}
        </button>
      )}
      {row.match?.by === 'NAME' && <button type="button" className="pg-btn pg-btn-ghost pg-focus" disabled={busy} onClick={() => onFix({ newPerson: true })}>No es esta persona</button>}
      {hasError && <button type="button" className="pg-btn pg-btn-ghost pg-focus" disabled={busy} onClick={() => onFix({ skip: true })}>Omitir esta fila</button>}
      {row.fix?.newPerson && <button type="button" className={link} disabled={busy} onClick={() => onFix({ newPerson: false })}>Buscarlo otra vez en el padrón</button>}
      {row.fix && row.fix.sectionId !== 'auto' && <button type="button" className={link} disabled={busy} onClick={() => onFix({ sectionId: 'auto' })}>Usar la sección del archivo</button>}
      {!!row.fix?.corrected.length && (
        <button type="button" className={link} disabled={busy} onClick={() => onFix({ values: Object.fromEntries(row.fix!.corrected.map((f) => [f, null])) })}>Volver al dato del archivo</button>
      )}
    </div>
  );
};

const FixEditor = ({ row, field, busy, onSave, onCancel }: {
  row: ImportRow; field: FixValueField; busy: boolean; onSave: (values: Partial<Record<FixValueField, string>>) => void; onCancel: () => void;
}) => {
  const isName = field === 'lastNames' || field === 'firstNames';
  const issue = row.issues.find((i) => i.field === field);
  const [values, setValues] = useState<Partial<Record<FixValueField, string>>>(() => (isName
    ? { lastNames: row.fileNames.lastNames, firstNames: row.fileNames.firstNames }
    : { [field]: field === 'documentType' ? 'DNI' : field === 'sex' ? 'Mujer' : issue?.value ?? '' }));
  const set = (key: FixValueField, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(values);
  };
  const id = `fix-${row.line}`;
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 bg-gray-50 px-4 py-3 dark:bg-gray-800/60" aria-label={`Corregir la fila ${row.line}`}>
      {isName ? (
        <>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200" htmlFor={`${id}-last`}>
            Apellidos
            <input id={`${id}-last`} className={`${input} mt-1 block w-56`} value={values.lastNames ?? ''} onChange={(e) => set('lastNames', e.target.value)} maxLength={100} autoComplete="off" />
          </label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-200" htmlFor={`${id}-first`}>
            Nombres
            <input id={`${id}-first`} className={`${input} mt-1 block w-48`} value={values.firstNames ?? ''} onChange={(e) => set('firstNames', e.target.value)} maxLength={100} autoComplete="off" />
          </label>
        </>
      ) : field === 'sex' ? (
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-200" htmlFor={id}>
          Sexo
          <select id={id} className={`${select} mt-1 block`} value={values.sex ?? 'Mujer'} onChange={(e) => set('sex', e.target.value)}>
            <option value="Mujer">Mujer</option>
            <option value="Hombre">Hombre</option>
          </select>
        </label>
      ) : field === 'documentType' ? (
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-200" htmlFor={id}>
          Tipo de documento
          <select id={id} className={`${select} mt-1 block`} value={values.documentType ?? 'DNI'} onChange={(e) => set('documentType', e.target.value)}>
            {DOCUMENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      ) : (
        <label className="text-xs font-semibold text-gray-700 dark:text-gray-200" htmlFor={id}>
          {FIX_FIELD_LABEL[field]}
          <input
            id={id}
            className={`${input} mt-1 block w-56`}
            value={values[field] ?? ''}
            onChange={(e) => set(field, e.target.value)}
            inputMode={field === 'documentNumber' ? 'numeric' : undefined}
            placeholder={field === 'birthDate' ? 'dd/mm/aaaa' : field === 'documentNumber' ? 'Número completo' : undefined}
            maxLength={120}
            autoComplete="off"
          />
        </label>
      )}
      <button type="submit" className={primaryButton} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
      <button type="button" className={cancelButton} onClick={onCancel}>Cancelar</button>
    </form>
  );
};

// ==================== 4 · CONFIRMAR ====================

const ConfirmStep = ({ schoolId, yearId, batch, onBack, onDone, onStale }: {
  schoolId: string; yearId: string; batch: ImportBatch; onBack: () => void; onDone: (result: ConfirmResult) => void; onStale: () => void;
}) => {
  const queryClient = useQueryClient();
  const counts = batch.review!.counts;
  const confirm = useMutation({
    mutationFn: () => rosterImportApi.confirm(schoolId, yearId, batch.id, batch.revision),
    onSuccess: (result) => {
      toast.success(result.message);
      void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
      void queryClient.invalidateQueries({ queryKey: rosterImportKeys.current(schoolId, yearId) });
      onDone(result);
    },
    onError: (error) => {
      toast.error(errorMessage(error, 'No se pudo importar'));
      // Si cambió mientras se revisaba (otra sesión, otra pestaña), se vuelve a revisar con lo último.
      if ((error as { response?: { status?: number } })?.response?.status === 409) onStale();
    },
  });
  const left = counts.error + counts.skipped;
  return (
    <section className="pg-surface space-y-4 p-5" aria-labelledby="confirm-title">
      <h2 id="confirm-title" className="text-lg font-bold text-gray-900 dark:text-white">Todo listo para importar</h2>
      <ul className="space-y-1.5 text-sm text-gray-800 dark:text-gray-100">
        {counts.create > 0 && <li>Se agregarán <b>{counts.create} {counts.create === 1 ? 'estudiante nuevo' : 'estudiantes nuevos'}</b> al padrón, con su matrícula del año.</li>}
        {counts.update > 0 && <li>Se completarán datos de <b>{counts.update} {counts.update === 1 ? 'estudiante' : 'estudiantes'}</b> que ya estaban.</li>}
        {counts.unchanged > 0 && <li>{counts.unchanged} {counts.unchanged === 1 ? 'fila ya estaba completa' : 'filas ya estaban completas'}: no cambian.</li>}
        {left > 0 && <li>{left} {left === 1 ? 'fila no se importa' : 'filas no se importan'} ({counts.error} con error, {counts.skipped} {counts.skipped === 1 ? 'omitida' : 'omitidas'}).</li>}
      </ul>
      <p className="flex items-start gap-2 rounded-xl bg-primary-50 p-3 text-sm text-primary-950 dark:bg-primary-500/10 dark:text-primary-50">
        <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>Importar solo completa datos vacíos y da sección a quien aún no tiene. No cambia nombres, documentos ya registrados ni secciones: eso se hace en la ficha o con «Trasladar». <b>Puedes deshacerlo durante 24 horas</b>, mientras nadie cambie a esos estudiantes.</span>
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={cancelButton} onClick={onBack}>Volver</button>
        <button type="button" className={primaryButton} disabled={confirm.isPending || confirm.isSuccess} onClick={() => confirm.mutate()}>
          {confirm.isPending || confirm.isSuccess ? 'Importando…' : 'Importar'}
        </button>
      </div>
    </section>
  );
};

const DoneView = ({ schoolId, yearId, batch, result, onRestart }: { schoolId: string; yearId: string; batch: ImportBatch; result: ConfirmResult | null; onRestart: () => void }) => {
  const errors = useMutation({
    mutationFn: () => rosterImportApi.downloadErrors(schoolId, yearId, batch.id),
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron descargar las filas con error')),
  });
  if (batch.status === 'UNDONE') {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">↩️</span><span className="text-5xl">📋</span><span className="text-4xl">🎒</span></div>
        <h1 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Esta importación se deshizo</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">El padrón volvió a como estaba antes.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className={primaryButton} onClick={onRestart}>Subir otro archivo</button>
          <Link to={`/escuela/${schoolId}/estudiantes`} className="pg-btn pg-focus">Ver estudiantes</Link>
        </div>
      </div>
    );
  }
  const created = result?.created ?? batch.created;
  const updated = result?.updated ?? batch.updated;
  const until = batch.confirmedAt ? new Date(new Date(batch.confirmedAt).getTime() + 86_400_000).toISOString() : null;
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
      <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">✅</span><span className="text-5xl">📋</span><span className="text-4xl">🎉</span></div>
      <h1 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Importación lista</h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">
        {created} {created === 1 ? 'estudiante nuevo' : 'estudiantes nuevos'} y {updated} {updated === 1 ? 'estudiante completado' : 'estudiantes completados'}.
        {until && ` Puedes deshacerla hasta ${whenLabel(until)} desde «Estudiantes».`}
      </p>
      {result && result.errors > 0 && (
        <p className="mx-auto mt-3 max-w-md text-sm text-amber-900 dark:text-amber-100">{result.errors} {result.errors === 1 ? 'fila con error no se importó' : 'filas con error no se importaron'}: descárgalas, corrígelas y vuelve a subirlas.</p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link to={`/escuela/${schoolId}/estudiantes`} className={primaryButton}>Ver estudiantes</Link>
        {(!result || result.errors > 0) && (
          <button type="button" className="pg-btn pg-focus" onClick={() => errors.mutate()} disabled={errors.isPending}>
            <Download size={16} aria-hidden="true" />Descargar filas con error
          </button>
        )}
      </div>
    </div>
  );
};
