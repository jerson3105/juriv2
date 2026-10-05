import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { errorMessage } from '../../auth/authHelpers';
import { cancelButton, primaryButton } from '../../home/homeHelpers';
import { SideDrawer } from '../SideDrawer';
import { schoolTeachersKey } from '../schoolHelpers';
import {
  assignmentApi, assignmentKeys, type ClassroomChoice, type MatrixSection, type MatrixTeacher, type PlanArea, type Workshop, type WorkshopMode,
} from '../../../lib/schoolAssignmentApi';
import { schoolRosterApi, schoolRosterKeys } from '../../../lib/schoolRosterApi';
import type { SchoolLevel } from '../../../lib/schoolYearApi';
import { sectionName } from './sectionHelpers';

const input = 'pg-focus min-h-[40px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const label = 'text-sm font-semibold text-gray-800 dark:text-gray-100';

/** Quiénes lo llevan, en corto. */
const whoTakes = (w: Workshop) => (w.mode === 'SECTION'
  ? (w.sections.length ? w.sections.map((s) => s.label).join(', ') : 'Sin secciones')
  : `${w.participants} ${w.participants === 1 ? 'inscrito' : 'inscritos'}`);

/** Talleres del nivel bajo la matriz: parte de un área, su nota cuenta dentro de ella con un peso. */
export const WorkshopsSection = ({ schoolId, yearId, level, plan, sections, teachers }: {
  schoolId: string; yearId: string; level: SchoolLevel; plan: PlanArea[]; sections: MatrixSection[]; teachers: MatrixTeacher[];
}) => {
  const workshops = useQuery({ queryKey: assignmentKeys.workshops(schoolId, yearId, level), queryFn: () => assignmentApi.workshops(schoolId, yearId, level) });
  const [open, setOpen] = useState<{ id: string | null } | null>(null);
  const list = workshops.data ?? [];
  return (
    <section className="space-y-3" aria-labelledby="workshops-title">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 id="workshops-title" className="text-base font-bold text-gray-900 dark:text-white">Talleres</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">Panadería, Karate…: cada taller es parte de un área y su nota cuenta dentro de ella con un peso.</p>
        </div>
        <button type="button" className="pg-btn pg-focus" onClick={() => setOpen({ id: null })}><Plus size={16} aria-hidden="true" />Taller</button>
      </div>
      {workshops.isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando los talleres" />
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Aún no hay talleres en este nivel.</p>
      ) : (
        <div className="pg-surface overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:text-gray-300">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Taller</th>
                <th scope="col" className="px-3 py-2 font-semibold">Docente</th>
                <th scope="col" className="px-3 py-2 font-semibold">Quiénes</th>
                <th scope="col" className="px-3 py-2 font-semibold">Clase</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Peso</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Editar</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {list.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-2.5">
                    <b className="text-gray-900 dark:text-white">{w.name}</b>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">{w.area.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">{w.teacherName}</td>
                  <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">{whoTakes(w)}</td>
                  <td className="px-3 py-2.5">
                    {w.classroom
                      ? <span className="text-gray-900 dark:text-white">{w.classroom.name}{w.classroom.missing > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">faltan {w.classroom.missing}</span>}</span>
                      : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Sin clase</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-800 dark:text-gray-100">{w.weight} %</td>
                  <td className="px-3 py-2.5 text-right"><button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setOpen({ id: w.id })}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AnimatePresence>
        {open && (
          <WorkshopDrawer
            key={open.id ?? 'new'}
            schoolId={schoolId}
            yearId={yearId}
            level={level}
            plan={plan}
            sections={sections}
            teachers={teachers}
            workshopId={open.id}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
};

type ClassMode = 'keep' | 'create' | 'link' | 'none';

const WorkshopDrawer = ({ schoolId, yearId, level, plan, sections, teachers, workshopId, onClose }: {
  schoolId: string; yearId: string; level: SchoolLevel; plan: PlanArea[]; sections: MatrixSection[]; teachers: MatrixTeacher[];
  workshopId: string | null; onClose: () => void;
}) => {
  const detail = useQuery({
    queryKey: assignmentKeys.workshop(schoolId, yearId, workshopId ?? ''),
    queryFn: () => assignmentApi.workshop(schoolId, workshopId!),
    enabled: !!workshopId,
  });
  if (workshopId && (detail.isLoading || !detail.data)) {
    return (
      <SideDrawer title="Taller" onClose={onClose}>
        {detail.isError ? <p className="text-sm text-red-700 dark:text-red-300" role="alert">No se pudo abrir el taller.</p> : <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Cargando…</p>}
      </SideDrawer>
    );
  }
  return <WorkshopForm schoolId={schoolId} yearId={yearId} level={level} plan={plan} sections={sections} teachers={teachers} workshop={detail.data ?? null} onClose={onClose} />;
};

const WorkshopForm = ({ schoolId, yearId, level, plan, sections, teachers, workshop, onClose }: {
  schoolId: string; yearId: string; level: SchoolLevel; plan: PlanArea[]; sections: MatrixSection[]; teachers: MatrixTeacher[];
  workshop: Awaited<ReturnType<typeof assignmentApi.workshop>> | null; onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(workshop?.name ?? '');
  const [areaId, setAreaId] = useState(workshop?.area.id ?? '');
  const [teacherId, setTeacherId] = useState(workshop?.teacherUserId ?? '');
  const [mode, setMode] = useState<WorkshopMode>(workshop?.mode ?? 'SECTION');
  const [sectionIds, setSectionIds] = useState<string[]>(workshop?.sections.map((s) => s.id) ?? []);
  const [students, setStudents] = useState<Array<{ id: string; name: string; section: string | null }>>(
    workshop?.students.map((s) => ({ id: s.id, name: `${s.lastNames}, ${s.firstNames}`, section: s.section })) ?? [],
  );
  const [weight, setWeight] = useState(String(workshop?.weight ?? 30));
  const [classMode, setClassMode] = useState<ClassMode>(workshop ? 'keep' : 'create');
  const [classroomId, setClassroomId] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const area = plan.find((a) => a.areaId === areaId);
  const teacher = teachers.find((t) => t.userId === teacherId);
  const changingTeacher = !!workshop && teacherId !== workshop.teacherUserId;
  const changingArea = !!workshop && areaId !== workshop.area.id;
  const effectiveClass: ClassMode = (changingTeacher || changingArea) && classMode === 'keep' ? 'none' : classMode;
  const eligibleSections = sections.filter((s) => !area || area.grades.includes(s.grade));

  const classes = useQuery({
    queryKey: assignmentKeys.teacherClasses(schoolId, teacherId),
    queryFn: () => assignmentApi.teacherClassrooms(schoolId, teacherId),
    enabled: !!teacherId,
  });
  // Clases del docente que pueden ser del taller: sin sección (las de sección son de un área), libres y del área o sin área.
  const usable = (classes.data ?? []).filter((c) => !c.sectionId && !c.linked && (!c.areaId || c.areaId === areaId) && c.id !== workshop?.classroom?.id);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.all(schoolId, yearId) });
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.teacherClasses(schoolId, teacherId) });
    void queryClient.invalidateQueries({ queryKey: schoolRosterKeys.all(schoolId, yearId) });
    void queryClient.invalidateQueries({ queryKey: schoolTeachersKey(schoolId) });
  };
  const classroom = (): ClassroomChoice | undefined => {
    if (effectiveClass === 'keep') return undefined;
    if (effectiveClass === 'link') return { mode: 'link', classroomId };
    return { mode: effectiveClass };
  };
  const payload = () => ({
    name, level, areaId, teacherUserId: teacherId, mode, weight: Number(weight),
    sectionIds: mode === 'SECTION' ? sectionIds.filter((id) => eligibleSections.some((s) => s.id === id)) : [],
    studentIds: mode === 'CHOSEN' ? students.map((s) => s.id) : [],
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!workshop) return assignmentApi.createWorkshop(schoolId, yearId, { ...payload(), classroom: classroom()! });
      const choice = classroom();
      return assignmentApi.updateWorkshop(schoolId, workshop.id, { ...payload(), ...(choice ? { classroom: choice } : {}) });
    },
    onSuccess: (result) => {
      refresh();
      toast.success(result.message);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar el taller')),
  });
  const sync = useMutation({
    mutationFn: () => assignmentApi.syncWorkshop(schoolId, workshop!.id),
    onSuccess: (result) => {
      refresh();
      toast.success(result.message);
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo sincronizar')),
  });
  const remove = useMutation({
    mutationFn: () => assignmentApi.removeWorkshop(schoolId, workshop!.id),
    onSuccess: (message) => {
      refresh();
      toast.success(message);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo quitar el taller')),
  });

  const weightValue = Number(weight);
  const invalid = name.trim().length < 2 || !areaId || !teacherId || !Number.isInteger(weightValue) || weightValue < 5 || weightValue > 90
    || (mode === 'SECTION' && sectionIds.filter((id) => eligibleSections.some((s) => s.id === id)).length === 0)
    || (effectiveClass === 'link' && !classroomId);
  const radio = (value: ClassMode, text: string, disabled = false) => (
    <label className={`flex min-h-[40px] items-center gap-2 text-sm ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
      <input type="radio" name="workshop-class" value={value} checked={effectiveClass === value} disabled={disabled} onChange={() => setClassMode(value)} className="h-4 w-4 accent-primary-600" />
      {text}
    </label>
  );

  return (
    <SideDrawer title={workshop ? workshop.name : 'Nuevo taller'} subtitle={area ? `Parte de ${area.name}` : 'Parte de un área del plan'} onClose={onClose}>
      {workshop?.classroom && workshop.classroom.missing > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 p-3 dark:border-amber-500/40">
          <p className="text-sm text-amber-900 dark:text-amber-100">{workshop.classroom.missing} {workshop.classroom.missing === 1 ? 'participante aún no está' : 'participantes aún no están'} en la clase.</p>
          <button type="button" className="pg-btn pg-focus" onClick={() => sync.mutate()} disabled={sync.isPending}><RefreshCw size={16} aria-hidden="true" />{sync.isPending ? 'Sincronizando…' : 'Sincronizar'}</button>
        </div>
      )}
      <div>
        <label htmlFor="workshop-name" className={label}>Nombre</label>
        <input id="workshop-name" className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Taller de panadería" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="workshop-area" className={label}>Área</label>
          <select id="workshop-area" className={`${input} mt-1 px-2`} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Elige…</option>
            {plan.map((a) => <option key={a.areaId} value={a.areaId}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="workshop-teacher" className={label}>Docente</label>
          <select id="workshop-teacher" className={`${input} mt-1 px-2`} value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setClassroomId(''); if (!workshop) setClassMode('create'); }}>
            <option value="">Elige…</option>
            {teachers.map((t) => <option key={t.userId} value={t.userId}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={label}>Quiénes lo llevan</legend>
        <div className="pg-seg mt-1" role="group" aria-label="Quiénes lo llevan">
          <button type="button" className="pg-seg-item pg-focus" aria-pressed={mode === 'SECTION'} onClick={() => setMode('SECTION')}>Toda la sección</button>
          <button type="button" className="pg-seg-item pg-focus" aria-pressed={mode === 'CHOSEN'} onClick={() => setMode('CHOSEN')}>Con inscripción</button>
        </div>
        {mode === 'SECTION' ? (
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Secciones">
            {eligibleSections.length === 0 && <p className="text-sm text-gray-700 dark:text-gray-300">Ninguna sección de este nivel lleva esa área en su plan.</p>}
            {eligibleSections.map((s) => (
              <button
                key={s.id}
                type="button"
                className="pg-chip pg-focus"
                aria-pressed={sectionIds.includes(s.id)}
                onClick={() => setSectionIds((list) => (list.includes(s.id) ? list.filter((id) => id !== s.id) : [...list, s.id]))}
              >
                {s.label} <span className="tabular-nums opacity-80">{s.students}</span>
              </button>
            ))}
          </div>
        ) : (
          <StudentPicker schoolId={schoolId} yearId={yearId} level={level} grades={area?.grades ?? null} selected={students} onChange={setStudents} />
        )}
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          {mode === 'SECTION' ? 'Todos los estudiantes de esas secciones entran solos a la clase del taller.' : 'Solo los inscritos, aunque sean de varias secciones.'}
        </p>
      </fieldset>

      <div>
        <label htmlFor="workshop-weight" className={label}>Peso en la nota de {area?.name ?? 'su área'}</label>
        <div className="mt-1 flex items-center gap-2">
          <input id="workshop-weight" type="number" min={5} max={90} step={5} inputMode="numeric" className={`${input} w-24`} value={weight} onChange={(e) => setWeight(e.target.value)} />
          <span className="text-sm text-gray-700 dark:text-gray-300">% · la clase de {area?.name ?? 'el área'} vale el resto</span>
        </div>
      </div>

      {teacherId && (
        <fieldset>
          <legend className={label}>Clase</legend>
          <div className="mt-1 space-y-0.5">
            {workshop && !changingTeacher && !changingArea && radio('keep', workshop.classroom ? `Seguir con «${workshop.classroom.name}»` : 'Seguir sin clase')}
            {radio('create', `Crear «${name.trim() || 'el taller'}» para ${teacher?.name.split(' ')[0] ?? 'el docente'}`)}
            {radio('link', 'Usar una clase que ya tiene', !classes.isLoading && usable.length === 0)}
            {effectiveClass === 'link' && (
              <select aria-label="Clase que ya tiene" className={`${input} ml-6 w-[calc(100%-1.5rem)] px-2`} value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
                <option value="">Elige la clase…</option>
                {usable.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.students} {c.students === 1 ? 'estudiante' : 'estudiantes'}</option>)}
              </select>
            )}
            {!classes.isLoading && usable.length === 0 && <p className="ml-6 text-xs text-gray-600 dark:text-gray-300">No tiene clases libres sin sección de esa área.</p>}
            {radio('none', 'Sin clase por ahora')}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={cancelButton} onClick={onClose}>Cancelar</button>
        <button type="button" className={primaryButton} disabled={invalid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Guardando…' : workshop ? 'Guardar' : 'Crear taller'}
        </button>
      </div>

      {workshop && (
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          {confirmRemove ? (
            <div role="alertdialog" aria-label="Quitar el taller" className="space-y-2">
              <p className="text-sm text-gray-800 dark:text-gray-100">¿Quitar el taller? Su clase y sus estudiantes siguen con su docente.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="pg-btn pg-focus border-red-300 text-red-800 dark:border-red-500/50 dark:text-red-100" onClick={() => remove.mutate()} disabled={remove.isPending}>Quitar</button>
                <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => setConfirmRemove(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" className="pg-btn pg-btn-ghost pg-focus text-red-800 dark:text-red-200" onClick={() => setConfirmRemove(true)}>
              <Trash2 size={16} aria-hidden="true" />Quitar el taller
            </button>
          )}
        </div>
      )}
    </SideDrawer>
  );
};

/** Inscritos: buscar en el padrón del nivel (por nombre o DNI completo) y agregar o quitar. */
const StudentPicker = ({ schoolId, yearId, level, grades, selected, onChange }: {
  schoolId: string; yearId: string; level: SchoolLevel; grades: number[] | null;
  selected: Array<{ id: string; name: string; section: string | null }>; onChange: (next: Array<{ id: string; name: string; section: string | null }>) => void;
}) => {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = { filter: 'all' as const, level, q: q || undefined, page: 1 };
  const results = useQuery({
    queryKey: schoolRosterKeys.list(schoolId, yearId, query),
    queryFn: () => schoolRosterApi.list(schoolId, yearId, query),
    enabled: q.length >= 2,
  });
  const chosen = new Set(selected.map((s) => s.id));
  const options = (results.data?.items ?? []).filter((s) => s.section && !chosen.has(s.id) && (!grades || grades.includes(s.section.grade)));
  return (
    <div className="mt-2 space-y-2">
      <label className="relative block">
        <span className="sr-only">Buscar estudiantes</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o DNI completo" className={`${input} pl-9`} />
      </label>
      {q.length >= 2 && (
        <ul className="max-h-48 divide-y divide-gray-200 overflow-y-auto rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700" aria-label="Resultados">
          {results.isLoading && <li className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">Buscando…</li>}
          {!results.isLoading && options.length === 0 && <li className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">Nadie más coincide.</li>}
          {options.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 text-sm text-gray-900 dark:text-white">{s.lastNames}, {s.firstNames} <span className="text-xs text-gray-600 dark:text-gray-300">{s.section ? sectionName(s.section) : ''}</span></span>
              <button type="button" className="pg-btn pg-btn-ghost pg-focus" onClick={() => onChange([...selected, { id: s.id, name: `${s.lastNames}, ${s.firstNames}`, section: s.section ? sectionName(s.section) : null }])}>
                <Plus size={14} aria-hidden="true" />Inscribir
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{selected.length} {selected.length === 1 ? 'inscrito' : 'inscritos'}</p>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Inscritos">
          {selected.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-100">
              {s.name}{s.section ? ` · ${s.section}` : ''}
              <button type="button" className="pg-focus flex h-6 w-6 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => onChange(selected.filter((x) => x.id !== s.id))} aria-label={`Quitar a ${s.name}`}>
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
