import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Coins,
  Zap,
  Check,
  Shield,
  Calendar,
  ScrollText,
  Map,
  BookOpen,
  Album,
  School,
  BookMarked,
  BarChart3,
  ShoppingBag,
  Medal,
  Shirt,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useStudentStore } from '../../store/studentStore';
import { useThemeStore } from '../../store/themeStore';
import { studentApi } from '../../lib/studentApi';
import { useCharacterClasses } from '../../hooks/useCharacterClasses';
import { expeditionApi } from '../../lib/expeditionApi';
import { ThemeToggle } from '../ui/ThemeToggle';
import { NotificationsBell, NotificationsPanel } from '../NotificationsPanel';
import { BugReportButton } from '../BugReportButton';
import { ParticleLayer } from '../story/ParticleLayer';

type StudentMenuKey = 'space' | 'rewards' | 'adventures' | 'community';

type StudentMenuItem = {
  path: string;
  label: string;
  icon: JSX.Element;
  gradient: string;
  isActive: boolean;
  meta?: string;
  showPing?: boolean;
};

type StudentMenuGroup = {
  key: StudentMenuKey;
  label: string;
  icon: JSX.Element;
  gradient: string;
  subItems: StudentMenuItem[];
};

const teacherNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, gradient: 'from-blue-500 to-indigo-500' },
  { path: '/classrooms', label: 'Mis Clases', icon: Users, gradient: 'from-emerald-500 to-teal-500' },
  { path: '/schools', label: 'Mi Escuela', icon: School, gradient: 'from-blue-500 to-indigo-600' },
  { path: '/settings', label: 'Configuración', icon: Settings, gradient: 'from-gray-500 to-slate-500' },
];

export const MainLayout = () => {
  const { user, logout } = useAuthStore();
  const { selectedClassIndex, setSelectedClassIndex } = useStudentStore();
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [studentMenusOpen, setStudentMenusOpen] = useState<Record<StudentMenuKey, boolean>>({
    space: true,
    rewards: false,
    adventures: false,
    community: false,
  });

  const isTeacher = user?.role === 'TEACHER';

  // Cargar clases del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
    enabled: !isTeacher,
  });

  const currentProfile = myClasses?.[selectedClassIndex];
  const { classMap } = useCharacterClasses(currentProfile?.classroomId);

  // Cargar expediciones del estudiante para mostrar indicador
  const { data: studentExpeditions = [] } = useQuery({
    queryKey: ['student-expeditions', currentProfile?.classroomId, currentProfile?.id],
    queryFn: () => expeditionApi.getStudentExpeditions(currentProfile!.classroomId, currentProfile!.id),
    enabled: !isTeacher && !!currentProfile?.classroomId && !!currentProfile?.id,
  });

  // Verificar si hay expediciones no completadas
  const hasActiveExpeditions = studentExpeditions.some(exp => !exp.studentProgress?.isCompleted);
  const characterInfo = currentProfile ? (classMap[currentProfile.characterClassId!] || classMap[currentProfile.characterClass]) : null;

  const matchesPath = (path: string, mode: 'exact' | 'startsWith' = 'exact') => {
    if (mode === 'startsWith') {
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    }
    return location.pathname === path;
  };

  const hasCompetencyOverview = !!myClasses?.some((profile) => profile.classroom?.useCompetencies);
  const isStudentOverviewZone = !isTeacher && ['/dashboard', '/my-classes', '/my-skills', '/join-class'].some((path) => matchesPath(path));
  const isStudentClassThemeRoute = !isTeacher && [
    { path: '/my-class', mode: 'exact' as const },
    { path: '/my-clan', mode: 'exact' as const },
    { path: '/my-attendance', mode: 'exact' as const },
    { path: '/scrolls', mode: 'exact' as const },
    { path: '/my-grades', mode: 'exact' as const },
    { path: '/my-progress', mode: 'exact' as const },
    { path: '/my-shop', mode: 'exact' as const },
    { path: '/my-badges', mode: 'exact' as const },
    { path: '/my-avatar', mode: 'exact' as const },
    { path: '/expeditions', mode: 'exact' as const },
    { path: '/jiro-expeditions', mode: 'exact' as const },
    { path: '/jiro-expedition', mode: 'startsWith' as const },
    { path: '/collectibles', mode: 'exact' as const },
    { path: '/my-story', mode: 'exact' as const },
  ].some((route) => matchesPath(route.path, route.mode));

  // El tema de clase solo debe afectar rutas dentro del aula del estudiante.
  const activeStoryTheme = (() => {
    if (isTeacher || !isStudentClassThemeRoute) return null;
    const raw = currentProfile?.classroom?.themeConfig;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
  })();
  const hasStoryTheme = !!(activeStoryTheme?.colors?.background && activeStoryTheme?.colors?.sidebar);

  const isThemeDark = (() => {
    if (!hasStoryTheme || !activeStoryTheme?.colors?.background) return false;
    const hex = activeStoryTheme.colors.background.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  })();
  const storyThemeClass = hasStoryTheme ? (isThemeDark ? 'story-theme-dark' : 'story-theme-light') : '';

  const storyThemeStyle = hasStoryTheme ? {
    backgroundColor: activeStoryTheme.colors.background,
    '--story-bg': activeStoryTheme.colors.background,
    '--story-sidebar': activeStoryTheme.colors.sidebar,
    '--story-primary': activeStoryTheme.colors.primary,
    '--story-secondary': activeStoryTheme.colors.secondary,
    '--story-accent': activeStoryTheme.colors.accent || activeStoryTheme.colors.primary,
    '--story-primary-rgb': (() => {
      const hex = (activeStoryTheme.colors.primary || '#6366f1').replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    })(),
  } as React.CSSProperties : undefined;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const studentOverviewNavItems: StudentMenuItem[] = !isTeacher ? [
    {
      path: '/dashboard',
      label: 'Principal',
      icon: <LayoutDashboard size={14} />,
      gradient: 'from-blue-500 to-indigo-500',
      isActive: matchesPath('/dashboard'),
    },
    {
      path: '/my-classes',
      label: 'Mis clases',
      icon: <Users size={14} />,
      gradient: 'from-emerald-500 to-teal-500',
      isActive: matchesPath('/my-classes') || matchesPath('/join-class'),
    },
    ...((hasCompetencyOverview || matchesPath('/my-skills')) ? [{
      path: '/my-skills',
      label: 'Destrezas',
      icon: <BookOpen size={14} />,
      gradient: 'from-violet-500 to-indigo-500',
      isActive: matchesPath('/my-skills'),
    }] : []),
  ] : [];

  const studentMenuGroups: StudentMenuGroup[] = !isTeacher && currentProfile && !isStudentOverviewZone ? [
    {
      key: 'space',
      label: 'Mi espacio',
      icon: <Users size={16} />,
      gradient: 'from-emerald-500 to-teal-500',
      subItems: [
        {
          path: '/my-class',
          label: 'Mi Clase',
          icon: <Users size={14} />,
          gradient: 'from-emerald-500 to-teal-500',
          isActive: matchesPath('/my-class'),
        },
        {
          path: '/my-attendance',
          label: 'Mi Asistencia',
          icon: <Calendar size={14} />,
          gradient: 'from-indigo-500 to-purple-500',
          isActive: matchesPath('/my-attendance'),
        },
        ...(currentProfile.classroom?.useCompetencies ? [{
          path: '/my-grades',
          label: 'Mis Calificaciones',
          icon: <BookOpen size={14} />,
          gradient: 'from-purple-500 to-indigo-500',
          isActive: matchesPath('/my-grades'),
        }] : []),
        {
          path: '/my-progress',
          label: 'Mi Progreso',
          icon: <BarChart3 size={14} />,
          gradient: 'from-emerald-500 to-teal-500',
          isActive: matchesPath('/my-progress'),
        },
      ],
    },
    {
      key: 'rewards',
      label: 'Recompensas',
      icon: <Medal size={16} />,
      gradient: 'from-amber-500 to-orange-500',
      subItems: [
        {
          path: '/my-shop',
          label: 'Tienda de ítems',
          icon: <ShoppingBag size={14} />,
          gradient: 'from-amber-500 to-orange-500',
          isActive: matchesPath('/my-shop'),
          meta: `${currentProfile.gp} GP`,
        },
        {
          path: '/my-badges',
          label: 'Mis insignias',
          icon: <Medal size={14} />,
          gradient: 'from-amber-500 to-orange-500',
          isActive: matchesPath('/my-badges'),
        },
        {
          path: '/my-avatar',
          label: 'Personalizar avatar',
          icon: <Shirt size={14} />,
          gradient: 'from-fuchsia-500 to-pink-500',
          isActive: matchesPath('/my-avatar'),
        },
        {
          path: '/collectibles',
          label: 'Álbum de cromos',
          icon: <Album size={14} />,
          gradient: 'from-amber-500 to-yellow-500',
          isActive: matchesPath('/collectibles'),
        },
      ],
    },
    {
      key: 'adventures',
      label: 'Aventuras',
      icon: <Map size={16} />,
      gradient: 'from-cyan-500 to-blue-500',
      subItems: [
        ...(studentExpeditions.length > 0 ? [{
          path: '/expeditions',
          label: 'Expediciones',
          icon: <Map size={14} />,
          gradient: 'from-emerald-500 to-teal-500',
          isActive: matchesPath('/expeditions'),
          showPing: hasActiveExpeditions && !matchesPath('/expeditions'),
        }] : []),
        {
          path: '/jiro-expeditions',
          label: 'Expedición de Jiro',
          icon: <span className="text-sm">🦊</span>,
          gradient: 'from-orange-500 to-amber-500',
          isActive: matchesPath('/jiro-expeditions') || matchesPath('/jiro-expedition', 'startsWith'),
        },
        ...(currentProfile.classroom?.scrollsEnabled ? [{
          path: '/scrolls',
          label: 'Pergaminos',
          icon: <ScrollText size={14} />,
          gradient: 'from-amber-500 to-orange-500',
          isActive: matchesPath('/scrolls'),
          showPing: !!currentProfile.classroom?.scrollsOpen && !matchesPath('/scrolls'),
        }] : []),
        ...(hasStoryTheme ? [{
          path: '/my-story',
          label: 'Mi Historia',
          icon: <BookMarked size={14} />,
          gradient: 'from-violet-500 to-fuchsia-500',
          isActive: matchesPath('/my-story'),
        }] : []),
      ],
    },
    {
      key: 'community',
      label: 'Comunidad',
      icon: <Shield size={16} />,
      gradient: 'from-teal-500 to-cyan-500',
      subItems: [
        ...(currentProfile.classroom?.clansEnabled ? [{
          path: '/my-clan',
          label: 'Mi Clan',
          icon: <Shield size={14} />,
          gradient: 'from-teal-500 to-cyan-500',
          isActive: matchesPath('/my-clan'),
        }] : []),
      ],
    },
  ] : [];

  const toggleStudentMenu = (menuKey: StudentMenuKey) => {
    setStudentMenusOpen((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  const themedActiveGradientStyle = hasStoryTheme
    ? {
        background: `linear-gradient(to right, ${activeStoryTheme?.colors?.primary || '#6366f1'}, ${activeStoryTheme?.colors?.secondary || activeStoryTheme?.colors?.primary || '#8b5cf6'})`,
      }
    : undefined;

  useEffect(() => {
    if (typeof document === 'undefined' || isTeacher) {
      return;
    }

    document.documentElement.classList.toggle('dark', hasStoryTheme ? false : resolvedTheme === 'dark');

    return () => {
      document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    };
  }, [hasStoryTheme, isTeacher, resolvedTheme]);

  return (
    <div
      className={`min-h-screen ${hasStoryTheme ? storyThemeClass : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800'}`}
      style={storyThemeStyle}
    >
      {/* Storytelling particles */}
      {hasStoryTheme && activeStoryTheme?.particles && (
        <ParticleLayer particles={activeStoryTheme.particles} />
      )}

      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: !isTeacher && collapsed ? 72 : 240 }}
        className={`
          fixed top-0 left-0 z-50 h-full flex flex-col
          ${hasStoryTheme ? '' : 'bg-white/90 dark:bg-gray-800/90'} backdrop-blur-xl shadow-xl shadow-blue-500/10
          ${hasStoryTheme ? 'border-r border-white/10' : 'border-r border-white/50 dark:border-gray-700/50'}
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={hasStoryTheme ? { backgroundColor: activeStoryTheme?.colors?.sidebar } : undefined}
      >
        {/* Logo */}
        <div className={`flex items-center justify-between h-14 px-4 ${hasStoryTheme ? 'border-b border-white/10' : 'border-b border-gray-100 dark:border-gray-700'}`}>
          <Link to="/dashboard" className="flex items-center gap-2 justify-center">
            <img 
              src={!isTeacher && collapsed ? '/logo-solo.png' : '/logo.png'}
              alt="Juried" 
              className={`${!isTeacher && collapsed ? 'h-8 w-8' : 'h-8'} w-auto transition-all`}
            />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`lg:hidden p-1.5 rounded-lg transition-colors ${hasStoryTheme ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Student Stats (solo para estudiantes) */}
        {!isTeacher && currentProfile && !collapsed && !isStudentOverviewZone && (
          <div className={`p-3 ${hasStoryTheme ? 'border-b border-white/10' : 'border-b border-gray-100 dark:border-gray-700'}`}>
            {/* Selector de clase si tiene múltiples */}
            {myClasses && myClasses.length > 1 && (
              <div className="mb-2 relative">
                <button
                  onClick={() => setShowClassSelector(!showClassSelector)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${hasStoryTheme ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{characterInfo?.icon}</span>
                    <span className={`font-medium truncate max-w-[120px] ${hasStoryTheme ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                      {currentProfile.classroom?.name}
                    </span>
                  </div>
                  <ChevronDown size={14} className={`transition-transform ${hasStoryTheme ? 'text-white/60' : 'text-gray-500'} ${showClassSelector ? 'rotate-180' : ''}`} />
                </button>
                
                {showClassSelector && (
                  <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl z-20 overflow-hidden ${hasStoryTheme ? 'bg-gray-900/95 border border-white/20' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
                    {myClasses.map((profile, index) => {
                      const classInfo = classMap[profile.characterClassId!] || classMap[profile.characterClass];
                      return (
                        <button
                          key={profile.id}
                          onClick={() => {
                            setSelectedClassIndex(index);
                            setShowClassSelector(false);
                          }}
                          className={`w-full flex items-center gap-2 p-2 transition-colors ${hasStoryTheme
                            ? (index === selectedClassIndex ? 'bg-white/15' : 'hover:bg-white/10')
                            : (index === selectedClassIndex ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700')
                          }`}
                        >
                          <span className="text-lg">{classInfo?.icon}</span>
                          <div className="flex-1 text-left">
                            <p className={`text-sm font-medium truncate ${hasStoryTheme ? 'text-white' : 'text-gray-800 dark:text-white'}`}>{profile.classroom?.name}</p>
                            <p className={`text-xs ${hasStoryTheme ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>Nivel {profile.level}</p>
                          </div>
                          {index === selectedClassIndex && <Check size={14} className={hasStoryTheme ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {isTeacher ? (
            teacherNavItems.map((item) => {
              const isActivePath = location.pathname === item.path ||
                (item.path === '/classrooms' && location.pathname.startsWith('/classroom'));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl
                    transition-all duration-200 group
                    ${isActivePath
                      ? 'bg-gradient-to-r ' + item.gradient + ' text-white shadow-md'
                      : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center transition-all
                    ${isActivePath
                      ? 'bg-white/20'
                      : 'bg-gradient-to-br ' + item.gradient + ' text-white shadow-sm group-hover:scale-105'
                    }
                  `}>
                    <item.icon size={16} />
                  </div>
                  <span className={`text-sm font-medium ${isActivePath ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })
          ) : (
            <div className="space-y-2">
              {isStudentOverviewZone && studentOverviewNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl
                    transition-all duration-200 group
                    ${item.isActive
                      ? `${hasStoryTheme ? '' : `bg-gradient-to-r ${item.gradient}`} text-white shadow-md`
                      : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  style={item.isActive && hasStoryTheme ? themedActiveGradientStyle : undefined}
                >
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center transition-all
                    ${item.isActive
                      ? 'bg-white/20'
                      : hasStoryTheme
                        ? 'bg-white/10 text-white shadow-sm group-hover:scale-105'
                        : 'bg-gradient-to-br ' + item.gradient + ' text-white shadow-sm group-hover:scale-105'
                    }
                  `}>
                    {item.icon}
                  </div>
                  {!collapsed && (
                    <span className={`text-sm font-semibold ${item.isActive ? '' : hasStoryTheme ? 'text-white/85' : 'text-gray-700 dark:text-gray-300'}`}>
                      {item.label}
                    </span>
                  )}
                </Link>
              ))}

              {!isStudentOverviewZone && studentMenuGroups.map((group) => {
                const groupHasActiveItem = group.subItems.some((subItem) => subItem.isActive);
                const groupKey = group.key;
                const isGroupOpen = !collapsed && (studentMenusOpen[groupKey] || groupHasActiveItem);

                return (
                  <div key={group.key} className="space-y-1">
                    <button
                      type="button"
                      title={collapsed ? group.label : undefined}
                      onClick={() => {
                        if (collapsed) {
                          setCollapsed(false);
                          return;
                        }

                        toggleStudentMenu(groupKey);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                        transition-all duration-200 group
                        ${groupHasActiveItem
                          ? `${hasStoryTheme ? '' : `bg-gradient-to-r ${group.gradient}`} text-white shadow-md`
                          : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }
                      `}
                      style={groupHasActiveItem && hasStoryTheme ? themedActiveGradientStyle : undefined}
                    >
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center transition-all
                        ${groupHasActiveItem
                          ? 'bg-white/20'
                          : hasStoryTheme
                            ? 'bg-white/10 text-white shadow-sm group-hover:scale-105'
                            : 'bg-gradient-to-br ' + group.gradient + ' text-white shadow-sm group-hover:scale-105'
                        }
                      `}>
                        {group.icon}
                      </div>
                      {!collapsed && (
                        <>
                          <span className={`flex-1 text-left text-sm font-semibold ${groupHasActiveItem ? '' : hasStoryTheme ? 'text-white/85' : 'text-gray-700 dark:text-gray-300'}`}>
                            {group.label}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`}
                          />
                        </>
                      )}
                    </button>

                    {!collapsed && isGroupOpen && (
                      <div className="ml-4 mt-1 space-y-1">
                        {group.subItems.map((subItem) => (
                          <Link
                            key={subItem.path}
                            to={subItem.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`
                              flex items-center gap-2 px-2.5 py-1.5 rounded-lg
                              transition-all duration-200 group relative
                              ${subItem.isActive
                                ? hasStoryTheme ? 'text-white' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                : hasStoryTheme ? 'text-white/60 hover:bg-white/10 hover:text-white/90' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                              }
                            `}
                            style={subItem.isActive && hasStoryTheme ? { backgroundColor: `${activeStoryTheme?.colors?.primary || '#6366f1'}40` } : undefined}
                          >
                            <span className={`
                              flex h-4 w-4 items-center justify-center flex-shrink-0
                              ${subItem.isActive
                                ? hasStoryTheme ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'
                                : hasStoryTheme ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'
                              }
                            `}>
                              {subItem.icon}
                            </span>
                            <span className="flex-1 text-sm font-medium">
                              {subItem.label}
                            </span>
                            {(subItem.meta || subItem.showPing) && (
                              <div className="ml-auto flex items-center gap-2">
                                {subItem.meta && (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${subItem.isActive ? hasStoryTheme ? 'bg-white/15 text-white' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300' : hasStoryTheme ? 'bg-white/10 text-white/75' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}>
                                    {subItem.meta}
                                  </span>
                                )}
                                {subItem.showPing && (
                                  <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="relative flex h-2.5 w-2.5"
                                  >
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                                  </motion.span>
                                )}
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </nav>

        {/* User Card - solo para profesores */}
        {isTeacher && (
          <div className={`absolute bottom-0 left-0 right-0 p-3 ${hasStoryTheme ? 'border-t border-white/10 bg-black/10' : 'border-t border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50'}`}>
            <div className={`flex items-center gap-3 p-2 rounded-xl mb-2 ${hasStoryTheme ? 'bg-white/10' : 'bg-gray-50 dark:bg-gray-700'}`}>
              {user?.avatarUrl ? (
                <img 
                  src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${user.avatarUrl.startsWith('/api') ? user.avatarUrl.replace('/api', '') : user.avatarUrl}`}
                  alt="Avatar"
                  className="w-9 h-9 rounded-xl object-cover shadow-md"
                />
              ) : (
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-white text-sm font-bold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${hasStoryTheme ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                  {user?.firstName} {user?.lastName}
                </p>
                <p className={`text-xs ${hasStoryTheme ? 'text-white/60' : 'text-gray-500'}`}>
                  Docente
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 px-3 py-2 w-full rounded-xl transition-colors text-sm font-medium ${hasStoryTheme ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        )}
        {/* Toggle collapse - solo en desktop para estudiantes */}
        {!isTeacher && (
          <div className={`hidden lg:block p-2 ${hasStoryTheme ? 'border-t border-white/10' : 'border-t border-gray-100 dark:border-gray-700'}`}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-xl transition-colors ${hasStoryTheme ? 'text-white/50 hover:text-white/80 hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              {!collapsed && <span className="text-xs font-medium">Colapsar</span>}
            </button>
          </div>
        )}
      </motion.aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${!isTeacher && collapsed ? 'lg:pl-[72px]' : 'lg:pl-60'}`}>
        {/* Top Bar */}
        <header
          className={`sticky top-0 z-30 h-14 backdrop-blur-lg shadow-sm ${hasStoryTheme ? 'border-b border-white/10' : 'bg-white/80 dark:bg-gray-800/80 border-b border-white/50 dark:border-gray-700/50'}`}
          style={hasStoryTheme ? { backgroundColor: `${activeStoryTheme?.colors?.background || '#111827'}cc` } : undefined}
        >
          <div className="flex h-full items-center px-4">
            <div className="flex min-w-0 flex-1 items-center">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className={`lg:hidden p-2 rounded-xl transition-colors ${hasStoryTheme ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'}`}
              >
                <Menu size={20} />
              </button>

              {/* Student Stats in header */}
              {!isTeacher && currentProfile && !isStudentOverviewZone && (
                <div className="flex items-center gap-2 md:gap-3 flex-1 justify-center md:justify-start md:ml-2">
                  {/* Nivel + XP */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${hasStoryTheme && isThemeDark ? 'bg-white/10 text-white' : hasStoryTheme ? 'bg-white/40 text-gray-800' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'}`}>
                    <Zap size={13} className={hasStoryTheme ? 'text-amber-400' : 'text-amber-500'} />
                    <span>Nv.{currentProfile.level}</span>
                    <span className={`${hasStoryTheme && isThemeDark ? 'text-white/50' : hasStoryTheme ? 'text-gray-500' : 'text-indigo-400 dark:text-indigo-500'}`}>•</span>
                    <span>{currentProfile.xp} XP</span>
                  </div>

                  {/* HP */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${hasStoryTheme && isThemeDark ? 'bg-white/10 text-white' : hasStoryTheme ? 'bg-white/40 text-gray-800' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                    <Heart size={13} className="text-red-500" />
                    <span>{currentProfile.hp}/100</span>
                  </div>

                  {/* Oro */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${hasStoryTheme && isThemeDark ? 'bg-white/10 text-white' : hasStoryTheme ? 'bg-white/40 text-gray-800' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}>
                    <Coins size={13} className="text-amber-500" />
                    <span>{currentProfile.gp}</span>
                  </div>
                </div>
              )}

              {(isTeacher || isStudentOverviewZone || (!isTeacher && !currentProfile)) && <div className="flex-1" />}
            </div>

            <div className="ml-auto flex items-center gap-2 md:gap-3">
              {/* Notificaciones (solo para estudiantes) */}
              {!isTeacher && (
                <NotificationsBell onClick={() => setShowNotifications(true)} classroomId={currentProfile?.classroomId} />
              )}

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* User Menu */}
              <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${hasStoryTheme ? 'hover:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                {user?.avatarUrl ? (
                  <img 
                    src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${user.avatarUrl.startsWith('/api') ? user.avatarUrl.replace('/api', '') : user.avatarUrl}`}
                    alt="Avatar"
                    className="w-8 h-8 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                    <span className="text-white text-xs font-bold">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className={`text-sm font-medium ${hasStoryTheme && isThemeDark ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                    {user?.firstName}
                  </p>
                </div>
                <ChevronDown size={14} className={hasStoryTheme && isThemeDark ? 'text-white/50' : 'text-gray-400'} />
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
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                      </div>
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Settings size={16} />
                        Configuración
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 w-full text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
          <Outlet context={{ storyTheme: hasStoryTheme ? activeStoryTheme : null, isThemeDark, hasStoryTheme }} />
        </main>
      </div>

      {/* Panel de notificaciones (solo para estudiantes) */}
      {!isTeacher && (
        <NotificationsPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* Botón de reporte de bugs (solo para profesores) */}
      {isTeacher && <BugReportButton />}
    </div>
  );
};
