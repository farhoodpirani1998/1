import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { ThemeProvider } from './lib/theme';
import { AppLayout } from './components/AppLayout';
import { RouteErrorBoundary } from './components/AppErrorBoundary';
import { RequireRole } from './components/RequireRole';
import { LoginPage } from './pages/LoginPage';
import { AdminForgotPasswordPage } from './pages/AdminForgotPasswordPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { ArchivedStudentsPage } from './pages/ArchivedStudentsPage';
import { InstallmentsPage } from './pages/InstallmentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SchoolsPage } from './pages/SchoolsPage';
import { SchoolDetailPage } from './pages/SchoolDetailPage';
import { UsersPage } from './pages/UsersPage';
import { TeacherAssignmentsPage } from './pages/TeacherAssignmentsPage';
import { GuardiansPage } from './pages/GuardiansPage';
import { GuardianDetailPage } from './pages/GuardianDetailPage';
import { TeacherDetailPage } from './pages/TeacherDetailPage';
import { SubjectDetailPage } from './pages/SubjectDetailPage';
import { HomeworkDetailPage } from './pages/HomeworkDetailPage';
import { AnnouncementDetailPage } from './pages/AnnouncementDetailPage';
import { TimetablePage } from './pages/TimetablePage';
import { AttendancePage } from './pages/AttendancePage';
import { PrintReceiptPage } from './pages/PrintReceiptPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomeRedirect } from './components/HomeRedirect';
import { ParentLoginPage } from './pages/parent/ParentLoginPage';
import { ParentForgotPasswordPage } from './pages/parent/ParentForgotPasswordPage';
import { ParentDashboardPage } from './pages/parent/ParentDashboardPage';
import { ParentTuitionPage } from './pages/parent/ParentTuitionPage';
import { ParentInstallmentsPage } from './pages/parent/ParentInstallmentsPage';
import { ParentPaymentsPage } from './pages/parent/ParentPaymentsPage';
import { ParentReportCardPage } from './pages/parent/ParentReportCardPage';
import { ParentAttendancePage } from './pages/parent/ParentAttendancePage';
import { ParentAnnouncementsPage } from './pages/parent/ParentAnnouncementsPage';
import { ParentDocumentsPage } from './pages/parent/ParentDocumentsPage';
import { ParentTimetablePage } from './pages/parent/ParentTimetablePage';
import { ParentHomeworkPage } from './pages/parent/ParentHomeworkPage';
import { ParentStudentProvider } from './lib/parentStudent';
import { TeacherLoginPage } from './pages/teacher/TeacherLoginPage';
import { TeacherForgotPasswordPage } from './pages/teacher/TeacherForgotPasswordPage';
import { TeacherDashboardPage } from './pages/teacher/TeacherDashboardPage';
import { TeacherStudentsPage } from './pages/teacher/TeacherStudentsPage';
import { TeacherAttendancePage } from './pages/teacher/TeacherAttendancePage';
import { TeacherAssessmentsPage } from './pages/teacher/TeacherAssessmentsPage';
import { TeacherHomeworkPage } from './pages/teacher/TeacherHomeworkPage';
import { TeacherTimetablePage } from './pages/teacher/TeacherTimetablePage';
import { TeacherAnnouncementsPage } from './pages/teacher/TeacherAnnouncementsPage';
import { FounderOverviewPage } from './pages/founder/FounderOverviewPage';
import { FounderSchoolLayout } from './pages/founder/FounderSchoolLayout';
import { FounderSchoolDashboardPage } from './pages/founder/FounderSchoolDashboardPage';
import { FounderStudentsPage } from './pages/founder/FounderStudentsPage';
import { FounderTeachersPage } from './pages/founder/FounderTeachersPage';
import { FounderAllTeachersPage } from './pages/founder/FounderAllTeachersPage';
import { FounderStaffPage } from './pages/founder/FounderStaffPage';
import { FounderTuitionPage } from './pages/founder/FounderTuitionPage';

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
            <RouteErrorBoundary>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<AdminForgotPasswordPage />} />
              <Route path="/parent/login" element={<ParentLoginPage />} />
              <Route path="/parent/forgot-password" element={<ParentForgotPasswordPage />} />
              <Route path="/teacher/login" element={<TeacherLoginPage />} />
              <Route path="/teacher/forgot-password" element={<TeacherForgotPasswordPage />} />
              <Route path="/print/receipt/:paymentId" element={<PrintReceiptPage />} />

              <Route element={<AppLayout />}>
                {/* "/" itself isn't wrapped in RequireRole: HomeRedirect already
                    redirects super_admin -> /schools and founder -> /founder/overview
                    before rendering DashboardPage, so those roles never see an
                    empty/confusing dashboard here. Wrapping it in
                    RequireRole roles={['school_admin','accountant','staff']} would
                    break that redirect (super_admin/founder would hit "access
                    restricted" instead of being sent to their real home). */}
                <Route path="/" element={<HomeRedirect />} />
                <Route
                  path="/students"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <StudentsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/students/archived"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <ArchivedStudentsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/students/:id"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <StudentDetailPage />
                    </RequireRole>
                  }
                />
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
                  path="/schools/:id"
                  element={
                    <RequireRole roles={['super_admin']}>
                      <SchoolDetailPage />
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

                {/* Sprint 2 (Educational Operations): admin-side weekly
                    class schedule, whole-school attendance-by-date, and
                    guardian file management. */}
                <Route
                  path="/timetable"
                  element={
                    <RequireRole roles={['school_admin']}>
                      <TimetablePage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/attendance"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <AttendancePage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/guardians"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <GuardiansPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/guardians/:id"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <GuardianDetailPage />
                    </RequireRole>
                  }
                />

                {/* Phase 5N follow-up: Global Search detail routes for the
                    four groups that previously had no staff-facing detail
                    page (see GlobalSearch.tsx). Roles match GET /search's
                    own role gate (school_admin, accountant, staff) — same
                    principle as /guardians/:id above: whoever can see a
                    result in search can open it. */}
                <Route
                  path="/teachers/:id"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <TeacherDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/subjects/:id"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <SubjectDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/homework/:id"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <HomeworkDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/announcements/:id"
                  element={
                    <RequireRole roles={['school_admin', 'accountant', 'staff']}>
                      <AnnouncementDetailPage />
                    </RequireRole>
                  }
                />

                {/* Founder Dashboard — read-only, multi-school portal (see
                    founder-frontend-prompt.md). Shares the staff /login
                    (HomeRedirect sends role:'founder' to /founder/overview
                    after sign-in) rather than a dedicated login route, since
                    the backend's login flow doesn't distinguish it — same
                    reasoning as super_admin above. The school-scoped pages
                    all nest under FounderSchoolLayout, which resolves
                    :schoolId against GET /founder/schools and renders the
                    shared breadcrumb/switcher/tab chrome. */}
                <Route
                  path="/founder/overview"
                  element={
                    <RequireRole roles={['founder']}>
                      <FounderOverviewPage />
                    </RequireRole>
                  }
                />
                {/* Cross-school teacher directory — distinct from the
                    per-school /founder/schools/:schoolId/teachers tab
                    below, which stays nested under FounderSchoolLayout. */}
                <Route
                  path="/founder/teachers"
                  element={
                    <RequireRole roles={['founder']}>
                      <FounderAllTeachersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/founder/schools/:schoolId"
                  element={
                    <RequireRole roles={['founder']}>
                      <FounderSchoolLayout />
                    </RequireRole>
                  }
                >
                  <Route index element={<FounderSchoolDashboardPage />} />
                  <Route path="students" element={<FounderStudentsPage />} />
                  <Route path="teachers" element={<FounderTeachersPage />} />
                  <Route path="staff" element={<FounderStaffPage />} />
                  <Route path="tuition" element={<FounderTuitionPage />} />
                </Route>
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
                  <Route path="report-card" element={<ParentReportCardPage />} />
                  <Route path="attendance" element={<ParentAttendancePage />} />
                  <Route path="announcements" element={<ParentAnnouncementsPage />} />
                  <Route path="documents" element={<ParentDocumentsPage />} />
                  <Route path="timetable" element={<ParentTimetablePage />} />
                  <Route path="homework" element={<ParentHomeworkPage />} />
                </Route>
              </Route>

              {/* Teacher portal. Same AppLayout-with-loginPath shape as
                  the parent route group above — RequireRole gates every
                  route on 'teacher', and AppLayout redirects an
                  unauthenticated visit to /teacher/login instead of the
                  staff /login. Every route below is a real page. */}
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
                  <Route path="announcements" element={<TeacherAnnouncementsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </RouteErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
    </QueryClientProvider>
  );
}
