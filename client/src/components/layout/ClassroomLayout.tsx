import { useState, useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  Settings,
  Award,
  ArrowLeft,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Dices,
  ScrollText,
  GraduationCap,
  LayoutDashboard,
  CalendarCheck,
  ChevronDown,
  List,
  Gamepad2,
  LogOut,
  Menu,
  X,
  Medal,
  Trophy,
  BookOpen,
  Target,
  Map,
  Lock,
  Sparkles,
  Rocket,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useClassroomOnboardingStore } from '../../store/classroomOnboardingStore';
import { classroomApi } from '../../lib/classroomApi';
import { NotificationsBell, NotificationsPanel } from '../NotificationsPanel';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ClassroomOnboardingProvider } from '../onboarding';
import { HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const ClassroomLayout = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [studentsMenuOpen, setStudentsMenuOpen] = useState(true);
  const [gamificationMenuOpen, setGamificationMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showExpeditionsModal, setShowExpeditionsModal] = useState(false);
  const { logout } = useAuthStore();
  const { openWelcomeModal, hasCompletedForClassroom, isActive: isOnboardingActive, currentStep } = useClassroomOnboardingStore();

  // Abrir submenús automáticamente durante el onboarding
  // Pasos: 0=welcome, 1=students-menu, 2=students-list, 3=select-student, 4=give-points-btn, 5=modal-tabs, 6=manual-tab, 7=complete
  useEffect(() => {
    if (isOnboardingActive) {
      // Paso 1-2: Menú de estudiantes
      if (currentStep === 1 || currentStep === 2) {
        setStudentsMenuOpen(true);
      }
    }
  }, [isOnboardingActive, currentStep]);

  const { data: classroom, isLoading, refetch } = useQuery({
    queryKey: ['classroom', id],
    queryFn: () => classroomApi.getById(id!),
    enabled: !!id,
  });

  const copyCode = async () => {
    if (!classroom) return;
    await navigator.clipboard.writeText(classroom.code);
    setCopiedCode(true);
    toast.success('Código copiado');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const menuItems = [
    { 
      label: 'Estudiantes', 
      icon: Users,
      gradient: 'from-blue-500 to-indigo-500',
      menuKey: 'students',
      onboardingId: 'students-menu',
      subItems: [
        { path: `/classroom/${id}/students`, label: 'Lista', icon: List, onboardingId: 'students-list' },
        { path: `/classroom/${id}/clans`, label: 'Clanes', icon: Users },
        { path: `/classroom/${id}/attendance`, label: 'Asistencia', icon: CalendarCheck },
      ],
    },
    { 
      label: 'Gamificación', 
      icon: Gamepad2,
      gradient: 'from-amber-500 to-orange-500',
      menuKey: 'gamification',
      onboardingId: 'gamification-menu',
      subItems: [
        { path: `/classroom/${id}/behaviors`, label: 'Comportamientos', icon: Award, onboardingId: 'behaviors-menu' },
        { path: `/classroom/${id}/badges`, label: 'Insignias', icon: Medal },
        { path: `/classroom/${id}/missions`, label: 'Misiones', icon: Target },
        { path: `/classroom/${id}/shop`, label: 'Tienda', icon: ShoppingBag, onboardingId: 'shop-menu' },
        { path: `/classroom/${id}/activities`, label: 'Actividades', icon: Dices },
        { path: '', label: 'Expediciones', icon: Map, locked: true, comingSoon: true },
      ],
    },
    { 
      path: `/classroom/${id}/question-banks`, 
      label: 'Banco de Preguntas', 
      icon: BookOpen,
      gradient: 'from-indigo-500 to-purple-500',
    },
    { 
      path: `/classroom/${id}/rankings`, 
      label: 'Rankings', 
      icon: Trophy,
      gradient: 'from-amber-500 to-yellow-500',
    },
    { 
      path: `/classroom/${id}/statistics`, 
      label: 'Estadísticas', 
      icon: LayoutDashboard,
      gradient: 'from-violet-500 to-purple-500',
      onboardingId: 'statistics-menu',
    },
    { 
      path: `/classroom/${id}/history`, 
      label: 'Historial', 
      icon: ScrollText,
      gradient: 'from-cyan-500 to-blue-500',
    },
    { 
      path: `/classroom/${id}/settings`, 
      label: 'Configuración', 
      icon: Settings,
      gradient: 'from-gray-500 to-slate-500',
    },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="w-60 bg-white/50 dark:bg-gray-800/50 animate-pulse" />
        <div className="flex-1 p-6">
          <div className="h-32 bg-white/50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="text-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl p-8 shadow-xl">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-2xl flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Clase no encontrada</p>
          <button
            onClick={() => navigate('/classrooms')}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            Volver a mis clases
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse pointer-events-none" />
      <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-purple-200 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar de clase */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        className={`
          fixed lg:relative z-50 lg:z-10 h-full
          bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-xl shadow-blue-500/10 
          border-r border-white/50 dark:border-gray-700/50 flex flex-col
          transform transition-transform duration-300 lg:transform-none
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 justify-center">
            <img 
              src="/logo.png" 
              alt="Juried" 
              className={`${collapsed ? 'h-8' : 'h-9'} w-auto transition-all`}
            />
          </Link>
          {/* Botón cerrar en móvil */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Header del sidebar */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/classrooms')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              title="Volver a mis clases"
            >
              <ArrowLeft size={18} />
            </button>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-800 dark:text-white truncate text-sm">
                  {classroom.name}
                </h2>
                <button
                  onClick={copyCode}
                  data-onboarding="class-code"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <span className="font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">{classroom.code}</span>
                  {copiedCode ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Menú */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const hasSubItems = 'subItems' in item && item.subItems;
            const isSubMenuActive = hasSubItems && item.subItems?.some(sub => isActive(sub.path));
            const active = item.path ? isActive(item.path) : isSubMenuActive;
            
            // Item con submenú
            if (hasSubItems) {
              const menuKey = (item as any).menuKey;
              const isMenuOpen = menuKey === 'students' ? studentsMenuOpen : gamificationMenuOpen;
              const toggleMenu = () => {
                if (menuKey === 'students') {
                  setStudentsMenuOpen(!studentsMenuOpen);
                } else {
                  setGamificationMenuOpen(!gamificationMenuOpen);
                }
              };
              
              return (
                <div key={item.label}>
                  <button
                    onClick={toggleMenu}
                    data-onboarding={(item as any).onboardingId}
                    className={`
                      w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 group
                      ${isSubMenuActive
                        ? 'bg-gradient-to-r ' + item.gradient + ' text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0
                      ${isSubMenuActive 
                        ? 'bg-white/20' 
                        : 'bg-gradient-to-br ' + item.gradient + ' text-white shadow-sm group-hover:scale-105'
                      }
                    `}>
                      <Icon size={16} />
                    </div>
                    {!collapsed && (
                      <>
                        <span className={`text-sm font-medium truncate flex-1 text-left ${isSubMenuActive ? '' : 'text-gray-700 dark:text-gray-300'}`}>
                          {item.label}
                        </span>
                        <ChevronDown 
                          size={14} 
                          className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''} ${isSubMenuActive ? 'text-white' : 'text-gray-400'}`} 
                        />
                      </>
                    )}
                  </button>
                  
                  {/* Submenú */}
                  {isMenuOpen && !collapsed && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.subItems?.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const subActive = isActive(subItem.path);
                        const isLocked = (subItem as any).locked;
                        
                        // Item bloqueado (próximamente)
                        if (isLocked) {
                          return (
                            <button
                              key={subItem.label}
                              onClick={() => setShowExpeditionsModal(true)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            >
                              <SubIcon size={14} />
                              <span className="text-sm">{subItem.label}</span>
                              <Lock size={12} className="ml-auto text-gray-400" />
                            </button>
                          );
                        }
                        
                        return (
                          <Link
                            key={subItem.path}
                            to={subItem.path}
                            data-onboarding={(subItem as any).onboardingId}
                            className={`
                              flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200
                              ${subActive
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                              }
                            `}
                          >
                            <SubIcon size={14} />
                            <span className="text-sm">{subItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            // Item normal sin submenú
            return (
              <Link
                key={item.path}
                to={item.path!}
                data-onboarding={(item as any).onboardingId}
                className={`
                  flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 group
                  ${active
                    ? 'bg-gradient-to-r ' + item.gradient + ' text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0
                  ${active 
                    ? 'bg-white/20' 
                    : 'bg-gradient-to-br ' + item.gradient + ' text-white shadow-sm group-hover:scale-105'
                  }
                `}>
                  <Icon size={16} />
                </div>
                {!collapsed && (
                  <span className={`text-sm font-medium truncate ${active ? '' : 'text-gray-700 dark:text-gray-300'}`}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Toggle collapse - solo en desktop */}
        <div className="hidden lg:block p-2 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span className="text-xs font-medium">Colapsar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header */}
        <header className="h-14 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-white/50 dark:border-gray-700/50 shadow-sm flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Botón menú móvil */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <GraduationCap size={16} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-gray-800 dark:text-white">{classroom.name}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{classroom.students?.length || 0} estudiantes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Botón de ayuda / tour */}
            <button
              onClick={() => openWelcomeModal(classroom.id)}
              className="p-2 text-gray-500 hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-colors"
              title={hasCompletedForClassroom(classroom.id) ? "Repetir tour guiado" : "Ver tour guiado"}
            >
              <HelpCircle size={18} />
            </button>
            
            {/* Toggle de tema */}
            <ThemeToggle />
            
            {/* Botón de notificaciones */}
            <NotificationsBell onClick={() => setShowNotifications(true)} />
            
            {/* Botón de cerrar sesión */}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet context={{ classroom, refetch }} />
        </main>
      </div>

      {/* Panel de notificaciones */}
      <NotificationsPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />

      {/* Onboarding de la clase */}
      <ClassroomOnboardingProvider 
        classroomId={classroom.id}
        studentCount={classroom.students?.length || 0}
      >
        <></>
      </ClassroomOnboardingProvider>

      {/* Modal de Expediciones - Próximamente */}
      <AnimatePresence>
        {showExpeditionsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowExpeditionsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decoración de fondo */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
              </div>

              {/* Contenido */}
              <div className="relative p-8 text-center text-white">
                {/* Icono principal */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                  className="w-24 h-24 mx-auto mb-6 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-xl"
                >
                  <Map size={48} className="text-white" />
                </motion.div>

                {/* Badge de próximamente */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-4"
                >
                  <Sparkles size={16} className="text-yellow-300" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Próximamente</span>
                  <Sparkles size={16} className="text-yellow-300" />
                </motion.div>

                {/* Título */}
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl font-bold mb-3"
                >
                  🗺️ Expediciones
                </motion.h2>

                {/* Descripción */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-white/90 text-lg mb-6 leading-relaxed"
                >
                  ¡Prepárate para una nueva forma de aprender! Las Expediciones transformarán tu clase en una aventura épica con mapas interactivos.
                </motion.p>

                {/* Beneficios */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-6 text-left"
                >
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Rocket size={18} className="text-yellow-300" />
                    ¿Qué podrás hacer?
                  </h3>
                  <ul className="space-y-2 text-sm text-white/90">
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">✨</span>
                      <span>Crear mapas temáticos con pines de objetivos conectados</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">🎯</span>
                      <span>Asignar tareas, historias y recompensas en cada punto del mapa</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">📊</span>
                      <span>Seguir el progreso de cada estudiante en tiempo real</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">🏆</span>
                      <span>Otorgar XP, GP y contribuciones al clan automáticamente</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-300 mt-0.5">📁</span>
                      <span>Recibir entregas de archivos y aprobar avances</span>
                    </li>
                  </ul>
                </motion.div>

                {/* Mensaje motivacional */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-white/80 text-sm mb-6"
                >
                  🚀 Estamos trabajando para traerte esta increíble funcionalidad muy pronto.
                  <br />¡Mantente atento a las novedades!
                </motion.p>

                {/* Botón de cerrar */}
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  onClick={() => setShowExpeditionsModal(false)}
                  className="px-8 py-3 bg-white text-emerald-600 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  ¡Entendido!
                </motion.button>
              </div>

              {/* Botón X para cerrar */}
              <button
                onClick={() => setShowExpeditionsModal(false)}
                className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
