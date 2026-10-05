import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { BookOpen, Wand2 } from 'lucide-react';
import { assignmentApi, assignmentKeys, type MatrixAssignment, type MatrixSection, type PlanArea } from '../../../lib/schoolAssignmentApi';
import type { SchoolLevel } from '../../../lib/schoolYearApi';
import { LEVEL_LABEL } from './schoolYearHelpers';
import { AssignmentDrawer } from './AssignmentDrawer';
import { FromClassesDrawer, PlanDrawer } from './PlanDrawers';

type Filter = 'all' | 'gaps' | 'noclass';
const badge = 'inline-flex h-8 min-w-[44px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold tracking-wide';

/**
 * Asignaciones: matriz por nivel (secciones × áreas del plan) con la tutoría, quién enseña cada área, si tiene clase
 * y los totales. Cada celda abre el panel para asignar; las flechas recorren la matriz.
 */
export const AssignmentsTab = ({ schoolId, yearId }: { schoolId: string; yearId: string }) => {
  const [params, setParams] = useSearchParams();
  const levelParam = (['INICIAL', 'PRIMARIA', 'SECUNDARIA'].includes(params.get('nivel') ?? '') ? params.get('nivel') : null) as SchoolLevel | null;
  const matrix = useQuery({
    queryKey: assignmentKeys.matrix(schoolId, yearId, levelParam),
    queryFn: () => assignmentApi.matrix(schoolId, yearId, levelParam),
    placeholderData: (previous) => previous,
  });
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<{ sectionId: string; areaId: string } | null>(null);
  const [panel, setPanel] = useState<'plan' | 'from' | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const data = matrix.data;
  const byCell = useMemo(() => new Map((data?.assignments ?? []).map((a) => [`${a.sectionId}|${a.areaId}`, a])), [data?.assignments]);
  const teacherById = useMemo(() => new Map((data?.teachers ?? []).map((t) => [t.userId, t])), [data?.teachers]);

  if (matrix.isLoading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200 motion-reduce:animate-none dark:bg-gray-800" aria-busy="true" aria-label="Cargando las asignaciones" />;
  if (matrix.isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/40 dark:bg-red-900/20" role="alert">
        <p className="font-semibold text-red-900 dark:text-red-100">No se pudieron cargar las asignaciones.</p>
        <button type="button" onClick={() => void matrix.refetch()} className="pg-btn pg-focus mt-3">Reintentar</button>
      </div>
    );
  }
  if (!data.level) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-600 dark:bg-gray-800/60">
        <div className="mx-auto flex w-fit gap-3" aria-hidden="true"><span className="text-4xl">🔤</span><span className="text-5xl">🧑‍🏫</span><span className="text-4xl">📚</span></div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Primero crea las secciones</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-700 dark:text-gray-300">Las asignaciones dicen qué docente enseña cada área en cada sección: créalas en «Grados y secciones».</p>
      </div>
    );
  }

  const level = data.level;
  const applies = (section: MatrixSection, area: PlanArea) => area.grades.includes(section.grade);
  const gapsOf = (section: MatrixSection) => data.plan.filter((area) => applies(section, area) && !byCell.has(`${section.id}|${area.areaId}`)).length;
  const noClassOf = (section: MatrixSection) => data.assignments.filter((a) => a.sectionId === section.id && !a.classroom).length;
  const rows = data.sections.filter((s) => (filter === 'gaps' ? gapsOf(s) > 0 : filter === 'noclass' ? noClassOf(s) > 0 : true));
  const gapCount = data.counts.required - data.counts.assigned;
  const setLevel = (next: SchoolLevel) => {
    const updated = new URLSearchParams(params);
    updated.set('nivel', next);
    setParams(updated, { replace: true });
    setFilter('all');
  };

  // Flechas: de celda en celda (solo las que tienen botón).
  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const move = moves[e.key];
    const current = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    if (!move || !current) return;
    const [r, c] = current.dataset.cell!.split(',').map(Number);
    for (let step = 1; step < 40; step++) {
      const next = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${r + move[0] * step},${c + move[1] * step}"]`);
      if (next) {
        e.preventDefault();
        next.focus();
        return;
      }
      if (move[0] !== 0 && (r + move[0] * step < 0 || r + move[0] * step >= rows.length)) return;
      if (move[1] !== 0 && (c + move[1] * step < 0 || c + move[1] * step >= data.plan.length)) return;
    }
  };

  const openCell = open ? { section: data.sections.find((s) => s.id === open.sectionId), area: data.plan.find((a) => a.areaId === open.areaId) } : null;

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Equipo y carga">
        {data.teachers.map((t) => (
          <li key={t.userId} className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-black text-white" aria-hidden="true">{t.initials}</span>
            <span className="min-w-0">
              <b className="block truncate text-sm text-gray-900 dark:text-white">{t.name}</b>
              <small className="block truncate text-xs text-gray-600 dark:text-gray-300">
                {t.assignments} {t.assignments === 1 ? 'asignación' : 'asig.'}{t.tutorOf.length ? ` · Tutoría ${t.tutorOf.join(', ')}` : ''}
              </small>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {data.levels.length > 1 && (
          <div className="pg-seg" role="group" aria-label="Nivel">
            {data.levels.map((l) => (
              <button key={l} type="button" className="pg-seg-item pg-focus" aria-pressed={l === level} onClick={() => setLevel(l)}>{LEVEL_LABEL[l]}</button>
            ))}
          </div>
        )}
        <button type="button" className="pg-chip pg-focus" aria-pressed={filter === 'gaps'} onClick={() => setFilter(filter === 'gaps' ? 'all' : 'gaps')}>
          Por cubrir <span className="tabular-nums opacity-80">{gapCount}</span>
        </button>
        <button type="button" className="pg-chip pg-focus" aria-pressed={filter === 'noclass'} onClick={() => setFilter(filter === 'noclass' ? 'all' : 'noclass')}>
          Sin clase <span className="tabular-nums opacity-80">{data.counts.withoutClass}</span>
        </button>
        <span className="flex-1" />
        <button type="button" className="pg-btn pg-focus" onClick={() => setPanel('from')}>
          <Wand2 size={16} aria-hidden="true" />Completar desde las clases
        </button>
        <button type="button" className="pg-btn pg-focus" onClick={() => setPanel('plan')}>
          <BookOpen size={16} aria-hidden="true" />Plan de estudios
        </button>
      </div>
      <p className="hidden flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-300 md:flex" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className={`${badge} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100`}>MP</span>con clase</span>
        <span className="flex items-center gap-1.5"><span className={`${badge} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100`}>MP<span className="h-1.5 w-1.5 rounded-full border-[1.5px] border-current" /></span>sin clase</span>
        <span className="flex items-center gap-1.5"><span className={`${badge} border-[1.5px] border-dashed border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100`}>+ Falta</span>sin docente</span>
        <span className="flex items-center gap-1.5"><span className="font-bold text-gray-400">—</span>fuera del plan</span>
      </p>

      <div className="pg-surface overflow-x-auto">
        <table ref={tableRef} className="w-full min-w-[46rem] border-separate border-spacing-0 text-[13px]" role="grid" aria-label={`Asignaciones de ${LEVEL_LABEL[level]}: sección por área`} onKeyDown={onKeyDown}>
          <thead>
            <tr className="text-xs font-bold text-gray-600 dark:text-gray-300">
              <th scope="col" className="h-10 border-b border-gray-200 bg-gray-50 pl-4 text-left dark:border-gray-700 dark:bg-gray-800/80">Sección</th>
              <th scope="col" className="h-10 border-b border-gray-200 bg-gray-50 pl-2 text-left dark:border-gray-700 dark:bg-gray-800/80">Tutoría</th>
              {data.plan.map((area) => {
                const gaps = data.sections.some((s) => applies(s, area) && !byCell.has(`${s.id}|${area.areaId}`));
                return (
                  <th key={area.areaId} scope="col" title={area.name} className={`h-10 border-b border-gray-200 bg-gray-50 px-1 text-center dark:border-gray-700 dark:bg-gray-800/80 ${gaps ? 'text-amber-800 dark:text-amber-200' : ''}`}>
                    {area.shortName ?? area.name}
                  </th>
                );
              })}
              <th scope="col" className="h-10 border-b border-gray-200 bg-gray-50 px-2 text-center dark:border-gray-700 dark:bg-gray-800/80">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={data.plan.length + 3} className="p-6 text-center text-sm text-gray-700 dark:text-gray-300">Ninguna sección con ese filtro.</td></tr>
            )}
            {rows.map((section, r) => {
              const required = data.plan.filter((a) => applies(section, a)).length;
              const assigned = required - gapsOf(section);
              return (
                <tr key={section.id}>
                  <th scope="row" className="h-12 whitespace-nowrap border-b border-gray-100 bg-white pl-4 text-left text-sm font-bold text-gray-900 dark:border-gray-700/60 dark:bg-gray-800 dark:text-white">
                    {section.label}
                    <span className="block text-xs font-normal text-gray-600 dark:text-gray-300">{section.students} est.</span>
                  </th>
                  <td className="h-12 border-b border-gray-100 pl-2 dark:border-gray-700/60">
                    {section.tutor
                      ? <span className={`${badge} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100`} title={section.tutor.name}>{section.tutor.initials}</span>
                      : <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Sin tutoría</span>}
                  </td>
                  {data.plan.map((area, c) => (
                    <td key={area.areaId} className="h-12 border-b border-gray-100 px-0.5 text-center dark:border-gray-700/60">
                      {applies(section, area)
                        ? <Cell section={section} area={area} assignment={byCell.get(`${section.id}|${area.areaId}`)} teacherName={(id) => teacherById.get(id)} position={`${r},${c}`} onOpen={() => setOpen({ sectionId: section.id, areaId: area.areaId })} />
                        : <span className="font-bold text-gray-400" title="No está en el plan de este grado">—</span>}
                    </td>
                  ))}
                  <td className={`h-12 border-b border-gray-100 px-2 text-center font-bold tabular-nums dark:border-gray-700/60 ${assigned < required ? 'text-amber-800 dark:text-amber-200' : 'text-gray-900 dark:text-white'}`}>
                    {assigned}/{required}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-[12.5px] font-bold text-gray-600 dark:text-gray-300">
              <th scope="row" colSpan={2} className="h-10 bg-gray-50 pl-4 text-left dark:bg-gray-800/80">Con docente</th>
              {data.plan.map((area) => {
                const required = data.sections.filter((s) => applies(s, area)).length;
                const assigned = data.sections.filter((s) => applies(s, area) && byCell.has(`${s.id}|${area.areaId}`)).length;
                return <td key={area.areaId} className={`h-10 bg-gray-50 text-center tabular-nums dark:bg-gray-800/80 ${assigned < required ? 'text-amber-800 dark:text-amber-200' : ''}`}>{assigned}/{required}</td>;
              })}
              <td className="h-10 bg-gray-50 text-center tabular-nums dark:bg-gray-800/80">{data.counts.assigned}/{data.counts.required}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {data.counts.missing > 0 && (
        <p className="text-sm text-amber-900 dark:text-amber-100">
          {data.counts.missing} {data.counts.missing === 1 ? 'estudiante aún no está' : 'estudiantes aún no están'} en las clases vinculadas: abre la celda marcada y elige «Sincronizar».
        </p>
      )}

      <AnimatePresence>
        {openCell?.section && openCell.area && (
          <AssignmentDrawer
            key={`${openCell.section.id}|${openCell.area.areaId}`}
            schoolId={schoolId}
            yearId={yearId}
            section={openCell.section}
            area={openCell.area}
            assignment={byCell.get(`${openCell.section.id}|${openCell.area.areaId}`) ?? null}
            teachers={data.teachers}
            onClose={() => setOpen(null)}
          />
        )}
        {panel === 'plan' && <PlanDrawer key="plan" schoolId={schoolId} yearId={yearId} initialLevel={level} onClose={() => setPanel(null)} />}
        {panel === 'from' && <FromClassesDrawer key="from" schoolId={schoolId} yearId={yearId} onClose={() => setPanel(null)} />}
      </AnimatePresence>
    </div>
  );
};

const Cell = ({ section, area, assignment, teacherName, position, onOpen }: {
  section: MatrixSection; area: PlanArea; assignment: MatrixAssignment | undefined;
  teacherName: (id: string) => { name: string; initials: string } | undefined; position: string; onOpen: () => void;
}) => {
  if (!assignment) {
    return (
      <button type="button" data-cell={position} onClick={onOpen} className={`${badge} pg-focus border-[1.5px] border-dashed border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-100`} aria-label={`${section.label}, ${area.name}: falta docente. Asignar`}>
        + Falta
      </button>
    );
  }
  const teacher = teacherName(assignment.teacherUserId);
  const classroom = assignment.classroom;
  const state = !classroom ? 'sin clase vinculada' : classroom.archived ? `clase «${classroom.name}» archivada` : `clase «${classroom.name}»${classroom.missing ? `, faltan ${classroom.missing}` : ''}`;
  return (
    <button
      type="button"
      data-cell={position}
      onClick={onOpen}
      title={`${teacher?.name ?? 'Docente'} · ${state}`}
      aria-label={`${section.label}, ${area.name}: ${teacher?.name ?? 'docente'}, ${state}`}
      className={`${badge} pg-focus relative bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600`}
    >
      {teacher?.initials ?? '?'}
      {(!classroom || classroom.archived) && <span className="h-1.5 w-1.5 rounded-full border-[1.5px] border-current" aria-hidden="true" />}
      {classroom && classroom.missing > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-gray-800" aria-hidden="true" />}
    </button>
  );
};
