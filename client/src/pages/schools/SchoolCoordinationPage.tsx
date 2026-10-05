import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { relativeTime } from '../../components/home/homeHelpers';
import { CompetencyDistribution } from '../../components/gradebook/CompetencyDistribution';
import { LEVEL_LABEL } from '../../components/schools/console/schoolYearHelpers';
import { coordinatorApi, coordinatorKeys, type CoordinationClass, type CoordinationPanel } from '../../lib/schoolCoordinatorApi';

const pill = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap';
const PILL = {
  muted: `${pill} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100`,
  warn: `${pill} bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100`,
  info: `${pill} bg-primary-100 text-primary-900 dark:bg-primary-500/20 dark:text-primary-100`,
};
const sectionTitle = 'text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300';
const WEEK_MS = 7 * 86_400_000;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const periodLabel = (period: string) => {
  const m = /^\d{4}-B([1-4])$/.exec(period);
  return m ? `Bimestre ${m[1]}` : period;
};
/** Sin puntos en la última semana (o nunca). */
const quietWeek = (c: CoordinationClass) => !!c.classroom && !c.classroom.archived
  && (!c.gamification?.lastActivityAt || Date.now() - new Date(c.gamification.lastActivityAt).getTime() > WEEK_MS);

/**
 * Mi coordinación: cómo van las clases y talleres de mi área (participación y asistencia de 30 días, avance de notas
 * del bimestre de cada clase). Sin entrar a las clases ni ver a cada estudiante.
 */
export const SchoolCoordinationPage = () => {
  const { school, activeYear, yearsLoading } = useSchoolConsole();
  const [params, setParams] = useSearchParams();
  const yearId = activeYear?.id ?? '';
  const panel = useQuery({ queryKey: coordinatorKeys.panel(school.id, yearId), queryFn: () => coordinatorApi.panel(school.id, yearId), enabled: !!activeYear });

  if (yearsLoading || (activeYear && panel.isLoading)) return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando tu coordinación" />;
  if (!activeYear) return <p className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Tu coordinación aparece cuando la escuela prepare su año escolar.</p>;
  if (panel.isError || !panel.data) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">No se pudo cargar tu coordinación.</p>
        <button type="button" onClick={() => void panel.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>
      </div>
    );
  }
  const { coordinations } = panel.data;
  if (coordinations.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">🧭</span><span className="text-5xl">🧑‍🏫</span><span className="text-4xl">📊</span></div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">No coordinas un área este año</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">La administración nombra al coordinador de cada área en «Docentes». Cuando te nombre, aquí verás cómo van las clases y talleres de tu área.</p>
      </div>
    );
  }
  const current = coordinations.find((c) => c.id === params.get('area')) ?? coordinations[0];
  const choose = (id: string) => {
    const updated = new URLSearchParams(params);
    updated.set('area', id);
    setParams(updated, { replace: true });
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Mi coordinación</h1>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{current.area.name} · {LEVEL_LABEL[current.level]} · Año escolar {panel.data.year.name}</p>
      </header>
      {coordinations.length > 1 && (
        <div className="pg-seg" role="group" aria-label="Área que coordinas">
          {coordinations.map((c) => (
            <button key={c.id} type="button" className="pg-seg-item pg-focus" aria-pressed={c.id === current.id} onClick={() => choose(c.id)}>
              {c.area.shortName ?? c.area.name} · {LEVEL_LABEL[c.level]}
            </button>
          ))}
        </div>
      )}
      <Summary schoolId={school.id} coordination={current} />
      {current.classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Tu área aún no tiene secciones ni talleres asignados en este nivel.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {current.classes.map((c) => <ClassCard key={`${c.kind}-${c.id}`} item={c} />)}
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string | null }) => (
  <li className="pg-surface px-4 py-3">
    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</p>
    <p className="mt-0.5 text-xl font-black tabular-nums text-gray-900 dark:text-white">{value}</p>
    {hint && <p className="text-xs text-gray-600 dark:text-gray-300">{hint}</p>}
  </li>
);

const Summary = ({ schoolId, coordination }: { schoolId: string; coordination: CoordinationPanel['coordinations'][number] }) => {
  const classes = coordination.classes;
  const withClass = classes.filter((c) => c.classroom && !c.classroom.archived);
  const students = withClass.reduce((n, c) => n + c.students, 0);
  const records = withClass.reduce((n, c) => n + (c.attendance?.records ?? 0), 0);
  const attendance = records > 0 ? Math.round(withClass.reduce((n, c) => n + (c.attendance ? c.attendance.rate * c.attendance.records : 0), 0) / records) : null;
  const quiet = withClass.filter(quietWeek).length;
  const sections = classes.filter((c) => c.kind === 'SECTION').length;
  const workshops = classes.length - sections;
  const { behaviors, badges } = coordination.library;
  return (
    <section aria-label="Resumen del área" className="space-y-3">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Clases y talleres"
          value={String(classes.length)}
          hint={[sections ? plural(sections, 'sección', 'secciones') : null, workshops ? plural(workshops, 'taller', 'talleres') : null, classes.length - withClass.length ? `${classes.length - withClass.length} sin clase` : null].filter(Boolean).join(' · ')}
        />
        <Stat label="Estudiantes" value={String(students)} hint="en las clases del área" />
        <Stat label="Asistencia (30 días)" value={attendance === null ? '—' : `${attendance} %`} hint={attendance === null ? 'Sin registros' : 'presentes'} />
        <Stat label="Sin actividad esta semana" value={String(quiet)} hint={quiet === 1 ? 'clase sin puntos en 7 días' : 'clases sin puntos en 7 días'} />
      </ul>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        <span className="flex-1">
          {behaviors + badges > 0
            ? `En la Biblioteca propusiste ${plural(behaviors, 'comportamiento', 'comportamientos')} y ${plural(badges, 'insignia', 'insignias')} para tu área: cada clase muestra cuántos ya usa.`
            : 'Propón comportamientos e insignias para tu área en la Biblioteca: los docentes del área los importan a sus clases.'}
        </span>
        <Link to={`/escuela/${schoolId}/biblioteca`} className="pg-btn pg-focus"><BookOpen size={16} aria-hidden="true" />Ir a la Biblioteca</Link>
      </div>
    </section>
  );
};

const ClassCard = ({ item }: { item: CoordinationClass }) => {
  const titleId = `coord-class-${item.kind}-${item.id}`;
  const g = item.gamification;
  const a = item.attendance;
  const last = g?.lastActivityAt ? relativeTime(g.lastActivityAt) : null;
  return (
    <section className="pg-surface overflow-hidden" aria-labelledby={titleId}>
      <header className="flex flex-wrap items-start gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-bold text-gray-900 dark:text-white">
            {item.label}
            {item.kind === 'WORKSHOP' && item.detail && <span className="font-normal text-gray-600 dark:text-gray-300"> · {item.detail}</span>}
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {[item.teacher.name, item.classroom?.name, item.classroom ? plural(item.students, 'estudiante', 'estudiantes') : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        {item.kind === 'WORKSHOP' && <span className={PILL.info}>Taller</span>}
        {!item.classroom && <span className={PILL.warn}>Sin clase</span>}
        {item.classroom?.archived && <span className={PILL.warn}>Clase archivada</span>}
        {quietWeek(item) && <span className={PILL.muted}>Sin puntos esta semana</span>}
      </header>
      {!item.classroom ? (
        <p className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">Aún no tiene clase en Juried: su docente la crea o la vincula desde «Mis asignaciones».</p>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <div className="space-y-1.5">
            <h3 className={sectionTitle}>Participación · 30 días</h3>
            {g && (g.positive30 + g.negative30 + g.xp30 + g.badges30 > 0) ? (
              <>
                <p className="text-sm text-gray-900 dark:text-white">
                  <b className="tabular-nums">{g.xp30.toLocaleString('es-PE')} XP</b>
                  {` · ${plural(g.positive30, 'reconocimiento', 'reconocimientos')}`}
                  {g.negative30 ? ` · ${plural(g.negative30, 'llamada de atención', 'llamadas de atención')}` : ''}
                  {g.badges30 ? ` · ${plural(g.badges30, 'insignia', 'insignias')}` : ''}
                </p>
                {g.top.length > 0 && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">Más usados: {g.top.map((t) => `${t.icon ? `${t.icon} ` : ''}${t.name} (${t.count})`).join(' · ')}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">Sin puntos en los últimos 30 días.</p>
            )}
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {last ? `Última actividad ${last}` : 'Aún sin actividad'}
              {g && (g.imported.behaviors + g.imported.badges > 0) ? ` · Usa de tu área: ${[g.imported.behaviors ? plural(g.imported.behaviors, 'comportamiento', 'comportamientos') : null, g.imported.badges ? plural(g.imported.badges, 'insignia', 'insignias') : null].filter(Boolean).join(' y ')}` : ''}
            </p>
          </div>
          <div className="space-y-1">
            <h3 className={sectionTitle}>Asistencia · 30 días</h3>
            <p className="text-sm text-gray-900 dark:text-white">
              {a ? (
                <>
                  <b className="tabular-nums">{a.rate} % presentes</b>
                  {` en ${plural(a.days, 'día', 'días')}`}
                  {a.late ? ` · ${plural(a.late, 'tardanza', 'tardanzas')}` : ''}
                  {a.absent ? ` · ${plural(a.absent, 'falta', 'faltas')}` : ''}
                </>
              ) : 'Sin registros de asistencia.'}
            </p>
          </div>
          <div className="space-y-2">
            <h3 className={sectionTitle}>Avance de notas{item.grades ? ` · ${periodLabel(item.grades.period)}${item.grades.isClosed ? ' (cerrado)' : ''}` : ''}</h3>
            <Grades item={item} />
          </div>
        </div>
      )}
    </section>
  );
};

const Grades = ({ item }: { item: CoordinationClass }) => {
  const grades = item.grades;
  if (!item.classroom?.usesGrades) return <p className="text-sm text-gray-700 dark:text-gray-300">Esta clase no usa calificaciones por competencias.</p>;
  if (!grades) return <p className="text-sm text-gray-700 dark:text-gray-300">Clase archivada: sin notas que mostrar.</p>;
  if (grades.competencies.length === 0) return <p className="text-sm text-gray-700 dark:text-gray-300">La clase aún no eligió sus competencias.</p>;
  if (grades.competencies.every((c) => c.graded === 0)) return <p className="text-sm text-gray-700 dark:text-gray-300">Aún sin notas en este bimestre.</p>;
  return (
    <CompetencyDistribution
      caption="Cuántos estudiantes van en cada nivel de logro, según el último cálculo del registro."
      rows={grades.competencies.map((c) => ({
        id: c.id,
        code: c.code,
        title: `${c.shortName ?? c.name ?? 'Competencia'}${c.average ? ` · promedio ${c.average.label}` : ''}`,
        counts: c.distribution,
        missing: Math.max(0, grades.students - c.graded),
      }))}
    />
  );
};
