import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BookOpen, CalendarCheck, CheckCircle2, Circle, Clock, GraduationCap, UserPlus, Users } from 'lucide-react';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { useSchoolPanelData } from '../../components/schools/useSchoolPanelData';
import { IDLE_DAYS, isIdle } from '../../components/schools/schoolHelpers';
import { currentPeriod, formatDay, formatRange, LEVEL_LABEL, PERIOD_NAME, PERIOD_PLURAL, periodLabel } from '../../components/schools/console/schoolYearHelpers';
import { schoolYearApi, schoolYearKeys } from '../../lib/schoolYearApi';
import { schoolSectionApi, schoolSectionKeys } from '../../lib/schoolSectionApi';
import { schoolRosterApi, schoolRosterKeys } from '../../lib/schoolRosterApi';

const card = 'pg-surface p-4';
const smallBtn = 'pg-btn pg-focus flex-shrink-0';

interface Step {
  title: string;
  detail: string;
  done: boolean;
  action?: { label: string; to: string; quiet?: boolean };
}

/** Inicio de la consola: para la administración, qué atender y cómo preparar el año; para el docente, el año en curso. */
export const SchoolHomePage = () => {
  const navigate = useNavigate();
  const { school, manager, verified, activeYear } = useSchoolConsole();
  const { classrooms, teachers, requests, loadingDetail, loadingTeachers } = useSchoolPanelData(school, manager);
  const year = useQuery({
    queryKey: schoolYearKeys.detail(school.id, activeYear?.id ?? ''),
    queryFn: () => schoolYearApi.get(school.id, activeYear!.id),
    enabled: !!activeYear,
  });
  const sectionsQuery = useQuery({
    queryKey: schoolSectionKeys.list(school.id, activeYear?.id ?? ''),
    queryFn: () => schoolSectionApi.list(school.id, activeYear!.id),
    enabled: manager && !!activeYear,
  });
  const sections = sectionsQuery.data ?? [];
  // Solo los conteos del padrón (primera página, sin filtros).
  const rosterQuery = { filter: 'all' as const, page: 1 };
  const roster = useQuery({
    queryKey: schoolRosterKeys.list(school.id, activeYear?.id ?? '', rosterQuery),
    queryFn: () => schoolRosterApi.list(school.id, activeYear!.id, rosterQuery),
    enabled: manager && !!activeYear,
  });
  const rosterCounts = roster.data?.counts;
  const withoutTutor = sections.filter((s) => !s.tutor);
  const base = `/escuela/${school.id}`;
  const detail = year.data;
  const period = detail ? currentPeriod(detail.periods) : null;
  const students = classrooms.reduce((sum, c) => sum + c.studentCount, 0);
  const idleClasses = classrooms.filter((c) => isIdle(c.lastActivityAt, c.studentCount));
  const teachersWithoutClasses = teachers.filter((t) => !classrooms.some((c) => c.teacherId === t.userId));
  const place = [school.city, school.country].filter(Boolean).join(', ');

  const kpis = [
    { label: 'Docentes', value: loadingTeachers ? '—' : teachers.length, hint: manager && requests.length > 0 ? `${requests.length} ${requests.length === 1 ? 'solicitud' : 'solicitudes'}` : 'en la escuela', icon: Users },
    { label: 'Clases', value: loadingDetail ? '—' : classrooms.length, hint: 'de sus docentes', icon: BookOpen },
    rosterCounts && rosterCounts.all > 0
      ? { label: 'Estudiantes', value: rosterCounts.all, hint: 'en el padrón', icon: GraduationCap }
      : { label: 'Estudiantes', value: loadingDetail ? '—' : students, hint: 'en las clases', icon: GraduationCap },
    {
      label: 'Periodo',
      value: period ? periodLabel(detail!.periodType, period.index) : '—',
      hint: !period ? 'sin año escolar'
        : period.state === 'now' ? `hasta el ${formatDay(period.period.endsOn)}`
          : period.state === 'next' ? `empieza el ${formatDay(period.period.startsOn)}` : 'el año terminó',
      icon: CalendarCheck,
    },
  ];

  const attention = manager ? [
    !activeYear && !year.isLoading && { icon: CalendarCheck, title: 'Prepara el año escolar', detail: 'Fechas, bimestres o trimestres y niveles: lo primero de la consola', action: 'Preparar', to: `${base}/anio` },
    (rosterCounts?.incomplete ?? 0) > 0 && { icon: GraduationCap, title: `${rosterCounts!.incomplete} ${rosterCounts!.incomplete === 1 ? 'estudiante con datos por completar' : 'estudiantes con datos por completar'}`, detail: 'Les falta el DNI o la fecha de nacimiento', action: 'Completar datos', to: `${base}/estudiantes?filtro=incomplete` },
    (rosterCounts?.no_section ?? 0) > 0 && { icon: GraduationCap, title: `${rosterCounts!.no_section} ${rosterCounts!.no_section === 1 ? 'estudiante sin sección' : 'estudiantes sin sección'}`, detail: 'Asígnales su sección desde la ficha', action: 'Ver estudiantes', to: `${base}/estudiantes?filtro=no_section` },
    withoutTutor.length > 0 && { icon: Users, title: `${withoutTutor.length} ${withoutTutor.length === 1 ? 'sección sin tutoría' : 'secciones sin tutoría'}`, detail: 'Elige un tutor en cada tarjeta de sección', action: 'Asignar', to: `${base}/secciones` },
    requests.length > 0 && { icon: UserPlus, title: `${requests.length} ${requests.length === 1 ? 'solicitud para unirse' : 'solicitudes para unirse'}`, detail: 'Docentes que esperan tu respuesta', action: 'Revisar', to: `${base}/docentes` },
    teachersWithoutClasses.length > 0 && { icon: Users, title: `${teachersWithoutClasses.length} ${teachersWithoutClasses.length === 1 ? 'docente sin clases' : 'docentes sin clases'}`, detail: 'Aún no ponen sus clases en la escuela', action: 'Ver docentes', to: `${base}/docentes` },
    idleClasses.length > 0 && { icon: Clock, title: `${idleClasses.length} ${idleClasses.length === 1 ? 'clase' : 'clases'} sin puntos en ${IDLE_DAYS} días`, detail: 'Puede que ya no se usen', action: 'Ver clases', to: `${base}/clases` },
  ].filter(Boolean) as { icon: typeof Users; title: string; detail: string; action: string; to: string }[] : [];

  const steps: Step[] = [
    {
      title: 'Año y periodos',
      detail: detail ? `${detail.periods.length} ${PERIOD_PLURAL[detail.periodType]} · ${formatRange(detail.startsOn, detail.endsOn)}` : 'Fechas, periodos y niveles',
      done: !!detail,
      action: detail ? { label: 'Editar', to: `${base}/anio`, quiet: true } : { label: 'Preparar', to: `${base}/anio` },
    },
    {
      title: 'Grados y secciones',
      detail: sections.length > 0
        ? `${sections.length} ${sections.length === 1 ? 'sección' : 'secciones'} en ${new Set(sections.map((s) => s.level)).size} ${new Set(sections.map((s) => s.level)).size === 1 ? 'nivel' : 'niveles'}`
        : 'Secciones con nombre propio en cada grado',
      done: sections.length > 0,
      action: detail ? (sections.length > 0 ? { label: 'Editar', to: `${base}/secciones`, quiet: true } : { label: 'Crear', to: `${base}/secciones` }) : undefined,
    },
    {
      title: 'Padrón de estudiantes',
      detail: rosterCounts && rosterCounts.all > 0
        ? `${rosterCounts.all} ${rosterCounts.all === 1 ? 'estudiante' : 'estudiantes'}${rosterCounts.incomplete ? ` · ${rosterCounts.incomplete} por completar` : ''}`
        : 'Desde tus clases o con la plantilla',
      done: !!rosterCounts && rosterCounts.all > 0 && rosterCounts.incomplete === 0 && rosterCounts.no_section === 0,
      action: detail ? (rosterCounts && rosterCounts.all > 0 ? { label: rosterCounts.incomplete || rosterCounts.no_section ? 'Continuar' : 'Ver', to: `${base}/estudiantes`, quiet: !(rosterCounts.incomplete || rosterCounts.no_section) } : { label: 'Empezar', to: `${base}/estudiantes` }) : undefined,
    },
    {
      title: 'Tutorías',
      detail: sections.length > 0 ? `${sections.length - withoutTutor.length} de ${sections.length} secciones` : 'Un tutor por sección',
      done: sections.length > 0 && withoutTutor.length === 0,
      action: sections.length > 0 ? (withoutTutor.length === 0 ? { label: 'Editar', to: `${base}/secciones`, quiet: true } : { label: 'Asignar', to: `${base}/secciones` }) : undefined,
    },
    { title: 'Asignaciones', detail: 'Qué docente enseña cada área en cada sección', done: false },
    { title: 'Matrícula automática', detail: 'Pone a cada estudiante en las clases de su sección', done: false },
    { title: 'Acceso con DNI y PIN', detail: 'Código del colegio o QR → DNI → PIN de 4 números', done: false },
  ];
  const ready = steps.filter((s) => s.done).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Inicio</h1>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
          {[school.name, place, activeYear ? `Año escolar ${activeYear.name}` : null].filter(Boolean).join(' · ')}
        </p>
      </header>

      {!verified && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="text-sm text-amber-950 dark:text-amber-100">
            <strong>Tu escuela está pendiente de verificación.</strong> Mientras tanto ves tus clases; la consola completa se activa cuando Juried la verifique.
          </p>
          <button type="button" onClick={() => navigate(`/schools?verificar=${school.id}`)} className="min-h-[44px] flex-shrink-0 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white hover:bg-amber-950">Enviar verificación</button>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={`${card} flex items-start gap-3`}>
            <k.icon size={20} className="mt-0.5 hidden flex-shrink-0 text-primary-700 dark:text-primary-300 sm:block" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{k.label}</dt>
              <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{k.value}</dd>
              <dd className="text-xs text-gray-600 dark:text-gray-300">{k.hint}</dd>
            </div>
          </div>
        ))}
      </dl>

      {manager ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <section className={`${card} lg:col-span-7`} aria-labelledby="pa-title">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-gray-700 dark:text-gray-300" aria-hidden="true" />
              <h2 id="pa-title" className="text-base font-bold text-gray-900 dark:text-white">Por atender</h2>
            </div>
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200"><CheckCircle2 size={16} aria-hidden="true" />Todo al día.</p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {attention.map((a) => (
                  <li key={a.title} className="flex items-center gap-3 py-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100" aria-hidden="true"><a.icon size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">{a.title}</span>
                      <span className="block text-xs text-gray-600 dark:text-gray-300">{a.detail}</span>
                    </span>
                    <Link to={a.to} className={smallBtn}>{a.action}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${card} lg:col-span-5`} aria-labelledby="ck-title">
            <div className="mb-2 flex items-center gap-2">
              <h2 id="ck-title" className="text-base font-bold text-gray-900 dark:text-white">Preparar el año {activeYear?.name ?? new Date().getFullYear()}</h2>
              <span className="ml-auto text-xs text-gray-600 dark:text-gray-300">{ready} de {steps.length} listos</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-label="Pasos listos" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={ready}>
              <div className="h-full rounded-full bg-primary-600 dark:bg-primary-400" style={{ width: `${(ready / steps.length) * 100}%` }} />
            </div>
            <ol className="mt-3 space-y-1">
              {steps.map((step) => (
                <li key={step.title} className="flex items-center gap-3 rounded-lg py-2">
                  {step.done
                    ? <CheckCircle2 size={20} className="flex-shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                    : <Circle size={20} className="flex-shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                      {step.title}
                      <span className="sr-only">{step.done ? ' (listo)' : ' (pendiente)'}</span>
                    </span>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">{step.detail}</span>
                  </span>
                  {step.action ? (
                    step.action.quiet
                      ? <Link to={step.action.to} className="pg-focus flex-shrink-0 rounded text-sm font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">{step.action.label}</Link>
                      : <Link to={step.action.to} className={smallBtn}>{step.action.label}</Link>
                  ) : (
                    <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">Próximamente</span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : verified && (
        <section className={`${card} max-w-2xl`} aria-labelledby="year-title">
          <h2 id="year-title" className="text-base font-bold text-gray-900 dark:text-white">{detail ? `Año escolar ${detail.name}` : 'Año escolar'}</h2>
          {detail ? (
            <>
              <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                {formatRange(detail.startsOn, detail.endsOn)} · {detail.periods.length} {PERIOD_PLURAL[detail.periodType]} · {detail.levels.map((l) => LEVEL_LABEL[l.level]).join(', ')}
              </p>
              <ol className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
                {detail.periods.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="font-semibold text-gray-900 dark:text-white">{PERIOD_NAME[detail.periodType]} {i + 1}</span>
                    {period?.period.id === p.id && period.state === 'now' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">En curso</span>}
                    <span className="ml-auto tabular-nums text-gray-700 dark:text-gray-300">{formatRange(p.startsOn, p.endsOn)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">La administración aún no prepara el año escolar.</p>
          )}
        </section>
      )}
    </div>
  );
};
