import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  getClasses,
  getSubjects,
  getTeacherStudents,
  getAssignments,
  createAssignment,
  deleteAssignment,
  getTeacherList,
  recordAttendance,
  recordAssessment,
  getHomework,
  createHomework,
  updateHomework,
  deleteHomework,
  getTimetable,
  type CreateTeacherAssignmentInput,
  type RecordAttendanceInput,
  type RecordAssessmentInput,
  type QueryHomeworkParams,
  type CreateHomeworkInput,
  type UpdateHomeworkInput,
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
