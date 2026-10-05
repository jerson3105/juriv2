import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download, Eye, FileText, Loader2, ShieldOff } from 'lucide-react';
import { errorMessage } from '../../auth/authHelpers';
import { schoolReportApi, schoolReportKeys, type PeriodCode, type ReportPeriod, type SectionReport, type StudentReport } from '../../../lib/schoolReportApi';
import { formatDay, periodState, reportName } from './reportCardHelpers';

/** Piezas de las libretas que comparten la administración («Libretas») y el tutor («Mi tutoría»). */

/** Bimestre de la libreta: los que aún no empiezan no se eligen. */
export const PeriodPicker = ({ periods, value, onChange }: { periods: ReportPeriod[]; value: PeriodCode; onChange: (code: PeriodCode) => void }) => (
  <div role="radiogroup" aria-label="Bimestre de la libreta" className="flex flex-wrap gap-2">
    {periods.map((p) => {
      const checked = p.code === value;
      return (
        <button key={p.code} type="button" role="radio" aria-checked={checked} disabled={!p.started}
          onClick={() => onChange(p.code)}
          className={`pg-focus min-h-[44px] rounded-xl border-2 px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'border-primary-600 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-100' : 'border-gray-200 text-gray-900 hover:border-gray-300 dark:border-gray-700 dark:text-white'}`}>
          <span className="block font-bold">Bimestre {p.number}</span>
          <span className="block text-xs text-gray-600 dark:text-gray-300">{periodState(p)}</span>
        </button>
      );
    })}
  </div>
);

interface StudentListProps {
  data: SectionReport;
  /** Qué acción está en curso: «open-<id>», «<id>» (PDF) o null. */
  busy: string | null;
  onOpen: (studentId: string) => void;
  onDownload: (studentId: string, name: string) => void;
  /** Solo la administración marca exoneraciones. */
  onExempt?: (student: StudentReport) => void;
}

/** Los estudiantes de la sección con lo que le falta a su libreta, «Ver» (abre el PDF) y «PDF». */
export const ReportStudentList = ({ data, busy, onOpen, onDownload, onExempt }: StudentListProps) => {
  if (data.students.length === 0) return <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">Esta sección no tiene estudiantes.</p>;
  return (
    <ol className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
      {data.students.map((row, index) => {
        const s = row.student;
        const name = reportName(s);
        const exempt = row.areas.filter((a) => a.exempt).map((a) => a.name);
        return (
          <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                <span className="mr-2 tabular-nums text-gray-500 dark:text-gray-400">{index + 1}.</span>{name}
                {s.status === 'WITHDRAWN' && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">Retiro{s.withdrawnOn ? ` ${formatDay(s.withdrawnOn)}` : ''}</span>}
                {exempt.map((area) => (
                  <span key={area} className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100">EXO · {area}</span>
                ))}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {[
                  row.missing.grades > 0 ? `${row.missing.grades} ${row.missing.grades === 1 ? 'competencia sin nota' : 'competencias sin nota'}` : 'Con todas sus notas',
                  row.missing.conclusions > 0 ? `${row.missing.conclusions} ${row.missing.conclusions === 1 ? 'conclusión pendiente' : 'conclusiones pendientes'}` : null,
                  !s.siagieCode ? 'sin código SIAGIE' : null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap gap-2">
              {onExempt && data.exemptable.length > 0 && s.status === 'ACTIVE' && (
                <button type="button" className="pg-btn pg-focus" disabled={busy !== null} onClick={() => onExempt(row)} aria-label={`Exoneraciones de ${name}`}>
                  <ShieldOff size={16} aria-hidden="true" />Exonerar
                </button>
              )}
              <button type="button" className="pg-btn pg-focus" disabled={busy !== null} onClick={() => onOpen(s.id)} aria-label={`Ver la libreta de ${name}`}>
                {busy === `open-${s.id}` ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}Ver
              </button>
              <button type="button" className="pg-btn pg-focus" disabled={busy !== null} onClick={() => onDownload(s.id, `${s.lastNames} ${s.firstNames}`)} aria-label={`Descargar la libreta de ${name}`}>
                {busy === s.id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}PDF
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

/** «Mi tutoría»: las libretas de la sección del tutor, para revisarlas antes de que se publiquen (sin el DNI). */
export const TutorReportCards = ({ schoolId, yearId, sectionId }: { schoolId: string; yearId: string; sectionId: string }) => {
  const [period, setPeriod] = useState<PeriodCode | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const report = useQuery({
    queryKey: schoolReportKeys.section(schoolId, yearId, sectionId, period),
    queryFn: () => schoolReportApi.section(schoolId, yearId, sectionId, period),
  });
  const data = report.data;
  const run = async (key: string, action: () => Promise<void>, fallback: string) => {
    setBusy(key);
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error, fallback));
    } finally {
      setBusy(null);
    }
  };
  if (report.isError) return null;
  return (
    <section className="pg-surface space-y-4 p-4 sm:p-5" aria-labelledby="tutor-report-cards">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="tutor-report-cards" className="text-base font-bold text-gray-900 dark:text-white">Libretas de la sección</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">Revísalas antes de que se publiquen; si algo no cuadra, avísale a la administración o al docente del área.</p>
        </div>
        {data && (
          <button type="button" className="pg-btn pg-focus" disabled={busy !== null || data.students.every((s) => s.student.status !== 'ACTIVE')}
            onClick={() => void run('section', () => schoolReportApi.download(schoolId, yearId, sectionId, data.upTo, `${data.section.label} ${data.year.name} ${data.upTo}`), 'No se pudo generar la libreta')}>
            {busy === 'section' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}Todas (PDF)
          </button>
        )}
      </div>
      {report.isLoading && <div className="h-24 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Armando las libretas" />}
      {data && (
        <>
          <PeriodPicker periods={data.periods} value={data.upTo} onChange={setPeriod} />
          {data.preview && <p className="text-sm text-amber-900 dark:text-amber-100">El bimestre aún está abierto: es una vista previa y sus notas pueden cambiar.</p>}
          <ReportStudentList
            data={data}
            busy={busy}
            onOpen={(id) => void run(`open-${id}`, () => schoolReportApi.open(schoolId, yearId, sectionId, data.upTo, id), 'No se pudo abrir la libreta')}
            onDownload={(id, name) => void run(id, () => schoolReportApi.download(schoolId, yearId, sectionId, data.upTo, `${name} ${data.year.name} ${data.upTo}`, id), 'No se pudo generar la libreta')}
          />
        </>
      )}
    </section>
  );
};
