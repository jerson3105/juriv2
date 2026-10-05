import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { useSchoolPanelData } from '../../components/schools/useSchoolPanelData';
import { TeachersTab } from '../../components/schools/TeachersTab';
import { ClassesTab } from '../../components/schools/ClassesTab';
import { LibraryTab } from '../../components/schools/LibraryTab';
import { ReportsTab, SummaryTab } from '../../components/schools/ReportsTab';
import { useAuthStore } from '../../store/authStore';
import { AssignmentsTab } from '../../components/schools/console/AssignmentsTab';
import { CoordinatorsTab } from '../../components/schools/console/CoordinatorsTab';

/**
 * Páginas de la consola que reutilizan las pestañas de «Mi Escuela» (docentes, clases, informes, biblioteca). Las
 * siguientes entregas las amplían (asignaciones, Mis asignaciones…).
 */

const PageHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <header className="mb-5">
    <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">{title}</h1>
    <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>
  </header>
);

export const SchoolTeachersPage = () => {
  const { school, manager, selectedYear } = useSchoolConsole();
  const { user } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const { detail, classrooms, teachers, requests, loadingTeachers } = useSchoolPanelData(school, manager);
  // Equipo | Asignaciones | Coordinación (las dos últimas, solo la administración); la vista va en la URL.
  const VIEWS = { asignaciones: 'assignments', coordinacion: 'coordination' } as const;
  const view: 'team' | 'assignments' | 'coordination' = manager ? VIEWS[params.get('vista') as keyof typeof VIEWS] ?? 'team' : 'team';
  const setView = (next: typeof view) => {
    const updated = new URLSearchParams(params);
    if (next === 'assignments') updated.set('vista', 'asignaciones');
    else if (next === 'coordination') updated.set('vista', 'coordinacion');
    else {
      updated.delete('vista');
      updated.delete('nivel');
    }
    setParams(updated, { replace: true });
  };
  const needsYear = (
    <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
      {view === 'coordination' ? 'Los coordinadores' : 'Las asignaciones'} son de un año escolar: <Link to={`/escuela/${school.id}/anio`} className="font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">prepara el año</Link>.
    </p>
  );
  const subtitle = [
    loadingTeachers ? null : `${teachers.length} ${teachers.length === 1 ? 'docente' : 'docentes'}`,
    manager && requests.length > 0 ? `${requests.length} ${requests.length === 1 ? 'solicitud para unirse' : 'solicitudes para unirse'}` : null,
  ].filter(Boolean).join(' · ') || 'El equipo de la escuela';
  return (
    <div className="w-full">
      <PageHeader title="Docentes" subtitle={subtitle} />
      {manager && (
        <div className="pg-seg mb-4" role="group" aria-label="Docentes">
          <button type="button" className="pg-seg-item pg-focus" aria-pressed={view === 'team'} onClick={() => setView('team')}>
            Equipo <span className="tabular-nums opacity-80">{teachers.length}</span>
          </button>
          <button type="button" className="pg-seg-item pg-focus" aria-pressed={view === 'assignments'} onClick={() => setView('assignments')}>Asignaciones</button>
          <button type="button" className="pg-seg-item pg-focus" aria-pressed={view === 'coordination'} onClick={() => setView('coordination')}>Coordinación</button>
        </div>
      )}
      {view === 'assignments' ? (
        selectedYear ? <AssignmentsTab schoolId={school.id} yearId={selectedYear.id} yearName={selectedYear.name} yearStatus={selectedYear.status} /> : needsYear
      ) : view === 'coordination' ? (
        selectedYear ? <CoordinatorsTab schoolId={school.id} yearId={selectedYear.id} /> : needsYear
      ) : (
      <TeachersTab
        school={school}
        manage={manager}
        currentUserId={user?.id}
        teachers={teachers}
        classrooms={classrooms}
        requests={requests}
        inviteCode={detail?.inviteCode ?? null}
        inviteExpiresAt={detail?.inviteExpiresAt ?? null}
        isLoading={loadingTeachers}
      />
      )}
    </div>
  );
};

export const SchoolClassesPage = () => {
  const { school, manager } = useSchoolConsole();
  const { classrooms, loadingDetail } = useSchoolPanelData(school, manager);
  return (
    <div className="w-full">
      <PageHeader title="Clases" subtitle={loadingDetail ? 'Las clases de los docentes de la escuela' : `${classrooms.length} ${classrooms.length === 1 ? 'clase' : 'clases'} en la escuela`} />
      <ClassesTab schoolId={school.id} manage={manager} classrooms={classrooms} isLoading={loadingDetail} />
    </div>
  );
};

export const SchoolReportsPage = () => {
  const { school, manager, selectedYear } = useSchoolConsole();
  const { classrooms } = useSchoolPanelData(school, manager);
  const reportsRef = useRef<HTMLDivElement>(null);
  return (
    <div className="space-y-6">
      <PageHeader title="Informes" subtitle={selectedYear ? `Participación y asistencia de las clases de ${selectedYear.name}` : 'Participación y asistencia de la escuela'} />
      <SummaryTab schoolId={school.id} yearId={selectedYear?.id ?? null} onOpenReports={() => reportsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      <div ref={reportsRef}>
        <ReportsTab schoolId={school.id} schoolName={school.name} classrooms={classrooms} yearId={selectedYear?.id ?? null} />
      </div>
    </div>
  );
};

export const SchoolLibraryPage = () => {
  const { school, manager, coordinations } = useSchoolConsole();
  const { user } = useAuthStore();
  const { classrooms } = useSchoolPanelData(school, manager);
  return (
    <div className="w-full">
      <PageHeader title="Biblioteca" subtitle="Comportamientos e insignias que la escuela comparte con sus clases" />
      <LibraryTab schoolId={school.id} manage={manager} myClassrooms={classrooms.filter((c) => c.teacherId === user?.id)} coordinations={coordinations} />
    </div>
  );
};
