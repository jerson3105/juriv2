import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertCircle, Info, Lock, LockOpen, Shuffle } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { HomeModal } from '../../components/home/HomeModal';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { useSchoolPanelData } from '../../components/schools/useSchoolPanelData';
import { cancelButton, primaryButton } from '../../components/home/homeHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import {
  defaultYearDates, LEVEL_LABEL, LEVELS, PERIOD_NAME, reviewYear, splitPeriods, weeksOf,
} from '../../components/schools/console/schoolYearHelpers';
import {
  schoolYearApi, schoolYearKeys, type GradeScale, type PeriodType, type SchoolLevel, type SchoolYearDetail, type SchoolYearInput,
} from '../../lib/schoolYearApi';

type LevelDraft = Record<SchoolLevel, { on: boolean; scale: GradeScale }>;

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

const toInput = (draft: Draft): SchoolYearInput => ({
  startsOn: draft.startsOn,
  endsOn: draft.endsOn,
  periodType: draft.periodType,
  periods: draft.periods,
  levels: LEVELS.filter((level) => draft.levels[level].on).map((level) => ({ level, gradeScale: draft.levels[level].scale })),
});

const fromYear = (year: SchoolYearDetail): Draft => ({
  name: year.name,
  startsOn: year.startsOn,
  endsOn: year.endsOn,
  periodType: year.periodType,
  periods: year.periods.map((p) => ({ code: p.code, startsOn: p.startsOn, endsOn: p.endsOn })),
  levels: Object.fromEntries(LEVELS.map((level) => {
    const found = year.levels.find((l) => l.level === level);
    return [level, { on: !!found, scale: found?.gradeScale ?? 'LITERAL' }];
  })) as LevelDraft,
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

/**
 * Año escolar: fechas, bimestres (con reparto automático) y niveles con su escala. Por ahora sin trimestres: Calificaciones
 * va por bimestres. La administración cierra y reabre cada bimestre en todas las clases del colegio.
 */
export const SchoolYearPage = () => {
  const { school, manager, activeYear, yearsLoading } = useSchoolConsole();
  const { classrooms, loadingDetail } = useSchoolPanelData(school, manager);
  const year = useQuery({
    queryKey: schoolYearKeys.detail(school.id, activeYear?.id ?? ''),
    queryFn: () => schoolYearApi.get(school.id, activeYear!.id),
    enabled: !!activeYear,
  });

  if (yearsLoading || (activeYear && year.isLoading) || (!activeYear && loadingDetail)) {
    return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando el año escolar" />;
  }
  if (activeYear && year.isError) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">No se pudo cargar el año escolar.</p>
        <button type="button" onClick={() => void year.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>
      </div>
    );
  }
  // La clave remonta el formulario al guardar (el año guardado pasa a ser el punto de partida).
  return (
    <YearForm
      key={year.data ? `${year.data.id}:${JSON.stringify(year.data)}` : 'new'}
      year={year.data ?? null}
      manager={manager}
      gradeLevels={classrooms.map((c) => c.gradeLevel)}
    />
  );
};

const YearForm = ({ year, manager, gradeLevels }: { year: SchoolYearDetail | null; manager: boolean; gradeLevels: Array<string | null> }) => {
  const { school } = useSchoolConsole();
  const queryClient = useQueryClient();
  // Punto de partida fijo: la clave del formulario lo remonta cuando cambia el año guardado.
  const [initial] = useState(() => (year ? fromYear(year) : newDraft(gradeLevels)));
  const [draft, setDraft] = useState<Draft>(initial);
  const [serverError, setServerError] = useState<string | null>(null);

  const input = toInput(draft);
  const { errors, issues } = reviewYear(input);
  const blocking = errors.length > 0 || issues.some((issue) => issue.kind === 'error');
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const readOnly = !manager;
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
    mutationFn: () => (year ? schoolYearApi.update(school.id, year.id, input) : schoolYearApi.create(school.id, { name: draft.name, ...input })),
    onSuccess: (saved) => {
      setServerError(null);
      queryClient.setQueryData(schoolYearKeys.detail(school.id, saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: schoolYearKeys.list(school.id) });
      toast.success(year ? 'Año escolar guardado' : `Año escolar ${saved.name} creado`);
    },
    onError: (error) => setServerError(errorMessage(error, 'No se pudo guardar el año escolar')),
  });

  const update = (patch: Partial<Draft>) => {
    setServerError(null);
    setDraft((current) => ({ ...current, ...patch }));
  };
  const setPeriod = (index: number, field: 'startsOn' | 'endsOn', value: string) =>
    update({ periods: draft.periods.map((p, i) => (i === index ? { ...p, [field]: value } : p)) });
  const setLevel = (level: SchoolLevel, patch: Partial<LevelDraft[SchoolLevel]>) =>
    update({ levels: { ...draft.levels, [level]: { ...draft.levels[level], ...patch } } });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly || blocking || (year && !dirty) || save.isPending) return;
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <header>
        <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">{year ? `Año escolar ${year.name}` : 'Preparar el año escolar'}</h1>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
          {year ? 'Fechas, periodos y niveles. Los cambios se ven en toda la escuela.' : 'Empieza por aquí: fechas, periodos y niveles de la escuela.'}
        </p>
      </header>

      {readOnly && (
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

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {year && dirty && (
            <button type="button" className={cancelButton} onClick={() => { setDraft(initial); setServerError(null); }}>
              Descartar cambios
            </button>
          )}
          <button type="submit" className={primaryButton} disabled={blocking || (!!year && !dirty) || save.isPending || (!year && draft.name.length !== 4)}>
            {save.isPending ? 'Guardando…' : year ? 'Guardar cambios' : 'Crear año escolar'}
          </button>
        </div>
      )}
    </form>
  );
};
