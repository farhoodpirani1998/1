// Centralized React Query key registry.
//
// RULE: no hook or component builds a queryKey array by hand — every
// key used in useQuery/useInvalidateQueries/setQueryData comes from
// here. This is what makes invalidation reliable: a mutation can
// invalidate `queryKeys.reports.all()` without knowing every exact
// param combination reports.ts ever queried with.
//
// Convention: every domain exposes
//   all()      -> root key for the whole domain (broadest invalidation)
//   lists()    -> root key for "list" queries within the domain
//   list(params) -> one specific filtered list
//   detail(id) -> one specific entity
// Domains that are single-shot (no list/detail split) just expose the
// keys that make sense for them (e.g. reports).

import type { QueryStudentsParams } from '../api/students.api';
import type { QueryInstallmentsParams } from '../api/tuition.api';
import type { FounderSchoolDashboardParams } from '../api/founder.api';
import type { QueryFounderStudentsParams } from '../types/founder.types';
import type { QueryGuardiansParams } from '../api/guardians.api';
import type { QueryTimetableParams } from '../api/timetable.api';
import type { QueryAttendanceByDateParams } from '../api/attendance.api';
import type { QuerySearchParams } from '../api/search.api';

export const queryKeys = {
  students: {
    all: () => ['students'] as const,
    lists: () => [...queryKeys.students.all(), 'list'] as const,
    list: (params?: QueryStudentsParams) => [...queryKeys.students.lists(), params ?? {}] as const,
    details: () => [...queryKeys.students.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.students.details(), id] as const,
    // POST/GET /students/:id/parent(s) — parent-portal logins linked to
    // one student, managed from StudentDetailPage's "والدین" section.
    parents: (id: string) => [...queryKeys.students.all(), 'parents', id] as const,
    // Sprint 1: POST/GET /students/:id/documents, DELETE /documents/:id
    // — uploaded document references shown in StudentDetailPage's
    // "مدارک" section.
    documents: (id: string) => [...queryKeys.students.all(), 'documents', id] as const,
  },

  guardians: {
    all: () => ['guardians'] as const,
    lists: () => [...queryKeys.guardians.all(), 'list'] as const,
    list: (params?: QueryGuardiansParams) => [...queryKeys.guardians.lists(), params ?? {}] as const,
    detail: (id: string) => [...queryKeys.guardians.all(), 'detail', id] as const,
  },

  // Sprint 2 (Educational Operations): school_admin-side weekly class
  // schedule management. Distinct from queryKeys.teacher.timetable()
  // above (the signed-in teacher's own read-only view).
  adminTimetable: {
    all: () => ['adminTimetable'] as const,
    list: (params?: QueryTimetableParams) => [...queryKeys.adminTimetable.all(), 'list', params ?? {}] as const,
  },

  // Sprint 2 (Educational Operations): school_admin-side whole-school
  // attendance-by-date roster.
  adminAttendance: {
    all: () => ['adminAttendance'] as const,
    byDate: (date: string, params?: QueryAttendanceByDateParams) =>
      [...queryKeys.adminAttendance.all(), 'byDate', date, params ?? {}] as const,
  },

  grades: {
    all: () => ['grades'] as const,
    list: () => [...queryKeys.grades.all(), 'list'] as const,
  },

  // Sprint 2B: academic subjects (GET /subjects), same shape/reasoning
  // as `grades` above — a small, rarely-changing per-school reference
  // list. Distinct from `teacher.subjects` below, which is the signed-in
  // teacher's own assigned-subjects list (GET /teacher/subjects), not
  // this school-wide reference list.
  subjects: {
    all: () => ['subjects'] as const,
    list: () => [...queryKeys.subjects.all(), 'list'] as const,
    // GET /subjects/:id — the subject detail page linked from Global
    // Search results.
    detail: (id: string) => [...queryKeys.subjects.all(), 'detail', id] as const,
  },

  academicYears: {
    all: () => ['academicYears'] as const,
    list: () => [...queryKeys.academicYears.all(), 'list'] as const,
  },

  // Single-shot per-school record (GET/PUT /settings) — one row per
  // school_admin's own school, no list/detail split needed.
  schoolSettings: {
    all: () => ['schoolSettings'] as const,
  },

  schools: {
    all: () => ['schools'] as const,
    list: () => [...queryKeys.schools.all(), 'list'] as const,
  },

  users: {
    all: () => ['users'] as const,
    list: () => [...queryKeys.users.all(), 'list'] as const,
  },

  tuitionPlans: {
    all: () => ['tuitionPlans'] as const,
    detail: (id: string) => [...queryKeys.tuitionPlans.all(), 'detail', id] as const,
  },

  installments: {
    all: () => ['installments'] as const,
    lists: () => [...queryKeys.installments.all(), 'list'] as const,
    list: (params?: QueryInstallmentsParams) => [...queryKeys.installments.lists(), params ?? {}] as const,
  },

  payments: {
    all: () => ['payments'] as const,
    list: (studentId?: string) => [...queryKeys.payments.all(), 'list', studentId ?? null] as const,
    receipt: (paymentId: string) => [...queryKeys.payments.all(), 'receipt', paymentId] as const,
  },

  reports: {
    all: () => ['reports'] as const,
    overdueSummary: () => [...queryKeys.reports.all(), 'overdueSummary'] as const,
    monthlyIncome: (year: number, month: number) => [...queryKeys.reports.all(), 'monthlyIncome', year, month] as const,
    debtorStudents: () => [...queryKeys.reports.all(), 'debtorStudents'] as const,
    studentStatement: (studentId: string) => [...queryKeys.reports.all(), 'studentStatement', studentId] as const,
  },

  analytics: {
    all: () => ['analytics'] as const,
    dashboard: () => [...queryKeys.analytics.all(), 'dashboard'] as const,
  },

  parent: {
    all: () => ['parent'] as const,
    students: () => [...queryKeys.parent.all(), 'students'] as const,
    tuition: (studentId: string) => [...queryKeys.parent.all(), 'tuition', studentId] as const,
    installments: (studentId: string) => [...queryKeys.parent.all(), 'installments', studentId] as const,
    payments: (studentId: string) => [...queryKeys.parent.all(), 'payments', studentId] as const,
    announcements: () => [...queryKeys.parent.all(), 'announcements'] as const,
  },

  // Sprint 1 (Teacher Portal Foundation) — profile/classes/subjects only.
  // Attendance/assessments/homework/timetable/announcements keys are
  // added by the sprints that build those pages.
  teacher: {
    all: () => ['teacher'] as const,
    profile: () => [...queryKeys.teacher.all(), 'profile'] as const,
    classes: () => [...queryKeys.teacher.all(), 'classes'] as const,
    subjects: () => [...queryKeys.teacher.all(), 'subjects'] as const,
    // Sprint: Teacher Students. Optional gradeId narrows to one of the
    // teacher's assigned grades — same "id or null" shape as
    // teacher.assignments(teacherId) below.
    students: (gradeId?: string) => [...queryKeys.teacher.all(), 'students', gradeId ?? null] as const,
    // Sprint 2A (Teacher Assignments, school_admin-only).
    assignments: (teacherId?: string) => [...queryKeys.teacher.all(), 'assignments', teacherId ?? null] as const,
    // Sprint 2B: the school_admin-facing teacher roster (GET /teacher/list),
    // used by the assignment picker — distinct from `subjects`/`grades`
    // above only in that it lives under the `teacher` namespace since it
    // is itself a /teacher/* route.
    list: () => [...queryKeys.teacher.all(), 'list'] as const,
    // Teacher Homework. Optional filter object narrows the key the same
    // "params or {}" shape as students.list(params) above — omitted
    // filters and an explicit {} both resolve to the same cache entry.
    homework: (params?: { gradeId?: string; subjectId?: string; academicYearId?: string }) =>
      [...queryKeys.teacher.all(), 'homework', params ?? {}] as const,
    // Teacher Timetable. No filters — GET /teacher/timetable always
    // returns the caller's full schedule (see TeacherController).
    timetable: () => [...queryKeys.teacher.all(), 'timetable'] as const,
    // school_admin-facing single-teacher read (GET /teacher/:id), for the
    // teacher detail page linked from Global Search results — distinct
    // from `profile()` above, which is always the signed-in teacher's own
    // account.
    detail: (id: string) => [...queryKeys.teacher.all(), 'detail', id] as const,
  },

  // Admin/staff-facing homework reads (GET /homework, GET /homework/:id —
  // HomeworkController). Distinct from `teacher.homework` above, which is
  // the signed-in teacher's own posted homework (GET /teacher/homework).
  adminHomework: {
    all: () => ['adminHomework'] as const,
    detail: (id: string) => [...queryKeys.adminHomework.all(), 'detail', id] as const,
  },

  // Admin-facing announcement reads (GET /announcements/:id —
  // AnnouncementsController). Distinct from `parent.announcements` above,
  // which is the signed-in parent's recipient-facing feed.
  adminAnnouncements: {
    all: () => ['adminAnnouncements'] as const,
    detail: (id: string) => [...queryKeys.adminAnnouncements.all(), 'detail', id] as const,
  },

  // Founder portal — read-only aggregated + per-school views (see
  // founder-frontend-prompt.md). `schools()` is also the source list the
  // school switcher and FounderSchoolLayout's not-found check use.
  founder: {
    all: () => ['founder'] as const,
    schools: () => [...queryKeys.founder.all(), 'schools'] as const,
    overview: () => [...queryKeys.founder.all(), 'overview'] as const,
    dashboard: (schoolId: string, params?: FounderSchoolDashboardParams) =>
      [...queryKeys.founder.all(), 'dashboard', schoolId, params ?? {}] as const,
    students: (schoolId: string, params?: QueryFounderStudentsParams) =>
      [...queryKeys.founder.all(), 'students', schoolId, params ?? {}] as const,
    teachers: (schoolId: string) => [...queryKeys.founder.all(), 'teachers', schoolId] as const,
    // GET /founder/teachers — cross-school teacher directory (all owned
    // schools at once), distinct from teachers(schoolId) above.
    allTeachers: () => [...queryKeys.founder.all(), 'teachers', 'all'] as const,
    staff: (schoolId: string) => [...queryKeys.founder.all(), 'staff', schoolId] as const,
    tuition: (schoolId: string) => [...queryKeys.founder.all(), 'tuition', schoolId] as const,
  },

  // Phase 5N: Global Search (GET /search) — single-shot, keyed by the
  // exact query text + limit, same "params or {}" shape as every other
  // list(params) above.
  search: {
    all: () => ['search'] as const,
    query: (params: QuerySearchParams) => [...queryKeys.search.all(), params] as const,
  },
} as const;
