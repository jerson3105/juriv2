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
  Heart,
  Coins,
  Zap,
  Check,
  HelpCircle,
  Shield,
  Calendar,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useStudentStore } from '../../store/studentStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { studentApi, CHARACTER_CLASSES } from '../../lib/studentApi';
import { ThemeToggle } from '../ui/ThemeToggle';
import { NotificationsBell, NotificationsPanel } from '../NotificationsPanel';

const teacherNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, gradient: 'from-blue-500 to-indigo-500' },
  { path: '/classrooms', label: 'Mis Clases', icon: Users, gradient: 'from-emerald-500 to-teal-500' },
  { path: '/schools', label: 'Mis Escuelas', icon: Building2, gradient: 'from-purple-500 to-pink-500' },
  { path: '/settings', label: 'Configuración', icon: Settings, gradient: 'from-gray-500 to-slate-500' },
];

const studentNavItems = [
  { path: '/dashboard', label: 'Mi Clase', icon: Users, gradient: 'from-emerald-500 to-teal-500' },
];

export const MainLayout = () => {
  const { user, logout } = useAuthStore();
  const { selectedClassIndex, setSelectedClassIndex } = useStudentStore();
  const { resetOnboarding, hasCompletedOnboarding } = useOnboardingStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const characterInfo = currentProfile ? CHARACTER_CLASSES[currentProfile.characterClass] : null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
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
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-60
          bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-xl shadow-blue-500/10
          border-r border-white/50 dark:border-gray-700/50
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100 dark:border-gray-700">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Juried" 
              className="h-8 w-auto"
            />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Student Stats (solo para estudiantes) */}
        {!isTeacher && currentProfile && (
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            {/* Selector de clase si tiene múltiples */}
            {myClasses && myClasses.length > 1 && (
              <div className="mb-2 relative">
                <button
                  onClick={() => setShowClassSelector(!showClassSelector)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{characterInfo?.icon}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[120px]">
                      {currentProfile.classroom?.name}
                    </span>
                  </div>
                  <ChevronDown size={14} className={`text-gray-500 transition-transform ${showClassSelector ? 'rotate-180' : ''}`} />
                </button>
                
                {showClassSelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-20 border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {myClasses.map((profile, index) => {
                      const classInfo = CHARACTER_CLASSES[profile.characterClass];
                      return (
                        <button
                          key={profile.id}
                          onClick={() => {
                            setSelectedClassIndex(index);
                            setShowClassSelector(false);
                          }}
                          className={`w-full flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            index === selectedClassIndex ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                          }`}
                        >
                          <span className="text-lg">{classInfo?.icon}</span>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{profile.classroom?.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Nivel {profile.level}</p>
                          </div>
                          {index === selectedClassIndex && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-3 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <Zap size={14} />
                  </div>
                  <span className="text-xs font-medium">Nivel {currentProfile.level}</span>
                </div>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  {currentProfile.xp} XP
                </span>
              </div>
              
              {/* HP Bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs mb-1 text-white/80">
                  <span className="flex items-center gap-1">
                    <Heart size={10} /> HP
                  </span>
                  <span>{currentProfile.hp}/100</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(currentProfile.hp, 100)}%` }}
                    className="h-full bg-gradient-to-r from-red-400 to-pink-400 rounded-full"
                  />
                </div>
              </div>

              {/* GP */}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-white/80">
                  <Coins size={12} /> Oro
                </span>
                <span className="font-bold text-amber-300">{currentProfile.gp}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActivePath = location.pathname === item.path || 
              (item.path === '/classrooms' && location.pathname.startsWith('/classroom'));
            // Agregar data-onboarding para el tour
            const onboardingId = item.path === '/classrooms' ? 'nav-classrooms' : undefined;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                data-onboarding={onboardingId}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl
                  transition-all duration-200 group
                  ${isActivePath
                    ? 'bg-gradient-to-r ' + item.gradient + ' text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                <span className={`text-sm font-medium ${isActivePath ? '' : 'text-gray-700 dark:text-gray-300'}`}>
                  {item.label}
                </span>
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
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
              <span className={`text-sm font-medium ${location.pathname === '/my-clan' ? '' : 'text-gray-700 dark:text-gray-300'}`}>
                Mi Clan
              </span>
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
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
              <span className={`text-sm font-medium ${location.pathname === '/my-attendance' ? '' : 'text-gray-700 dark:text-gray-300'}`}>
                Mi Asistencia
              </span>
            </Link>
          )}
        </nav>

        {/* User Card */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-700 mb-2">
            {user?.avatarUrl ? (
              <img 
                src={`${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}${user.avatarUrl}`}
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
              <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500">
                {isTeacher ? 'Docente' : 'Estudiante'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-60">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-white/50 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center justify-between h-full px-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu size={20} />
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Botón de ayuda / tour (solo para profesores) */}
            {isTeacher && (
              <button
                onClick={resetOnboarding}
                className="p-2 text-gray-500 hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-colors"
                title={hasCompletedOnboarding ? "Repetir tour guiado" : "Ver tour guiado"}
              >
                <HelpCircle size={20} />
              </button>
            )}

            {/* Notificaciones (solo para estudiantes) */}
            {!isTeacher && (
              <NotificationsBell onClick={() => setShowNotifications(true)} />
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl px-2 py-1.5 transition-colors"
              >
                {user?.avatarUrl ? (
                  <img 
                    src={`${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}${user.avatarUrl}`}
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
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {user?.firstName}
                  </p>
                </div>
                <ChevronDown size={14} className="text-gray-400" />
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
          <Outlet />
        </main>
      </div>

      {/* Panel de notificaciones (solo para estudiantes) */}
      {!isTeacher && (
        <NotificationsPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
};
