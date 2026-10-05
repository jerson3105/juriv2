import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertCircle, Download, ImagePlus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { HomeModal } from '../../components/home/HomeModal';
import { cancelButton, inputClass, primaryButton } from '../../components/home/homeHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { LEVEL_LABEL } from '../../components/schools/console/schoolYearHelpers';
import { PeriodPicker, ReportStudentList } from '../../components/schools/console/ReportCards';
import { reportName } from '../../components/schools/console/reportCardHelpers';
import { schoolSectionApi, schoolSectionKeys, type SchoolSection } from '../../lib/schoolSectionApi';
import {
  schoolLogoUrl, schoolReportApi, schoolReportKeys, type PeriodCode, type ReportSettings, type StudentReport,
} from '../../lib/schoolReportApi';
import type { SchoolLevel } from '../../lib/schoolYearApi';

const card = 'pg-surface p-4 sm:p-5';
const select = 'pg-focus min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:w-auto';
const LEVELS: SchoolLevel[] = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'];

/** Lo que falta de la cabecera (sin esto la libreta sale con casilleros en blanco). */
const missingHeader = (s: ReportSettings) => [!s.dre && 'DRE', !s.ugel && 'UGEL', !s.directorName && 'director(a)', !s.logoUrl && 'logo'].filter(Boolean) as string[];

const SettingsDialog = ({ schoolId, settings, levels, onClose }: { schoolId: string; settings: ReportSettings; levels: SchoolLevel[]; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    dre: settings.dre ?? '', ugel: settings.ugel ?? '', directorName: settings.directorName ?? '',
    codes: { INICIAL: settings.codes.INICIAL ?? '', PRIMARIA: settings.codes.PRIMARIA ?? '', SECUNDARIA: settings.codes.SECUNDARIA ?? '' },
  });
  const [logo, setLogo] = useState(settings.logoUrl);
  const [busy, setBusy] = useState<'save' | 'logo' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: schoolReportKeys.settings(schoolId) });
    void queryClient.invalidateQueries({ queryKey: ['school-report-section', schoolId] });
  };
  const codeError = (value: string) => (value && !/^\d{7}$/.test(value) ? 'El código modular tiene 7 números' : null);
  const invalid = LEVELS.some((level) => codeError(form.codes[level]));

  const save = async () => {
    setBusy('save');
    try {
      await schoolReportApi.saveSettings(schoolId, {
        dre: form.dre.trim() || null, ugel: form.ugel.trim() || null, directorName: form.directorName.trim() || null,
        codes: { INICIAL: form.codes.INICIAL.trim() || null, PRIMARIA: form.codes.PRIMARIA.trim() || null, SECUNDARIA: form.codes.SECUNDARIA.trim() || null },
      });
      toast.success('Datos de la libreta guardados');
      refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron guardar los datos'));
    } finally {
      setBusy(null);
    }
  };
  const uploadLogo = async (file: File) => {
    setBusy('logo');
    try {
      const { logoUrl } = await schoolReportApi.uploadLogo(schoolId, file);
      setLogo(logoUrl);
      refresh();
      toast.success('Logo guardado');
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar el logo'));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const removeLogo = async () => {
    setBusy('logo');
    try {
      await schoolReportApi.removeLogo(schoolId);
      setLogo(null);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo quitar el logo'));
    } finally {
      setBusy(null);
    }
  };

  const field = (id: string, label: string, value: string, onChange: (v: string) => void, extra: { placeholder?: string; maxLength: number; hint?: string; error?: string | null }) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-900 dark:text-white">{label}</label>
      <input id={id} value={value} maxLength={extra.maxLength} placeholder={extra.placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass}
        aria-invalid={!!extra.error} aria-describedby={extra.hint || extra.error ? `${id}-hint` : undefined} />
      {(extra.error || extra.hint) && <p id={`${id}-hint`} className={`mt-1 text-sm ${extra.error ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-300'}`}>{extra.error ?? extra.hint}</p>}
    </div>
  );

  return (
    <HomeModal
      title="Datos de la libreta"
      subtitle="Van en la cabecera de cada libreta"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
        <button type="button" className={primaryButton} disabled={busy !== null || invalid} onClick={() => void save()}>
          {busy === 'save' && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}Guardar
        </button>
      </>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900/40">
            {logo ? <img src={schoolLogoUrl(logo)} alt="Logo del colegio" className="h-full w-full object-contain" /> : <ImagePlus size={24} className="text-gray-400" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Logo del colegio</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Va a la derecha del título. PNG o JPG, hasta 2 MB.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" id="logo-file"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadLogo(file); }} />
              <label htmlFor="logo-file" className={`pg-btn pg-focus cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
                {busy === 'logo' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
                {logo ? 'Cambiar logo' : 'Subir logo'}
              </label>
              {logo && (
                <button type="button" className="pg-btn pg-focus" disabled={busy !== null} onClick={() => void removeLogo()}>
                  <Trash2 size={16} aria-hidden="true" />Quitar
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('report-dre', 'DRE', form.dre, (v) => setForm((f) => ({ ...f, dre: v })), { maxLength: 120, placeholder: 'DRE Lima Metropolitana' })}
          {field('report-ugel', 'UGEL', form.ugel, (v) => setForm((f) => ({ ...f, ugel: v })), { maxLength: 120, placeholder: 'UGEL 07' })}
        </div>
        {field('report-director', 'Director(a)', form.directorName, (v) => setForm((f) => ({ ...f, directorName: v })), { maxLength: 150, hint: 'Su nombre va bajo la firma del director(a).' })}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 dark:text-white">Código modular de cada nivel</legend>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {settings.modularCode ? `Si un nivel no tiene uno propio, va el del colegio (${settings.modularCode}).` : 'En el Perú cada nivel tiene el suyo (7 números).'}
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {levels.map((level) => field(`report-code-${level}`, LEVEL_LABEL[level], form.codes[level], (v) => setForm((f) => ({ ...f, codes: { ...f.codes, [level]: v.replace(/\D/g, '') } })), {
              maxLength: 7, placeholder: settings.modularCode ?? '0000000', error: codeError(form.codes[level]),
            }))}
          </div>
        </fieldset>
      </div>
    </HomeModal>
  );
};

const SettingsCard = ({ settings, onEdit }: { settings: ReportSettings; onEdit: () => void }) => {
  const missing = missingHeader(settings);
  return (
    <section className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center`} aria-labelledby="report-settings-title">
      <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40" aria-hidden="true">
        {settings.logoUrl ? <img src={schoolLogoUrl(settings.logoUrl)} alt="" className="h-full w-full object-contain" /> : <ImagePlus size={20} className="text-gray-400" />}
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="report-settings-title" className="text-base font-bold text-gray-900 dark:text-white">Cabecera de la libreta</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {[settings.dre, settings.ugel, settings.directorName ? `Director(a): ${settings.directorName}` : null].filter(Boolean).join(' · ') || 'Aún sin DRE, UGEL ni director(a).'}
        </p>
        {missing.length > 0 && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-200">
            <AlertCircle size={16} aria-hidden="true" />Falta: {missing.join(', ')}
          </p>
        )}
      </div>
      <button type="button" className="pg-btn pg-focus flex-shrink-0" onClick={onEdit}><Pencil size={16} aria-hidden="true" />Editar</button>
    </section>
  );
};

type View = 'avance' | 'libretas';

/** Avance de un bimestre: por sección y área, notas puestas de las esperadas y conclusiones pendientes; «Recordar» al docente. */
const ProgressView = ({ schoolId, yearId, period, onPeriod, onOpenSection }: {
  schoolId: string;
  yearId: string;
  period: PeriodCode | null;
  onPeriod: (code: PeriodCode) => void;
  onOpenSection: (sectionId: string, code: PeriodCode) => void;
}) => {
  const [reminding, setReminding] = useState<string | null>(null);
  const query = useQuery({ queryKey: schoolReportKeys.progress(schoolId, yearId, period), queryFn: () => schoolReportApi.progress(schoolId, yearId, period) });
  const data = query.data;

  if (query.isLoading) return <div className="h-48 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Calculando el avance" />;
  if (query.isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">{errorMessage(query.error, 'No se pudo calcular el avance')}</p>
        <button type="button" onClick={() => void query.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>
      </div>
    );
  }
  if (data.sections.length === 0) return <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Este año aún no tiene secciones.</p>;

  const remind = async (sectionId: string, areaId: string) => {
    setReminding(`${sectionId}:${areaId}`);
    try {
      toast.success(await schoolReportApi.remind(schoolId, yearId, { sectionId, areaId, period: data.upTo }));
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo enviar el recordatorio'));
    } finally {
      setReminding(null);
    }
  };
  const all = data.sections.flatMap((s) => s.cells);
  const expected = all.reduce((sum, c) => sum + c.expected, 0);
  const graded = all.reduce((sum, c) => sum + c.graded, 0);
  const pending = all.reduce((sum, c) => sum + c.pending, 0);
  const number = data.periods.find((p) => p.code === data.upTo)?.number;

  return (
    <section className={`${card} space-y-4`} aria-labelledby="progress-title">
      <div>
        <h2 id="progress-title" className="text-base font-bold text-gray-900 dark:text-white">Avance del bimestre {number}</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {graded} de {expected} notas por competencia{pending > 0 ? ` · ${pending} ${pending === 1 ? 'conclusión pendiente' : 'conclusiones pendientes'}` : ''}. No toda competencia se evalúa cada bimestre.
        </p>
      </div>
      <PeriodPicker periods={data.periods} value={data.upTo} onChange={onPeriod} />
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Notas puestas de las esperadas por sección y área en el bimestre {number}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 border-b border-gray-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">Sección</th>
              {data.areas.map((area) => (
                <th key={area.id} scope="col" className="min-w-[6.5rem] border-b border-gray-200 px-2 py-2 text-left align-bottom text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">{area.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sections.map((row) => (
              <tr key={row.id}>
                <th scope="row" className="sticky left-0 z-10 border-b border-gray-100 bg-white px-3 py-2 text-left align-top dark:border-gray-700/60 dark:bg-gray-800">
                  <button type="button" className="pg-focus rounded font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300" onClick={() => onOpenSection(row.id, data.upTo)}>
                    {row.label}
                  </button>
                  <span className="block text-xs font-normal text-gray-600 dark:text-gray-300">{row.students} {row.students === 1 ? 'estudiante' : 'estudiantes'}</span>
                </th>
                {data.areas.map((area) => {
                  const cell = row.cells.find((c) => c.areaId === area.id);
                  if (!cell) return <td key={area.id} className="border-b border-gray-100 px-2 py-2 align-top text-gray-400 dark:border-gray-700/60">—<span className="sr-only">No es del plan de esta sección</span></td>;
                  const missing = Math.max(0, cell.expected - cell.graded);
                  const complete = cell.expected > 0 && missing === 0 && cell.pending === 0;
                  const key = `${row.id}:${area.id}`;
                  return (
                    <td key={area.id} className="border-b border-gray-100 px-2 py-2 align-top dark:border-gray-700/60" title={cell.teacher ? cell.teacher.name : undefined}>
                      <span className={`font-semibold tabular-nums ${complete ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-900 dark:text-white'}`}>
                        {cell.graded}/{cell.expected}{complete && <span className="sr-only"> (completa)</span>}
                      </span>
                      {cell.pending > 0 && <span className="block text-xs text-amber-800 dark:text-amber-200">{cell.pending} sin conclusión</span>}
                      {cell.exempt > 0 && <span className="block text-xs text-gray-600 dark:text-gray-300">{cell.exempt} EXO</span>}
                      {!cell.teacher ? (
                        <span className="block text-xs text-gray-500 dark:text-gray-400">Sin docente</span>
                      ) : !complete && (missing > 0 || cell.pending > 0) ? (
                        <button type="button" className="pg-focus mt-0.5 block rounded text-xs font-semibold text-primary-700 underline-offset-2 hover:underline disabled:opacity-60 dark:text-primary-300"
                          disabled={reminding !== null} onClick={() => void remind(row.id, area.id)} aria-label={`Recordar a ${cell.teacher.name}: ${row.label}, ${area.name}`}>
                          {reminding === key ? 'Enviando…' : 'Recordar'}
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

/** Exoneraciones del año de un estudiante (Religión, Educación Física): su libreta dice «EXO» en esas competencias. */
const ExemptionDialog = ({ schoolId, yearId, yearName, student, exemptable, onClose }: {
  schoolId: string;
  yearId: string;
  yearName: string;
  student: StudentReport;
  exemptable: Array<{ id: string; name: string }>;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(() => new Set(student.areas.filter((a) => a.exempt).map((a) => a.id)));
  const [saving, setSaving] = useState(false);
  const name = reportName(student.student);
  const save = async () => {
    setSaving(true);
    try {
      await schoolReportApi.setExemptions(schoolId, yearId, student.student.id, [...selected]);
      void queryClient.invalidateQueries({ queryKey: ['school-report-section', schoolId] });
      void queryClient.invalidateQueries({ queryKey: ['school-report-progress', schoolId] });
      toast.success('Exoneraciones guardadas');
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron guardar las exoneraciones'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <HomeModal
      title="Exoneraciones"
      subtitle={`${name} · ${yearName}`}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelButton}>Cancelar</button>
        <button type="button" className={primaryButton} disabled={saving} onClick={() => void save()}>
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}Guardar
        </button>
      </>}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm text-gray-800 dark:text-gray-100">Exonerar de:</legend>
        {exemptable.map((area) => (
          <label key={area.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
            <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={selected.has(area.id)}
              onChange={(e) => setSelected((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(area.id); else next.delete(area.id);
                return next;
              })} />
            {area.name}
          </label>
        ))}
      </fieldset>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
        En su libreta, esas competencias dicen «EXO» y no cuentan como faltantes. Guarda el documento que lo sustenta (la solicitud de la familia o el certificado médico).
      </p>
    </HomeModal>
  );
};

/** Lista de libretas de una sección: elegir sección y bimestre, ver o descargar cada una y la de toda la sección. */
const LibretasView = ({ schoolId, yearId, yearName, sections, sectionId, onSection, period, onPeriod }: {
  schoolId: string;
  yearId: string;
  yearName: string;
  sections: SchoolSection[];
  sectionId: string | null;
  onSection: (id: string) => void;
  period: PeriodCode | null;
  onPeriod: (code: PeriodCode) => void;
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [exempting, setExempting] = useState<StudentReport | null>(null);
  const current = sections.find((s) => s.id === sectionId) ?? sections[0];
  const report = useQuery({
    queryKey: schoolReportKeys.section(schoolId, yearId, current?.id ?? '', period),
    queryFn: () => schoolReportApi.section(schoolId, yearId, current!.id, period),
    enabled: !!current,
  });
  const data = report.data;
  const levels = LEVELS.filter((level) => sections.some((s) => s.level === level));

  const download = async (studentId?: string, name?: string) => {
    if (!data || !current) return;
    setBusy(studentId ?? 'section');
    try {
      await schoolReportApi.download(schoolId, yearId, current.id, data.upTo, `${name ?? data.section.label} ${data.year.name} ${data.upTo}`, studentId);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo generar la libreta'));
    } finally {
      setBusy(null);
    }
  };
  const open = async (studentId: string) => {
    if (!data || !current) return;
    setBusy(`open-${studentId}`);
    try {
      await schoolReportApi.open(schoolId, yearId, current.id, data.upTo, studentId);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo abrir la libreta'));
    } finally {
      setBusy(null);
    }
  };

  if (sections.length === 0) return <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Este año aún no tiene secciones.</p>;
  const active = data?.students.filter((s) => s.student.status === 'ACTIVE') ?? [];
  const missingConclusions = data?.students.reduce((sum, s) => sum + s.missing.conclusions, 0) ?? 0;
  const selectedNumber = data?.periods.find((p) => p.code === data.upTo)?.number;

  return (
    <div className="space-y-5">
      <section className={`${card} space-y-4`} aria-label="Sección y bimestre">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="report-section" className="mb-1 block text-sm font-semibold text-gray-900 dark:text-white">Sección</label>
            <select id="report-section" className={select} value={current?.id ?? ''} onChange={(e) => onSection(e.target.value)}>
              {levels.map((level) => (
                <optgroup key={level} label={LEVEL_LABEL[level]}>
                  {sections.filter((s) => s.level === level).map((s) => (
                    <option key={s.id} value={s.id}>{s.level === 'INICIAL' ? `${s.grade} años ${s.name}` : `${s.grade}.° ${s.name}`}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button type="button" className={primaryButton} disabled={!data || active.length === 0 || busy !== null} onClick={() => void download()}>
            {busy === 'section' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
            Libretas de la sección (PDF)
          </button>
        </div>
        {data && <PeriodPicker periods={data.periods} value={data.upTo} onChange={onPeriod} />}
      </section>

      {report.isLoading && <div className="h-48 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Armando las libretas" />}
      {report.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-900/20" role="alert">
          <p className="font-semibold text-red-900 dark:text-red-100">{errorMessage(report.error, 'No se pudieron armar las libretas')}</p>
          <button type="button" onClick={() => void report.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>
        </div>
      )}

      {data && (
        <>
          {data.preview && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-100" role="status">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span><strong>El bimestre {selectedNumber} aún está abierto.</strong> La libreta es una vista previa: sus notas pueden cambiar hasta que lo cierres.</span>
            </p>
          )}
          {!data.documentsReadable && (
            <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100">
              El DNI no sale en la libreta hasta que el servidor tenga las llaves de documentos (avísale al equipo de Juried).
            </p>
          )}
          <section className={card} aria-labelledby="report-students">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="report-students" className="text-base font-bold text-gray-900 dark:text-white">
                {data.section.label} · {active.length} {active.length === 1 ? 'estudiante' : 'estudiantes'}
              </h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {data.section.tutor ? `Tutoría: ${data.section.tutor}` : 'Sin tutor(a)'}
                {missingConclusions > 0 ? ` · ${missingConclusions} ${missingConclusions === 1 ? 'conclusión pendiente' : 'conclusiones pendientes'}` : ''}
              </p>
            </div>
            <ReportStudentList data={data} busy={busy} onOpen={(id) => void open(id)} onDownload={(id, name) => void download(id, name)} onExempt={setExempting} />
          </section>
        </>
      )}

      {exempting && data && (
        <ExemptionDialog schoolId={schoolId} yearId={yearId} yearName={yearName} student={exempting} exemptable={data.exemptable} onClose={() => setExempting(null)} />
      )}
    </div>
  );
};

/**
 * Libretas (administración): la cabecera del colegio; el avance de cada bimestre por sección y área (con «Recordar»); y por
 * sección y bimestre la libreta de cada estudiante en PDF (el formato del MINEDU que usa el colegio), con sus exoneraciones.
 */
export const SchoolReportCardsPage = () => {
  const { school, manager, selectedYear } = useSchoolConsole();
  if (!manager) return <p className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Las libretas las maneja la administración del colegio.</p>;
  if (!selectedYear) return <p className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Aún no hay un año escolar.</p>;
  // Al cambiar de año, todo vuelve a empezar (primera sección, bimestre en curso).
  return <ReportCardsBody key={selectedYear.id} schoolId={school.id} yearId={selectedYear.id} yearName={selectedYear.name} />;
};

const ReportCardsBody = ({ schoolId, yearId, yearName }: { schoolId: string; yearId: string; yearName: string }) => {
  const [view, setView] = useState<View>('avance');
  const [editing, setEditing] = useState(false);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodCode | null>(null);

  const settings = useQuery({ queryKey: schoolReportKeys.settings(schoolId), queryFn: () => schoolReportApi.settings(schoolId) });
  const sections = useQuery({ queryKey: schoolSectionKeys.list(schoolId, yearId), queryFn: () => schoolSectionApi.list(schoolId, yearId) });
  const sorted = useMemo(() => [...(sections.data ?? [])].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.grade - b.grade || a.name.localeCompare(b.name, 'es')), [sections.data]);
  const levels = useMemo(() => {
    const present = LEVELS.filter((level) => sorted.some((s) => s.level === level));
    return present.length ? present : LEVELS;
  }, [sorted]);

  const tabs: Array<{ id: View; label: string }> = [{ id: 'avance', label: 'Avance' }, { id: 'libretas', label: 'Libretas' }];
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Libretas</h1>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">Informe de progreso del aprendizaje · {yearName}</p>
      </header>

      {settings.data && <SettingsCard settings={settings.data} onEdit={() => setEditing(true)} />}

      <div role="tablist" aria-label="Libretas" className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {tabs.map((tab) => (
          <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" aria-selected={view === tab.id} aria-controls={`panel-${tab.id}`}
            onClick={() => setView(tab.id)}
            className={`pg-focus min-h-[44px] flex-1 rounded-lg px-3 text-sm font-semibold ${view === tab.id ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div id={`panel-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`}>
        {sections.isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando las secciones" />
        ) : view === 'avance' ? (
          <ProgressView schoolId={schoolId} yearId={yearId} period={period} onPeriod={setPeriod}
            onOpenSection={(id, code) => { setSectionId(id); setPeriod(code); setView('libretas'); }} />
        ) : (
          <LibretasView schoolId={schoolId} yearId={yearId} yearName={yearName} sections={sorted} sectionId={sectionId} onSection={setSectionId} period={period} onPeriod={setPeriod} />
        )}
      </div>

      {editing && settings.data && <SettingsDialog schoolId={schoolId} settings={settings.data} levels={levels} onClose={() => setEditing(false)} />}
    </div>
  );
};
