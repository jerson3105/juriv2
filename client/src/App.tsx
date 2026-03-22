import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { TimerProvider } from './contexts/TimerContext';
import { NotificationProvider } from './contexts/NotificationContext';

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
import { StorytellingPage } from './pages/classroom/StorytellingPage';
import { AnnouncementsPage } from './pages/classroom/AnnouncementsPage';
import { ClassroomChatPage } from './pages/classroom/ClassroomChatPage';
import { StudentScrollsPage } from './pages/student/StudentScrollsPage';
import { StudentGradesPage } from './pages/student/StudentGradesPage';
import { StudentExpeditionsPage } from './pages/student/StudentExpeditionsPage';
import { StudentCollectiblesPage } from './pages/student/StudentCollectiblesPage';
import { StudentJiroExpeditionPage } from './pages/student/StudentJiroExpeditionPage';
import { StudentJiroExpeditionsPage } from './pages/student/StudentJiroExpeditionsPage';
import { StudentStoryPage } from './pages/student/StudentStoryPage';
import { StudentProgressPage } from './pages/student/StudentProgressPage';

// Settings
import { SettingsPage } from './pages/settings/SettingsPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAvatarItems from './pages/admin/AdminAvatarItems';
import AdminUsers from './pages/admin/AdminUsers';
import AdminClassrooms from './pages/admin/AdminClassrooms';
import AdminExpeditionMaps from './pages/admin/AdminExpeditionMaps';
import { AdminBugReports } from './pages/admin/AdminBugReports';
import AdminSchoolVerifications from './pages/admin/AdminSchoolVerifications';

// Schools
import { SchoolsPage } from './pages/schools/SchoolsPage';

// Parent pages
import ParentDashboard from './pages/parent/ParentDashboard';
import ChildDetailPage from './pages/parent/ChildDetailPage';
import ParentReportPage from './pages/parent/ParentReportPage';
import ParentAIReportPage from './pages/parent/ParentAIReportPage';
import ParentAnnouncementsPage from './pages/parent/ParentAnnouncementsPage';
import ParentGroupChatPage from './pages/parent/ParentGroupChatPage';

// Layout
import { MainLayout } from './components/layout/MainLayout';
import { ClassroomLayout } from './components/layout/ClassroomLayout';
import { ParentLayout } from './components/layout/ParentLayout';

// Store
import { useAuthStore } from './store/authStore';

// Onboarding
import { TeacherOnboardingProvider, useTeacherOnboarding } from './contexts/TeacherOnboardingContext';
import TeacherOnboardingFlow from './pages/onboarding/TeacherOnboardingFlow';

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
  const { isAuthenticated, accessToken } = useAuthStore();

  if (isAuthenticated && accessToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
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
              <Route path="storytelling" element={<StorytellingPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="chat" element={<ClassroomChatPage />} />
              <Route path="settings" element={<ClassroomSettingsPage />} />
              <Route path="student/:studentId" element={<StudentDetailPage />} />
            </Route>
            
            {/* Rutas de estudiante */}
            <Route path="join-class" element={<JoinClassPage />} />
            <Route path="my-clan" element={<MyClanPage />} />
            <Route path="my-attendance" element={<StudentAttendancePage />} />
            <Route path="scrolls" element={<StudentScrollsPage />} />
            <Route path="my-grades" element={<StudentGradesPage />} />
            <Route path="my-progress" element={<StudentProgressPage />} />
            <Route path="expeditions" element={<StudentExpeditionsPage />} />
            <Route path="jiro-expeditions" element={<StudentJiroExpeditionsPage />} />
            <Route path="jiro-expedition/:expeditionId" element={<StudentJiroExpeditionPage />} />
            <Route path="collectibles" element={<StudentCollectiblesPage />} />
            <Route path="my-story" element={<StudentStoryPage />} />
            
            {/* Redirigir rutas antiguas */}
            <Route path="my-classroom" element={<Navigate to="/dashboard" replace />} />
            

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
            path="/admin/school-verifications"
            element={
              <ProtectedRoute>
                <AdminSchoolVerifications />
              </ProtectedRoute>
            }
          />
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
            <Route path="chat" element={<ParentAnnouncementsPage />} />
            <Route path="chat/announcements/:classroomId" element={<ParentAnnouncementsPage />} />
            <Route path="chat/group" element={<ParentGroupChatPage />} />
            <Route path="chat/group/:classroomId" element={<ParentGroupChatPage />} />
          </Route>

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
      </NotificationProvider>
    </QueryClientProvider>
  );
}

export default App;
