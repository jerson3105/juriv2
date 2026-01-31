import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimerProvider } from './contexts/TimerContext';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { GoogleCallbackPage } from './pages/auth/GoogleCallbackPage';
import { SelectRolePage } from './pages/auth/SelectRolePage';
import { AboutPage } from './pages/AboutPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TeacherDashboard } from './pages/dashboard/TeacherDashboard';
import { ClassroomsPage } from './pages/classrooms/ClassroomsPage';
import { JoinClassPage } from './pages/student/JoinClassPage';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { MyClanPage } from './pages/student/MyClanPage';
import { StudentAttendancePage } from './pages/student/StudentAttendancePage';

// Classroom pages (teacher)
import { StudentsPage } from './pages/classroom/StudentsPage';
import { BehaviorsPage } from './pages/classroom/BehaviorsPage';
import { ShopPage } from './pages/classroom/ShopPage';
import { ActivitiesPage } from './pages/classroom/ActivitiesPage';
import { ClassroomSettingsPage } from './pages/classroom/ClassroomSettingsPage';
import { AttendancePage } from './pages/classroom/AttendancePage';
import { StudentDetailPage } from './pages/classroom/StudentDetailPage';
import { BadgesPage } from './pages/classroom/BadgesPage';
import { ClansPage } from './pages/classroom/ClansPage';
import { RankingsPage } from './pages/classroom/RankingsPage';
import { QuestionBanksPage } from './pages/classroom/QuestionBanksPage';
import { ExpeditionsPage } from './pages/classroom/ExpeditionsPage';
import { CollectiblesPage } from './pages/classroom/CollectiblesPage';
import { ReportsPage } from './pages/classroom/ReportsPage';
import { HistoryPage } from './pages/classroom/HistoryPage';
import { GradebookPage } from './pages/classroom/GradebookPage';
import { GradebookStatsPage } from './pages/classroom/GradebookStatsPage';
import { StudentScrollsPage } from './pages/student/StudentScrollsPage';
import { StudentGradesPage } from './pages/student/StudentGradesPage';
import { StudentExpeditionsPage } from './pages/student/StudentExpeditionsPage';
import { StudentCollectiblesPage } from './pages/student/StudentCollectiblesPage';
import { StudentJiroExpeditionPage } from './pages/student/StudentJiroExpeditionPage';
import { StudentJiroExpeditionsPage } from './pages/student/StudentJiroExpeditionsPage';

// Settings
import { SettingsPage } from './pages/settings/SettingsPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAvatarItems from './pages/admin/AdminAvatarItems';
import AdminUsers from './pages/admin/AdminUsers';
import AdminClassrooms from './pages/admin/AdminClassrooms';
import AdminSchools from './pages/admin/AdminSchools';
import AdminExpeditionMaps from './pages/admin/AdminExpeditionMaps';
import { AdminBugReports } from './pages/admin/AdminBugReports';

// School pages (B2B)
import MySchoolsPage from './pages/school/MySchoolsPage';
import SchoolDashboardPage from './pages/school/SchoolDashboardPage';
import SchoolMembersPage from './pages/school/SchoolMembersPage';
import SchoolClassroomsPage from './pages/school/SchoolClassroomsPage';
import SchoolStudentsPage from './pages/school/SchoolStudentsPage';
import SchoolSettingsPage from './pages/school/SchoolSettingsPage';
import SchoolGradesPage from './pages/school/SchoolGradesPage';

// Parent pages
import ParentDashboard from './pages/parent/ParentDashboard';
import ChildDetailPage from './pages/parent/ChildDetailPage';

// Layout
import { MainLayout } from './components/layout/MainLayout';
import { ClassroomLayout } from './components/layout/ClassroomLayout';

// Store
import { useAuthStore } from './store/authStore';

// Onboarding
import { OnboardingProvider } from './components/onboarding';

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
    return <StudentDashboard />;
  }
  
  return <TeacherDashboard />;
};

// Teacher Layout - envuelve las rutas de profesor con OnboardingProvider
const TeacherMainLayout = () => {
  const { user } = useAuthStore();
  
  // Solo envolver en OnboardingProvider si es profesor
  if (user?.role === 'TEACHER') {
    return (
      <OnboardingProvider>
        <MainLayout />
      </OnboardingProvider>
    );
  }
  
  return <MainLayout />;
};

// Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, accessToken, fetchUser } = useAuthStore();

  useEffect(() => {
    if (accessToken && !isAuthenticated) {
      fetchUser();
    }
  }, [accessToken, isAuthenticated, fetchUser]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TimerProvider>
        <BrowserRouter>
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
            <Route path="classrooms" element={<ClassroomsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            
            {/* Rutas de clase específica con su propio layout */}
            <Route path="classroom/:id" element={<ClassroomLayout />}>
              <Route index element={<Navigate to="students" replace />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="statistics" element={<Navigate to="../reports" replace />} />
              <Route path="dashboard" element={<Navigate to="../reports" replace />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="gradebook" element={<GradebookPage />} />
              <Route path="gradebook/stats" element={<GradebookStatsPage />} />
              <Route path="gamification-stats" element={<ReportsPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="behaviors" element={<BehaviorsPage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="activities" element={<ActivitiesPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="badges" element={<BadgesPage />} />
              <Route path="clans" element={<ClansPage />} />
              <Route path="rankings" element={<RankingsPage />} />
              <Route path="question-banks" element={<QuestionBanksPage />} />
              <Route path="expeditions" element={<ExpeditionsPage />} />
              <Route path="collectibles" element={<CollectiblesPage />} />
              <Route path="settings" element={<ClassroomSettingsPage />} />
              <Route path="student/:studentId" element={<StudentDetailPage />} />
            </Route>
            
            {/* Rutas de estudiante */}
            <Route path="join-class" element={<JoinClassPage />} />
            <Route path="my-clan" element={<MyClanPage />} />
            <Route path="my-attendance" element={<StudentAttendancePage />} />
            <Route path="scrolls" element={<StudentScrollsPage />} />
            <Route path="my-grades" element={<StudentGradesPage />} />
            <Route path="expeditions" element={<StudentExpeditionsPage />} />
            <Route path="jiro-expeditions" element={<StudentJiroExpeditionsPage />} />
            <Route path="jiro-expedition/:expeditionId" element={<StudentJiroExpeditionPage />} />
            <Route path="collectibles" element={<StudentCollectiblesPage />} />
            
            {/* Redirigir rutas antiguas */}
            <Route path="my-classroom" element={<Navigate to="/dashboard" replace />} />
            
            {/* Rutas de escuelas (B2B) */}
            <Route path="schools" element={<MySchoolsPage />} />
            <Route path="school/:schoolId" element={<SchoolDashboardPage />} />
            <Route path="school/:schoolId/members" element={<SchoolMembersPage />} />
            <Route path="school/:schoolId/classrooms" element={<SchoolClassroomsPage />} />
            <Route path="school/:schoolId/students" element={<SchoolStudentsPage />} />
            <Route path="school/:schoolId/grades" element={<SchoolGradesPage />} />
            <Route path="school/:schoolId/settings" element={<SchoolSettingsPage />} />
          </Route>

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/avatar-items"
            element={
              <ProtectedRoute>
                <AdminAvatarItems />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/expedition-maps"
            element={
              <ProtectedRoute>
                <AdminExpeditionMaps />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/classrooms"
            element={
              <ProtectedRoute>
                <AdminClassrooms />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/bug-reports"
            element={
              <ProtectedRoute>
                <AdminBugReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/schools"
            element={
              <ProtectedRoute>
                <AdminSchools />
              </ProtectedRoute>
            }
          />

          {/* Parent Routes */}
          <Route
            path="/parent"
            element={
              <ProtectedRoute>
                <ParentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/child/:studentId"
            element={
              <ProtectedRoute>
                <ChildDetailPage />
              </ProtectedRoute>
            }
          />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>

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
    </QueryClientProvider>
  );
}

export default App;
