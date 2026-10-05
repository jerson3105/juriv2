import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowRight, CalendarPlus, Info, Lock, LockOpen, PlayCircle, Shuffle, Trash2 } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { HomeModal } from '../../components/home/HomeModal';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { useSchoolPanelData } from '../../components/schools/useSchoolPanelData';
import { useYearFill } from '../../components/schools/console/useYearFill';
import { cancelButton, primaryButton } from '../../components/home/homeHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import {
  defaultYearDates, LEVEL_LABEL, LEVELS, PERIOD_NAME, reviewYear, splitPeriods, weeksOf,
} from '../../components/schools/console/schoolYearHelpers';
import {
  schoolYearApi, schoolYearKeys, type GradeScale, type PeriodType, type SchoolLevel, type SchoolYearDetail, type SchoolYearInput,
  type YearCopyOptions, type YearCopySummary,
} from '../../lib/schoolYearApi';

type LevelDraft = Record<SchoolLevel, { on: boolean; scale: GradeScale }>;
type CopyChoice = Omit<YearCopyOptions, 'yearId'>;

// «12 oct»: de una fecha AAAA-MM-DD o un instante ISO.
const shortDay = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
const localToday = () => new Date().toLocaleDateString('en-CA');
interface Draft {
  name: string;
  startsOn: string;
  endsOn: string;
  periodType: PeriodType;
  periods: SchoolYearInput['periods'];
  levels: LevelDraft;
}

const card = 'pg-surface p-4 sm:p-5';
const SCALES: { id: GradeScale; label: string }[] = [
  { id: 'LITERAL', label: 'Literal (AD, A, B, C)' },
  { id: 'VIGESIMAL', label: 'Vigesimal (0 a 20)' },
];
const ALL_COPIED: CopyChoice = { sections: true, tutors: true, plan: true, assignments: true, workshops: true, coordinators: true };
const COPY_ITEMS: Array<{ key: keyof CopyChoice; label: string; hint: string }> = [
  { key: 'sections', label: 'Grados y secciones', hint: 'Los mismos nombres y turnos' },
  { key: 'tutors', label: 'Tutorías', hint: 'Cada sección con su tutor, si sigue en el equipo' },
  { key: 'plan', label: 'Plan de estudios', hint: 'Las áreas de cada grado' },
  { key: 'assignments', label: 'Asignaciones', hint: 'Qué docente enseña cada área; las clases se crean después' },
  { key: 'workshops', label: 'Talleres', hint: 'Sin inscritos: se eligen cada año' },
  { key: 'coordinators', label: 'Coordinaciones de área', hint: 'Si la persona sigue en el equipo' },
];

const toInput = (draft: Draft): SchoolYearInput => ({
  startsOn: draft.startsOn,
  endsOn: draft.endsOn,
  periodType: draft.periodType,
  periods: draft.periods,
  levels: LEVELS.filter((level) => draft.levels[level].on).map((level) => ({ level, gradeScale: draft.levels[level].scale })),
});

const levelsOf = (year: SchoolYearDetail) => Object.fromEntries(LEVELS.map((level) => {
  const found = year.levels.find((l) => l.level === level);
  return [level, { on: !!found, scale: found?.gradeScale ?? 'LITERAL' }];
})) as LevelDraft;

const fromYear = (year: SchoolYearDetail): Draft => ({
  name: year.name,
  startsOn: year.startsOn,
  endsOn: year.endsOn,
  periodType: year.periodType,
  periods: year.periods.map((p) => ({ code: p.code, startsOn: p.startsOn, endsOn: p.endsOn })),
  levels: levelsOf(year),
});

/** Año nuevo: fechas típicas, bimestres repartidos y los niveles que ya aparecen en las clases (o los tres). */
const newDraft = (gradeLevels: Array<string | null>): Draft => {
  const year = new Date().getFullYear();
  const dates = defaultYearDates(year);
  const seen = new Set(gradeLevels.map((g) => g?.split('_')[0]).filter(Boolean));
  return {
    name: String(year),
    ...dates,
    periodType: 'BIMESTER',
    periods: splitPeriods(dates.startsOn, dates.endsOn, 'BIMESTER'),
    levels: Object.fromEntries(LEVELS.map((level) => [level, { on: seen.size === 0 || seen.has(level), scale: 'LITERAL' }])) as LevelDraft,
  };
};

/** El año siguiente a otro: sus fechas típicas, bimestres repartidos y los mismos niveles con su escala. */
const nextDraft = (source: SchoolYearDetail): Draft => {
  const name = String(Number(source.name) + 1);
  const dates = defaultYearDates(Number(name));
  return { name, ...dates, periodType: 'BIMESTER', periods: splitPeriods(dates.startsOn, dates.endsOn, 'BIMESTER'), levels: levelsOf(source) };
};

/** «12 secciones, 30 asignaciones y 4 coordinaciones» (lo que se copió). */
const copiedSummary = (copied: YearCopySummary) => {
  const parts = [
    copied.sections && `${copied.sections} ${copied.sections === 1 ? 'sección' : 'secciones'}`,
    copied.tutors && `${copied.tutors} ${copied.tutors === 1 ? 'tutoría' : 'tutorías'}`,
    copied.planLevels && `el plan de ${copied.planLevels} ${copied.planLevels === 1 ? 'nivel' : 'niveles'}`,
    copied.assignments && `${copied.assignments} ${copied.assignments === 1 ? 'asignación' : 'asignaciones'}`,
    copied.workshops && `${copied.workshops} ${copied.workshops === 1 ? 'taller' : 'talleres'}`,
    copied.coordinators && `${copied.coordinators} ${copied.coordinators === 1 ? 'coordinación' : 'coordinaciones'}`,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
};

const Loading = () => <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando el año escolar" />;
const LoadError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
    <p className="font-semibold text-red-900 dark:text-red-100">No se pudo cargar el año escolar.</p>
    <button type="button" onClick={onRetry} className="pg-btn pg-focus mt-3">Reintentar</button>
  </div>
);

/**
 * Año escolar: fechas, bimestres (con reparto automático) y niveles con su escala. Por ahora sin trimestres: Calificaciones
 * va por bimestres. La administración cierra y reabre cada bimestre en todas las clases del año, y prepara el año
 * siguiente como borrador mientras el actual sigue en curso (copiando su estructura).
 */
export const SchoolYearPage = () => {
  const { school, manager, years, selectedYear, activeYear, yearsLoading, selectYear } = useSchoolConsole();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [starting, setStarting] = useState<'confirm' | 'busy' | null>(null);
  // Lo llena el año recién iniciado (el que se miraba, en preparación hasta ese momento).
  const fill = useYearFill(school.id, selectedYear?.id ?? null);
  const { classrooms, loadingDetail } = useSchoolPanelData(school, manager);
  // El siguiente se prepara después del último (la lista llega del más nuevo al más antiguo), uno a la vez.
  const latest = years[0] ?? null;
  const planning = years.find((y) => y.status === 'PLANNING') ?? null;
  const canPrepare = manager && !!latest && !planning;
  const preparing = canPrepare && params.get('preparar') === '1';
  const year = useQuery({
    queryKey: schoolYearKeys.detail(school.id, selectedYear?.id ?? ''),
    queryFn: () => schoolYearApi.get(school.id, selectedYear!.id),
    enabled: !!selectedYear && !preparing,
  });
  const source = useQuery({
    queryKey: schoolYearKeys.detail(school.id, latest?.id ?? ''),
    queryFn: () => schoolYearApi.get(school.id, latest!.id),
    enabled: preparing,
  });
  const stopPreparing = () => {
    const next = new URLSearchParams(params);
    next.delete('preparar');
    setParams(next, { replace: true });
  };

  if (preparing) {
    if (source.isLoading) return <Loading />;
    if (source.isError || !source.data) return <LoadError onRetry={() => void source.refetch()} />;
    return (
      <YearForm
        key={`next:${source.data.id}`}
        year={null}
        prepareFrom={source.data}
        manager={manager}
        gradeLevels={[]}
        onCreated={(id) => {
          selectYear(id);
          stopPreparing();
        }}
        onCancel={stopPreparing}
      />
    );
  }
  if (yearsLoading || (selectedYear && year.isLoading) || (!selectedYear && loadingDetail)) return <Loading />;
  if (selectedYear && year.isError) return <LoadError onRetry={() => void year.refetch()} />;
  // El aviso aparece desde el último bimestre (o con el año ya cerrado); antes, «Preparar» está en el selector de año.
  const lastStart = year.data?.periods[year.data.periods.length - 1]?.startsOn;
  const offerNext = canPrepare && selectedYear?.id === latest?.id && (latest?.status === 'CLOSED' || (!!lastStart && lastStart <= localToday()));
  // Con el anterior cerrado, el año en preparación se inicia cuando empiezan las clases.
  const offerStart = manager && selectedYear?.status === 'PLANNING' && !activeYear;
  const start = async () => {
    setStarting('busy');
    try {
      const message = await schoolYearApi.start(school.id, selectedYear!.id);
      setStarting(null);
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: schoolYearKeys.list(school.id) });
      void queryClient.invalidateQueries({ queryKey: schoolYearKeys.detail(school.id, selectedYear!.id) });
      await fill.run();
    } catch (error) {
      setStarting('confirm');
      toast.error(errorMessage(error, 'No se pudo iniciar el año'));
    }
  };
  // Con el año siguiente preparado, el año en curso se cierra desde su último bimestre (promoción); ya cerrado, su bandeja.
  const offerClose = manager && !!planning && ((selectedYear?.status === 'ACTIVE' && !!lastStart && lastStart <= localToday()) || selectedYear?.status === 'CLOSED');
  // La clave remonta el formulario al guardar (el año guardado pasa a ser el punto de partida).
  return (
    <div className="space-y-5">
      {offerNext && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-500/40 dark:bg-primary-900/20 sm:flex-row sm:items-center">
          <CalendarPlus size={22} className="hidden flex-shrink-0 text-primary-700 dark:text-primary-300 sm:block" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">
            <strong>Prepara {Number(latest!.name) + 1} sin apuro.</strong> Copia secciones, plan, asignaciones, talleres y coordinaciones de {latest!.name}, y crea sus clases para que los docentes las preparen. Los estudiantes entran cuando {Number(latest!.name) + 1} empiece.
          </p>
          <button
            type="button"
            className={`${primaryButton} flex-shrink-0`}
            onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.set('preparar', '1'); return next; })}
          >
            Preparar {Number(latest!.name) + 1}
          </button>
        </div>
      )}
      {(offerStart || fill.progress) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-900/20 sm:flex-row sm:items-center" role="status">
          <PlayCircle size={22} className="hidden flex-shrink-0 text-emerald-700 dark:text-emerald-300 sm:block" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">
            {fill.progress
              ? <><strong>Llenando las clases de {selectedYear?.name}…</strong> {fill.progress.entered} {fill.progress.entered === 1 ? 'estudiante ya entró' : 'estudiantes ya entraron'} ({fill.progress.classes} clases).</>
              : <><strong>Cuando empiecen las clases, inicia {selectedYear?.name}.</strong> Cada estudiante entra a sus clases nuevas con su avatar, sus prendas y su familia; el XP, el nivel, el oro, las insignias y las cartas empiezan de cero.</>}
          </p>
          {!fill.progress && (
            <button type="button" className={`${primaryButton} flex-shrink-0`} onClick={() => setStarting('confirm')}>
              <PlayCircle size={16} aria-hidden="true" />Iniciar {selectedYear?.name}
            </button>
          )}
        </div>
      )}
      {starting && (
        <HomeModal
          title={`¿Iniciar ${selectedYear?.name}?`}
          onClose={() => setStarting(null)}
          footer={<>
            <button type="button" onClick={() => setStarting(null)} className={cancelButton}>Cancelar</button>
            <button type="button" className={primaryButton} disabled={starting === 'busy'} onClick={() => void start()}>
              <PlayCircle size={16} aria-hidden="true" />{starting === 'busy' ? 'Iniciando…' : `Iniciar ${selectedYear?.name}`}
            </button>
          </>}
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-100">
            <li>{selectedYear?.name} pasa a ser el año en curso: sus clases siguen sus bimestres.</li>
            <li>Cada estudiante matriculado entra a las clases de su sección con su avatar, sus prendas y su familia.</li>
            <li>Empiezan de cero el XP, el nivel, el oro, la Energía, las insignias, las cartas, los clanes y las rachas.</li>
            <li>No se puede deshacer.</li>
          </ul>
        </HomeModal>
      )}
      {offerClose && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-500/40 dark:bg-primary-900/20 sm:flex-row sm:items-center">
          <Lock size={22} className="hidden flex-shrink-0 text-primary-700 dark:text-primary-300 sm:block" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">
            {selectedYear?.status === 'CLOSED'
              ? <><strong>{selectedYear.name} ya cerró.</strong> Si alguien quedó en recuperación, resuélvelo antes de que {planning!.name} empiece.</>
              : <><strong>Cierra {selectedYear?.name}.</strong> Revisa quién pasa de grado, quién permanece, quién está en recuperación y quién egresa; al cerrar, sus clases se archivan.</>}
          </p>
          <Link to={`/escuela/${school.id}/promocion`} className={`${primaryButton} flex-shrink-0`}>
            {selectedYear?.status === 'CLOSED' ? 'Ver la promoción' : 'Promoción y cierre'}<ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
      <YearForm
        key={year.data ? `${year.data.id}:${JSON.stringify(year.data)}` : 'new'}
        year={year.data ?? null}
        manager={manager}
        gradeLevels={classrooms.map((c) => c.gradeLevel)}
        onCreated={selectYear}
      />
    </div>
  );
};

interface YearFormProps {
  year: SchoolYearDetail | null;
  /** Preparar el año siguiente a este (borrador que copia su estructura). */
  prepareFrom?: SchoolYearDetail | null;
  manager: boolean;
  gradeLevels: Array<string | null>;
  onCreated: (yearId: string) => void;
  onCancel?: () => void;
}

const YearForm = ({ year, prepareFrom = null, manager, gradeLevels, onCreated, onCancel }: YearFormProps) => {
  const { school, years, selectYear } = useSchoolConsole();
  const queryClient = useQueryClient();
  // Punto de partida fijo: la clave del formulario lo remonta cuando cambia el año guardado.
  const [initial] = useState(() => (year ? fromYear(year) : prepareFrom ? nextDraft(prepareFrom) : newDraft(gradeLevels)));
  const [draft, setDraft] = useState<Draft>(initial);
  const [copy, setCopy] = useState<CopyChoice>(ALL_COPIED);
  const [serverError, setServerError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const input = toInput(draft);
  const { errors, issues } = reviewYear(input);
  const blocking = errors.length > 0 || issues.some((issue) => issue.kind === 'error');
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const closedYear = year?.status === 'CLOSED';
  const readOnly = !manager || closedYear;
  const closedCodes = new Set(year?.periods.filter((p) => p.status !== 'OPEN').map((p) => p.code));
  const canLock = !!year && manager && year.status === 'ACTIVE';
  const [confirm, setConfirm] = useState<{ code: string; label: string; action: 'close' | 'reopen'; endsOn: string } | null>(null);
  const periodAction = useMutation({
    mutationFn: (input: { code: string; action: 'close' | 'reopen' }) => (input.action === 'close'
      ? schoolYearApi.closePeriod(school.id, year!.id, input.code)
      : schoolYearApi.reopenPeriod(school.id, year!.id, input.code)),
    onSuccess: (message) => {
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: schoolYearKeys.detail(school.id, year!.id) });
      // Calificaciones de las clases del colegio.
      void queryClient.invalidateQueries({ queryKey: ['bimester-status'] });
      void queryClient.invalidateQueries({ queryKey: ['classroom-grades'] });
      toast.success(message);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo completar')),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (year) return { saved: await schoolYearApi.update(school.id, year.id, input), copied: null };
      const created = await schoolYearApi.create(school.id, {
        name: draft.name, ...input, ...(prepareFrom ? { copyFrom: { yearId: prepareFrom.id, ...copy } } : {}),
      });
      return { saved: created as SchoolYearDetail, copied: created.copied };
    },
    onSuccess: ({ saved, copied }) => {
      setServerError(null);
      queryClient.setQueryData(schoolYearKeys.detail(school.id, saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: schoolYearKeys.list(school.id) });
      if (year) {
        toast.success('Año escolar guardado');
        return;
      }
      const summary = copied ? copiedSummary(copied) : null;
      const missing = copied?.notInTeam ? ` ${copied.notInTeam} no se copiaron: esa persona ya no está en el equipo.` : '';
      toast.success(
        saved.status === 'PLANNING'
          ? `${saved.name} en preparación.${summary ? ` Se copió: ${summary}.` : ''}${missing}`
          : `Año escolar ${saved.name} creado`,
        { duration: summary || missing ? 7000 : 4000 },
      );
      onCreated(saved.id);
    },
    onError: (error) => setServerError(errorMessage(error, 'No se pudo guardar el año escolar')),
  });

  const discard = useMutation({
    mutationFn: () => schoolYearApi.remove(school.id, year!.id),
    onSuccess: (message) => {
      setDiscarding(false);
      queryClient.removeQueries({ queryKey: schoolYearKeys.detail(school.id, year!.id) });
      void queryClient.invalidateQueries({ queryKey: schoolYearKeys.list(school.id) });
      const back = years.find((y) => y.status === 'ACTIVE') ?? years.find((y) => y.id !== year!.id);
      if (back) selectYear(back.id);
      toast.success(message);
    },
    onError: (error) => {
      setDiscarding(false);
      toast.error(errorMessage(error, 'No se pudo descartar'));
    },
  });

  const update = (patch: Partial<Draft>) => {
    setServerError(null);
    setDraft((current) => ({ ...current, ...patch }));
  };
  const setPeriod = (index: number, field: 'startsOn' | 'endsOn', value: string) =>
    update({ periods: draft.periods.map((p, i) => (i === index ? { ...p, [field]: value } : p)) });
  const setLevel = (level: SchoolLevel, patch: Partial<LevelDraft[SchoolLevel]>) =>
    update({ levels: { ...draft.levels, [level]: { ...draft.levels[level], ...patch } } });
  // Lo que se copia depende de otras partes: sin secciones no hay tutorías, asignaciones ni talleres; sin plan, tampoco
  // asignaciones ni talleres.
  const toggleCopy = (key: keyof CopyChoice, on: boolean) => setCopy((current) => {
    const next = { ...current, [key]: on };
    if (!on && key === 'sections') Object.assign(next, { tutors: false, assignments: false, workshops: false });
    if (!on && key === 'plan') Object.assign(next, { assignments: false, workshops: false });
    if (on && key === 'tutors') next.sections = true;
    if (on && (key === 'assignments' || key === 'workshops')) Object.assign(next, { sections: true, plan: true });
    return next;
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly || blocking || (year && !dirty) || save.isPending) return;
    save.mutate();
  };

  const title = prepareFrom ? `Preparar ${draft.name || 'el año siguiente'}` : year ? `Año escolar ${year.name}` : 'Preparar el año escolar';
  const subtitle = prepareFrom
    ? `Como borrador, mientras ${prepareFrom.name} sigue en curso. Sus clases no reciben estudiantes hasta que empiece.`
    : year ? 'Fechas, periodos y niveles. Los cambios se ven en toda la escuela.' : 'Empieza por aquí: fechas, periodos y niveles de la escuela.';

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <header>
        <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">{title}</h1>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>
      </header>

      {year?.status === 'PLANNING' && (
        <div className="flex flex-col gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-900/30 dark:text-amber-100 sm:flex-row sm:items-center" role="status">
          <Info size={16} className="hidden flex-shrink-0 sm:block" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <strong>{year.name} está en preparación.</strong> Arma sus secciones, asignaciones y clases con calma: los estudiantes entran a sus clases cuando el año empiece.
          </p>
          {manager && (
            <button type="button" className="pg-btn pg-focus flex-shrink-0" onClick={() => setDiscarding(true)}>
              <Trash2 size={16} aria-hidden="true" />Descartar
            </button>
          )}
        </div>
      )}
      {closedYear && (
        <p className="flex items-start gap-2 rounded-xl bg-gray-100 p-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100" role="status">
          <Lock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          {year!.name} ya cerró: solo se puede consultar.
        </p>
      )}
      {!manager && (
        <p className="flex items-start gap-2 rounded-xl bg-gray-100 p-3 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100" role="status">
          <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          Solo la administración de la escuela puede cambiar el año escolar.
        </p>
      )}

      <fieldset className={card} disabled={readOnly}>
        <legend className="sr-only">Fechas del año</legend>
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Fechas del año</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {!year && (
            <Input
              label="Año"
              inputMode="numeric"
              maxLength={4}
              value={draft.name}
              onChange={(e) => update({ name: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              required
            />
          )}
          <Input label="Empieza" type="date" value={draft.startsOn} onChange={(e) => update({ startsOn: e.target.value })} required />
          <Input label="Termina" type="date" value={draft.endsOn} onChange={(e) => update({ endsOn: e.target.value })} required />
        </div>
      </fieldset>

      <fieldset className={card} disabled={readOnly}>
        <legend className="sr-only">Periodos</legend>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Bimestres</h2>
          <button
            type="button"
            className="pg-btn pg-focus ml-auto"
            onClick={() => update({ periods: splitPeriods(draft.startsOn, draft.endsOn, draft.periodType) })}
            disabled={readOnly || closedCodes.size > 0 || errors.length > 0}
          >
            <Shuffle size={16} aria-hidden="true" />
            Repartir automáticamente
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Reparte el año en semanas iguales; luego mueve las fechas para las vacaciones. Las clases del colegio siguen estos bimestres en Calificaciones{canLock ? ', y aquí se cierran cuando terminan' : ''}.
        </p>
        <ol className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
          {draft.periods.map((period, index) => {
            const rowIssues = issues.filter((issue) => issue.index === index);
            const locked = closedCodes.has(period.code);
            const name = `${PERIOD_NAME[draft.periodType]} ${index + 1}`;
            return (
              <li key={period.code} className="py-3">
                <div className="grid items-end gap-3 sm:grid-cols-[9rem_1fr_1fr_5.5rem]">
                  <p className="pb-2.5 text-sm font-semibold text-gray-900 dark:text-white">
                    {name}
                    {locked && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-800 dark:bg-slate-700 dark:text-slate-100">Cerrado</span>}
                  </p>
                  <Input label="Desde" aria-label={`${name}: desde`} type="date" value={period.startsOn} onChange={(e) => setPeriod(index, 'startsOn', e.target.value)} disabled={readOnly || locked} />
                  <Input label="Hasta" aria-label={`${name}: hasta`} type="date" value={period.endsOn} onChange={(e) => setPeriod(index, 'endsOn', e.target.value)} disabled={readOnly || locked} />
                  <p className="pb-2.5 text-sm tabular-nums text-gray-600 dark:text-gray-300">
                    {period.startsOn && period.endsOn && period.endsOn >= period.startsOn ? `${weeksOf(period.startsOn, period.endsOn)} sem.` : '—'}
                  </p>
                </div>
                {canLock && (() => {
                  const saved = year!.periods.find((p) => p.code === period.code);
                  if (!saved || (saved.status !== 'LOCKED' && !saved.started)) return null;
                  const pending = dirty || periodAction.isPending;
                  return saved.status === 'LOCKED' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span>Cerrado{saved.lockedAt ? ` el ${shortDay(saved.lockedAt)}` : ''}: las notas de las clases no cambian.</span>
                      <button type="button" className="pg-btn pg-focus" disabled={pending} title={dirty ? 'Guarda o descarta los cambios primero' : undefined}
                        onClick={() => setConfirm({ code: saved.code, label: name, action: 'reopen', endsOn: saved.endsOn })}>
                        <LockOpen size={16} aria-hidden="true" />Reabrir
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <button type="button" className="pg-btn pg-focus" disabled={pending} title={dirty ? 'Guarda o descarta los cambios primero' : undefined}
                        onClick={() => setConfirm({ code: saved.code, label: name, action: 'close', endsOn: saved.endsOn })}>
                        <Lock size={16} aria-hidden="true" />Cerrar {name.toLowerCase()}
                      </button>
                    </div>
                  );
                })()}
                {rowIssues.map((issue) => (
                  <p
                    key={issue.text}
                    className={`mt-1.5 flex items-center gap-1.5 text-sm ${issue.kind === 'error' ? 'font-medium text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-200'}`}
                  >
                    {issue.kind === 'error' ? <AlertCircle size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}
                    {issue.text}
                  </p>
                ))}
              </li>
            );
          })}
        </ol>
      </fieldset>

      <fieldset className={card} disabled={readOnly}>
        <legend className="sr-only">Niveles y escala</legend>
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Niveles y escala</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Los niveles que ofrece la escuela este año y cómo se califica en cada uno.</p>
        <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
          {LEVELS.map((level) => {
            const state = draft.levels[level];
            return (
              <li key={level} className="flex flex-wrap items-center gap-3 py-2">
                <label className="flex min-h-[44px] min-w-[10rem] cursor-pointer items-center gap-3 text-sm font-semibold text-gray-900 dark:text-white">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-gray-400 text-primary-600 focus:ring-primary-500"
                    checked={state.on}
                    onChange={(e) => setLevel(level, { on: e.target.checked })}
                  />
                  {LEVEL_LABEL[level]}
                </label>
                {state.on && (
                  <div className="pg-seg" role="group" aria-label={`Escala de ${LEVEL_LABEL[level]}`}>
                    {SCALES.map((scale) => (
                      <button
                        key={scale.id}
                        type="button"
                        className="pg-seg-item pg-focus"
                        aria-pressed={state.scale === scale.id}
                        onClick={() => setLevel(level, { scale: scale.id })}
                      >
                        {scale.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      {prepareFrom && (
        <fieldset className={card}>
          <legend className="sr-only">Qué copiar de {prepareFrom.name}</legend>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Copiar de {prepareFrom.name}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Solo de los niveles marcados arriba. Todo se puede cambiar después; las asignaciones y talleres llegan sin clase y luego se crean de una vez.
          </p>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {COPY_ITEMS.map((option) => (
              <li key={option.key}>
                <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg py-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-400 text-primary-600 focus:ring-primary-500"
                    checked={copy[option.key]}
                    onChange={(e) => toggleCopy(option.key, e.target.checked)}
                  />
                  <span>
                    <span className="block font-semibold text-gray-900 dark:text-white">{option.label}</span>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">{option.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {(errors.length > 0 || serverError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-900/20 dark:text-red-100" role="alert">
          {[...errors, ...(serverError ? [serverError] : [])].map((text) => (
            <p key={text} className="flex items-center gap-1.5"><AlertCircle size={14} aria-hidden="true" />{text}</p>
          ))}
        </div>
      )}

      {confirm && (
        <HomeModal
          title={confirm.action === 'close' ? `¿Cerrar el ${confirm.label.toLowerCase()} en todo el colegio?` : `¿Reabrir el ${confirm.label.toLowerCase()}?`}
          onClose={() => setConfirm(null)}
          footer={<>
            <button type="button" onClick={() => setConfirm(null)} className={cancelButton}>Cancelar</button>
            <button type="button" className={primaryButton} disabled={periodAction.isPending} onClick={() => periodAction.mutate({ code: confirm.code, action: confirm.action })}>
              {confirm.action === 'close' ? <Lock size={16} aria-hidden="true" /> : <LockOpen size={16} aria-hidden="true" />}
              {periodAction.isPending ? 'Guardando…' : confirm.action === 'close' ? 'Cerrar bimestre' : 'Reabrir'}
            </button>
          </>}
        >
          {confirm.action === 'close' ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-100">
              <li>Las notas de todas las clases se calculan por última vez y quedan congeladas.</li>
              <li>Los docentes pueden seguir escribiendo conclusiones y exportar.</li>
              {confirm.endsOn >= localToday() && <li>Aún no termina (va hasta el {shortDay(confirm.endsOn)}): lo que pase desde ahora ya no contará para este bimestre.</li>}
              <li>Si hay que corregir algo, puedes reabrirlo.</li>
            </ul>
          ) : (
            <p className="text-sm text-gray-800 dark:text-gray-100">Las notas de todas las clases vuelven a cambiar con su evidencia hasta que lo cierres otra vez.</p>
          )}
        </HomeModal>
      )}

      {discarding && year && (
        <HomeModal
          title={`¿Descartar la preparación de ${year.name}?`}
          onClose={() => setDiscarding(false)}
          footer={<>
            <button type="button" onClick={() => setDiscarding(false)} className={cancelButton}>Cancelar</button>
            <button type="button" className={primaryButton} disabled={discard.isPending} onClick={() => discard.mutate()}>
              <Trash2 size={16} aria-hidden="true" />{discard.isPending ? 'Descartando…' : 'Descartar'}
            </button>
          </>}
        >
          <p className="text-sm text-gray-800 dark:text-gray-100">
            Se borran sus fechas, secciones, plan, asignaciones, talleres y coordinaciones. No se puede si ya tiene clases creadas o estudiantes matriculados.
          </p>
        </HomeModal>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onCancel && (
            <button type="button" className={cancelButton} onClick={onCancel}>Cancelar</button>
          )}
          {year && dirty && (
            <button type="button" className={cancelButton} onClick={() => { setDraft(initial); setServerError(null); }}>
              Descartar cambios
            </button>
          )}
          <button type="submit" className={primaryButton} disabled={blocking || (!!year && !dirty) || save.isPending || (!year && draft.name.length !== 4)}>
            {save.isPending ? 'Guardando…' : year ? 'Guardar cambios' : prepareFrom ? `Preparar ${draft.name}` : 'Crear año escolar'}
          </button>
        </div>
      )}
    </form>
  );
};
