import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { useSchoolPanelData } from '../../components/schools/useSchoolPanelData';
import { cancelButton, primaryButton } from '../../components/home/homeHelpers';
import { errorMessage } from '../../components/auth/authHelpers';
import { LEVEL_LABEL } from '../../components/schools/console/schoolYearHelpers';
import {
  byName, cleanName, gradeHeading, gradeLabel, LEVEL_GRADES, MAX_PER_GRADE, NAME_STYLES, namesFor, nextName, planSections, sectionName,
  type NameStyle,
} from '../../components/schools/console/sectionHelpers';
import { schoolSectionApi, schoolSectionKeys, type SchoolSection, type SchoolShift } from '../../lib/schoolSectionApi';
import { sexSummary } from '../../lib/studentSex';
import { schoolYearApi, schoolYearKeys, type SchoolLevel } from '../../lib/schoolYearApi';
import type { SchoolTeacher } from '../../lib/schoolApi';

const select = 'pg-focus mt-1 block min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

/** Grados y secciones del año: nivel → grado → tarjetas. Crear varias de una vez, nombre en el lugar, turno y tutoría. */
export const SchoolSectionsPage = () => {
  const { school, manager, activeYear, yearsLoading } = useSchoolConsole();
  const queryClient = useQueryClient();
  const { teachers } = useSchoolPanelData(school, manager);
  const yearId = activeYear?.id ?? '';
  const year = useQuery({ queryKey: schoolYearKeys.detail(school.id, yearId), queryFn: () => schoolYearApi.get(school.id, yearId), enabled: !!activeYear });
  const sections = useQuery({ queryKey: schoolSectionKeys.list(school.id, yearId), queryFn: () => schoolSectionApi.list(school.id, yearId), enabled: !!activeYear });
  const levels = (year.data?.levels ?? []).map((l) => l.level);
  const [picked, setPicked] = useState<SchoolLevel | null>(null);
  const [creating, setCreating] = useState(false);
  const panelId = useId();
  const level = picked && levels.includes(picked) ? picked : levels[0] ?? null;
  const all = sections.data ?? [];
  const tutors = teachers.filter((t) => t.status === 'VERIFIED');

  const listKey = schoolSectionKeys.list(school.id, yearId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: listKey });
  const createMany = useMutation({
    mutationFn: (items: { level: SchoolLevel; grade: number; name: string }[]) => schoolSectionApi.createMany(school.id, yearId, items),
    onSuccess: (result) => {
      void refresh();
      toast.success(result.message);
      setCreating(false);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudieron crear las secciones')),
  });

  if (yearsLoading || (activeYear && (year.isLoading || sections.isLoading))) {
    return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando las secciones" />;
  }
  if (!activeYear) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
          <span className="text-4xl">📅</span><span className="text-5xl">🏫</span><span className="text-4xl">✏️</span>
        </div>
        <h1 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Primero prepara el año escolar</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Las secciones pertenecen a un año: elige sus fechas, periodos y niveles.</p>
        {manager && <Link to={`/escuela/${school.id}/anio`} className={`${primaryButton} mt-5`}>Preparar el año</Link>}
      </div>
    );
  }
  if (year.isError || sections.isError) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">No se pudieron cargar las secciones.</p>
        <button type="button" onClick={() => { void year.refetch(); void sections.refetch(); }} className="pg-btn pg-focus mt-3">Reintentar</button>
      </div>
    );
  }

  const inLevel = level ? all.filter((s) => s.level === level) : [];
  const countIn = (l: SchoolLevel) => all.filter((s) => s.level === l).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">Grados y secciones</h1>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
            {activeYear.name} · {all.length} {all.length === 1 ? 'sección' : 'secciones'} · {all.filter((s) => !s.tutor).length} sin tutoría
          </p>
        </div>
        {manager && level && (
          <button type="button" className="pg-btn pg-focus" aria-expanded={creating} aria-controls={panelId} onClick={() => setCreating((v) => !v)}>
            <Plus size={16} aria-hidden="true" />
            Crear secciones
          </button>
        )}
      </header>

      {levels.length > 1 && (
        <div className="pg-seg" role="group" aria-label="Nivel">
          {levels.map((l) => (
            <button key={l} type="button" className="pg-seg-item pg-focus" aria-pressed={l === level} onClick={() => setPicked(l)}>
              {LEVEL_LABEL[l]} <span className="tabular-nums opacity-80">{countIn(l)}</span>
            </button>
          ))}
        </div>
      )}

      {creating && level && (
        <CreatePanel
          id={panelId}
          level={level}
          existing={all}
          busy={createMany.isPending}
          onCancel={() => setCreating(false)}
          onCreate={(items) => createMany.mutate(items)}
        />
      )}

      {level && inLevel.length === 0 && !creating ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
          <div className="mx-auto flex w-fit gap-3" aria-hidden="true">
            <span className="text-4xl">🔤</span><span className="text-5xl">🏫</span><span className="text-4xl">🎨</span>
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Aún no hay secciones en {LEVEL_LABEL[level]}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Créalas de una vez: con letras, colores, países o los nombres que uses en tu colegio.</p>
          {manager && (
            <button type="button" onClick={() => setCreating(true)} className={`${primaryButton} mt-5`}>
              <Plus size={16} aria-hidden="true" />
              Crear secciones
            </button>
          )}
        </div>
      ) : level && (
        <div className="space-y-6">
          {LEVEL_GRADES[level].map((grade) => (
            <GradeGroup
              key={grade}
              level={level}
              grade={grade}
              sections={inLevel.filter((s) => s.grade === grade).sort(byName)}
              tutors={tutors}
              manager={manager}
              adding={createMany.isPending}
              onAdd={(name) => createMany.mutate([{ level, grade, name }])}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface CreatePanelProps {
  id: string;
  level: SchoolLevel;
  existing: SchoolSection[];
  busy: boolean;
  onCancel: () => void;
  onCreate: (items: { level: SchoolLevel; grade: number; name: string }[]) => void;
}

const CreatePanel = ({ id, level, existing, busy, onCancel, onCreate }: CreatePanelProps) => {
  const grades = LEVEL_GRADES[level];
  const [chosen, setChosen] = useState<number[]>(() => grades.filter((g) => !existing.some((s) => s.level === level && s.grade === g)));
  const [style, setStyle] = useState<NameStyle>('LETTERS');
  const [count, setCount] = useState(1);
  const [custom, setCustom] = useState('');
  const names = namesFor(style, count, custom);
  const plan = planSections(level, chosen, names, existing);
  const fresh = plan.filter((p) => !p.exists);
  const toggle = (grade: number) => setChosen((list) => (list.includes(grade) ? list.filter((g) => g !== grade) : [...list, grade].sort((a, b) => a - b)));

  return (
    <section id={id} className="pg-surface p-4 sm:p-5" aria-labelledby={`${id}-title`}>
      <div className="flex items-center gap-2">
        <h2 id={`${id}-title`} className="text-base font-bold text-gray-900 dark:text-white">Crear secciones en {LEVEL_LABEL[level]}</h2>
        <button type="button" className="pg-icon-btn pg-focus ml-auto" aria-label="Cerrar" onClick={onCancel}><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 dark:text-white">Grados</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {grades.map((grade) => (
              <button key={grade} type="button" className="pg-chip pg-focus" aria-pressed={chosen.includes(grade)} onClick={() => toggle(grade)}>
                {gradeLabel(level, grade)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 dark:text-white">Nombres</legend>
          <div className="pg-seg mt-2" role="group" aria-label="Estilo de nombre">
            {NAME_STYLES.map((s) => (
              <button key={s.id} type="button" className="pg-seg-item pg-focus" aria-pressed={style === s.id} onClick={() => setStyle(s.id)}>{s.label}</button>
            ))}
          </div>
          {style === 'CUSTOM' && (
            <label className="mt-2 block text-sm text-gray-700 dark:text-gray-300">
              Escribe los nombres separados por comas
              <textarea
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                rows={2}
                placeholder="Girasoles, Ositos, Estrellitas"
                className="pg-focus mt-1 block w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
          )}
        </fieldset>
        {style !== 'CUSTOM' && (
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white">Secciones por grado</legend>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className="pg-icon-btn pg-focus border border-gray-300 dark:border-gray-600" aria-label="Una menos" onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1}><Minus size={16} aria-hidden="true" /></button>
              <span className="w-8 text-center text-lg font-bold tabular-nums text-gray-900 dark:text-white" aria-live="polite">{count}</span>
              <button type="button" className="pg-icon-btn pg-focus border border-gray-300 dark:border-gray-600" aria-label="Una más" onClick={() => setCount((c) => Math.min(MAX_PER_GRADE, c + 1))} disabled={count >= MAX_PER_GRADE}><Plus size={16} aria-hidden="true" /></button>
            </div>
          </fieldset>
        )}
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Vista previa</p>
        {plan.length === 0 ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{chosen.length === 0 ? 'Elige al menos un grado.' : 'Escribe al menos un nombre.'}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {plan.map((p) => (
              <li
                key={`${p.grade}-${p.name}`}
                className={p.exists
                  ? 'rounded-full bg-gray-100 px-2.5 py-0.5 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  : 'rounded-full bg-primary-50 px-2.5 py-0.5 text-sm font-semibold text-primary-900 dark:bg-primary-500/20 dark:text-primary-100'}
              >
                {sectionName(p)}{p.exists && ' ya existe · se omite'}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-sm text-gray-600 dark:text-gray-300">
          {fresh.length === 0 ? 'No hay secciones nuevas para crear.' : `Se ${fresh.length === 1 ? 'creará 1 sección' : `crearán ${fresh.length} secciones`}. La tutoría y el turno se eligen después en cada tarjeta.`}
        </p>
        <button type="button" className={cancelButton} onClick={onCancel}>Cancelar</button>
        <button
          type="button"
          className={primaryButton}
          disabled={fresh.length === 0 || busy}
          onClick={() => onCreate(fresh.map(({ level: l, grade, name }) => ({ level: l, grade, name })))}
        >
          {busy ? 'Creando…' : fresh.length === 1 ? 'Crear 1 sección' : `Crear ${fresh.length} secciones`}
        </button>
      </div>
    </section>
  );
};

interface GradeGroupProps {
  level: SchoolLevel;
  grade: number;
  sections: SchoolSection[];
  tutors: SchoolTeacher[];
  manager: boolean;
  adding: boolean;
  onAdd: (name: string) => void;
}

const GradeGroup = ({ level, grade, sections, tutors, manager, adding, onAdd }: GradeGroupProps) => {
  const headingId = useId();
  const suggestion = nextName(sections.map((s) => s.name));
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={headingId} className="text-base font-bold text-gray-900 dark:text-white">{gradeHeading(level, grade)}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{sections.length === 0 ? 'Sin secciones' : `${sections.length} ${sections.length === 1 ? 'sección' : 'secciones'}`}</p>
        {manager && suggestion && (
          <button
            type="button"
            className="pg-btn pg-btn-ghost pg-focus ml-auto text-primary-700 dark:text-primary-300"
            onClick={() => onAdd(suggestion)}
            disabled={adding}
            aria-label={`Agregar la sección ${gradeLabel(level, grade)} ${suggestion}`}
          >
            <Plus size={16} aria-hidden="true" />
            Sección
          </button>
        )}
      </div>
      {sections.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => <SectionCard key={section.id} section={section} tutors={tutors} manager={manager} />)}
        </div>
      )}
    </section>
  );
};

const SectionCard = ({ section, tutors, manager }: { section: SchoolSection; tutors: SchoolTeacher[]; manager: boolean }) => {
  const { school, activeYear } = useSchoolConsole();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fieldId = useId();
  const listKey = schoolSectionKeys.list(school.id, activeYear?.id ?? '');
  const display = sectionName(section);

  const save = useMutation({
    mutationFn: (patch: { name?: string; shift?: SchoolShift; tutorUserId?: string | null }) => schoolSectionApi.update(school.id, section.id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<SchoolSection[]>(listKey, (list) => list?.map((s) => (s.id === updated.id ? updated : s)));
      setEditing(false);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar la sección')),
  });
  const remove = useMutation({
    mutationFn: () => schoolSectionApi.remove(school.id, section.id),
    onSuccess: (message) => {
      queryClient.setQueryData<SchoolSection[]>(listKey, (list) => list?.filter((s) => s.id !== section.id));
      toast.success(message);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo quitar la sección')),
  });

  const submitName = () => {
    const clean = cleanName(name);
    if (!clean || clean === section.name) {
      setEditing(false);
      setName(section.name);
      return;
    }
    save.mutate({ name: clean });
  };

  return (
    <article className="pg-surface p-3">
      {editing ? (
        <div>
          <div className="flex items-center gap-1.5">
            <label htmlFor={fieldId} className="text-base font-bold text-gray-600 dark:text-gray-300">{gradeLabel(section.level, section.grade)}</label>
            <input
              id={fieldId}
              value={name}
              maxLength={40}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitName();
                if (e.key === 'Escape') { setEditing(false); setName(section.name); }
              }}
              className="pg-focus min-h-[40px] min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-base font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <button type="button" className="pg-icon-btn pg-focus" aria-label="Guardar nombre" onClick={submitName} disabled={save.isPending}><Check size={18} aria-hidden="true" /></button>
            <button type="button" className="pg-icon-btn pg-focus" aria-label="Cancelar" onClick={() => { setEditing(false); setName(section.name); }}><X size={18} aria-hidden="true" /></button>
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Se verá como «{gradeLabel(section.level, section.grade)} {cleanName(name) || '…'}»</p>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <h3 className="min-w-0 flex-1 truncate text-base font-bold text-gray-900 dark:text-white">
            <span className="text-gray-600 dark:text-gray-300">{gradeLabel(section.level, section.grade)}</span> {section.name}
          </h3>
          {!section.tutor && <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Sin tutoría</span>}
          {manager && (
            <>
              <button type="button" className="pg-icon-btn pg-focus" aria-label={`Cambiar el nombre de ${display}`} onClick={() => setEditing(true)}><Pencil size={16} aria-hidden="true" /></button>
              <button type="button" className="pg-icon-btn pg-focus" aria-label={`Quitar ${display}`} onClick={() => setConfirmDelete(true)}><Trash2 size={16} aria-hidden="true" /></button>
            </>
          )}
        </div>
      )}

      {section.students && (
        <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
          {section.students.total === 0
            ? 'Sin estudiantes aún'
            : [`${section.students.total} ${section.students.total === 1 ? 'estudiante' : 'estudiantes'}`, sexSummary({ ...section.students, unknown: section.students.total - section.students.women - section.students.men })].filter(Boolean).join(' · ')}
        </p>
      )}

      {confirmDelete ? (
        <div className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-900 dark:bg-red-900/30 dark:text-red-100" role="alertdialog" aria-label={`Quitar ${display}`}>
          <p>¿Quitar {display}?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="pg-btn pg-focus border-red-300 text-red-800 dark:border-red-500/50 dark:text-red-100" onClick={() => remove.mutate()} disabled={remove.isPending}>{remove.isPending ? 'Quitando…' : 'Quitar'}</button>
            <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setConfirmDelete(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Tutoría
            <select
              className={select}
              value={section.tutor?.userId ?? ''}
              disabled={!manager || save.isPending}
              onChange={(e) => save.mutate({ tutorUserId: e.target.value || null })}
            >
              <option value="">Sin tutoría</option>
              {tutors.map((t) => <option key={t.userId} value={t.userId}>{t.firstName} {t.lastName}</option>)}
              {section.tutor && !tutors.some((t) => t.userId === section.tutor!.userId) && (
                <option value={section.tutor.userId}>{section.tutor.firstName} {section.tutor.lastName}</option>
              )}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Turno
            <select
              className={select}
              value={section.shift}
              disabled={!manager || save.isPending}
              onChange={(e) => save.mutate({ shift: e.target.value as SchoolShift })}
            >
              <option value="MORNING">Mañana</option>
              <option value="AFTERNOON">Tarde</option>
            </select>
          </label>
        </div>
      )}
    </article>
  );
};
