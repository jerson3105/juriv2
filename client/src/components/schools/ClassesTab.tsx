import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { BarChart3, Search, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { schoolApi, type SchoolClassroom } from '../../lib/schoolApi';
import { gradeLabel, relativeTime } from '../home/homeHelpers';
import { IDLE_DAYS, isIdle } from './schoolHelpers';
import { SideDrawer } from './SideDrawer';

const selectClass = 'h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

const ClassReport = ({ schoolId, classroom }: { schoolId: string; classroom: SchoolClassroom }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['school-class-report', schoolId, classroom.id],
    queryFn: () => schoolApi.getClassroomReport(schoolId, classroom.id),
  });
  if (isLoading) return <p className="text-sm text-gray-700 dark:text-gray-300" role="status">Cargando reporte...</p>;
  if (isError || !data) return <p className="text-sm text-red-700 dark:text-red-300" role="alert">No se pudo cargar el reporte de esta clase.</p>;
  const { stats, attendance } = data;
  const tiles = [
    { label: 'XP otorgado', value: `+${stats.totalXpGiven.toLocaleString('es')}` },
    { label: 'XP retirado', value: `−${stats.totalXpRemoved.toLocaleString('es')}` },
    { label: 'Asistencia', value: (attendance.daysRecorded ?? 0) > 0 ? `${Math.round(attendance.attendanceRate)}% en ${attendance.daysRecorded} días` : 'Sin registros' },
    { label: 'Compras en tienda', value: stats.totalPurchases.toLocaleString('es') },
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/50">
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{t.label}</dt>
            <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{t.value}</dd>
          </div>
        ))}
      </dl>
      {stats.topStudents.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">Top estudiantes por XP</h3>
          <ol className="space-y-1.5">
            {stats.topStudents.slice(0, 5).map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-center font-black text-gray-700 dark:text-gray-300">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-gray-900 dark:text-white">{s.name}</span>
                <span className="font-bold tabular-nums text-gray-900 dark:text-white">{s.xp.toLocaleString('es')} XP</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {(stats.topPositiveBehaviors.length > 0 || stats.topNegativeBehaviors.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { title: 'Lo que más se reconoce', icon: TrendingUp, items: stats.topPositiveBehaviors, color: 'text-green-800 dark:text-green-200' },
            { title: 'Lo que más se corrige', icon: TrendingDown, items: stats.topNegativeBehaviors, color: 'text-red-800 dark:text-red-200' },
          ].filter((g) => g.items.length > 0).map((g) => (
            <div key={g.title}>
              <h3 className={`mb-2 flex items-center gap-1.5 text-sm font-bold ${g.color}`}><g.icon size={16} aria-hidden="true" />{g.title}</h3>
              <ul className="space-y-1">
                {g.items.map((b) => (
                  <li key={b.name} className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                    <span aria-hidden="true">{b.icon || '•'}</span>
                    <span className="min-w-0 flex-1 truncate">{b.name}</span>
                    <span className="font-bold tabular-nums">{b.count}×</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </>
  );
};

interface ClassesTabProps {
  schoolId: string;
  manage: boolean;
  classrooms: SchoolClassroom[];
  isLoading: boolean;
}

export const ClassesTab = ({ schoolId, manage, classrooms, isLoading }: ClassesTabProps) => {
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [grade, setGrade] = useState('');
  const [teacher, setTeacher] = useState('');
  const [report, setReport] = useState<SchoolClassroom | null>(null);

  const areas = useMemo(() => [...new Set(classrooms.map((c) => c.curriculumAreaName ?? ''))].sort((a, b) => a.localeCompare(b, 'es')), [classrooms]);
  const grades = useMemo(() => [...new Set(classrooms.map((c) => c.gradeLevel ?? ''))].sort(), [classrooms]);
  const teachers = useMemo(() => [...new Map(classrooms.map((c) => [c.teacherId, c.teacherName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')), [classrooms]);

  const term = search.trim().toLocaleLowerCase('es');
  const visible = classrooms
    .filter((c) => (!area || (c.curriculumAreaName ?? '') === (area === '__none' ? '' : area))
      && (!grade || (c.gradeLevel ?? '') === (grade === '__none' ? '' : grade))
      && (!teacher || c.teacherId === teacher)
      && (!term || [c.name, c.code ?? '', c.teacherName, gradeLabel(c.gradeLevel) ?? '', c.curriculumAreaName ?? ''].some((v) => v.toLocaleLowerCase('es').includes(term))))
    .sort((a, b) => (gradeLabel(a.gradeLevel) ?? 'zz').localeCompare(gradeLabel(b.gradeLevel) ?? 'zz', 'es') || a.name.localeCompare(b.name, 'es'));
  const students = visible.reduce((s, c) => s + c.studentCount, 0);
  const filtered = !!(area || grade || teacher || term);

  if (isLoading) return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />)}</div>;
  if (classrooms.length === 0) {
    return <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-800 dark:border-gray-600 dark:text-gray-200">Aún no hay clases en la escuela. Aparecen aquí cuando los profesores asignan sus clases.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar clase</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar clase, código o profesor" className={`${selectClass} w-full pl-9`} />
        </label>
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3 lg:flex">
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área" className={selectClass}>
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a || '__none'} value={a || '__none'}>{a || 'Sin área'}</option>)}
          </select>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="Filtrar por grado" className={selectClass}>
            <option value="">Todos los grados</option>
            {grades.map((g) => <option key={g || '__none'} value={g || '__none'}>{gradeLabel(g) ?? 'Sin grado'}</option>)}
          </select>
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)} aria-label="Filtrar por profesor" className={selectClass}>
            <option value="">Todos los profesores</option>
            {teachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'clase' : 'clases'} · {students} estudiantes
        {filtered && <button type="button" onClick={() => { setSearch(''); setArea(''); setGrade(''); setTeacher(''); }} className="ml-2 font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">Quitar filtros</button>}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-800 dark:border-gray-600 dark:text-gray-200">Ninguna clase coincide con los filtros.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const idle = isIdle(c.lastActivityAt, c.studentCount);
            return (
              <li key={c.id} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-gray-900 dark:text-white" title={c.name}>{c.name}</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{[gradeLabel(c.gradeLevel), c.curriculumAreaName].filter(Boolean).join(' · ') || 'Sin grado ni área'}</p>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200">{c.teacherName}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <span className="inline-flex items-center gap-1"><Users size={14} aria-hidden="true" />{c.studentCount}</span>
                  {c.code && <span className="font-mono text-xs">{c.code}</span>}
                  <span>{c.lastActivityAt ? `activa ${relativeTime(c.lastActivityAt)}` : 'sin actividad reciente'}</span>
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  {idle ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Sin puntos en {IDLE_DAYS} días</span>
                  ) : <span />}
                  {manage && (
                    <button type="button" onClick={() => setReport(c)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                      <BarChart3 size={16} aria-hidden="true" />
                      Ver reporte
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AnimatePresence>
        {report && (
          <SideDrawer key={report.id} title={report.name} subtitle={`${report.teacherName} · ${report.studentCount} estudiantes`} onClose={() => setReport(null)}>
            <ClassReport schoolId={schoolId} classroom={report} />
          </SideDrawer>
        )}
      </AnimatePresence>
    </div>
  );
};
