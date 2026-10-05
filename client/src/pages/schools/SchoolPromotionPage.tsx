import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, Circle, Lock, RotateCcw } from 'lucide-react';
import { HomeModal } from '../../components/home/HomeModal';
import { cancelButton, primaryButton } from '../../components/home/homeHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { LEVEL_LABEL } from '../../components/schools/console/schoolYearHelpers';
import { SITUATION, SITUATIONS } from '../../components/schools/console/promotionLabels';
import {
  promotionApi, promotionKeys, type FinalSituation, type PromotionSection, type PromotionStudent, type PromotionTarget, type SituationCounts,
} from '../../lib/schoolPromotionApi';
import { schoolYearKeys, type SchoolLevel } from '../../lib/schoolYearApi';

const card = 'pg-surface p-4 sm:p-5';
const select = 'pg-focus min-h-[40px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const STAYS = new Set<FinalSituation>(['PROMOTED', 'REPEATS', 'RECOVERY']);

/** «312 promovidos · 4 permanecen · …» (solo lo que hay). */
const countsLine = (counts: SituationCounts) => SITUATIONS.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${SITUATION[s].plural}`).join(' · ');

const TargetOptions = ({ targets }: { targets: PromotionTarget[] }) => (
  <>
    {[...new Set(targets.map((t) => t.level))].map((level) => (
      <optgroup key={level} label={LEVEL_LABEL[level]}>
        {targets.filter((t) => t.level === level).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </optgroup>
    ))}
  </>
);

/**
 * Promoción y cierre del año (administración). Cada sección pasa a la del grado siguiente (o egresa); se marcan las
 * excepciones por estudiante. Al cerrar, quienes siguen quedan matriculados en el año que se prepara y las clases del año
 * se archivan. Ya cerrado, queda la bandeja de recuperación hasta que el año siguiente empiece.
 */
export const SchoolPromotionPage = () => {
  const { school, manager, years, activeYear } = useSchoolConsole();
  // El año que se promueve: el activo; entre el cierre y el inicio del siguiente, el último cerrado (su bandeja).
  const year = activeYear ?? years.find((y) => y.status === 'CLOSED') ?? null;
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: promotionKeys.overview(school.id, year?.id ?? ''),
    queryFn: () => promotionApi.overview(school.id, year!.id),
    enabled: manager && !!year,
  });
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: promotionKeys.all(school.id, year?.id ?? '') });

  if (!manager) return <p className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">La promoción la maneja la administración del colegio.</p>;
  if (!year) return <p className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Aún no hay un año escolar en curso.</p>;
  if (overview.isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando la promoción" />;
  if (overview.isError || !overview.data) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">{errorMessage(overview.error, 'No se pudo cargar la promoción.')}</p>
        <button type="button" onClick={() => void overview.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>
      </div>
    );
  }
  const data = overview.data;
  const next = data.target?.name ?? String(Number(data.year.name) + 1);
  const closed = data.year.status === 'CLOSED';

  const close = async () => {
    setClosing(true);
    try {
      const { message } = await promotionApi.close(school.id, data.year.id);
      setConfirming(false);
      toast.success(message, { duration: 6000 });
      void queryClient.invalidateQueries({ queryKey: schoolYearKeys.list(school.id) });
      void queryClient.invalidateQueries({ queryKey: ['school-roster', school.id] });
      void queryClient.invalidateQueries({ queryKey: ['school-sections', school.id] });
      refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo cerrar el año'));
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">
            {closed ? `${data.year.name} cerrado` : `Promoción ${data.year.name}`} <ArrowRight size={20} className="inline align-[-2px]" aria-label="a" /> {next}
          </h1>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{countsLine(data.counts) || 'Sin estudiantes matriculados'}</p>
        </div>
        {!closed && (
          <button type="button" className={primaryButton} disabled={!data.closable} onClick={() => setConfirming(true)}>
            <Lock size={16} aria-hidden="true" />Cerrar {data.year.name}
          </button>
        )}
      </header>

      {!data.target && !closed && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-900/20 sm:flex-row sm:items-center" role="status">
          <p className="min-w-0 flex-1 text-sm text-amber-950 dark:text-amber-100"><strong>Primero prepara {next}.</strong> Sus secciones son el destino de cada estudiante.</p>
          <Link to={`/escuela/${school.id}/anio?preparar=1`} className="pg-btn pg-focus flex-shrink-0">Preparar {next}</Link>
        </div>
      )}

      {!closed && data.target && (
        <section className={`${card} grid gap-4 md:grid-cols-2`} aria-label="Antes de cerrar">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Para cerrar {data.year.name}</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {[
                { ok: data.periods.total > 0 && data.periods.locked === data.periods.total, text: `Bimestres cerrados: ${data.periods.locked} de ${data.periods.total}`, link: { to: `/escuela/${school.id}/anio`, label: 'Año escolar' } },
                { ok: data.counts.missing === 0, text: data.counts.missing === 0 ? `Cada estudiante que sigue tiene sección en ${next}` : `${data.counts.missing} ${data.counts.missing === 1 ? 'estudiante sin sección' : 'estudiantes sin sección'} en ${next}` },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-2">
                  {item.ok ? <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> : <Circle size={16} className="flex-shrink-0 text-gray-400" aria-hidden="true" />}
                  <span className="text-gray-900 dark:text-gray-100">{item.text}<span className="sr-only">{item.ok ? ' (listo)' : ' (pendiente)'}</span></span>
                  {!item.ok && item.link && <Link to={item.link.to} className="pg-focus rounded text-sm font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">{item.link.label}</Link>}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Al empezar {next}</h2>
            <p className="mt-2">Cada estudiante entra a sus clases nuevas con su avatar y sus prendas. Empiezan de cero el XP, el nivel, el oro, la Energía, las insignias, las cartas, los clanes y las rachas.</p>
          </div>
        </section>
      )}

      {closed ? (
        <RecoveryTray schoolId={school.id} yearId={data.year.id} next={next} rows={data.recovery} targets={data.targets} onChanged={refresh} />
      ) : (
        <>
          {data.levels.map((level) => (
            <section key={level.level} className={card} aria-labelledby={`lvl-${level.level}`}>
              <h2 id={`lvl-${level.level}`} className="text-base font-bold text-gray-900 dark:text-white">{LEVEL_LABEL[level.level]}</h2>
              <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
                {level.sections.map((section) => (
                  <SectionRow key={section.id} schoolId={school.id} yearId={data.year.id} level={level.level} section={section} targets={data.targets} disabled={!data.target} onChanged={refresh} />
                ))}
              </ul>
            </section>
          ))}
          {data.noSection > 0 && (
            <section className={card} aria-labelledby="no-section">
              <h2 id="no-section" className="text-base font-bold text-gray-900 dark:text-white">Sin sección en {data.year.name} ({data.noSection})</h2>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">Elige su situación y su sección de {next}.</p>
              <StudentsList schoolId={school.id} yearId={data.year.id} sectionKey="sin-seccion" level={null} grade={null} targets={data.targets} disabled={!data.target} onChanged={refresh} />
            </section>
          )}
        </>
      )}

      {confirming && (
        <HomeModal
          title={`¿Cerrar ${data.year.name}?`}
          onClose={() => setConfirming(false)}
          footer={<>
            <button type="button" onClick={() => setConfirming(false)} className={cancelButton}>Cancelar</button>
            <button type="button" className={primaryButton} disabled={closing} onClick={() => void close()}>
              <Lock size={16} aria-hidden="true" />{closing ? 'Cerrando…' : `Cerrar ${data.year.name}`}
            </button>
          </>}
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-100">
            <li>Cada estudiante queda con su situación final: {countsLine(data.counts)}.</li>
            <li>Quienes siguen quedan matriculados en {next}; entran a sus clases cuando {next} empiece.</li>
            <li>Las clases de {data.year.name} y las del colegio sin sección se archivan: quedan para consultar.</li>
            <li>Quienes no continúan o egresan ya no entran con el código del colegio.</li>
            <li>No se puede deshacer. Las recuperaciones se resuelven después, hasta que {next} empiece.</li>
          </ul>
        </HomeModal>
      )}
    </div>
  );
};

const SectionRow = ({ schoolId, yearId, level, section, targets, disabled, onChanged }: {
  schoolId: string; yearId: string; level: SchoolLevel; section: PromotionSection; targets: PromotionTarget[]; disabled: boolean; onChanged: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const value = section.destination.kind === 'GRADUATE' ? 'GRADUATE' : section.destination.sectionId ?? '';
  const save = async (target: string | 'GRADUATE' | null) => {
    setSaving(true);
    try {
      await promotionApi.setSection(schoolId, yearId, section.id, target);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar el destino'));
    } finally {
      setSaving(false);
    }
  };
  const exceptions = SITUATIONS.filter((s) => s !== 'PROMOTED' && s !== 'GRADUATED' && section.counts[s] > 0).map((s) => `${section.counts[s]} ${SITUATION[s].plural}`);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-[7rem] text-sm font-semibold text-gray-900 dark:text-white">{section.label} <span className="font-normal text-gray-600 dark:text-gray-300">({section.students})</span></span>
        <ArrowRight size={16} className="text-gray-500" aria-hidden="true" />
        <select
          aria-label={`Destino de ${section.label}`}
          className={select}
          value={value}
          disabled={disabled || saving}
          onChange={(e) => void save(e.target.value || null)}
        >
          {value === '' && <option value="">Elige su destino</option>}
          <TargetOptions targets={targets} />
          <option value="GRADUATE">Egresan</option>
        </select>
        {section.destination.explicit && (
          <button type="button" className="pg-focus inline-flex min-h-[40px] items-center gap-1 rounded text-sm font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300" disabled={saving} onClick={() => void save(null)}>
            <RotateCcw size={14} aria-hidden="true" />Automático
          </button>
        )}
        {section.counts.missing > 0 && <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">{section.counts.missing} sin sección en el destino</span>}
        {exceptions.length > 0 && <span className="text-xs text-gray-600 dark:text-gray-300">{exceptions.join(' · ')}</span>}
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="pg-focus ml-auto inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700">
          {open ? 'Ocultar' : 'Ver estudiantes'}<ChevronDown size={16} className={open ? 'rotate-180' : ''} aria-hidden="true" />
        </button>
      </div>
      {open && <StudentsList schoolId={schoolId} yearId={yearId} sectionKey={section.id} level={level} grade={section.grade} targets={targets} disabled={disabled} onChanged={onChanged} />}
    </li>
  );
};

const StudentsList = ({ schoolId, yearId, sectionKey, level, grade, targets, disabled, onChanged }: {
  schoolId: string; yearId: string; sectionKey: string; level: SchoolLevel | null; grade: number | null; targets: PromotionTarget[]; disabled: boolean; onChanged: () => void;
}) => {
  const queryClient = useQueryClient();
  const students = useQuery({ queryKey: promotionKeys.section(schoolId, yearId, sectionKey), queryFn: () => promotionApi.sectionStudents(schoolId, yearId, sectionKey) });
  const [saving, setSaving] = useState<string | null>(null);
  const save = async (student: PromotionStudent, situation: FinalSituation | null, targetSectionId?: string | null) => {
    setSaving(student.studentId);
    try {
      await promotionApi.setStudent(schoolId, yearId, student.studentId, situation, targetSectionId);
      void queryClient.invalidateQueries({ queryKey: promotionKeys.section(schoolId, yearId, sectionKey) });
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar'));
    } finally {
      setSaving(null);
    }
  };
  if (students.isLoading) return <p className="mt-2 text-sm text-gray-600 dark:text-gray-300" aria-busy="true">Cargando estudiantes…</p>;
  if (students.isError) return <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">No se pudieron cargar los estudiantes.</p>;
  const rows = students.data ?? [];
  if (rows.length === 0) return <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Sin estudiantes.</p>;
  // Quien permanece sigue en su grado: sus opciones son las secciones de ese grado.
  return (
    <ul className="mt-2 space-y-1 rounded-xl bg-gray-50 p-2 dark:bg-gray-900/40">
      {rows.map((student) => {
        const options = student.situation === 'REPEATS' && level && grade !== null ? targets.filter((t) => t.level === level && t.grade === grade) : targets;
        const busy = disabled || saving === student.studentId;
        return (
          <li key={student.studentId} className="flex flex-wrap items-center gap-2 px-1 py-1">
            <span className="min-w-[12rem] flex-1 text-sm text-gray-900 dark:text-gray-100">{student.name}</span>
            <select
              aria-label={`Situación de ${student.name}`}
              className={select}
              value={student.situation}
              disabled={busy}
              onChange={(e) => void save(student, e.target.value as FinalSituation)}
            >
              {SITUATIONS.map((s) => <option key={s} value={s}>{SITUATION[s].label}{!student.explicit && s === student.situation ? ' (automático)' : ''}</option>)}
            </select>
            {STAYS.has(student.situation) && (
              <select
                aria-label={`Sección de ${student.name} el año siguiente`}
                className={select}
                value={student.target ?? ''}
                disabled={busy}
                onChange={(e) => void save(student, student.situation, e.target.value || null)}
              >
                {!student.target && <option value="">Elige su sección</option>}
                <TargetOptions targets={options} />
              </select>
            )}
            {student.explicit && (
              <button type="button" className="pg-focus inline-flex min-h-[40px] items-center gap-1 rounded text-xs font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300" disabled={busy} onClick={() => void save(student, null)}>
                <RotateCcw size={12} aria-hidden="true" />Automático
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};

/** Ya cerrado: quienes esperan su recuperación. Se resuelven como Promovido o Permanece hasta que el año siguiente empiece. */
const RecoveryTray = ({ schoolId, yearId, next, rows, targets, onChanged }: {
  schoolId: string; yearId: string; next: string; rows: Array<{ studentId: string; name: string; from: string | null; target: string | null; targetLabel: string | null }>;
  targets: PromotionTarget[]; onChanged: () => void;
}) => {
  const [choice, setChoice] = useState<Record<string, { situation: 'PROMOTED' | 'REPEATS'; target: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const resolve = async (studentId: string) => {
    const pick = choice[studentId];
    if (!pick?.target) return;
    setSaving(studentId);
    try {
      await promotionApi.setStudent(schoolId, yearId, studentId, pick.situation, pick.target);
      toast.success('Recuperación resuelta');
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo resolver'));
    } finally {
      setSaving(null);
    }
  };
  return (
    <section className={card} aria-labelledby="recovery-title">
      <h2 id="recovery-title" className="text-base font-bold text-gray-900 dark:text-white">Recuperación</h2>
      {rows.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200"><CheckCircle2 size={16} aria-hidden="true" />No queda ninguna recuperación por resolver.</p>
      ) : (
        <>
          <p className="mt-0.5 flex items-start gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            Están matriculados en {next} de forma provisional. Resuélvelas antes de que {next} empiece.
          </p>
          <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => {
              const pick = choice[row.studentId] ?? { situation: 'PROMOTED' as const, target: row.target ?? '' };
              const set = (patch: Partial<typeof pick>) => setChoice((current) => ({ ...current, [row.studentId]: { ...pick, ...patch } }));
              return (
                <li key={row.studentId} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-[12rem] flex-1 text-sm text-gray-900 dark:text-gray-100">{row.name}{row.from && <span className="text-gray-600 dark:text-gray-300"> · {row.from}</span>}</span>
                  <select aria-label={`Resultado de ${row.name}`} className={select} value={pick.situation} onChange={(e) => set({ situation: e.target.value as 'PROMOTED' | 'REPEATS', target: '' })}>
                    <option value="PROMOTED">{SITUATION.PROMOTED.label}</option>
                    <option value="REPEATS">{SITUATION.REPEATS.label}</option>
                  </select>
                  <select aria-label={`Sección de ${row.name} en ${next}`} className={select} value={pick.target} onChange={(e) => set({ target: e.target.value })}>
                    <option value="">Elige su sección</option>
                    <TargetOptions targets={targets} />
                  </select>
                  <button type="button" className="pg-btn pg-focus" disabled={!pick.target || saving === row.studentId} onClick={() => void resolve(row.studentId)}>Resolver</button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
};
