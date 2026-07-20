import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  getClasses,
  getSubjects,
  getTeacherStudents,
  getTeacherStudentProfile,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getTeacherList,
  getTeacherById,
  recordAttendance,
  getMyAttendanceStatus,
  recordAssessment,
  getHomework,
  createHomework,
  updateHomework,
  deleteHomework,
  getMyHomeworkSubmissionSummary,
  getTimetable,
  getMyAnnouncements,
  markAnnouncementRead,
  type CreateTeacherAssignmentInput,
  type RecordAttendanceInput,
  type QueryAttendanceStatusParams,
  type RecordAssessmentInput,
  type QueryHomeworkParams,
  type CreateHomeworkInput,
  type UpdateHomeworkInput,
  type TeacherAnnouncementView,
} from '../api/teacher.api';
import { queryKeys } from '../lib/queryKeys';

// GET /teacher/profile. Every teacher-portal page needs this to know
// who's signed in and what they're assigned to teach.
export function useTeacherProfile() {
  return useQuery({
    queryKey: queryKeys.teacher.profile(),
    queryFn: () => getProfile().then((res) => res.data),
  });
}

// GET /teacher/classes — the grades the signed-in teacher is assigned to.
export function useTeacherClasses() {
  return useQuery({
    queryKey: queryKeys.teacher.classes(),
    queryFn: () => getClasses().then((res) => res.data),
  });
}

// GET /teacher/subjects — the subjects the signed-in teacher is assigned to.
export function useTeacherSubjects() {
  return useQuery({
    queryKey: queryKeys.teacher.subjects(),
    queryFn: () => getSubjects().then((res) => res.data),
  });
}

// GET /teacher/students — every student in one of the signed-in
// teacher's assigned grades, optionally narrowed to one gradeId (must be
// one of the teacher's own assignments; the backend 403s otherwise).
export function useTeacherStudents(gradeId?: string) {
  return useQuery({
    queryKey: queryKeys.teacher.students(gradeId),
    queryFn: () => getTeacherStudents(gradeId).then((res) => res.data),
  });
}

// ---------------------------------------------------------------------
// Sprint 2A: Teacher Assignments (school_admin-only). Backs
// TeacherAssignmentsPage — not part of the teacher self-service hooks
// above.
// ---------------------------------------------------------------------

// GET /teacher/assignments — @Roles('school_admin'). Optional teacherId
// narrows to one teacher's assignments; omitted lists every assignment
// in the caller's school.
export function useTeacherAssignments(teacherId?: string) {
  return useQuery({
    queryKey: queryKeys.teacher.assignments(teacherId),
    queryFn: () => getAssignments(teacherId).then((res) => res.data),
  });
}

// POST /teacher/assignments — @Roles('school_admin').
export function useCreateTeacherAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTeacherAssignmentInput) => createAssignment(dto).then((res) => res.data),
    onSuccess: () => {
      // A new assignment can affect any teacherId-filtered list as well
      // as the unfiltered one — invalidate every assignments query (any
      // teacherId) via prefix match, without touching the unrelated
      // profile/classes/subjects caches under queryKeys.teacher.all().
      queryClient.invalidateQueries({ queryKey: [...queryKeys.teacher.all(), 'assignments'] });
    },
  });
}

// DELETE /teacher/assignments/:id — @Roles('school_admin').
export function useDeleteTeacherAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.teacher.all(), 'assignments'] });
    },
  });
}

// GET /teacher/list — @Roles('school_admin'). The school's teacher
// roster for the assignment picker. Rarely changes within a session —
// treated as long-lived reference data, same staleTime reasoning as
// useGrades().
export function useTeacherList() {
  return useQuery({
    queryKey: queryKeys.teacher.list(),
    queryFn: () => getTeacherList().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

// GET /teacher/:id — the teacher detail page linked from Global Search
// results. Distinct from useTeacherProfile() above, which is always the
// signed-in teacher's own account.
export function useTeacherDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teacher.detail(id ?? ''),
    queryFn: () => getTeacherById(id as string).then((res) => res.data),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------
// Teacher Attendance (Part 1). POST /teacher/attendance — @Roles('teacher').
// No attendance list/detail query exists yet (attendance history is out
// of scope for Part 1), so there is no cache to invalidate here — the
// mutation is intentionally the only piece added. TeacherAttendancePage
// calls mutateAsync once per modified student (no bulk backend endpoint).
// ---------------------------------------------------------------------
export function useRecordAttendance() {
  return useMutation({
    mutationFn: (dto: RecordAttendanceInput) => recordAttendance(dto).then((res) => res.data),
  });
}

// ---------------------------------------------------------------------
// Sprint F.1: real "which of my classes still need attendance taken"
// status, replacing the Dashboard's former today's-class-count proxy.
// GET /teacher/attendance/status — read-only, no mutations (same
// "query only, nothing to invalidate" shape as useTeacherTimetable).
// ---------------------------------------------------------------------
export function useTeacherAttendanceStatus(params?: QueryAttendanceStatusParams) {
  return useQuery({
    queryKey: queryKeys.teacher.attendanceStatus(params),
    queryFn: () => getMyAttendanceStatus(params).then((res) => res.data),
  });
}

// ---------------------------------------------------------------------
// Teacher Assessments. POST /teacher/assessments — @Roles('teacher').
// Same "no read query yet, so nothing to invalidate" shape as
// useRecordAttendance above — assessment history is out of scope for
// this feature.
// ---------------------------------------------------------------------
export function useRecordAssessment() {
  return useMutation({
    mutationFn: (dto: RecordAssessmentInput) => recordAssessment(dto).then((res) => res.data),
  });
}

// ---------------------------------------------------------------------
// Teacher Homework. GET/POST/PUT/DELETE /teacher/homework — @Roles('teacher').
// Unlike attendance/assessments above, this is a real CRUD resource with
// its own list query — every mutation invalidates queryKeys.teacher.homework()
// by prefix (any gradeId/subjectId/academicYearId filter combination),
// same "invalidate the whole domain, not just the exact params used"
// shape useCreateTeacherAssignment/useDeleteTeacherAssignment already use.
// ---------------------------------------------------------------------

export function useTeacherHomework(params?: QueryHomeworkParams) {
  return useQuery({
    queryKey: queryKeys.teacher.homework(params),
    queryFn: () => getHomework(params).then((res) => res.data),
  });
}

export function useCreateHomework() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateHomeworkInput) => createHomework(dto).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.teacher.all(), 'homework'] });
    },
  });
}

export function useUpdateHomework() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateHomeworkInput }) =>
      updateHomework(id, dto).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.teacher.all(), 'homework'] });
    },
  });
}

export function useDeleteHomework() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHomework(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.teacher.all(), 'homework'] });
    },
  });
}

// ---------------------------------------------------------------------
// Sprint F.1: roster-aware submission summary for one homework. GET
// /teacher/homework/:id/submissions/summary — read-only, no mutations.
// ---------------------------------------------------------------------
export function useTeacherHomeworkSubmissionSummary(homeworkId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teacher.homeworkSubmissionSummary(homeworkId ?? ''),
    queryFn: () => getMyHomeworkSubmissionSummary(homeworkId as string).then((res) => res.data),
    enabled: !!homeworkId,
  });
}

// Same query as above, batched across several homework ids at once —
// used by the Dashboard's Pending Tasks / Recent Activity widgets, which
// each need the summary for more than one homework and can't call
// useQuery in a loop (against the rules of hooks). Each entry in the
// returned array mirrors what useTeacherHomeworkSubmissionSummary(id)
// would return for that id, in the same order as homeworkIds — callers
// zip it back against their own id list. Shares its cache with the
// single-id hook above (same query key), so calling both for the same
// homeworkId never issues a duplicate request.
export function useTeacherHomeworkSubmissionSummaries(homeworkIds: string[]) {
  return useQueries({
    queries: homeworkIds.map((id) => ({
      queryKey: queryKeys.teacher.homeworkSubmissionSummary(id),
      queryFn: () => getMyHomeworkSubmissionSummary(id).then((res) => res.data),
    })),
  });
}

// ---------------------------------------------------------------------
// Teacher Timetable (Phase 5K). GET /teacher/timetable — @Roles('teacher').
// Read-only, no mutations — same "query only, nothing to invalidate"
// shape as useTeacherStudents.
// ---------------------------------------------------------------------

export function useTeacherTimetable() {
  return useQuery({
    queryKey: queryKeys.teacher.timetable(),
    queryFn: () => getTimetable().then((res) => res.data),
  });
}

// ---------------------------------------------------------------------
// Teacher Announcements (Phase 5H). GET /teacher/announcements —
// read-only, no mutations — same "query only, nothing to invalidate"
// shape as useTeacherTimetable above.
// ---------------------------------------------------------------------

export function useTeacherAnnouncements() {
  return useQuery({
    queryKey: queryKeys.teacher.announcements(),
    queryFn: () => getMyAnnouncements().then((res) => res.data),
  });
}

// Sprint F.1: marks one announcement as read for the signed-in teacher.
// POST /teacher/announcements/:id/read. Updates the
// queryKeys.teacher.announcements() cache optimistically (isRead/readAt
// flipped immediately, restored on error) rather than waiting on a
// round trip — the Dashboard's Announcements widget needs its unread
// indicator to disappear the instant an item is opened.
export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markAnnouncementRead(id).then((res) => res.data),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.teacher.announcements() });
      const previous = queryClient.getQueryData<TeacherAnnouncementView[]>(queryKeys.teacher.announcements());
      queryClient.setQueryData<TeacherAnnouncementView[]>(queryKeys.teacher.announcements(), (old) =>
        old?.map((a) => (a.id === id ? { ...a, isRead: true, readAt: a.readAt ?? new Date().toISOString() } : a)),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.teacher.announcements(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teacher.announcements() });
    },
  });
}

// ---------------------------------------------------------------------
// Student Profile card. GET /teacher/students/:id/profile —
// @Roles('teacher'). Same shared shape as useStudentProfile
// (hooks/useStudent.ts), scoped to one of the teacher's own assigned
// students — powers <StudentProfileModal/> from every teacher-portal
// page that lists students (TeacherStudentsPage, TeacherAssessmentsPage).
// ---------------------------------------------------------------------

export function useTeacherStudentProfile(studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teacher.studentProfile(studentId ?? ''),
    queryFn: () => getTeacherStudentProfile(studentId as string).then((res) => res.data),
    enabled: !!studentId,
  });
}
