import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { errorMessage } from '../../components/auth/authHelpers';
import { primaryButton } from '../../components/home/homeHelpers';
import { ageOf, formatWhen, rosterName } from '../../components/schools/console/rosterHelpers';
import { assignmentApi, assignmentKeys, type ClassroomChoice, type MyLoad, type MyLoadAssignment, type Workshop } from '../../lib/schoolAssignmentApi';

const pill = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap';
const PILL = {
  ok: `${pill} bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100`,
  warn: `${pill} bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100`,
  info: `${pill} bg-primary-100 text-primary-900 dark:bg-primary-500/20 dark:text-primary-100`,
};

const statusOf = (a: MyLoadAssignment): { text: string; tone: keyof typeof PILL } => {
  if (!a.classroom) return { text: 'Sin clase', tone: 'warn' };
  if (a.classroom.archived) return { text: 'Clase archivada', tone: 'warn' };
  if (a.missing > 0) return { text: `${a.missing === 1 ? 'Falta 1' : `Faltan ${a.missing}`}`, tone: 'warn' };
  if (a.arrivedToday > 0) return { text: `${a.arrivedToday === 1 ? 'Llegó 1' : `Llegaron ${a.arrivedToday}`} hoy`, tone: 'info' };
  if (a.leftToday > 0) return { text: `${a.leftToday === 1 ? 'Salió 1' : `Salieron ${a.leftToday}`} hoy`, tone: 'info' };
  return { text: 'Al día', tone: 'ok' };
};

/** Mis asignaciones: lo que enseño este año (sección × área) con su clase, y mi tutoría. Para todo el equipo. */
export const SchoolMyAssignmentsPage = () => {
  const { school, activeYear, yearsLoading } = useSchoolConsole();
  const yearId = activeYear?.id ?? '';
  const load = useQuery({ queryKey: assignmentKeys.myLoad(school.id, yearId), queryFn: () => assignmentApi.myLoad(school.id, yearId), enabled: !!activeYear });

  if (yearsLoading || (activeYear && load.isLoading)) return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando tus asignaciones" />;
  if (!activeYear) return <p className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Tus asignaciones aparecen cuando la escuela prepare su año escolar.</p>;
  if (load.isError || !load.data) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">No se pudieron cargar tus asignaciones.</p>
        <button type="button" onClick={() => void load.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>
      </div>
    );
  }
  const data = load.data;
  const sections = new Set(data.assignments.map((a) => a.section.id)).size;
  const byArea = new Map<string, MyLoadAssignment[]>();
  for (const a of data.assignments) byArea.set(a.area.id, [...(byArea.get(a.area.id) ?? []), a]);
  const subtitle = [
    data.assignments.length ? `${data.assignments.length} ${data.assignments.length === 1 ? 'asignación' : 'asignaciones'} en ${sections} ${sections === 1 ? 'sección' : 'secciones'}` : null,
    data.workshops.length ? `${data.workshops.length} ${data.workshops.length === 1 ? 'taller' : 'talleres'}` : null,
    data.tutoring.length ? `Tutoría de ${data.tutoring.map((t) => t.section.label).join(', ')}` : null,
  ].filter(Boolean).join(' · ') || `Año escolar ${activeYear.name}`;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Mis asignaciones</h1>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>
      </header>

      {data.assignments.length === 0 && data.tutoring.length === 0 && data.workshops.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">📚</span><span className="text-5xl">🧑‍🏫</span><span className="text-4xl">🗂️</span></div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Aún no tienes asignaciones</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">La administración te asigna las áreas que enseñas en cada sección. Cuando lo haga, aquí verás tus clases y sus estudiantes.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {[...byArea.values()].map((rows) => <AreaCard key={rows[0].area.id} schoolId={school.id} yearId={yearId} rows={rows} myClasses={data.myClasses} />)}
            {data.workshops.length > 0 && <WorkshopsCard schoolId={school.id} yearId={yearId} workshops={data.workshops} myClasses={data.myClasses} />}
            {data.assignments.length === 0 && data.workshops.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Aún no tienes áreas asignadas.</p>}
          </div>
          <div className="space-y-4 lg:col-span-4">
            {data.tutoring.map((t) => <TutoringCard key={t.section.id} schoolId={school.id} tutoring={t} />)}
          </div>
        </div>
      )}
    </div>
  );
};

const AreaCard = ({ schoolId, yearId, rows, myClasses }: { schoolId: string; yearId: string; rows: MyLoadAssignment[]; myClasses: MyLoad['myClasses'] }) => {
  const titleId = `area-${rows[0].area.id}`;
  return (
    <section className="pg-surface overflow-hidden" aria-labelledby={titleId}>
      <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 id={titleId} className="text-base font-bold text-gray-900 dark:text-white">{rows[0].area.name}</h2>
        <span className="text-sm text-gray-600 dark:text-gray-300">{rows.length} {rows.length === 1 ? 'sección' : 'secciones'}</span>
      </header>
      <table className="w-full text-left text-sm">
        <thead className="hidden text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300 md:table-header-group">
          <tr>
            <th scope="col" className="px-4 py-2 font-semibold">Sección</th>
            <th scope="col" className="px-3 py-2 font-semibold">Clase vinculada</th>
            <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">Acción</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row) => <LoadRow key={row.id} schoolId={schoolId} yearId={yearId} row={row} myClasses={myClasses} />)}
        </tbody>
      </table>
    </section>
  );
};

const LoadRow = ({ schoolId, yearId, row, myClasses }: { schoolId: string; yearId: string; row: MyLoadAssignment; myClasses: MyLoad['myClasses'] }) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'idle' | 'link' | 'create'>('idle');
  const [classroomId, setClassroomId] = useState('');
  const usable = myClasses.filter((c) => !c.linked && (!c.sectionId || c.sectionId === row.section.id) && (!c.areaId || c.areaId === row.area.id));
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.all(schoolId, yearId) });
    void queryClient.invalidateQueries({ queryKey: ['classrooms'] });
  };
  const setClassroom = useMutation({
    mutationFn: (choice: ClassroomChoice) => assignmentApi.setClassroom(schoolId, row.id, choice),
    onSuccess: (result) => {
      refresh();
      toast.success(result.message);
      setStep('idle');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la clase')),
  });
  const sync = useMutation({
    mutationFn: () => assignmentApi.sync(schoolId, row.id),
    onSuccess: (result) => {
      refresh();
      toast.success(result.message);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo sincronizar')),
  });
  const status = statusOf(row);

  return (
    <tr className="block md:table-row">
      <td className="block px-4 pt-3 md:table-cell md:py-2.5">
        <span className="font-bold text-gray-900 dark:text-white">{row.section.label}</span>
        <span className="block text-xs text-gray-600 dark:text-gray-300">{row.students} {row.students === 1 ? 'estudiante' : 'estudiantes'}</span>
      </td>
      <td className="inline-block px-4 py-1 md:table-cell md:px-3 md:py-2.5">
        {row.classroom ? <span className="text-gray-900 dark:text-white">{row.classroom.name}</span> : <span className="text-gray-600 dark:text-gray-300">Ninguna todavía</span>}
      </td>
      <td className="inline-block px-2 py-1 md:table-cell md:px-3 md:py-2.5"><span className={PILL[status.tone]}>{status.text}</span></td>
      <td className="block px-4 pb-3 md:table-cell md:px-3 md:py-2.5">
        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          {row.classroom && !row.classroom.archived && (
            <Link to={`/classroom/${row.classroom.id}`} className="pg-btn pg-focus"><ExternalLink size={14} aria-hidden="true" />Abrir clase</Link>
          )}
          {row.classroom && row.missing > 0 && (
            <button type="button" className="pg-btn pg-focus" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw size={14} aria-hidden="true" />{sync.isPending ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          )}
          {!row.classroom && step === 'idle' && (
            <>
              <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setStep('link')} disabled={usable.length === 0} title={usable.length === 0 ? 'No tienes clases libres de esta sección y área' : undefined}>Vincular</button>
              <button type="button" className="pg-btn pg-focus text-primary-800 dark:text-primary-200" onClick={() => setStep('create')}>Crear clase</button>
            </>
          )}
          {step === 'link' && (
            <>
              <select aria-label={`Clase para ${row.area.name} ${row.section.label}`} className="pg-focus min-h-[40px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
                <option value="">Elige tu clase…</option>
                {usable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" className={primaryButton} disabled={!classroomId || setClassroom.isPending} onClick={() => setClassroom.mutate({ mode: 'link', classroomId })}>Vincular</button>
              <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setStep('idle')}>Cancelar</button>
            </>
          )}
          {step === 'create' && (
            <span className="flex flex-wrap items-center gap-1.5" role="alertdialog" aria-label="Crear clase">
              <span className="text-sm text-gray-800 dark:text-gray-100">¿Crear «{row.area.name} {row.section.label}»?</span>
              <button type="button" className={primaryButton} disabled={setClassroom.isPending} onClick={() => setClassroom.mutate({ mode: 'create' })}>{setClassroom.isPending ? 'Creando…' : 'Crear'}</button>
              <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setStep('idle')}>Cancelar</button>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
};

/** Mis talleres: quiénes lo llevan, su clase y su estado, con las mismas acciones que un área. */
const WorkshopsCard = ({ schoolId, yearId, workshops, myClasses }: { schoolId: string; yearId: string; workshops: Workshop[]; myClasses: MyLoad['myClasses'] }) => (
  <section className="pg-surface overflow-hidden" aria-labelledby="my-workshops">
    <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <h2 id="my-workshops" className="text-base font-bold text-gray-900 dark:text-white">Talleres</h2>
      <span className="text-sm text-gray-600 dark:text-gray-300">{workshops.length}</span>
    </header>
    <table className="w-full text-left text-sm">
      <thead className="hidden text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300 md:table-header-group">
        <tr>
          <th scope="col" className="px-4 py-2 font-semibold">Taller</th>
          <th scope="col" className="px-3 py-2 font-semibold">Clase vinculada</th>
          <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
          <th scope="col" className="px-3 py-2"><span className="sr-only">Acción</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {workshops.map((w) => <WorkshopRow key={w.id} schoolId={schoolId} yearId={yearId} workshop={w} myClasses={myClasses} />)}
      </tbody>
    </table>
  </section>
);

const WorkshopRow = ({ schoolId, yearId, workshop, myClasses }: { schoolId: string; yearId: string; workshop: Workshop; myClasses: MyLoad['myClasses'] }) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'idle' | 'link' | 'create'>('idle');
  const [classroomId, setClassroomId] = useState('');
  const usable = myClasses.filter((c) => !c.linked && !c.sectionId && (!c.areaId || c.areaId === workshop.area.id));
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.all(schoolId, yearId) });
    void queryClient.invalidateQueries({ queryKey: ['classrooms'] });
  };
  const setClassroom = useMutation({
    mutationFn: (choice: ClassroomChoice) => assignmentApi.setWorkshopClassroom(schoolId, workshop.id, choice),
    onSuccess: (result) => {
      refresh();
      toast.success(result.message);
      setStep('idle');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la clase')),
  });
  const sync = useMutation({
    mutationFn: () => assignmentApi.syncWorkshop(schoolId, workshop.id),
    onSuccess: (result) => {
      refresh();
      toast.success(result.message);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo sincronizar')),
  });
  const who = workshop.mode === 'SECTION' ? workshop.sections.map((s) => s.label).join(', ') || 'Sin secciones' : `${workshop.participants} ${workshop.participants === 1 ? 'inscrito' : 'inscritos'}`;
  const status = !workshop.classroom ? { text: 'Sin clase', tone: 'warn' as const }
    : workshop.classroom.archived ? { text: 'Clase archivada', tone: 'warn' as const }
      : workshop.classroom.missing > 0 ? { text: workshop.classroom.missing === 1 ? 'Falta 1' : `Faltan ${workshop.classroom.missing}`, tone: 'warn' as const }
        : { text: 'Al día', tone: 'ok' as const };
  return (
    <tr className="block md:table-row">
      <td className="block px-4 pt-3 md:table-cell md:py-2.5">
        <span className="font-bold text-gray-900 dark:text-white">{workshop.name}</span>
        <span className="block text-xs text-gray-600 dark:text-gray-300">{workshop.area.name} · {who} · {workshop.weight} % del área</span>
      </td>
      <td className="inline-block px-4 py-1 md:table-cell md:px-3 md:py-2.5">
        {workshop.classroom ? <span className="text-gray-900 dark:text-white">{workshop.classroom.name}</span> : <span className="text-gray-600 dark:text-gray-300">Ninguna todavía</span>}
      </td>
      <td className="inline-block px-2 py-1 md:table-cell md:px-3 md:py-2.5"><span className={PILL[status.tone]}>{status.text}</span></td>
      <td className="block px-4 pb-3 md:table-cell md:px-3 md:py-2.5">
        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          {workshop.classroom && !workshop.classroom.archived && (
            <Link to={`/classroom/${workshop.classroom.id}`} className="pg-btn pg-focus"><ExternalLink size={14} aria-hidden="true" />Abrir clase</Link>
          )}
          {workshop.classroom && workshop.classroom.missing > 0 && (
            <button type="button" className="pg-btn pg-focus" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw size={14} aria-hidden="true" />{sync.isPending ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          )}
          {!workshop.classroom && step === 'idle' && (
            <>
              <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setStep('link')} disabled={usable.length === 0} title={usable.length === 0 ? 'No tienes clases libres sin sección de esta área' : undefined}>Vincular</button>
              <button type="button" className="pg-btn pg-focus text-primary-800 dark:text-primary-200" onClick={() => setStep('create')}>Crear clase</button>
            </>
          )}
          {step === 'link' && (
            <>
              <select aria-label={`Clase para ${workshop.name}`} className="pg-focus min-h-[40px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
                <option value="">Elige tu clase…</option>
                {usable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" className={primaryButton} disabled={!classroomId || setClassroom.isPending} onClick={() => setClassroom.mutate({ mode: 'link', classroomId })}>Vincular</button>
              <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setStep('idle')}>Cancelar</button>
            </>
          )}
          {step === 'create' && (
            <span className="flex flex-wrap items-center gap-1.5" role="alertdialog" aria-label="Crear clase">
              <span className="text-sm text-gray-800 dark:text-gray-100">¿Crear «{workshop.name}»?</span>
              <button type="button" className={primaryButton} disabled={setClassroom.isPending} onClick={() => setClassroom.mutate({ mode: 'create' })}>{setClassroom.isPending ? 'Creando…' : 'Crear'}</button>
              <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setStep('idle')}>Cancelar</button>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
};

const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? 'hoy' : formatWhen(iso).replace(/,? \d{1,2}:\d{2}.*$/, '');
};

const TutoringCard = ({ schoolId, tutoring }: { schoolId: string; tutoring: MyLoad['tutoring'][number] }) => {
  const titleId = `tutoring-${tutoring.section.id}`;
  const { coverage } = tutoring;
  return (
    <section className="pg-surface space-y-3 p-4" aria-labelledby={titleId}>
      <h2 id={titleId} className="text-base font-bold text-gray-900 dark:text-white">Mi tutoría · {tutoring.section.label}</h2>
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700">
          <dt className="text-xs font-semibold text-gray-600 dark:text-gray-300">Estudiantes</dt>
          <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{tutoring.students}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700">
          <dt className="text-xs font-semibold text-gray-600 dark:text-gray-300">Datos por completar</dt>
          <dd className={`text-xl font-black tabular-nums ${tutoring.incomplete ? 'text-amber-800 dark:text-amber-200' : 'text-gray-900 dark:text-white'}`}>{tutoring.incomplete}</dd>
        </div>
      </dl>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Esta semana</p>
        {tutoring.arrivals.length === 0 ? (
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">Sin llegadas nuevas.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {tutoring.arrivals.map((a, i) => (
              <li key={`${a.name}-${i}`} className="text-sm">
                <b className="text-gray-900 dark:text-white">Llegó {a.name}</b>
                <span className="block text-xs text-gray-600 dark:text-gray-300">{a.from ? `desde ${a.from} · ` : ''}{dayLabel(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Áreas de {tutoring.section.label}</p>
        <p className={`mt-1 text-sm font-semibold ${coverage.assigned < coverage.required ? 'text-amber-900 dark:text-amber-100' : 'text-emerald-800 dark:text-emerald-200'}`}>
          {coverage.assigned} de {coverage.required} con docente{coverage.missingAreas.length ? ` · ${coverage.missingAreas.length === 1 ? 'falta' : 'faltan'} ${coverage.missingAreas.slice(0, 3).join(', ')}${coverage.missingAreas.length > 3 ? '…' : ''}` : ''}
        </p>
      </div>
      <Link to={`/escuela/${schoolId}/mi-tutoria/${tutoring.section.id}`} className="pg-btn pg-focus w-full">Ver mi sección</Link>
    </section>
  );
};

/** La sección de mi tutoría: estudiantes, si falta DNI o fecha y en cuántas clases están. Sin datos sensibles. */
export const SchoolTutoringPage = () => {
  const { school, activeYear } = useSchoolConsole();
  const { sectionId = '' } = useParams();
  const yearId = activeYear?.id ?? '';
  const section = useQuery({ queryKey: assignmentKeys.tutoring(school.id, yearId, sectionId), queryFn: () => assignmentApi.tutoring(school.id, yearId, sectionId), enabled: !!activeYear && !!sectionId });
  const data = section.data;
  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <Link to={`/escuela/${school.id}/mis-asignaciones`} className="pg-icon-btn pg-focus" aria-label="Volver a Mis asignaciones"><ArrowLeft size={20} aria-hidden="true" /></Link>
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Mi tutoría{data ? ` · ${data.section.label}` : ''}</h1>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{data ? `${data.students.length} ${data.students.length === 1 ? 'estudiante' : 'estudiantes'}${data.section.tutor ? ` · tutoría de ${data.section.tutor}` : ''}` : 'Tu sección'}</p>
        </div>
      </header>
      {section.isLoading && <div className="h-48 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando la sección" />}
      {section.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
          <p className="font-semibold text-red-900 dark:text-red-100">{errorMessage(section.error, 'No se pudo abrir la sección')}</p>
        </div>
      )}
      {data && (data.students.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Aún no hay estudiantes matriculados en esta sección.</p>
      ) : (
        <div className="pg-surface overflow-hidden">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Estudiantes de {data.section.label}</caption>
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:text-gray-300">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Estudiante</th>
                <th scope="col" className="px-3 py-2 font-semibold">DNI</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Edad</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Clases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.students.map((s) => {
                const age = ageOf(s.birthDate);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{rosterName(s)}</td>
                    <td className="px-3 py-2.5">{s.hasDocument ? <span className="text-gray-800 dark:text-gray-100">Registrado</span> : <span className={PILL.warn}>Falta DNI</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{age !== null ? <span className="text-gray-800 dark:text-gray-100">{age}</span> : <span className={PILL.warn}>Falta fecha</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-800 dark:text-gray-100">{s.classes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};
