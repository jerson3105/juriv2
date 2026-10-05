import { useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { schoolApi } from '../../lib/schoolApi';
import { schoolYearApi, schoolYearKeys } from '../../lib/schoolYearApi';
import { coordinatorApi, coordinatorKeys } from '../../lib/schoolCoordinatorApi';
import type { SchoolConsoleContext } from './schoolConsoleContext';
import { canManageSchool, canViewSchool, mySchoolsKey, pendingRequestsKey } from '../schools/schoolHelpers';
import { YearMenu } from '../schools/console/YearMenu';
import { AppSidebar } from './sidebar/AppSidebar';
import { SchoolSealCard } from './sidebar/SchoolSealCard';
import { TeacherHomeFooter } from './sidebar/SidebarFooters';
import { schoolConsoleNav } from './sidebar/navBuilders';
import { useSidebarCollapsed } from './sidebar/useSidebarState';

const FRAME = 'fixed inset-0 z-[100] flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800';

const todayLabel = () => {
  const text = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Consola escolar: un contexto propio, como el aula (cubre a MainLayout). El sidebar muestra el menú del colegio con
 * su sello; la barra superior, el año escolar.
 */
export const SchoolLayout = () => {
  const { schoolId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useSidebarCollapsed('teacher');
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: schools, isLoading, isError, refetch } = useQuery({ queryKey: mySchoolsKey, queryFn: schoolApi.getMySchools });
  const school = schools?.find((s) => s.id === schoolId);
  const verified = school?.memberStatus === 'VERIFIED';
  const manager = !!school && canManageSchool(school);
  const years = useQuery({ queryKey: schoolYearKeys.list(schoolId), queryFn: () => schoolYearApi.list(schoolId), enabled: verified });
  const requests = useQuery({ queryKey: pendingRequestsKey(schoolId), queryFn: () => schoolApi.getPendingRequests(schoolId), enabled: manager });
  const activeYearId = years.data?.find((year) => year.status === 'ACTIVE')?.id ?? '';
  const coordinations = useQuery({
    queryKey: coordinatorKeys.mine(schoolId, activeYearId),
    queryFn: () => coordinatorApi.mine(schoolId, activeYearId),
    enabled: verified && !!activeYearId,
  });

  if (isLoading) {
    return (
      <div className={`${FRAME} items-center justify-center`} aria-busy="true" aria-label="Cargando la escuela">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600 motion-reduce:animate-none" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className={`${FRAME} items-center justify-center p-4`}>
        <div className="max-w-sm rounded-2xl border border-red-200 bg-white p-6 text-center dark:border-red-500/40 dark:bg-gray-800" role="alert">
          <p className="font-semibold text-gray-900 dark:text-white">No se pudo abrir la escuela.</p>
          <button type="button" onClick={() => void refetch()} className="mt-3 min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">Reintentar</button>
        </div>
      </div>
    );
  }
  if (!school || !canViewSchool(school)) return <Navigate to="/schools" replace />;

  const yearList = years.data ?? [];
  const activeYear = yearList.find((year) => year.status === 'ACTIVE') ?? null;
  const roleLabel = !verified ? 'Por verificar' : manager ? 'Administración' : 'Docente';
  const context: SchoolConsoleContext = { school, manager, verified, years: yearList, activeYear, yearsLoading: years.isLoading, coordinations: coordinations.data ?? [] };

  return (
    <div className={FRAME}>
      <AppSidebar
        accent={null}
        bandTint={null}
        sky={{ kind: 'orion' }}
        twinkle={false}
        logoTo="/dashboard"
        context={<SchoolSealCard name={school.name} roleLabel={roleLabel} onBack={() => navigate('/dashboard')} />}
        nav={schoolConsoleNav({ schoolId, pathname: location.pathname, manager, verified, pendingRequests: requests.data?.length ?? 0, coordinates: (coordinations.data?.length ?? 0) > 0 })}
        navLabel="Menú de la escuela"
        footer={({ rail }) => <TeacherHomeFooter user={user} rail={rail} onLogout={() => void logout()} roleLabel={roleLabel} />}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        contentRef={contentRef}
        menuButtonRef={menuButtonRef}
      />
      <div ref={contentRef} className={`relative z-10 flex flex-1 flex-col overflow-hidden ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <header className="relative flex h-14 items-center gap-2 border-b border-white/50 bg-white/80 px-2 shadow-sm backdrop-blur-lg dark:border-gray-700/50 dark:bg-gray-800/80 sm:px-4">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 lg:hidden"
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          {verified && <YearMenu schoolId={schoolId} years={yearList} activeYear={activeYear} manager={manager} />}
          <span className="flex-1" />
          <span className="hidden text-sm text-gray-600 dark:text-gray-300 sm:block">{todayLabel()}</span>
        </header>
        <main data-pg className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
};
