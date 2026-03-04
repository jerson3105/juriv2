import { useState } from 'react';
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
  GraduationCap,
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
  // Target, // Temporalmente no usado
  Map,
  Lock,
  Sparkles,
  Rocket,
  BarChart3,
  Scroll,
  ClipboardList,
  Album,
  Megaphone,
  MessageCircle,
  BookMarked,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { classroomApi } from '../../lib/classroomApi';
import { NotificationsBell, NotificationsPanel } from '../NotificationsPanel';
import { ThemeToggle } from '../ui/ThemeToggle';
import { BugReportButton } from '../BugReportButton';
import toast from 'react-hot-toast';
import { AIAssistantWidget } from '../classroom/AIAssistantWidget';
import { ParticleLayer } from '../story/ParticleLayer';
import { useTeacherOnboardingSafe } from '../../contexts/TeacherOnboardingContext';

const FEATURE_LABELS: Record<string, string> = {
  students: 'Estudiantes',
  behaviors: 'Comportamientos',
  rankings: 'Rankings',
  grades: 'Calificaciones',
  settings: 'Configuración',
  badges: 'Insignias',
  shop: 'Tienda',
  clans: 'Clanes',
  attendance: 'Asistencia',
  collectibles: 'Coleccionables',
  storytelling: 'Historia de clase',
  expedition: 'Expediciones',
  question_bank: 'Preguntas',
  activities: 'Actividades',
};

const FEATURE_INFO: Record<string, { emoji: string; description: string }> = {
  badges: { emoji: '\u{1F3C5}', description: 'Reconoce logros específicos de tus estudiantes con trofeos permanentes.' },
  shop: { emoji: '\u{1F6CD}\uFE0F', description: 'Tus estudiantes canjean sus puntos por recompensas que vos creás.' },
  clans: { emoji: '\u2694\uFE0F', description: 'Divide tu clase en equipos que compiten y colaboran entre sí.' },
  attendance: { emoji: '\u{1F4CB}', description: 'Registra la asistencia diaria de tus estudiantes desde el aula.' },
  collectibles: { emoji: '\u{1F4E6}', description: 'Tus estudiantes coleccionan cromos que pueden comprar con sus monedas (GP).' },
  storytelling: { emoji: '\u{1F4D6}', description: 'Crea una historia narrativa de fondo para tu clase que ambienta la experiencia.' },
  expedition: { emoji: '\u{1F5FA}\uFE0F', description: 'Aventuras de aprendizaje con mapas interactivos donde los estudiantes exploran y completan misiones. Incluye la Expedición de Jiro con bancos de preguntas y sistema de energía.' },
  question_bank: { emoji: '\u2753', description: 'Crea y organiza preguntas para usar en Expediciones y Torneos.' },
  activities: { emoji: '\u26A1', description: 'Herramientas interactivas para dinamizar tu clase: Ruleta del Destino, Torneos, Aula Zen, Actividades de Tiempo, Pergaminos del Aula y más.' },
};

export const ClassroomLayout = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [studentsMenuOpen, setStudentsMenuOpen] = useState(true);
  const [gamificationMenuOpen, setGamificationMenuOpen] = useState(false);
  const [claseMenuOpen, setClaseMenuOpen] = useState(false);
  const [comunicacionMenuOpen, setComunicacionMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showExpeditionsModal, setShowExpeditionsModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [earlyUnlockConfirm, setEarlyUnlockConfirm] = useState<{ features: string[]; label: string } | null>(null);
  const { logout } = useAuthStore();
  const onboarding = useTeacherOnboardingSafe();

  const { data: classroom, isLoading, refetch } = useQuery({
    queryKey: ['classroom', id],
    queryFn: () => classroomApi.getById(id!),
    enabled: !!id,
  });

  // Parse storytelling theme from classroom
  const tc = (() => {
    const raw = classroom?.themeConfig;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
  })();
  const hasStoryTheme = !!(tc?.colors?.background && tc?.colors?.sidebar);

  // Calculate if theme is light or dark based on background luminosity
  const isThemeDark = (() => {
    if (!hasStoryTheme || !tc?.colors?.background) return false;
    const hex = tc.colors.background.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate relative luminance (ITU-R BT.709)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5; // Dark if luminance < 50%
  })();
  const storyThemeClass = hasStoryTheme ? (isThemeDark ? 'story-theme-dark' : 'story-theme-light') : '';

  const copyCode = async () => {
    if (!classroom) return;
    await navigator.clipboard.writeText(classroom.code);
    setCopiedCode(true);
    toast.success('Código copiado');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const allMenuItems = [
    { 
      label: 'Estudiantes', 
      icon: Users,
      gradient: 'from-blue-500 to-indigo-500',
      menuKey: 'students',
      onboardingId: 'students-menu',
      featureKey: 'students',
      subItems: [
        { path: `/classroom/${id}/students`, label: 'Lista', icon: List, onboardingId: 'students-list', featureKey: 'students' },
        { path: `/classroom/${id}/clans`, label: 'Clanes', icon: Users, featureKey: 'clans' },
        { path: `/classroom/${id}/attendance`, label: 'Asistencia', icon: CalendarCheck, featureKey: 'attendance' },
      ],
    },
    { 
      label: 'Gamificación', 
      icon: Gamepad2,
      gradient: 'from-amber-500 to-orange-500',
      menuKey: 'gamification',
      onboardingId: 'gamification-menu',
      featureKey: 'behaviors',
      subItems: [
        { path: `/classroom/${id}/behaviors`, label: 'Comportamientos', icon: Award, onboardingId: 'behaviors-menu', featureKey: 'behaviors' },
        { path: `/classroom/${id}/badges`, label: 'Insignias', icon: Medal, featureKey: 'badges' },
        { path: `/classroom/${id}/shop`, label: 'Tienda', icon: ShoppingBag, onboardingId: 'shop-menu', featureKey: 'shop' },
        { path: `/classroom/${id}/collectibles`, label: 'Coleccionables', icon: Album, featureKey: 'collectibles' },
        { path: `/classroom/${id}/rankings`, label: 'Rankings', icon: Trophy, featureKey: 'rankings' },
        { path: `/classroom/${id}/storytelling`, label: 'Historia de clase', icon: Sparkles, featureKey: 'storytelling' },
      ],
    },
    { 
      label: 'Clase', 
      icon: BookMarked,
      gradient: 'from-emerald-500 to-teal-500',
      menuKey: 'clase',
      featureKey: 'activities',
      subItems: [
        { path: `/classroom/${id}/activities`, label: 'Actividades', icon: Dices, featureKey: 'activities' },
        { path: `/classroom/${id}/question-banks`, label: 'Preguntas', icon: BookOpen, featureKey: 'question_bank' },
        ...(classroom?.useCompetencies ? [{ path: `/classroom/${id}/gradebook`, label: 'Calificaciones', icon: ClipboardList, featureKey: 'grades' }] : []),
        { path: `/classroom/${id}/history`, label: 'Registro de actividad', icon: Scroll },
      ],
    },
    { 
      label: 'Comunicación', 
      icon: Megaphone,
      gradient: 'from-cyan-500 to-blue-500',
      menuKey: 'comunicacion',
      subItems: [
        { path: `/classroom/${id}/announcements`, label: 'Avisos', icon: Megaphone },
        ...(classroom?.scrollsEnabled ? [{ path: `/classroom/${id}/activities`, label: 'Chats', icon: MessageCircle }] : []),
      ],
    },
  ];

  // Bottom items — separated visually from groups
  const bottomMenuItems = [
    { 
      path: `/classroom/${id}/reports`, 
      label: 'Estadísticas', 
      icon: BarChart3,
      gradient: 'from-violet-500 to-purple-500',
      onboardingId: 'statistics-menu',
    },
    { 
      path: `/classroom/${id}/settings`, 
      label: 'Configuración', 
      icon: Settings,
      gradient: 'from-gray-500 to-slate-500',
      featureKey: 'settings',
    },
  ];

  // Helper: check if a feature is unlocked
  const isUnlocked = (featureKey?: string) => {
    if (!featureKey) return true; // Items without featureKey are always visible
    if (!onboarding) return true; // No onboarding context → show everything
    return onboarding.isFeatureUnlocked(featureKey);
  };

  // Helper: check if a feature has "¡Nuevo!" badge
  const isNewFeature = (featureKey?: string) => {
    if (!featureKey || !onboarding) return false;
    return onboarding.isFeatureNew(featureKey);
  };

  // Filter menu items based on unlocked features
  const menuItems = allMenuItems
    .map((item) => {
      if ('subItems' in item && item.subItems) {
        const filteredSubs = item.subItems.filter(sub => isUnlocked((sub as any).featureKey));
        // Show parent menu if at least one sub-item is visible
        if (filteredSubs.length === 0) return null;
        return { ...item, subItems: filteredSubs };
      }
      if (!isUnlocked((item as any).featureKey)) return null;
      return item;
    })
    .filter(Boolean) as typeof allMenuItems;

  const isActive = (path: string, exact?: boolean) => {
    if (!path) return false;
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
    <div
      className={hasStoryTheme ? `fixed inset-0 z-[100] flex transition-colors duration-500 ${storyThemeClass}` : 'fixed inset-0 z-[100] flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800'}
      style={hasStoryTheme ? {
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
      } as React.CSSProperties : undefined}
    >
      {/* Storytelling particles */}
      {hasStoryTheme && tc.particles && (
        <ParticleLayer particles={tc.particles} />
      )}

      {/* Decorative elements */}
      {!hasStoryTheme && (
        <>
          <div className="absolute top-20 right-10 w-64 h-64 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse pointer-events-none" />
          <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-purple-200 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />
        </>
      )}

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
          ${hasStoryTheme ? '' : 'bg-white/90 dark:bg-gray-800/90'} backdrop-blur-xl shadow-xl shadow-blue-500/10 
          ${hasStoryTheme ? 'border-r border-white/10' : 'border-r border-white/50 dark:border-gray-700/50'} flex flex-col
          transform transition-transform duration-300 lg:transform-none
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={hasStoryTheme ? { backgroundColor: tc.colors.sidebar } : undefined}
      >
        {/* Logo */}
        <div className={`p-3 flex items-center justify-between ${hasStoryTheme ? 'border-b border-white/10' : 'border-b border-gray-100 dark:border-gray-700'}`}>
          <Link to="/dashboard" className="flex items-center gap-2 justify-center">
            <img 
              src={collapsed ? "/logo-solo.png" : "/logo.png"}
              alt="Juried" 
              className={`${collapsed ? 'h-8 w-8' : 'h-9'} w-auto transition-all`}
            />
          </Link>
          {/* Botón cerrar en móvil */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className={`lg:hidden p-1.5 rounded-lg transition-colors ${hasStoryTheme ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Header del sidebar */}
        <div className={`p-3 ${hasStoryTheme ? 'border-b border-white/10' : 'border-b border-gray-100 dark:border-gray-700'}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/classrooms')}
              className={`p-2 rounded-xl transition-colors ${hasStoryTheme ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="Volver a mis clases"
            >
              <ArrowLeft size={18} />
            </button>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <h2 className={`font-bold truncate text-sm ${hasStoryTheme ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                  {classroom.name}
                </h2>
                <button
                  onClick={copyCode}
                  className={`flex items-center gap-1 text-xs transition-colors ${hasStoryTheme ? 'text-white/60 hover:text-white/80' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  <span className={`font-mono px-1.5 py-0.5 rounded ${hasStoryTheme ? 'bg-white/10' : 'bg-blue-50 dark:bg-blue-900/30'}`}>{classroom.code}</span>
                  {copiedCode ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Menú */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {/* Collapsible groups */}
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isSubMenuActive = item.subItems?.some(sub => isActive(sub.path));
            const menuKey = (item as any).menuKey;
            const isMenuOpen = 
              menuKey === 'students' ? studentsMenuOpen :
              menuKey === 'gamification' ? gamificationMenuOpen :
              menuKey === 'clase' ? claseMenuOpen :
              menuKey === 'comunicacion' ? comunicacionMenuOpen : false;
            
            const toggleMenu = () => {
              if (menuKey === 'students') {
                setStudentsMenuOpen(!studentsMenuOpen);
              } else if (menuKey === 'gamification') {
                setGamificationMenuOpen(!gamificationMenuOpen);
              } else if (menuKey === 'clase') {
                setClaseMenuOpen(!claseMenuOpen);
              } else if (menuKey === 'comunicacion') {
                setComunicacionMenuOpen(!comunicacionMenuOpen);
              }
            };
            
            return (
              <div key={item.label}>
                <button
                  onClick={toggleMenu}
                  className={`
                    w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 group
                    ${isSubMenuActive
                      ? hasStoryTheme ? 'text-white shadow-md' : 'bg-gradient-to-r ' + item.gradient + ' text-white shadow-md'
                      : hasStoryTheme ? 'text-white/80 hover:bg-white/10' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  style={isSubMenuActive && hasStoryTheme ? { background: `linear-gradient(to right, ${tc?.colors?.primary || '#6366f1'}, ${tc?.colors?.secondary || '#8b5cf6'})` } : undefined}
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
                      <span className={`text-sm font-medium truncate flex-1 text-left ${isSubMenuActive ? '' : hasStoryTheme ? 'text-white/90' : 'text-gray-700 dark:text-gray-300'}`}>
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
                          onClick={() => {
                            const fk = (subItem as any).featureKey;
                            if (fk && isNewFeature(fk)) onboarding?.dismissBadge(fk);
                          }}
                          className={`
                            flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200
                            ${subActive
                              ? hasStoryTheme ? 'text-white' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                              : hasStoryTheme ? 'text-white/60 hover:bg-white/10 hover:text-white/90' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                            }
                          `}
                          style={subActive && hasStoryTheme ? { backgroundColor: `${tc?.colors?.primary || '#6366f1'}40` } : undefined}
                        >
                          <SubIcon size={14} />
                          <span className="text-sm">{subItem.label}</span>
                          {isNewFeature((subItem as any).featureKey) && (
                            <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full leading-none">
                              Nuevo
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Divider — only show if groups are visible above */}
          {menuItems.length > 0 && (
            <div className={`my-2 mx-2 h-px ${hasStoryTheme ? 'bg-white/10' : 'bg-gray-200 dark:bg-gray-700'}`} />
          )}

          {/* Bottom items: Estadísticas + Configuración */}
          {bottomMenuItems.filter(bi => isUnlocked((bi as any).featureKey)).map((bItem) => {
            const BIcon = bItem.icon;
            const bActive = isActive(bItem.path);
            const bIsNew = isNewFeature((bItem as any).featureKey);
            return (
              <Link
                key={bItem.path}
                to={bItem.path}
                onClick={() => {
                  const fk = (bItem as any).featureKey;
                  if (fk && bIsNew) onboarding?.dismissBadge(fk);
                }}
                className={`
                  flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 group
                  ${bActive
                    ? 'bg-gradient-to-r ' + bItem.gradient + ' text-white shadow-md'
                    : hasStoryTheme ? 'text-white/80 hover:bg-white/10' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                title={collapsed ? bItem.label : undefined}
              >
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0
                  ${bActive 
                    ? 'bg-white/20' 
                    : 'bg-gradient-to-br ' + bItem.gradient + ' text-white shadow-sm group-hover:scale-105'
                  }
                `}>
                  <BIcon size={16} />
                </div>
                {!collapsed && (
                  <>
                    <span className={`text-sm font-medium truncate flex-1 ${bActive ? '' : hasStoryTheme ? 'text-white/90' : 'text-gray-700 dark:text-gray-300'}`}>
                      {bItem.label}
                    </span>
                    {bIsNew && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full leading-none">
                        Nuevo
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Onboarding sidebar bottom: pending unlocks + unlock link + level */}
        {onboarding && !onboarding.data?.isExperienced && !collapsed && (
          <div className={`p-2 space-y-1 ${hasStoryTheme ? 'border-t border-white/10' : 'border-t border-gray-100 dark:border-gray-700'}`}>
            {/* Pending unlocks notification */}
            {onboarding.hasPendingUnlocks && (
              <button
                onClick={() => setShowUnlockModal(true)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 transition-all text-left"
              >
                <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles size={12} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 truncate">
                    ¡Nuevas funciones disponibles!
                  </p>
                </div>
                <span className="w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                  {(onboarding.data?.pendingUnlocks ?? []).length}
                </span>
              </button>
            )}

            {/* Desbloquear más funciones */}
            {onboarding.data && onboarding.data.lockedFeatures.length > 0 && (
              <button
                onClick={() => setShowUnlockModal(true)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  hasStoryTheme
                    ? 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    : 'text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Lock size={12} />
                <span>Desbloquear más funciones →</span>
              </button>
            )}

            {/* Level indicator */}
            {onboarding.data?.level && (
              <div className={`flex items-center gap-2 px-2.5 py-1 ${hasStoryTheme ? 'text-white/30' : 'text-gray-400 dark:text-gray-500'}`}>
                <Rocket size={12} />
                <span className="text-[11px] font-medium">Nivel: {onboarding.data.level}</span>
              </div>
            )}
          </div>
        )}

        {/* Toggle collapse - solo en desktop */}
        <div className={`hidden lg:block p-2 ${hasStoryTheme ? 'border-t border-white/10' : 'border-t border-gray-100 dark:border-gray-700'}`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-xl transition-colors ${hasStoryTheme ? 'text-white/50 hover:text-white/80 hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span className="text-xs font-medium">Colapsar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header */}
        <header
          className={`h-14 backdrop-blur-lg shadow-sm flex items-center justify-between px-4 ${hasStoryTheme ? 'border-b border-white/10' : 'bg-white/80 dark:bg-gray-800/80 border-b border-white/50 dark:border-gray-700/50'}`}
          style={hasStoryTheme ? { backgroundColor: `${tc.colors.background}ee` } : undefined}
        >
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
            {/* Botón de reportar bug */}
            <BugReportButton variant="icon" />
            
            {/* Toggle de tema */}
            <ThemeToggle />
            
            {/* Botón de notificaciones */}
            <NotificationsBell onClick={() => setShowNotifications(true)} classroomId={classroom.id} />
            
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
          <Outlet context={{ classroom, refetch, storyTheme: hasStoryTheme ? tc : null, isThemeDark }} />
        </main>
      </div>

      {/* Panel de notificaciones */}
      <NotificationsPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)}
        classroomId={classroom.id}
      />

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

      {/* Unlock Features Modal */}
      <AnimatePresence>
        {showUnlockModal && onboarding?.data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowUnlockModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Fixed Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  <img src="/logo-solo.png" alt="Juried" className="w-10 h-10" />
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">Funciones disponibles</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Activá nuevas funciones para tu clase</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Estas funciones se activan gradualmente para que puedas dominar una a la vez.
                </p>
              </div>

              {/* Scrollable Body */}
              <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
                {/* Pending unlocks */}
                {(onboarding.data.pendingUnlocks ?? []).length > 0 && (
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">¡Listas para activar!</p>
                    <div className="space-y-2">
                      {(onboarding.data.pendingUnlocks ?? []).map(f => {
                        const info = FEATURE_INFO[f];
                        return (
                          <div key={f} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                  {info?.emoji && <span className="mr-1.5">{info.emoji}</span>}
                                  {FEATURE_LABELS[f] || f}
                                </p>
                                {info?.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{info.description}</p>
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  await onboarding.activateFeatures([f]);
                                }}
                                className="px-3 py-1 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:shadow-md transition-all flex-shrink-0 mt-0.5"
                              >
                                Activar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {(onboarding.data.pendingUnlocks ?? []).length > 1 && (
                      <button
                        onClick={async () => {
                          await onboarding.activateFeatures(onboarding.data!.pendingUnlocks ?? []);
                        }}
                        className="w-full mt-2 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded-lg transition-colors"
                      >
                        Activar todas
                      </button>
                    )}
                  </div>
                )}

                {/* Schedule tiers */}
                {onboarding.data.schedule.filter(t => !t.allUnlocked).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Próximamente</p>
                    <div className="space-y-3">
                      {onboarding.data.schedule.filter(t => !t.allUnlocked).map((tier, idx) => {
                        const lockedFeatures = tier.features.filter(f => !(onboarding.data!.unlockedFeatures ?? []).includes(f));
                        if (lockedFeatures.length === 0) return null;
                        const tierLabel = tier.available ? 'Disponible ahora' : `En ${tier.daysRemaining} días`;
                        return (
                          <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                              {tierLabel}
                            </p>
                            <div className="space-y-2.5">
                              {lockedFeatures.map(f => {
                                const info = FEATURE_INFO[f];
                                return (
                                  <div key={f} className="flex items-start gap-2">
                                    {info?.emoji && <span className="text-base leading-5 flex-shrink-0">{info.emoji}</span>}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{FEATURE_LABELS[f] || f}</p>
                                      {info?.description && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{info.description}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {!tier.available && (
                              <button
                                onClick={() => {
                                  setEarlyUnlockConfirm({ features: lockedFeatures, label: tierLabel });
                                }}
                                className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                Activar antes
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <button
                  onClick={() => { setShowUnlockModal(false); setEarlyUnlockConfirm(null); }}
                  className="w-full py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Cerrar
                </button>
              </div>

              {/* Early Unlock Confirmation Dialog */}
              <AnimatePresence>
                {earlyUnlockConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-2xl"
                    onClick={() => setEarlyUnlockConfirm(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.92, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="mx-4 w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 p-5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                        ¿Activar funciones antes de tiempo?
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Grupo: <span className="font-semibold text-gray-700 dark:text-gray-300">{earlyUnlockConfirm.label}</span>
                      </p>
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {earlyUnlockConfirm.features.map(f => {
                            const info = FEATURE_INFO[f];
                            return (
                              <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full font-medium">
                                {info?.emoji && <span>{info.emoji}</span>}
                                {FEATURE_LABELS[f] || f}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Estas funciones aparecerán en tu menú lateral inmediatamente.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEarlyUnlockConfirm(null)}
                          className="flex-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={async () => {
                            await onboarding.earlyUnlock(earlyUnlockConfirm.features);
                            setEarlyUnlockConfirm(null);
                          }}
                          className="flex-1 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:shadow-md transition-all"
                        >
                          Activar
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Assistant Widget - Flotante */}
      {id && <AIAssistantWidget classroomId={id} />}
    </div>
  );
};
