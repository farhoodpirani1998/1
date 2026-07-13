import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { ThemeProvider } from './lib/theme';
import { AppLayout } from './components/AppLayout';
import { RequireRole } from './components/RequireRole';
import { LoginPage } from './pages/LoginPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { ArchivedStudentsPage } from './pages/ArchivedStudentsPage';
import { InstallmentsPage } from './pages/InstallmentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SchoolsPage } from './pages/SchoolsPage';
import { UsersPage } from './pages/UsersPage';
import { TeacherAssignmentsPage } from './pages/TeacherAssignmentsPage';
import { PrintReceiptPage } from './pages/PrintReceiptPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomeRedirect } from './components/HomeRedirect';
import { ParentLoginPage } from './pages/parent/ParentLoginPage';
import { ParentForgotPasswordPage } from './pages/parent/ParentForgotPasswordPage';
import { ParentDashboardPage } from './pages/parent/ParentDashboardPage';
import { ParentTuitionPage } from './pages/parent/ParentTuitionPage';
import { ParentInstallmentsPage } from './pages/parent/ParentInstallmentsPage';
import { ParentPaymentsPage } from './pages/parent/ParentPaymentsPage';
import { ParentStudentProvider } from './lib/parentStudent';
import { TeacherLoginPage } from './pages/teacher/TeacherLoginPage';
import { TeacherDashboardPage } from './pages/teacher/TeacherDashboardPage';
import { TeacherStudentsPage } from './pages/teacher/TeacherStudentsPage';
import { TeacherAttendancePage } from './pages/teacher/TeacherAttendancePage';
import { TeacherAssessmentsPage } from './pages/teacher/TeacherAssessmentsPage';
import { TeacherHomeworkPage } from './pages/teacher/TeacherHomeworkPage';
import { TeacherTimetablePage } from './pages/teacher/TeacherTimetablePage';
import { TeacherComingSoonPage } from './pages/teacher/TeacherComingSoonPage';

// This is a school back-office / accounting tool, not a realtime feed:
// refetch-on-focus would just add flicker when switching tabs, and
// every write path (see src/hooks/*) invalidates exactly what it
// affects, so background refetch isn't load-bearing for correctness.
// retry:0 on mutations matches the *current* behavior exactly (there
// was no retry logic before this migration, and voidPayment has no
// idempotency key, so a silent retry could double-void). retry:1 on
// queries is a small resilience add for flaky networks with no
// user-visible behavior change (a failed query already rendered an
// error state either way).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/parent/login" element={<ParentLoginPage />} />
              <Route path="/parent/forgot-password" element={<ParentForgotPasswordPage />} />
              <Route path="/teacher/login" element={<TeacherLoginPage />} />
              <Route path="/print/receipt" element={<PrintReceiptPage />} />

              <Route element={<AppLayout />}>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/students/archived" element={<ArchivedStudentsPage />} />
                <Route path="/students/:id" element={<StudentDetailPage />} />
                <Route
                  path="/installments"
                  element={
                    <RequireRole roles={['school_admin', 'accountant']}>
                      <InstallmentsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <RequireRole roles={['school_admin', 'accountant']}>
                      <ReportsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequireRole roles={['school_admin']}>
                      <SettingsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/schools"
                  element={
                    <RequireRole roles={['super_admin']}>
                      <SchoolsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RequireRole roles={['super_admin']}>
                      <UsersPage />
                    </RequireRole>
                  }
                />
                {/* Sprint 2A: Teacher Assignments — school_admin-only admin
                    page for managing teacher_assignments rows. Distinct
                    from the /teacher/* self-service portal group below. */}
                <Route
                  path="/teacher-assignments"
                  element={
                    <RequireRole roles={['school_admin']}>
                      <TeacherAssignmentsPage />
                    </RequireRole>
                  }
                />
              </Route>

              <Route element={<AppLayout loginPath="/parent/login" />}>
                <Route
                  path="/parent"
                  element={
                    <RequireRole roles={['parent']}>
                      <ParentStudentProvider>
                        <Outlet />
                      </ParentStudentProvider>
                    </RequireRole>
                  }
                >
                  <Route path="dashboard" element={<ParentDashboardPage />} />
                  <Route path="tuition" element={<ParentTuitionPage />} />
                  <Route path="installments" element={<ParentInstallmentsPage />} />
                  <Route path="payments" element={<ParentPaymentsPage />} />
                </Route>
              </Route>

              {/* Teacher portal. Same AppLayout-with-loginPath shape as
                  the parent route group above — RequireRole gates every
                  route on 'teacher', and AppLayout redirects an
                  unauthenticated visit to /teacher/login instead of the
                  staff /login. Only /teacher/announcements still points
                  at the shared placeholder (TeacherComingSoonPage);
                  every other route below is a real page. */}
              <Route element={<AppLayout loginPath="/teacher/login" />}>
                <Route
                  path="/teacher"
                  element={
                    <RequireRole roles={['teacher']}>
                      <Outlet />
                    </RequireRole>
                  }
                >
                  <Route path="dashboard" element={<TeacherDashboardPage />} />
                  <Route path="students" element={<TeacherStudentsPage />} />
                  <Route path="attendance" element={<TeacherAttendancePage />} />
                  <Route path="assessments" element={<TeacherAssessmentsPage />} />
                  <Route path="homework" element={<TeacherHomeworkPage />} />
                  <Route path="timetable" element={<TeacherTimetablePage />} />
                  <Route path="announcements" element={<TeacherComingSoonPage title="اطلاعیه‌ها" />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
    </QueryClientProvider>
  );
}
