import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { queryClient } from './lib/queryClient';
import { TimerProvider } from './contexts/TimerContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { lazyPage } from './lib/lazyPage';
import { CelebrationHost } from './components/celebrations/CelebrationHost';

// Páginas del flujo de acceso: carga inmediata (primera pantalla de quien no ha iniciado sesión).
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { JoinDoorPage } from './pages/auth/JoinDoorPage';
import { GoogleCallbackPage } from './pages/auth/GoogleCallbackPage';
import { SelectRolePage } from './pages/auth/SelectRolePage';
import { TeacherRegisterPage } from './pages/auth/TeacherRegisterPage';
import { FamilyRegisterPage } from './pages/auth/FamilyRegisterPage';
import { FamilyJoinPage } from './pages/auth/FamilyJoinPage';

// Resto de páginas: bajo demanda (code splitting por ruta). Cada usuario descarga solo lo que abre.
const AboutPage = lazyPage(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const PrivacyPolicyPage = lazyPage(() => import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TeacherHome = lazyPage(() => import('./pages/dashboard/TeacherHome').then((m) => ({ default: m.TeacherHome })));
const JoinClassPage = lazyPage(() => import('./pages/student/JoinClassPage').then((m) => ({ default: m.JoinClassPage })));
const StudentDashboard = lazyPage(() => import('./pages/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const StudentOverviewPage = lazyPage(() => import('./pages/student/StudentOverviewPage').then((m) => ({ default: m.StudentOverviewPage })));
const StudentClassesOverviewPage = lazyPage(() => import('./pages/student/StudentClassesOverviewPage').then((m) => ({ default: m.StudentClassesOverviewPage })));
const StudentSkillsOverviewPage = lazyPage(() => import('./pages/student/StudentSkillsOverviewPage').then((m) => ({ default: m.StudentSkillsOverviewPage })));
const MyClanPage = lazyPage(() => import('./pages/student/MyClanPage').then((m) => ({ default: m.MyClanPage })));
const StudentCalendarPage = lazyPage(() => import('./pages/student/StudentCalendarPage').then((m) => ({ default: m.StudentCalendarPage })));

// Classroom pages (teacher)
const StudentsPage = lazyPage(() => import('./pages/classroom/StudentsPage').then((m) => ({ default: m.StudentsPage })));
const BehaviorsPage = lazyPage(() => import('./pages/classroom/BehaviorsPage').then((m) => ({ default: m.BehaviorsPage })));
const ShopPage = lazyPage(() => import('./pages/classroom/ShopPage').then((m) => ({ default: m.ShopPage })));
const ObservatorioPage = lazyPage(() => import('./pages/classroom/ObservatorioPage').then((m) => ({ default: m.ObservatorioPage })));
const ClassroomSettingsPage = lazyPage(() => import('./pages/classroom/ClassroomSettingsPage').then((m) => ({ default: m.ClassroomSettingsPage })));
const AttendancePage = lazyPage(() => import('./pages/classroom/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const StudentDetailPage = lazyPage(() => import('./pages/classroom/StudentDetailPage').then((m) => ({ default: m.StudentDetailPage })));
const BadgesPage = lazyPage(() => import('./pages/classroom/BadgesPage').then((m) => ({ default: m.BadgesPage })));
const ClansPage = lazyPage(() => import('./pages/classroom/ClansPage').then((m) => ({ default: m.ClansPage })));
const RankingsPage = lazyPage(() => import('./pages/classroom/RankingsPage').then((m) => ({ default: m.RankingsPage })));
const QuestionBanksPage = lazyPage(() => import('./pages/classroom/QuestionBanksPage').then((m) => ({ default: m.QuestionBanksPage })));
const ExpeditionsPage = lazyPage(() => import('./pages/classroom/ExpeditionsPage').then((m) => ({ default: m.ExpeditionsPage })));
const CollectiblesPage = lazyPage(() => import('./pages/classroom/CollectiblesPage').then((m) => ({ default: m.CollectiblesPage })));
const ReportsPage = lazyPage(() => import('./pages/classroom/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const HistoryPage = lazyPage(() => import('./pages/classroom/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const GradebookPage = lazyPage(() => import('./pages/classroom/GradebookPage').then((m) => ({ default: m.GradebookPage })));
const StorytellingPage = lazyPage(() => import('./pages/classroom/StorytellingPage').then((m) => ({ default: m.StorytellingPage })));
const FamilyRoomPage = lazyPage(() => import('./pages/classroom/FamilyRoomPage').then((m) => ({ default: m.FamilyRoomPage })));
const StudentScrollsPage = lazyPage(() => import('./pages/student/StudentScrollsPage').then((m) => ({ default: m.StudentScrollsPage })));
const StudentGradesPage = lazyPage(() => import('./pages/student/StudentGradesPage').then((m) => ({ default: m.StudentGradesPage })));
const StudentExpeditionsPage = lazyPage(() => import('./pages/student/StudentExpeditionsPage').then((m) => ({ default: m.StudentExpeditionsPage })));
const StudentCollectiblesPage = lazyPage(() => import('./pages/student/StudentCollectiblesPage').then((m) => ({ default: m.StudentCollectiblesPage })));
const StudentExpeditionPage = lazyPage(() => import('./pages/student/StudentExpeditionPage').then((m) => ({ default: m.StudentExpeditionPage })));
const StudentStoryPage = lazyPage(() => import('./pages/student/StudentStoryPage').then((m) => ({ default: m.StudentStoryPage })));
const StudentProgressPage = lazyPage(() => import('./pages/student/StudentProgressPage').then((m) => ({ default: m.StudentProgressPage })));
const StudentItemsShopPage = lazyPage(() => import('./pages/student/StudentItemsShopPage').then((m) => ({ default: m.StudentItemsShopPage })));
const StudentBadgesPage = lazyPage(() => import('./pages/student/StudentBadgesPage').then((m) => ({ default: m.StudentBadgesPage })));
const StudentAvatarPage = lazyPage(() => import('./pages/student/StudentAvatarPage').then((m) => ({ default: m.StudentAvatarPage })));

// Settings
const SettingsPage = lazyPage(() => import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

// Admin pages
const AdminLayout = lazyPage(() => import('./components/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboard = lazyPage(() => import('./pages/admin/AdminDashboard'));
const AdminAvatarItems = lazyPage(() => import('./pages/admin/AdminAvatarItems'));
const AdminAvatarItemPage = lazyPage(() => import('./pages/admin/AdminAvatarItemPage'));
const AvatarItemEditorPage = lazyPage(() => import('./pages/admin/AvatarItemEditorPage'));
const AdminUsers = lazyPage(() => import('./pages/admin/AdminUsers'));
const AdminClassrooms = lazyPage(() => import('./pages/admin/AdminClassrooms'));
const AdminExpeditionMaps = lazyPage(() => import('./pages/admin/AdminExpeditionMaps'));
const AdminBugReports = lazyPage(() => import('./pages/admin/AdminBugReports').then((m) => ({ default: m.AdminBugReports })));
const AdminSchoolVerifications = lazyPage(() => import('./pages/admin/AdminSchoolVerifications'));
const AdminTeacherVerifications = lazyPage(() => import('./pages/admin/AdminTeacherVerifications'));

// Schools
const SchoolsPage = lazyPage(() => import('./pages/schools/SchoolsPage').then((m) => ({ default: m.SchoolsPage })));
const SchoolConsoleEntry = lazyPage(() => import('./pages/schools/SchoolConsoleEntry').then((m) => ({ default: m.SchoolConsoleEntry })));
const SchoolHomePage = lazyPage(() => import('./pages/schools/SchoolHomePage').then((m) => ({ default: m.SchoolHomePage })));
const SchoolYearPage = lazyPage(() => import('./pages/schools/SchoolYearPage').then((m) => ({ default: m.SchoolYearPage })));
const SchoolPromotionPage = lazyPage(() => import('./pages/schools/SchoolPromotionPage').then((m) => ({ default: m.SchoolPromotionPage })));
const SchoolSectionsPage = lazyPage(() => import('./pages/schools/SchoolSectionsPage').then((m) => ({ default: m.SchoolSectionsPage })));
const SchoolStudentsPage = lazyPage(() => import('./pages/schools/SchoolStudentsPage').then((m) => ({ default: m.SchoolStudentsPage })));
const SchoolRosterBuilderPage = lazyPage(() => import('./pages/schools/SchoolRosterBuilderPage').then((m) => ({ default: m.SchoolRosterBuilderPage })));
const SchoolRosterImportPage = lazyPage(() => import('./pages/schools/SchoolRosterImportPage').then((m) => ({ default: m.SchoolRosterImportPage })));
const SchoolMyAssignmentsPage = lazyPage(() => import('./pages/schools/SchoolMyAssignmentsPage').then((m) => ({ default: m.SchoolMyAssignmentsPage })));
const SchoolTutoringPage = lazyPage(() => import('./pages/schools/SchoolMyAssignmentsPage').then((m) => ({ default: m.SchoolTutoringPage })));
const SchoolAccessPage = lazyPage(() => import('./pages/schools/SchoolAccessPage').then((m) => ({ default: m.SchoolAccessPage })));
const SchoolCoordinationPage = lazyPage(() => import('./pages/schools/SchoolCoordinationPage').then((m) => ({ default: m.SchoolCoordinationPage })));
const SchoolTeachersPage = lazyPage(() => import('./pages/schools/SchoolConsolePages').then((m) => ({ default: m.SchoolTeachersPage })));
const SchoolClassesPage = lazyPage(() => import('./pages/schools/SchoolConsolePages').then((m) => ({ default: m.SchoolClassesPage })));
const SchoolReportsPage = lazyPage(() => import('./pages/schools/SchoolConsolePages').then((m) => ({ default: m.SchoolReportsPage })));
const SchoolLibraryPage = lazyPage(() => import('./pages/schools/SchoolConsolePages').then((m) => ({ default: m.SchoolLibraryPage })));

// Parent pages
const ParentDashboard = lazyPage(() => import('./pages/parent/ParentDashboard'));
const ChildDetailPage = lazyPage(() => import('./pages/parent/ChildDetailPage'));
const ParentReportPage = lazyPage(() => import('./pages/parent/ParentReportPage'));
const ParentAIReportPage = lazyPage(() => import('./pages/parent/ParentAIReportPage'));
const ParentRoomPage = lazyPage(() => import('./pages/parent/ParentRoomPage'));

// Layout
import { MainLayout } from './components/layout/MainLayout';
import { ClassroomLayout } from './components/layout/ClassroomLayout';
import { SchoolLayout } from './components/layout/SchoolLayout';
import { ParentLayout } from './components/layout/ParentLayout';

// Store
import { useAuthStore } from './store/authStore';

// Onboarding
import { TeacherOnboardingProvider, useTeacherOnboarding } from './contexts/TeacherOnboardingContext';
import { Loader2 } from 'lucide-react';
import { refreshSession } from './lib/session';
import { Starfield } from './components/auth/SpaceScene';
import { IdleGuard } from './components/auth/IdleGuard';
const TeacherOnboardingFlow = lazyPage(() => import('./pages/onboarding/TeacherOnboardingFlow'));

// Dashboard Router - redirige según el rol
const DashboardRouter = () => {
  const { user } = useAuthStore();
  
  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }
  
  if (user?.role === 'PARENT') {
    return <Navigate to="/parent" replace />;
  }
  
  if (user?.role === 'STUDENT') {
    return <StudentOverviewPage />;
  }
  
  return <TeacherHome />;
};

// Inner component that checks onboarding status
const TeacherOnboardingGate = () => {
  const { needsOnboarding, isLoading } = useTeacherOnboarding();

  if (isLoading) return null; // Don't flash anything while loading
  if (needsOnboarding) return <TeacherOnboardingFlow />;

  return <MainLayout />;
};

// Teacher Layout - envuelve las rutas de profesor con providers
const TeacherMainLayout = () => {
  const { user } = useAuthStore();
  
  if (user?.role === 'TEACHER') {
    return (
      <TeacherOnboardingProvider>
        <TeacherOnboardingGate />
      </TeacherOnboardingProvider>
    );
  }
  
  return <MainLayout />;
};


// Al abrir la app, la sesión se recupera con la cookie httpOnly (el access token vive en memoria).
// Mientras tanto se muestra el cielo nocturno; si la cookie ya no sirve, se pide entrar de nuevo.
const SessionBootstrap = () => {
  useEffect(() => {
    const { isAuthenticated, accessToken } = useAuthStore.getState();
    if (!isAuthenticated || accessToken) return;
    void refreshSession().then((token) => {
      if (!token) useAuthStore.setState({ user: null, isAuthenticated: false });
    });
  }, []);
  return null;
};

const SessionSplash = () => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1026]" role="status" aria-label="Recuperando tu sesión">
    <Starfield count={50} />
    <Loader2 className="relative h-8 w-8 animate-spin text-amber-200" aria-hidden="true" />
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, accessToken } = useAuthStore();

  if (isAuthenticated && !accessToken) return <SessionSplash />;
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, accessToken } = useAuthStore();

  if (isAuthenticated && !accessToken) return <SessionSplash />;
  if (isAuthenticated && accessToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* framer-motion respeta "reducir movimiento" del sistema operativo */}
      <MotionConfig reducedMotion="user">
      <NotificationProvider>
      <TimerProvider>
        <BrowserRouter>
          <SessionBootstrap />
          <IdleGuard />
          <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />
          <Route path="/register/student-code" element={<Navigate to="/unirse" replace />} />
          <Route path="/registro/docente" element={<PublicRoute><TeacherRegisterPage /></PublicRoute>} />
          <Route path="/registro/familia" element={<PublicRoute><FamilyRegisterPage /></PublicRoute>} />
          {/* Sin PublicRoute: una familia con sesión también abre el enlace para pedir unirse. */}
          <Route path="/familia/:code" element={<FamilyJoinPage />} />
          <Route path="/unirse" element={<JoinDoorPage />} />
          <Route path="/unirse/:code" element={<JoinDoorPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          
          {/* Google OAuth Callback */}
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
          <Route path="/auth/select-role" element={<SelectRolePage />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TeacherMainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardRouter />} />
            {/* Rutas de profesor - lista de clases */}
            {/* "Mis clases" ahora vive en Inicio */}
            <Route path="classrooms" element={<Navigate to="/dashboard" replace />} />
            <Route path="settings" element={<SettingsPage />} />
            
            {/* Consola escolar: un contexto propio con su menú, como la clase */}
            <Route path="escuela" element={<SchoolConsoleEntry />} />
            <Route path="escuela/:schoolId" element={<SchoolLayout />}>
              <Route index element={<SchoolHomePage />} />
              <Route path="anio" element={<SchoolYearPage />} />
              <Route path="promocion" element={<SchoolPromotionPage />} />
              <Route path="secciones" element={<SchoolSectionsPage />} />
              <Route path="estudiantes" element={<SchoolStudentsPage />} />
              <Route path="estudiantes/armar" element={<SchoolRosterBuilderPage />} />
              <Route path="estudiantes/importar" element={<SchoolRosterImportPage />} />
              <Route path="acceso" element={<SchoolAccessPage />} />
              <Route path="mis-asignaciones" element={<SchoolMyAssignmentsPage />} />
              <Route path="mi-tutoria/:sectionId" element={<SchoolTutoringPage />} />
              <Route path="coordinacion" element={<SchoolCoordinationPage />} />
              <Route path="docentes" element={<SchoolTeachersPage />} />
              <Route path="clases" element={<SchoolClassesPage />} />
              <Route path="informes" element={<SchoolReportsPage />} />
              <Route path="biblioteca" element={<SchoolLibraryPage />} />
            </Route>

            {/* Rutas de clase específica con su propio layout */}
            <Route path="classroom/:id" element={<ClassroomLayout />}>
              <Route index element={<Navigate to="students" replace />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="statistics" element={<Navigate to="../reports" replace />} />
              <Route path="dashboard" element={<Navigate to="../reports" replace />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="gradebook" element={<GradebookPage />} />
              <Route path="gradebook/stats" element={<Navigate to="../gradebook?tab=resumen" replace />} />
              <Route path="gamification-stats" element={<ReportsPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="behaviors" element={<BehaviorsPage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="activities" element={<ObservatorioPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="badges" element={<BadgesPage />} />
              <Route path="clans" element={<ClansPage />} />
              <Route path="rankings" element={<RankingsPage />} />
              <Route path="question-banks" element={<QuestionBanksPage />} />
              <Route path="question-banks/:bankId" element={<QuestionBanksPage />} />
              <Route path="expeditions" element={<ExpeditionsPage />} />
              <Route path="expeditions/:expeditionId" element={<ExpeditionsPage />} />
              <Route path="collectibles" element={<CollectiblesPage />} />
              <Route path="storytelling" element={<StorytellingPage />} />
              <Route path="families" element={<FamilyRoomPage />} />
              {/* Avisos y Chat grupal ahora son una sola sala. */}
              <Route path="announcements" element={<Navigate to="../families" replace />} />
              <Route path="chat" element={<Navigate to="../families" replace />} />
              <Route path="settings" element={<Navigate to="general" replace />} />
              <Route path="settings/:section" element={<ClassroomSettingsPage />} />
              <Route path="student/:studentId" element={<StudentDetailPage />} />
            </Route>
            
            {/* Rutas de estudiante */}
            <Route path="my-class" element={<StudentDashboard />} />
            <Route path="my-classes" element={<StudentClassesOverviewPage />} />
            <Route path="my-skills" element={<StudentSkillsOverviewPage />} />
            <Route path="join-class" element={<JoinClassPage />} />
            <Route path="my-clan" element={<MyClanPage />} />
            <Route path="my-calendar" element={<StudentCalendarPage />} />
            {/* "Mi Asistencia" pasó a ser "Mi calendario" */}
            <Route path="my-attendance" element={<Navigate to="/my-calendar" replace />} />
            <Route path="scrolls" element={<StudentScrollsPage />} />
            <Route path="my-grades" element={<StudentGradesPage />} />
            <Route path="my-progress" element={<StudentProgressPage />} />
            <Route path="my-shop" element={<StudentItemsShopPage />} />
            <Route path="my-badges" element={<StudentBadgesPage />} />
            <Route path="my-avatar" element={<StudentAvatarPage />} />
            <Route path="expeditions" element={<StudentExpeditionsPage />} />
            <Route path="expeditions/:expeditionId" element={<StudentExpeditionPage />} />
            {/* La Expedición de Jiro se unió a Expediciones. */}
            <Route path="jiro-expeditions" element={<Navigate to="/expeditions" replace />} />
            <Route path="jiro-expedition/:expeditionId" element={<Navigate to="/expeditions" replace />} />
            <Route path="collectibles" element={<StudentCollectiblesPage />} />
            <Route path="my-story" element={<StudentStoryPage />} />
            
            {/* Redirigir rutas antiguas */}
            <Route path="my-classroom" element={<Navigate to="/my-class" replace />} />
            

          </Route>

          {/* Panel de administración: un solo armazón (guarda de rol, menú y pie) para todas sus páginas. */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="avatar-items" element={<AdminAvatarItems />} />
            <Route path="avatar-items/nueva" element={<AvatarItemEditorPage />} />
            <Route path="avatar-items/:id/editar" element={<AvatarItemEditorPage />} />
            <Route path="avatar-items/:id" element={<AdminAvatarItemPage />} />
            <Route path="expedition-maps" element={<AdminExpeditionMaps />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="classrooms" element={<AdminClassrooms />} />
            <Route path="bug-reports" element={<AdminBugReports />} />
            <Route path="teacher-verifications" element={<AdminTeacherVerifications />} />
            <Route path="school-verifications" element={<AdminSchoolVerifications />} />
            <Route path="cuenta" element={<SettingsPage />} />
          </Route>
          {/* School Routes */}
          <Route
            path="/schools"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SchoolsPage />} />
          </Route>

          {/* Parent Routes */}
          <Route
            path="/parent"
            element={
              <ProtectedRoute>
                <ParentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ParentDashboard />} />
            <Route path="child/:studentId" element={<ChildDetailPage />} />
            <Route path="report" element={<ParentReportPage />} />
            <Route path="report/:studentId" element={<ParentReportPage />} />
            <Route path="ai-report" element={<ParentAIReportPage />} />
            <Route path="ai-report/:studentId" element={<ParentAIReportPage />} />
            <Route path="avisos" element={<ParentRoomPage />} />
            {/* Avisos y Chat grupal ahora son una sola sala. */}
            <Route path="chat/*" element={<Navigate to="/parent/avisos" replace />} />
          </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>

        {/* Subidas de nivel e insignias (profesor y alumno) */}
        <CelebrationHost />

        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
              borderRadius: '10px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </TimerProvider>
      </NotificationProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}

export default App;
