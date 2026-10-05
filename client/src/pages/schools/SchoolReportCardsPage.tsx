import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertCircle, Download, Eye, FileText, ImagePlus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { HomeModal } from '../../components/home/HomeModal';
import { cancelButton, inputClass, primaryButton } from '../../components/home/homeHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { LEVEL_LABEL } from '../../components/schools/console/schoolYearHelpers';
import { schoolSectionApi, schoolSectionKeys, type SchoolSection } from '../../lib/schoolSectionApi';
import {
  schoolLogoUrl, schoolReportApi, schoolReportKeys, type PeriodCode, type ReportSettings, type SectionReport,
} from '../../lib/schoolReportApi';
import type { SchoolLevel } from '../../lib/schoolYearApi';

const card = 'pg-surface p-4 sm:p-5';
const select = 'pg-focus min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:w-auto';
const LEVELS: SchoolLevel[] = ['INICIAL', 'PRIMARIA', 'SECUNDARIA'];
const formatDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

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

const periodState = (p: SectionReport['periods'][number]) => (p.locked ? 'Cerrado' : p.started ? 'En curso' : 'Aún no');

/**
 * Libretas (administración): la cabecera del colegio, y por sección y bimestre la libreta de cada estudiante en PDF (el
 * formato del MINEDU que usa el colegio). Se revisa lo que falta: notas y las conclusiones que exige la norma.
 */
export const SchoolReportCardsPage = () => {
  const { school, manager, selectedYear } = useSchoolConsole();
  const [editing, setEditing] = useState(false);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodCode | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const yearId = selectedYear?.id ?? '';

  const settings = useQuery({ queryKey: schoolReportKeys.settings(school.id), queryFn: () => schoolReportApi.settings(school.id), enabled: manager });
  const sections = useQuery({ queryKey: schoolSectionKeys.list(school.id, yearId), queryFn: () => schoolSectionApi.list(school.id, yearId), enabled: manager && !!yearId });
  const sorted = useMemo(() => [...(sections.data ?? [])].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.grade - b.grade || a.name.localeCompare(b.name, 'es')), [sections.data]);
  const levels = useMemo(() => {
    const present = LEVELS.filter((level) => sorted.some((s) => s.level === level));
    return present.length ? present : LEVELS;
  }, [sorted]);
  // Al cambiar de año, la primera sección.
  useEffect(() => { setSectionId(null); setPeriod(null); }, [yearId]);
  const current: SchoolSection | undefined = sorted.find((s) => s.id === sectionId) ?? sorted[0];

  const report = useQuery({
    queryKey: schoolReportKeys.section(school.id, yearId, current?.id ?? '', period),
    queryFn: () => schoolReportApi.section(school.id, yearId, current!.id, period),
    enabled: manager && !!yearId && !!current,
  });
  const data = report.data;

  if (!manager) return <p className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Las libretas las maneja la administración del colegio.</p>;
  if (!selectedYear) return <p className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Aún no hay un año escolar.</p>;

  const download = async (studentId?: string, name?: string) => {
    if (!data || !current) return;
    setBusy(studentId ?? 'section');
    try {
      await schoolReportApi.download(school.id, yearId, current.id, data.upTo, `${name ?? data.section.label} ${data.year.name} ${data.upTo}`, studentId);
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
      await schoolReportApi.open(school.id, yearId, current.id, data.upTo, studentId);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo abrir la libreta'));
    } finally {
      setBusy(null);
    }
  };

  const active = data?.students.filter((s) => s.student.status === 'ACTIVE') ?? [];
  const missingConclusions = data?.students.reduce((sum, s) => sum + s.missing.conclusions, 0) ?? 0;
  const selectedNumber = data?.periods.find((p) => p.code === data.upTo)?.number;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Libretas</h1>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">Informe de progreso del aprendizaje · {selectedYear.name}</p>
      </header>

      {settings.data && <SettingsCard settings={settings.data} onEdit={() => setEditing(true)} />}

      <section className={`${card} space-y-4`} aria-label="Sección y bimestre">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="report-section" className="mb-1 block text-sm font-semibold text-gray-900 dark:text-white">Sección</label>
            <select id="report-section" className={select} value={current?.id ?? ''} disabled={!sorted.length} onChange={(e) => setSectionId(e.target.value)}>
              {levels.filter((level) => sorted.some((s) => s.level === level)).map((level) => (
                <optgroup key={level} label={LEVEL_LABEL[level]}>
                  {sorted.filter((s) => s.level === level).map((s) => (
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
        {data && (
          <div role="radiogroup" aria-label="Bimestre de la libreta" className="flex flex-wrap gap-2">
            {data.periods.map((p) => {
              const checked = p.code === data.upTo;
              return (
                <button key={p.code} type="button" role="radio" aria-checked={checked} disabled={!p.started}
                  onClick={() => setPeriod(p.code)}
                  className={`pg-focus min-h-[44px] rounded-xl border-2 px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100' : 'border-gray-200 text-gray-900 hover:border-gray-300 dark:border-gray-700 dark:text-white'}`}>
                  <span className="block font-bold">Bimestre {p.number}</span>
                  <span className="block text-xs text-gray-600 dark:text-gray-300">{periodState(p)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {sections.data && sorted.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Este año aún no tiene secciones.</p>
      )}
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
              <span><strong>El bimestre {selectedNumber} aún está abierto.</strong> La libreta es una vista previa: sus notas pueden cambiar hasta que lo cierres en «Año escolar».</span>
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
            {data.students.length === 0 ? (
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">Esta sección no tiene estudiantes.</p>
            ) : (
              <ol className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
                {data.students.map((row, index) => {
                  const s = row.student;
                  const name = `${s.lastNames.toLocaleUpperCase('es')}, ${s.firstNames}`;
                  return (
                    <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          <span className="mr-2 tabular-nums text-gray-500 dark:text-gray-400">{index + 1}.</span>{name}
                          {s.status === 'WITHDRAWN' && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">Retiro{s.withdrawnOn ? ` ${formatDay(s.withdrawnOn)}` : ''}</span>}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {[
                            row.missing.grades > 0 ? `${row.missing.grades} ${row.missing.grades === 1 ? 'competencia sin nota' : 'competencias sin nota'}` : 'Con todas sus notas',
                            row.missing.conclusions > 0 ? `${row.missing.conclusions} ${row.missing.conclusions === 1 ? 'conclusión pendiente' : 'conclusiones pendientes'}` : null,
                            !s.siagieCode ? 'sin código SIAGIE' : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 gap-2">
                        <button type="button" className="pg-btn pg-focus" disabled={busy !== null} onClick={() => void open(s.id)} aria-label={`Ver la libreta de ${name}`}>
                          {busy === `open-${s.id}` ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}Ver
                        </button>
                        <button type="button" className="pg-btn pg-focus" disabled={busy !== null} onClick={() => void download(s.id, `${s.lastNames} ${s.firstNames}`)} aria-label={`Descargar la libreta de ${name}`}>
                          {busy === s.id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}PDF
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}

      {editing && settings.data && <SettingsDialog schoolId={school.id} settings={settings.data} levels={levels} onClose={() => setEditing(false)} />}
    </div>
  );
};
