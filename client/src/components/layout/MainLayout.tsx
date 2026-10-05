import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronDown, Coins, Heart, LogOut, Menu, Moon, Plus, Settings, Users, Zap } from 'lucide-react';
import { Hearts } from '../energy/EnergyMeter';
import { isYoungLevel } from '../energy/energyHelpers';
import { useAuthStore } from '../../store/authStore';
import { accountLabel } from '../auth/authHelpers';
import { useStudentStore } from '../../store/studentStore';
import { useThemeStore } from '../../store/themeStore';
import { useAnnouncer } from '../../store/announcerStore';
import { useCurrentStudentProfile } from '../../hooks/useCurrentStudentProfile';
import { expeditionApi, expeditionKeys } from '../../lib/expeditionApi';
import { ThemeToggle } from '../ui/ThemeToggle';
import { NotificationsBell, NotificationsPanel } from '../NotificationsPanel';
import { BugReportButton } from '../BugReportButton';
import { ParticleLayer } from '../story/ParticleLayer';
import { deriveStoryAccent, storyAccentVars, accentGradient, mixHex } from '../../lib/storyTheme';
import { useStoryParticles } from '../../hooks/useStoryParticles';
import { useStoryLive } from '../../hooks/useStoryLive';
import { StudentEntryEffects } from '../student/StudentEntryEffects';
import { levelProgress } from '../students/profile/profileHelpers';
import { classSkyFor, litStarsFor } from '../student/home/classSky';
import { AppSidebar } from './sidebar/AppSidebar';
import { ClassSwitcher, type ClassLink } from './sidebar/ClassSwitcher';
import type { BandSky } from './sidebar/SidebarBand';
import { StudentDrawerFooter, TeacherHomeFooter } from './sidebar/SidebarFooters';
import { studentClassNav, studentEmptyNav, studentRouteAvailable, teacherHomeNav } from './sidebar/navBuilders';
import { useSidebarCollapsed } from './sidebar/useSidebarState';

const NIGHT = '#0b1026';

export const MainLayout = () => {
  const { user, logout } = useAuthStore();
  const pendingClassCode = useStudentStore((state) => state.pendingClassCode);
  const setPendingClassCode = useStudentStore((state) => state.setPendingClassCode);
  const forgetProfile = useStudentStore((state) => state.forgetProfile);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const announcement = useAnnouncer((state) => state.message);
  const announce = useAnnouncer((state) => state.announce);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isTeacher = user?.role === 'TEACHER';
  const [collapsed, setCollapsed] = useSidebarCollapsed(isTeacher ? 'teacher' : 'student');

  // La clase abierta del alumno (por id: sobrevive a la recarga).
  const { myClasses, profile: currentProfile, source, stale, isFetching, selectProfile } = useCurrentStudentProfile();

  // Entró con PIN por una clase: esa queda elegida (manda sobre la que recordaba).
  useEffect(() => {
    if (!pendingClassCode || !myClasses) return;
    if (source === 'pending' && currentProfile) selectProfile(currentProfile.id);
    setPendingClassCode(null);
  }, [pendingClassCode, myClasses, source, currentProfile, selectProfile, setPendingClassCode]);

  // La clase que recordaba ya no está en su lista (la archivaron o lo quitaron): se olvida, con aviso.
  useEffect(() => {
    if (!stale || isFetching) return;
    forgetProfile(user?.id);
    toast('La clase que tenías abierta ya no está en tu lista.', { id: 'class-gone', icon: 'ℹ️' });
  }, [stale, isFetching, forgetProfile, user?.id]);

  // Tema de la clase para lo que ocurre al entrar (historia), en cualquier pantalla.
  const entryAccent = useMemo(
    () => deriveStoryAccent(currentProfile?.classroom?.themeConfig ?? null),
    [currentProfile?.classroom?.themeConfig],
  );

  // Expediciones de la clase (misma caché que el Inicio y el calendario): el menú las muestra si hay; el punto,
  // solo si hay algo que el alumno pueda hacer (no si espera a su profe).
  const { data: studentExpeditions = [] } = useQuery({
    queryKey: expeditionKeys.mine(currentProfile?.classroomId ?? ''),
    queryFn: () => expeditionApi.mine(currentProfile!.classroomId),
    enabled: !isTeacher && !!currentProfile?.classroomId,
  });
  const hasActiveExpeditions = studentExpeditions.some((expedition) => expedition.actionable);

  const matchesPath = (path: string, mode: 'exact' | 'startsWith' = 'exact') => {
    if (mode === 'startsWith') {
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    }
    return location.pathname === path;
  };

  const hasCompetencyOverview = !!myClasses?.some((profile) => profile.classroom?.useCompetencies);
  // Vistas de todas las clases: la barra superior no muestra los datos de una sola.
  const isStudentOverviewZone = !isTeacher && ['/dashboard', '/my-classes', '/my-skills', '/join-class'].some((path) => matchesPath(path));
  const isStudentClassThemeRoute = !isTeacher && [
    { path: '/my-class', mode: 'exact' as const },
    { path: '/my-clan', mode: 'exact' as const },
    { path: '/my-calendar', mode: 'exact' as const },
    { path: '/scrolls', mode: 'exact' as const },
    { path: '/my-grades', mode: 'exact' as const },
    { path: '/my-progress', mode: 'exact' as const },
    { path: '/my-shop', mode: 'exact' as const },
    { path: '/my-badges', mode: 'exact' as const },
    { path: '/my-avatar', mode: 'exact' as const },
    { path: '/expeditions', mode: 'startsWith' as const },
    { path: '/collectibles', mode: 'exact' as const },
    { path: '/my-story', mode: 'exact' as const },
  ].some((route) => matchesPath(route.path, route.mode));

  // El tema de clase solo debe afectar rutas dentro del aula del estudiante.
  const themeSource = !isTeacher && isStudentClassThemeRoute ? currentProfile?.classroom?.themeConfig : null;
  const storyAccent = useMemo(() => deriveStoryAccent(themeSource), [themeSource]);
  const hasStoryTheme = !!storyAccent;
  const [studentParticles] = useStoryParticles('student');
  // El alumno recibe en vivo los finales que revela su profe.
  useStoryLive(!isTeacher ? currentProfile?.classroomId : null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    if (typeof document === 'undefined' || isTeacher) {
      return;
    }

    // El tema de la historia ya no fuerza el modo claro: cada alumno conserva su preferencia.
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [isTeacher, resolvedTheme]);

  // ── Sidebar ─────────────────────────────────────────────────────────────────────────────────
  const pathname = location.pathname;
  // Dentro de una clase, ClassroomLayout (hija de esta ruta) cubre todo con su propio menú: este no se
  // monta (si no, quedaban dos menús para el lector y el teclado, y su estado se desfasaba).
  const coveredByClassroom = isTeacher && (pathname.startsWith('/classroom/') || pathname.startsWith('/escuela/'));
  const xpPerLevel = (currentProfile?.classroom as { xpPerLevel?: number } | undefined)?.xpPerLevel || 100;
  const levelPercent = currentProfile ? levelProgress(currentProfile.xp, currentProfile.level, xpPerLevel).percent : 0;

  const nav = isTeacher
    ? teacherHomeNav(pathname)
    : currentProfile
      ? studentClassNav({
        profile: currentProfile,
        pathname,
        expeditions: studentExpeditions.length,
        hasActiveExpeditions,
        hasStoryTheme,
      })
      : studentEmptyNav(pathname);

  // El cielo de la clase (el mismo de su Inicio), encendido con su nivel; fuera de una clase, Orión.
  const sky: BandSky = !isTeacher && currentProfile
    ? { kind: 'class', constellation: classSkyFor(currentProfile.classroomId), lit: litStarsFor(levelPercent), key: currentProfile.classroomId }
    : { kind: 'orion' };

  const classLinks: ClassLink[] = [
    { to: '/join-class', label: 'Unirme a otra clase', icon: <Plus size={16} aria-hidden="true" /> },
    { to: '/my-classes', label: 'Ver todas mis clases', icon: <Users size={16} aria-hidden="true" /> },
    ...(hasCompetencyOverview ? [{ to: '/my-skills', label: 'Destrezas', icon: <BookOpen size={16} aria-hidden="true" /> }] : []),
  ];

  // Cambiar de clase: sigue en la misma página si existe en la otra; si no, va a su Inicio con aviso.
  const handleSelectClass = (profileId: string) => {
    const next = myClasses?.find((profile) => profile.id === profileId);
    if (!next) return;
    selectProfile(profileId);
    const name = next.classroom?.name ?? 'tu clase';
    announce(`Ahora estás en «${name}»`);
    if (!studentRouteAvailable(next, location.pathname)) {
      navigate('/my-class');
      toast(`En «${name}» no está esta sección: te llevamos a su inicio.`, { id: 'class-section-missing', icon: 'ℹ️' });
    }
  };

  return (
    <div
      className="relative isolate min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
      style={storyAccentVars(storyAccent)}
    >
      {/* Partículas suaves del tema, detrás del contenido (el alumno puede apagarlas en Mi Historia) */}
      {storyAccent?.particles && studentParticles && (
        <ParticleLayer particles={storyAccent.particles} accentColor={storyAccent.primary} />
      )}

      {!coveredByClassroom && <AppSidebar
        accent={storyAccent}
        bandTint={storyAccent ? mixHex(NIGHT, storyAccent.sidebar, 0.35) : null}
        sky={sky}
        // Hasta 5 estrellas titilan al llegar; en el Inicio no, porque su cielo ya se mueve.
        twinkle={isTeacher || pathname !== '/my-class'}
        logoTo={isTeacher || !currentProfile ? '/dashboard' : '/my-class'}
        context={!isTeacher && currentProfile && myClasses
          ? <ClassSwitcher classes={myClasses} current={currentProfile} onSelect={handleSelectClass} links={classLinks} />
          : undefined}
        nav={nav}
        navLabel={isTeacher ? 'Menú principal' : 'Menú de la clase'}
        footer={isTeacher
          ? ({ rail }) => <TeacherHomeFooter user={user} rail={rail} onLogout={() => void handleLogout()} />
          : ({ drawer }) => (drawer ? <StudentDrawerFooter firstName={user?.firstName} onLogout={() => void handleLogout()} /> : null)}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
        contentRef={contentRef}
        menuButtonRef={menuButtonRef}
      />}
      <p className="sr-only" aria-live="polite">{announcement}</p>

      {/* Main Content */}
      <div ref={contentRef} className={collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}>
        {/* Top Bar */}
        <header
          className="sticky top-0 z-30 h-14 backdrop-blur-lg shadow-sm bg-white/80 dark:bg-gray-800/80 border-b border-white/50 dark:border-gray-700/50"
        >
          {storyAccent && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5" style={{ background: accentGradient(storyAccent, 90) }} aria-hidden="true" />
          )}
          <div className="flex h-full items-center px-4">
            <div className="flex min-w-0 flex-1 items-center">
              {/* Mobile Menu Button */}
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menú"
                aria-expanded={sidebarOpen}
                className={`lg:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700`}
              >
                <Menu size={20} aria-hidden="true" />
              </button>

              {/* Nivel, energía y oro de la clase (el nivel con el sistema de niveles de la clase).
                  En el Inicio no se repiten: los muestra el bloque del personaje. */}
              {!isTeacher && currentProfile && !isStudentOverviewZone && !matchesPath('/my-class') && (() => {
                const classroom = currentProfile.classroom as { xpPerLevel?: number; maxHp?: number; gradeLevel?: string | null };
                const level = levelProgress(currentProfile.xp, currentProfile.level, classroom.xpPerLevel || 100);
                const maxHp = classroom.maxHp || 100;
                return (
                  // En el celular: chips compactos y alineados a la izquierda; si no caben, se desplazan
                  // (centrados se salían por los dos lados y tapaban el menú y la campana).
                  <div className="flex min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto sm:gap-2 md:ml-2 md:gap-3">
                    {/* Nivel + XP del nivel */}
                    <div className="flex flex-shrink-0 items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-100 sm:gap-1.5 sm:px-2.5">
                      <Zap size={13} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />
                      <span className="sr-only">Nivel {currentProfile.level}, {level.inLevel} de {level.needed} XP</span>
                      <span aria-hidden="true"><span className="hidden sm:inline">Nv.</span>{currentProfile.level}</span>
                      <span className="hidden sm:inline" aria-hidden="true">· {level.inLevel}/{level.needed} XP</span>
                    </div>

                    {/* Energía: luna si descansa, corazones de inicial a 2.º, número con el máximo de la clase */}
                    {currentProfile.hp <= 0 ? (
                      <div className="flex flex-shrink-0 items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100 sm:gap-1.5 sm:px-2.5">
                        <Moon size={13} className="fill-current" aria-hidden="true" />
                        <span className="max-sm:sr-only">Descansando</span>
                      </div>
                    ) : isYoungLevel(classroom.gradeLevel) ? (
                      <div className="flex flex-shrink-0 items-center px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20">
                        <Hearts hp={currentProfile.hp} maxHp={maxHp} />
                      </div>
                    ) : (
                      <div className="flex flex-shrink-0 items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-100 sm:gap-1.5 sm:px-2.5">
                        <Heart size={13} className="text-red-600 dark:text-red-300" aria-hidden="true" />
                        <span className="sr-only">Energía {currentProfile.hp} de {maxHp}</span>
                        <span aria-hidden="true">{currentProfile.hp}<span className="hidden sm:inline">/{maxHp}</span></span>
                      </div>
                    )}

                    {/* Oro */}
                    <div className="flex flex-shrink-0 items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 sm:gap-1.5 sm:px-2.5">
                      <Coins size={13} className="text-amber-600 dark:text-amber-300" aria-hidden="true" />
                      <span className="sr-only">Oro: </span>
                      <span>{currentProfile.gp}</span>
                    </div>
                  </div>
                );
              })()}

              {(isTeacher || isStudentOverviewZone || (!isTeacher && !currentProfile) || (!isTeacher && matchesPath('/my-class'))) && <div className="flex-1" />}
            </div>

            <div className="ml-auto flex items-center gap-2 md:gap-3">
              {/* Notificaciones (solo para estudiantes) */}
              {!isTeacher && (
                <NotificationsBell onClick={() => setShowNotifications(true)} classroomId={currentProfile?.classroomId} />
              )}

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Alumno: "Salir" siempre a la vista (computadoras compartidas del colegio) */}
              {!isTeacher && (
                <button
                  type="button"
                  onClick={handleLogout}
                  title={user?.firstName ? `¿No eres ${user.firstName}? Sal aquí` : 'Salir'}
                  className="hidden sm:inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  <LogOut size={16} aria-hidden="true" />
                  Salir
                </button>
              )}

              {/* User Menu */}
              <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`Menú de ${user?.firstName ?? 'usuario'}`}
                className={`flex min-h-[44px] items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700`}
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${user.avatarUrl.startsWith('/api') ? user.avatarUrl.replace('/api', '') : user.avatarUrl}`}
                    alt="Avatar"
                    className="w-8 h-8 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-sm">
                    <span className="text-white text-xs font-bold">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className={`text-sm font-medium text-gray-800 dark:text-white`}>
                    {user?.firstName}
                  </p>
                </div>
                <ChevronDown size={14} className="hidden text-gray-400 sm:block" aria-hidden="true" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50"
                    >
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{accountLabel(user)}</p>
                      </div>
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Settings size={16} />
                        Configuración
                      </Link>
                      {/* Alumno: sus clases, unirse a otra y sus destrezas (también en «Tus clases» del menú) */}
                      {!isTeacher && myClasses && myClasses.length > 1 && (
                        <Link
                          to="/my-classes"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex min-h-[44px] items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Users size={16} aria-hidden="true" />
                          Mis clases
                        </Link>
                      )}
                      {!isTeacher && hasCompetencyOverview && (
                        <Link
                          to="/my-skills"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex min-h-[44px] items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <BookOpen size={16} aria-hidden="true" />
                          Destrezas
                        </Link>
                      )}
                      {!isTeacher && (
                        <Link
                          to="/join-class"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex min-h-[44px] items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Plus size={16} aria-hidden="true" />
                          Unirme a otra clase
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex min-h-[44px] items-center gap-2 px-3 py-2 w-full text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <LogOut size={16} />
                        Cerrar sesión
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet context={{ storyTheme: null, isThemeDark: false, hasStoryTheme: false, storyAccent }} />
        </main>
      </div>

      {/* Panel de notificaciones (solo para estudiantes) */}
      {!isTeacher && (
        <NotificationsPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* Al entrar, en cualquier pantalla: historia, celebración y día de racha de la clase actual */}
      {!isTeacher && currentProfile && (
        <StudentEntryEffects key={currentProfile.id} profile={currentProfile} storyAccent={entryAccent} />
      )}

      {/* Botón de reporte de bugs (solo para profesores) */}
      {isTeacher && <BugReportButton />}
    </div>
  );
};
