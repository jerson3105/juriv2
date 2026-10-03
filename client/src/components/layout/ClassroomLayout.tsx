import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Sparkles,
  GraduationCap,
  LogOut,
  Menu,
  X,
  Map,
  Rocket,
  Coins,
  TrendingUp,
  Crown,
  Wrench,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { classroomApi } from '../../lib/classroomApi';
import { NotificationsBell, NotificationsPanel } from '../NotificationsPanel';
import { ThemeToggle } from '../ui/ThemeToggle';
import { BugReportButton } from '../BugReportButton';
import { classNoteApi } from '../../lib/classNoteApi';
import { shopApi } from '../../lib/shopApi';

// Las herramientas de clase se descargan solo al abrirlas (no pesan en la carga inicial de la app).
const ClassroomUtilities = lazy(() =>
  import('../classroom/ClassroomUtilities').then((module) => ({ default: module.ClassroomUtilities })),
);
import { ParticleLayer } from '../story/ParticleLayer';
import { deriveStoryAccent, storyAccentVars, accentGradient, mixHex } from '../../lib/storyTheme';
import { storyApi } from '../../lib/storyApi';
import { useStoryParticles } from '../../hooks/useStoryParticles';
import { useStoryLive } from '../../hooks/useStoryLive';
import { useTeacherOnboardingSafe } from '../../contexts/TeacherOnboardingContext';
import { classSkyFor } from '../student/home/classSky';
import { AppSidebar } from './sidebar/AppSidebar';
import { NewsLine } from './sidebar/SidebarFooters';
import { TeacherClassCard } from './sidebar/TeacherClassCard';
import { teacherClassNav } from './sidebar/navBuilders';
import { useOpenGroups, useSidebarCollapsed } from './sidebar/useSidebarState';

const NIGHT = '#0b1026';
const NEWS_KEY = 'juried-sb-news';

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
  activities: 'Observatorio de Jiro',
};

const FEATURE_INFO: Record<string, { emoji: string; description: string }> = {
  badges: { emoji: '\u{1F3C5}', description: 'Reconoce logros específicos de tus estudiantes con trofeos permanentes.' },
  shop: { emoji: '\u{1F6CD}\uFE0F', description: 'Tus estudiantes canjean sus puntos por recompensas que tú creas.' },
  clans: { emoji: '\u2694\uFE0F', description: 'Divide tu clase en equipos que compiten y colaboran entre sí.' },
  attendance: { emoji: '\u{1F4CB}', description: 'Registra la asistencia diaria de tus estudiantes desde el aula.' },
  collectibles: { emoji: '\u{1F4E6}', description: 'Tus estudiantes completan álbumes de figuritas abriendo sobres con su oro.' },
  storytelling: { emoji: '\u{1F4D6}', description: 'Crea una historia narrativa de fondo para tu clase que ambienta la experiencia.' },
  expedition: { emoji: '\u{1F5FA}\uFE0F', description: 'Aventuras de aprendizaje con mapas interactivos donde los estudiantes exploran y completan misiones. Incluye la Expedición de Jiro con bancos de preguntas y sistema de energía.' },
  question_bank: { emoji: '\u2753', description: 'Crea y organiza preguntas para el Observatorio de Jiro y las Expediciones.' },
  activities: { emoji: '\u26A1', description: 'Actividades para jugar en clase con Jiro de guía: Descanso de Jiro, Conquista, Pergaminos del Aula y Expediciones.' },
};

export const ClassroomLayout = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useSidebarCollapsed('teacher');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Aviso de funciones oculto «hasta la próxima novedad» (se guarda qué novedad se ocultó).
  const [newsDismissed, setNewsDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(NEWS_KEY);
    } catch {
      return null;
    }
  });
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

  const { data: pendingNotesCount = 0 } = useQuery({
    queryKey: ['class-notes-count', id],
    queryFn: () => classNoteApi.pendingCount(id!),
    enabled: !!id,
  });

  // Compras y usos de la tienda esperando al profesor (mismas claves que la Tienda: comparten caché).
  const { data: pendingShopPurchases = [] } = useQuery({
    queryKey: ['pending-purchases', id],
    queryFn: () => shopApi.getPendingPurchases(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
  const { data: pendingShopUsages = [] } = useQuery({
    queryKey: ['pending-usages', id],
    queryFn: () => shopApi.getPendingUsages(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
  const pendingShopCount = pendingShopPurchases.length + pendingShopUsages.length;

  // Tema de historia: solo acentos (barra lateral, cabecera, chips) derivados para cumplir AA.
  // El contenido conserva sus superficies neutras del modo claro/oscuro.
  const storyAccent = useMemo(() => deriveStoryAccent(classroom?.themeConfig), [classroom?.themeConfig]);
  const hasStoryTheme = !!storyAccent;
  const [teacherParticles] = useStoryParticles('teacher');
  // Revelaciones y metas alcanzadas en vivo (sala de la clase).
  useStoryLive(id);

  // Capítulos listos para revelar: aviso en el menú (misma caché que la página de Historia).
  const { data: classroomStories = [] } = useQuery({
    queryKey: ['stories', id],
    queryFn: () => storyApi.getClassroomStories(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
  const readyToReveal = classroomStories.reduce((sum, story) => sum + (story.isActive ? story.readyToReveal ?? 0 : 0), 0);

  const classroomStudents = classroom?.students || [];
  const headerTotalXP = classroomStudents.reduce((sum, student) => sum + (student.xp || 0), 0);
  const headerTotalGP = classroomStudents.reduce((sum, student) => sum + (student.gp || 0), 0);
  const headerAvgLevel = classroomStudents.length > 0
    ? Math.round((classroomStudents.reduce((sum, student) => sum + (student.level || 0), 0) / classroomStudents.length) * 10) / 10
    : 0;
  const headerTopStudent = classroomStudents.length > 0
    ? [...classroomStudents].sort((a, b) => (b.xp || 0) - (a.xp || 0))[0]
    : null;
  const showStudentsSummaryHeader = location.pathname.includes('/students');

  const getHeaderDisplayName = (student: typeof classroomStudents[number] | null) => {
    if (!student) return 'Sin datos';
    if (classroom?.showCharacterName === false) {
      if (student.realName && student.realLastName) return `${student.realName} ${student.realLastName}`;
      return student.realName || student.characterName || 'Sin nombre';
    }
    return student.characterName || 'Sin nombre';
  };

  // ── Sidebar ───────────────────────────────────────────────────────────────────────────────────
  // Funciones del onboarding: lo bloqueado no aparece; lo recién activado lleva «Nuevo».
  const isUnlocked = (featureKey?: string) => !featureKey || !onboarding || onboarding.isFeatureUnlocked(featureKey);
  const isNewFeature = (featureKey?: string) => !!featureKey && !!onboarding && onboarding.isFeatureNew(featureKey);
  const { groups: navGroups, footer: navFooter, activeGroupId } = teacherClassNav({
    classroomId: id ?? '',
    pathname: location.pathname,
    scrollsEnabled: !!classroom?.scrollsEnabled,
    isUnlocked,
    isNew: isNewFeature,
    dismissNew: (featureKey) => onboarding?.dismissBadge(featureKey),
    pendingShopCount,
    readyToReveal,
  });
  const openGroups = useOpenGroups('teacher-class', activeGroupId);

  // Novedades del onboarding: una sola línea; con ✕ se oculta hasta la próxima novedad.
  const pendingUnlocks = onboarding?.data?.pendingUnlocks ?? [];
  const lockedCount = onboarding?.data?.lockedFeatures.length ?? 0;
  const newsKey = pendingUnlocks.length > 0
    ? `pending:${[...pendingUnlocks].sort().join(',')}`
    : lockedCount > 0 ? `locked:${lockedCount}` : null;
  const showNews = !!onboarding && !onboarding.data?.isExperienced && !!newsKey && newsKey !== newsDismissed;
  const dismissNews = () => {
    if (!newsKey) return;
    try {
      localStorage.setItem(NEWS_KEY, newsKey);
    } catch {
      // Sin almacenamiento: vuelve a aparecer al recargar.
    }
    setNewsDismissed(newsKey);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="w-64 bg-white/50 dark:bg-gray-800/50 animate-pulse" />
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
            onClick={() => navigate('/dashboard')}
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
      className="fixed inset-0 z-[100] flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800"
      style={storyAccentVars(storyAccent)}
    >
      {/* Partículas del tema: apagadas por defecto en vistas del profesor (interruptor en Historia de clase) */}
      {storyAccent?.particles && teacherParticles && (
        <ParticleLayer particles={storyAccent.particles} accentColor={storyAccent.primary} />
      )}

      {/* Brillos de fondo: con tema toman su color y derivan despacio; sin tema, quietos. Sin filter: blur
          ni pulsos infinitos (se recalculaban en cada cuadro, también proyectando). */}
      {hasStoryTheme ? (
        <>
          <div className="story-glow story-glow-a pointer-events-none absolute top-16 right-8 h-72 w-72 rounded-full" aria-hidden="true" />
          <div className="story-glow story-glow-b pointer-events-none absolute bottom-16 left-1/3 h-80 w-80 rounded-full" aria-hidden="true" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute right-10 top-20 h-72 w-72 rounded-full opacity-70 dark:opacity-25" style={{ background: 'radial-gradient(circle, rgba(191, 219, 254, 0.55), transparent 70%)' }} aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-20 left-1/3 h-72 w-72 rounded-full opacity-70 dark:opacity-25" style={{ background: 'radial-gradient(circle, rgba(233, 213, 255, 0.5), transparent 70%)' }} aria-hidden="true" />
        </>
      )}

      {/* Sidebar de la clase: banda con el cielo de la clase (el mismo que ven sus alumnos, quieto) */}
      <AppSidebar
        accent={storyAccent}
        bandTint={storyAccent ? mixHex(NIGHT, storyAccent.sidebar, 0.35) : null}
        sky={{ kind: 'class', constellation: classSkyFor(classroom.id), lit: classSkyFor(classroom.id).stars.length, key: classroom.id }}
        twinkle={false}
        logoTo="/dashboard"
        context={(
          <TeacherClassCard
            classroomId={classroom.id}
            name={classroom.name}
            code={classroom.code}
            accent={storyAccent}
            onBack={() => navigate('/dashboard')}
          />
        )}
        nav={navGroups}
        navLabel="Menú de la clase"
        footerNav={navFooter}
        footer={showNews
          ? ({ rail }) => (
            <NewsLine rail={rail} pending={pendingUnlocks.length} onOpen={() => setShowUnlockModal(true)} onDismiss={dismissNews} />
          )
          : undefined}
        speed="fast"
        openGroups={openGroups}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileMenuOpen}
        onMobileOpenChange={setMobileMenuOpen}
        contentRef={contentRef}
        menuButtonRef={menuButtonRef}
      />

      {/* Contenido principal */}
      <div ref={contentRef} className={`flex-1 flex flex-col overflow-hidden relative z-10 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        {/* Header */}
        <header
          className="relative h-14 backdrop-blur-lg shadow-sm flex items-center justify-between px-4 bg-white/80 dark:bg-gray-800/80 border-b border-white/50 dark:border-gray-700/50"
        >
          {storyAccent && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5" style={{ background: accentGradient(storyAccent, 90) }} aria-hidden="true" />
          )}
          <div className="flex items-center gap-3 min-w-0">
            {/* Botón menú móvil */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex h-11 w-11 items-center justify-center text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              aria-label="Abrir menú"
              aria-expanded={mobileMenuOpen}
            >
              <Menu size={20} />
            </button>
            {storyAccent ? (
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md text-base"
                style={{ background: accentGradient(storyAccent) }}
                title={storyAccent.title ?? 'Tema de la clase'}
                aria-hidden="true"
              >
                {storyAccent.emoji}
              </div>
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <GraduationCap size={16} className="text-white" />
              </div>
            )}
            <div className="hidden sm:block min-w-0">
              <h1 className="text-sm font-bold text-gray-800 dark:text-white">{classroom.name}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{classroom.students?.length || 0} estudiantes</p>
            </div>
          </div>

          {showStudentsSummaryHeader && (
            <div className="hidden xl:flex items-center justify-center gap-2 flex-1 px-4 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                <Sparkles size={12} />
                <span className="text-xs font-semibold">{headerTotalXP.toLocaleString()} XP</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                <Coins size={12} />
                <span className="text-xs font-semibold">{headerTotalGP.toLocaleString()} GP</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                <TrendingUp size={12} />
                <span className="text-xs font-semibold">{headerAvgLevel} Nv</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 max-w-[220px] min-w-0">
                <Crown size={12} className="text-amber-500 flex-shrink-0" />
                <span className="text-xs font-semibold truncate">{getHeaderDisplayName(headerTopStudent)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {/* Herramientas de clase: disponibles en todas las páginas del aula */}
            <button
              type="button"
              onClick={() => setShowTools(true)}
              className="relative inline-flex items-center gap-2 min-h-[36px] px-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
              aria-label={pendingNotesCount > 0 ? `Herramientas de clase (${pendingNotesCount} notas pendientes)` : 'Herramientas de clase'}
              title="Herramientas de clase"
            >
              <Wrench size={16} aria-hidden="true" />
              <span className="hidden md:inline">Herramientas</span>
              {pendingNotesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800" aria-hidden="true">
                  {pendingNotesCount}
                </span>
              )}
            </button>

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
              className="flex items-center gap-2 min-h-[36px] px-3 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet context={{ classroom, refetch, storyTheme: null, isThemeDark: false, storyAccent, openTools: () => setShowTools(true) }} />
        </main>
      </div>

      {showTools && (
        <Suspense fallback={null}>
          <ClassroomUtilities
        isOpen={showTools}
        onClose={() => setShowTools(false)}
        students={classroom.students || []}
        showCharacterName={classroom.showCharacterName !== false}
        classroomId={classroom.id}
        xpPerLevel={classroom.xpPerLevel || 100}
        allowNegativePoints={classroom.allowNegativePoints !== false}
          />
        </Suspense>
      )}

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
                    <p className="text-xs text-gray-600 dark:text-gray-400">Activa nuevas funciones para tu clase</p>
                    {onboarding.data.level && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <Rocket size={12} aria-hidden="true" />
                        Tu nivel: {onboarding.data.level}
                      </p>
                    )}
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
    </div>
  );
};
