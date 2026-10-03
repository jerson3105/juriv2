import { useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu, UserCog } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { adminApi, adminOverviewKey } from '../../lib/adminApi';
import { AppSidebar } from '../layout/sidebar/AppSidebar';
import { TeacherHomeFooter } from '../layout/sidebar/SidebarFooters';
import { useSidebarCollapsed } from '../layout/sidebar/useSidebarState';
import { adminNav } from '../layout/sidebar/navBuilders';

/** «Completa» trabaja a pantalla completa: sin menú (el editor tiene su propia barra con «←»). */
const EDITOR_ROUTE = /^\/admin\/avatar-items\/(nueva|[^/]+\/editar)\/?$/;

/** Sello del panel en la banda: texto, no solo color, para que no se confunda con una vista de docente. */
const AdminSeal = () => (
  <span className="inline-flex items-center rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-950">
    Admin
  </span>
);

/**
 * Armazón del panel de administración: guarda de rol única para todas las páginas, el menú común de Juried
 * (banda de noche con Orión y el sello «Admin») con números donde espera una acción, y el pie con la
 * cuenta, el tema y «Cerrar sesión».
 */
export const AdminLayout = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useSidebarCollapsed('admin');
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === 'ADMIN';
  const { data: overview } = useQuery({
    queryKey: adminOverviewKey,
    queryFn: adminApi.getOverview,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  if (!isAdmin) return <Navigate to="/" replace />;
  if (EDITOR_ROUTE.test(pathname)) return <Outlet />;

  const counts = overview
    ? {
      teacherRequests: overview.teachers.pendingRequests,
      schoolRequests: overview.schools.pendingVerifications,
      drafts: overview.avatarItems.drafts,
      bugReports: overview.bugReports.pending,
    }
    : null;
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <AppSidebar
        accent={null}
        bandTint={null}
        sky={{ kind: 'orion' }}
        twinkle={false}
        logoTo="/admin"
        context={<AdminSeal />}
        nav={adminNav(pathname, counts)}
        navLabel="Menú de administración"
        footerNav={[{ id: 'account', label: 'Mi cuenta', to: '/admin/cuenta', icon: <UserCog size={16} aria-hidden="true" />, active: pathname === '/admin/cuenta' }]}
        footer={({ rail }) => <TeacherHomeFooter user={user} rail={rail} roleLabel="Administración" showTheme onLogout={() => void handleLogout()} />}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        contentRef={contentRef}
        menuButtonRef={menuButtonRef}
      />
      <div ref={contentRef} className={collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}>
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-gray-200 bg-white/90 px-2 backdrop-blur dark:border-gray-700 dark:bg-gray-800/90 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="font-semibold">Administración</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
};
