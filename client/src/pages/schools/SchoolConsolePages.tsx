import { useRef } from 'react';
import { useSchoolConsole } from '../../components/layout/schoolConsoleContext';
import { useSchoolPanelData } from '../../components/schools/useSchoolPanelData';
import { TeachersTab } from '../../components/schools/TeachersTab';
import { ClassesTab } from '../../components/schools/ClassesTab';
import { LibraryTab } from '../../components/schools/LibraryTab';
import { ReportsTab, SummaryTab } from '../../components/schools/ReportsTab';
import { useAuthStore } from '../../store/authStore';

/**
 * Páginas de la consola que reutilizan las pestañas de «Mi Escuela» (docentes, clases, informes, biblioteca). Las
 * siguientes entregas las amplían (asignaciones, Mi carga…).
 */

const PageHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <header className="mb-5">
    <h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">{title}</h1>
    <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{subtitle}</p>
  </header>
);

export const SchoolTeachersPage = () => {
  const { school, manager } = useSchoolConsole();
  const { user } = useAuthStore();
  const { detail, classrooms, teachers, requests, loadingTeachers } = useSchoolPanelData(school, manager);
  const subtitle = [
    loadingTeachers ? null : `${teachers.length} ${teachers.length === 1 ? 'docente' : 'docentes'}`,
    manager && requests.length > 0 ? `${requests.length} ${requests.length === 1 ? 'solicitud para unirse' : 'solicitudes para unirse'}` : null,
  ].filter(Boolean).join(' · ') || 'El equipo de la escuela';
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Docentes" subtitle={subtitle} />
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
    </div>
  );
};

export const SchoolClassesPage = () => {
  const { school, manager } = useSchoolConsole();
  const { classrooms, loadingDetail } = useSchoolPanelData(school, manager);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Clases" subtitle={loadingDetail ? 'Las clases de los docentes de la escuela' : `${classrooms.length} ${classrooms.length === 1 ? 'clase' : 'clases'} en la escuela`} />
      <ClassesTab schoolId={school.id} manage={manager} classrooms={classrooms} isLoading={loadingDetail} />
    </div>
  );
};

export const SchoolReportsPage = () => {
  const { school, manager } = useSchoolConsole();
  const { classrooms } = useSchoolPanelData(school, manager);
  const reportsRef = useRef<HTMLDivElement>(null);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Informes" subtitle="Participación y asistencia de la escuela" />
      <SummaryTab schoolId={school.id} onOpenReports={() => reportsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      <div ref={reportsRef}>
        <ReportsTab schoolId={school.id} schoolName={school.name} classrooms={classrooms} />
      </div>
    </div>
  );
};

export const SchoolLibraryPage = () => {
  const { school, manager } = useSchoolConsole();
  const { user } = useAuthStore();
  const { classrooms } = useSchoolPanelData(school, manager);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Biblioteca" subtitle="Comportamientos e insignias que la escuela comparte con sus clases" />
      <LibraryTab schoolId={school.id} manage={manager} myClassrooms={classrooms.filter((c) => c.teacherId === user?.id)} />
    </div>
  );
};
