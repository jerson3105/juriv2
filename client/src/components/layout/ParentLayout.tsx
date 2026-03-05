import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  BarChart3,
  Sparkles,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Megaphone,
  MessageCircle,
  GraduationCap,
  Check,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from '../ui/ThemeToggle';
import { SelectedClassroomProvider, useSelectedClassroom } from '../../contexts/SelectedClassroomContext';
import type { ChildSummary } from '../../lib/parentApi';

type NavItem = { path: string; label: string; icon: any; gradient: string; exact?: boolean };
type NavGroup = { label: string; icon: any; gradient: string; menuKey: string; subItems: NavItem[] };
type ParentNavEntry = NavItem | NavGroup;

const parentNavItems: ParentNavEntry[] = [
  { path: '/parent', label: 'Inicio', icon: Home, gradient: 'from-indigo-500 to-purple-500', exact: true },
  { path: '/parent/report', label: 'Reportes', icon: BarChart3, gradient: 'from-emerald-500 to-teal-500' },
  { path: '/parent/ai-report', label: 'Informe inteligente', icon: Sparkles, gradient: 'from-purple-500 to-pink-500' },
  {
    label: 'Comunicación',
    icon: Megaphone,
    gradient: 'from-cyan-500 to-blue-500',
    menuKey: 'comunicacion',
    subItems: [
      { path: '/parent/chat', label: 'Avisos', icon: Megaphone, gradient: 'from-cyan-500 to-blue-500', exact: true },
      { path: '/parent/chat/group', label: 'Chat grupal', icon: MessageCircle, gradient: 'from-indigo-500 to-purple-500' },
    ],
  },
];

export const ParentLayout = () => {
  return (
    <SelectedClassroomProvider>
      <ParentLayoutInner />
    </SelectedClassroomProvider>
  );
};

function ClassroomSelector() {
  const { children, selected, setSelected, hasMultipleChildren, isLoading } = useSelectedClassroom();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (isLoading || !hasMultipleChildren || !selected) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors max-w-[260px]"
      >
        <GraduationCap size={16} className="text-indigo-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
          {selected.classroomName}
        </span>
        <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50"
          >
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Seleccionar clase</p>
            </div>
            {children.map((child: ChildSummary) => {
              const isActive = child.studentProfileId === selected.studentProfileId;
              return (
                <button
                  key={child.studentProfileId}
                  onClick={() => { setSelected(child); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                  }`}>
                    <GraduationCap size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-white'}`}>
                      {child.classroomName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {child.studentName} · {child.teacherName}
                    </p>
                  </div>
                  {isActive && <Check size={16} className="text-indigo-500 flex-shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function isNavGroup(entry: ParentNavEntry): entry is NavGroup {
  return 'subItems' in entry;
}

const ParentLayoutInner = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({ comunicacion: true });

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
      <motion.aside
        initial={false}
        animate={{ width: 240 }}
        className={`
          fixed top-0 left-0 z-50 h-full flex flex-col
          bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-xl shadow-blue-500/10
          border-r border-white/50 dark:border-gray-700/50
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100 dark:border-gray-700">
          <Link to="/parent" className="flex items-center gap-2 justify-center">
            <img 
              src="/logo.png"
              alt="Juried" 
              className="h-8 w-auto transition-all"
            />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {parentNavItems.map((entry) => {
            if (isNavGroup(entry)) {
              const isGroupActive = entry.subItems.some(s => location.pathname.startsWith(s.path));
              const isExpanded = openMenus[entry.menuKey];
              return (
                <div key={entry.menuKey}>
                  <button
                    onClick={() => toggleMenu(entry.menuKey)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl w-full
                      transition-all duration-200 group
                      ${isGroupActive
                        ? 'bg-gradient-to-r ' + entry.gradient + ' text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center transition-all
                      ${isGroupActive
                        ? 'bg-white/20'
                        : 'bg-gradient-to-br ' + entry.gradient + ' text-white shadow-sm group-hover:scale-105'
                      }
                    `}>
                      <entry.icon size={16} />
                    </div>
                    <span className={`text-sm font-medium flex-1 text-left ${isGroupActive ? '' : 'text-gray-700 dark:text-gray-300'}`}>
                      {entry.label}
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-5 pl-3 border-l-2 border-gray-200 dark:border-gray-600 mt-1 space-y-0.5">
                          {entry.subItems.map((sub) => {
                            const isSubActive = sub.exact
                              ? (location.pathname === sub.path || location.pathname.startsWith(sub.path + '/announcements'))
                              : location.pathname.startsWith(sub.path);
                            return (
                              <Link
                                key={sub.path}
                                to={sub.path}
                                onClick={() => setSidebarOpen(false)}
                                className={`
                                  flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                                  transition-all duration-200
                                  ${isSubActive
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                                  }
                                `}
                              >
                                <sub.icon size={15} />
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            const item = entry as NavItem;
            const isActivePath = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
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
        </nav>

        {/* User section at bottom */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 p-2 rounded-xl mb-2 bg-gray-50 dark:bg-gray-700">
            {user?.avatarUrl ? (
              <img 
                src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${user.avatarUrl.startsWith('/api') ? user.avatarUrl.replace('/api', '') : user.avatarUrl}`}
                alt="Avatar"
                className="w-9 h-9 rounded-xl object-cover shadow-md"
              />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white text-sm font-bold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-gray-800 dark:text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500">
                Padre de familia
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-xl transition-colors text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="transition-all duration-300 lg:pl-60">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 backdrop-blur-lg shadow-sm bg-white/80 dark:bg-gray-800/80 border-b border-white/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between h-full px-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <Menu size={20} />
            </button>

            {/* Classroom Selector */}
            <ClassroomSelector />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {user?.avatarUrl ? (
                  <img 
                    src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}${user.avatarUrl.startsWith('/api') ? user.avatarUrl.replace('/api', '') : user.avatarUrl}`}
                    alt="Avatar"
                    className="w-8 h-8 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-sm">
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
    </div>
  );
};
