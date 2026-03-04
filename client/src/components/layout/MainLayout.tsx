import { useState } from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useStudentStore } from '../../store/studentStore';
import { studentApi, CHARACTER_CLASSES } from '../../lib/studentApi';
import { expeditionApi } from '../../lib/expeditionApi';
import { ThemeToggle } from '../ui/ThemeToggle';
import { NotificationsBell, NotificationsPanel } from '../NotificationsPanel';
import { BugReportButton } from '../BugReportButton';
import { ParticleLayer } from '../story/ParticleLayer';

const teacherNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, gradient: 'from-blue-500 to-indigo-500' },
  { path: '/classrooms', label: 'Mis Clases', icon: Users, gradient: 'from-emerald-500 to-teal-500' },
  { path: '/schools', label: 'Mi Escuela', icon: School, gradient: 'from-blue-500 to-indigo-600' },
  { path: '/settings', label: 'Configuración', icon: Settings, gradient: 'from-gray-500 to-slate-500' },
];

const studentNavItems = [
  { path: '/dashboard', label: 'Mi Clase', icon: Users, gradient: 'from-emerald-500 to-teal-500' },
];

export const MainLayout = () => {
  const { user, logout } = useAuthStore();
  const { selectedClassIndex, setSelectedClassIndex } = useStudentStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const isTeacher = user?.role === 'TEACHER';
  const navItems = isTeacher ? teacherNavItems : studentNavItems;

  // Cargar clases del estudiante
  const { data: myClasses } = useQuery({
    queryKey: ['my-classes'],
    queryFn: studentApi.getMyClasses,
    enabled: !isTeacher,
  });

  const currentProfile = myClasses?.[selectedClassIndex];

  // Cargar expediciones del estudiante para mostrar indicador
  const { data: studentExpeditions = [] } = useQuery({
    queryKey: ['student-expeditions', currentProfile?.classroomId, currentProfile?.id],
    queryFn: () => expeditionApi.getStudentExpeditions(currentProfile!.classroomId, currentProfile!.id),
    enabled: !isTeacher && !!currentProfile?.classroomId && !!currentProfile?.id,
  });

  // Verificar si hay expediciones no completadas
  const hasActiveExpeditions = studentExpeditions.some(exp => !exp.studentProgress?.isCompleted);
  const characterInfo = currentProfile ? CHARACTER_CLASSES[currentProfile.characterClass] : null;

  // Parse storytelling theme from student's classroom
  const tc = (() => {
    if (isTeacher) return null;
    const raw = currentProfile?.classroom?.themeConfig;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
  })();
  const hasStoryTheme = !isTeacher && !!(tc?.colors?.background && tc?.colors?.sidebar);

  const isThemeDark = (() => {
    if (!hasStoryTheme || !tc?.colors?.background) return false;
    const hex = tc.colors.background.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  })();
  const storyThemeClass = hasStoryTheme ? (isThemeDark ? 'story-theme-dark' : 'story-theme-light') : '';

  const storyThemeStyle = hasStoryTheme ? {
    backgroundColor: tc.colors.background,
    '--story-bg': tc.colors.background,
    '--story-sidebar': tc.colors.sidebar,
    '--story-primary': tc.colors.primary,
    '--story-secondary': tc.colors.secondary,
    '--story-accent': tc.colors.accent || tc.colors.primary,
    '--story-primary-rgb': (() => {
      const hex = (tc.colors.primary || '#6366f1').replace('#', '');
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

  return (
    <div
      className={`min-h-screen ${hasStoryTheme ? storyThemeClass : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800'}`}
      style={storyThemeStyle}
    >
      {/* Storytelling particles */}
      {hasStoryTheme && tc.particles && (
        <ParticleLayer particles={tc.particles} />
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
        style={hasStoryTheme ? { backgroundColor: tc.colors.sidebar } : undefined}
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
        {!isTeacher && currentProfile && !collapsed && (
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
                      const classInfo = CHARACTER_CLASSES[profile.characterClass];
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
          {navItems.map((item) => {
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
                {!(!isTeacher && collapsed) && (
                  <span className={`text-sm font-medium ${isActivePath ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
          
          {/* Mi Clan - solo para estudiantes con clan habilitado */}
          {!isTeacher && currentProfile?.classroom?.clansEnabled && (
            <Link
              to="/my-clan"
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 group
                ${location.pathname === '/my-clan'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md'
                  : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${location.pathname === '/my-clan'
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-sm group-hover:scale-105'
                }
              `}>
                <Shield size={16} />
              </div>
              {!collapsed && (
                <span className={`text-sm font-medium ${location.pathname === '/my-clan' ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  Mi Clan
                </span>
              )}
            </Link>
          )}

          {/* Mi Asistencia - solo para estudiantes */}
          {!isTeacher && currentProfile && (
            <Link
              to="/my-attendance"
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 group
                ${location.pathname === '/my-attendance'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
                  : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${location.pathname === '/my-attendance'
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm group-hover:scale-105'
                }
              `}>
                <Calendar size={16} />
              </div>
              {!collapsed && (
                <span className={`text-sm font-medium ${location.pathname === '/my-attendance' ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  Mi Asistencia
                </span>
              )}
            </Link>
          )}

          {/* Pergaminos del Aula - solo para estudiantes con scrolls habilitado */}
          {!isTeacher && currentProfile?.classroom?.scrollsEnabled && (
            <Link
              to="/scrolls"
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 group relative
                ${location.pathname === '/scrolls'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${location.pathname === '/scrolls'
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm group-hover:scale-105'
                }
              `}>
                <ScrollText size={16} />
              </div>
              {!collapsed && (
                <span className={`text-sm font-medium ${location.pathname === '/scrolls' ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  Pergaminos
                </span>
              )}
              {/* Indicador animado cuando el mural está abierto */}
              {currentProfile?.classroom?.scrollsOpen && location.pathname !== '/scrolls' && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-2 flex h-2.5 w-2.5"
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </motion.span>
              )}
            </Link>
          )}

          {/* Coleccionables - solo para estudiantes */}
          {!isTeacher && currentProfile && (
            <Link
              to="/collectibles"
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 group relative
                ${location.pathname === '/collectibles'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md'
                  : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${location.pathname === '/collectibles'
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-amber-500 to-yellow-500 text-white shadow-sm group-hover:scale-105'
                }
              `}>
                <Album size={16} />
              </div>
              {!collapsed && (
                <span className={`text-sm font-medium ${location.pathname === '/collectibles' ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  Álbum de Cromos
                </span>
              )}
            </Link>
          )}

          {/* Expediciones - solo para estudiantes */}
          {!isTeacher && studentExpeditions.length > 0 && (
            <Link
              to="/expeditions"
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 group relative
                ${location.pathname === '/expeditions'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                  : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${location.pathname === '/expeditions'
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm group-hover:scale-105'
                }
              `}>
                <Map size={16} />
              </div>
              {!collapsed && (
                <span className={`text-sm font-medium ${location.pathname === '/expeditions' ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  Expediciones
                </span>
              )}
              {/* Indicador animado cuando hay expediciones activas */}
              {hasActiveExpeditions && location.pathname !== '/expeditions' && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-2 flex h-2.5 w-2.5"
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </motion.span>
              )}
            </Link>
          )}

          {/* Expediciones de Jiro - solo para estudiantes */}
          {!isTeacher && (
            <Link
              to="/jiro-expeditions"
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 group relative
                ${location.pathname.startsWith('/jiro-expedition')
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                  : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${location.pathname.startsWith('/jiro-expedition')
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm group-hover:scale-105'
                }
              `}>
                <span className="text-sm">🦊</span>
              </div>
              {!collapsed && (
                <span className={`text-sm font-medium ${location.pathname.startsWith('/jiro-expedition') ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  Expedición de Jiro
                </span>
              )}
            </Link>
          )}

          {/* Mis Calificaciones - solo para estudiantes con competencias habilitadas */}
          {!isTeacher && currentProfile?.classroom?.useCompetencies && (
            <Link
              to="/my-grades"
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 group relative
                ${location.pathname === '/my-grades'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
                  : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${location.pathname === '/my-grades'
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-sm group-hover:scale-105'
                }
              `}>
                <BookOpen size={16} />
              </div>
              {!collapsed && (
                <span className={`text-sm font-medium ${location.pathname === '/my-grades' ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  Mis Calificaciones
                </span>
              )}
            </Link>
          )}

          {/* Historia - solo para estudiantes con storytelling activo */}
          {!isTeacher && hasStoryTheme && (
            <Link
              to="/my-story"
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-200 group relative
                ${location.pathname === '/my-story'
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md'
                  : hasStoryTheme ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${location.pathname === '/my-story'
                  ? 'bg-white/20' 
                  : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm group-hover:scale-105'
                }
              `}>
                <BookMarked size={16} />
              </div>
              {!collapsed && (
                <span className={`text-sm font-medium ${location.pathname === '/my-story' ? '' : hasStoryTheme ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                  Historia
                </span>
              )}
            </Link>
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
          style={hasStoryTheme ? { backgroundColor: `${tc.colors.background}cc` } : undefined}
        >
          <div className="flex items-center justify-between h-full px-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden p-2 rounded-xl transition-colors ${hasStoryTheme ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              <Menu size={20} />
            </button>

            {/* Student Stats in header */}
            {!isTeacher && currentProfile && (
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

            {/* Spacer (solo para profesores) */}
            {isTeacher && <div className="flex-1" />}


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
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet context={{ storyTheme: hasStoryTheme ? tc : null, isThemeDark, hasStoryTheme }} />
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
