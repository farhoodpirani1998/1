import { api } from '../lib/api';
import type { TeacherProfileView, TeacherClassView, TeacherSubjectView } from '../types/teacher.types';
import type { Student } from '../types/student.types';

// Sprint 1 scope only — the three read endpoints the Teacher Dashboard
// needs. Attendance/assessments/homework/timetable/announcements calls
// are added by the sprints that build those pages (see TeacherController
// on the backend for the full route list already implemented there).

// GET /teacher/profile — @Roles('teacher'). The signed-in teacher's own
// account plus a compact summary of their grade+subject assignments.
export function getProfile() {
  return api.get<TeacherProfileView>('/teacher/profile');
}

// GET /teacher/classes — @Roles('teacher'). Every grade the teacher is
// currently assigned to, deduped by grade (never a school-wide list).
export function getClasses() {
  return api.get<TeacherClassView[]>('/teacher/classes');
}

// GET /teacher/subjects — @Roles('teacher'). Every subject the teacher is
// currently assigned to, deduped by subject (never a school-wide list).
export function getSubjects() {
  return api.get<TeacherSubjectView[]>('/teacher/subjects');
}

// GET /teacher/students — @Roles('teacher'). Every student in one of the
// teacher's assigned grades, optionally narrowed to a single gradeId
// (must be one of the teacher's own assignments — the backend rejects
// any other gradeId with 403, never silently returns an empty list).
// Returns raw Student entities with the `grade` relation loaded, same
// shape GET /students already returns admin-side — reuses the existing
// Student type (types/student.types.ts) rather than duplicating it.
//
// Named getTeacherStudents rather than getStudents/getMyStudents:
// students.api.ts already exports getStudents() (admin-side GET
// /students) and parent.api.ts already exports getMyStudents() (GET
// /parent/students) — all three are re-exported from the same
// api/index.ts barrel, so this avoids both name collisions.
export function getTeacherStudents(gradeId?: string) {
  return api.get<Student[]>('/teacher/students', {
    params: gradeId ? { gradeId } : undefined,
  });
}

// ---------------------------------------------------------------------
// Sprint 2A: Teacher Assignments (school_admin-only). This is the admin
// side of teacher_assignments — creating/listing/removing which
// teacher teaches which grade+subject — as opposed to the teacher's own
// self-service reads above. Backend: TeacherController's
// POST/GET/DELETE /teacher/assignments routes (@Roles('school_admin')).
//
// Sprint 2B: teacherName/gradeTitle/subjectTitle added below — the
// backend now resolves and returns these (teacher-view.dto.ts), so the
// admin UI no longer has to fall back to raw ids. Also added
// getTeacherList() (GET /teacher/list), the school_admin-facing roster
// that TeacherAssignmentsPage now uses for the teacher picker — see
// TeacherAssignmentsPage.tsx.

export interface TeacherAssignmentView {
  id: string;
  teacherId: string;
  teacherName?: string;
  gradeId: string;
  gradeTitle?: string;
  subjectId: string;
  subjectTitle?: string;
  createdAt: string;
}

export interface CreateTeacherAssignmentInput {
  teacherId: string;
  gradeId: string;
  subjectId: string;
}

// POST /teacher/assignments — @Roles('school_admin'). Idempotent on the
// backend: assigning the same (teacher, grade, subject) triple twice
// returns the existing row rather than erroring.
export function createAssignment(dto: CreateTeacherAssignmentInput) {
  return api.post<TeacherAssignmentView>('/teacher/assignments', dto);
}

// GET /teacher/assignments — @Roles('school_admin'). Optional teacherId
// narrows to one teacher's assignments; omitted lists every assignment
// in the caller's school.
export function getAssignments(teacherId?: string) {
  return api.get<TeacherAssignmentView[]>('/teacher/assignments', {
    params: teacherId ? { teacherId } : undefined,
  });
}

// DELETE /teacher/assignments/:id — @Roles('school_admin'). 204 No Content.
export function deleteAssignment(id: string) {
  return api.delete<void>(`/teacher/assignments/${id}`);
}

// GET /teacher/list — @Roles('school_admin'). The roster of teacher-role
// users in the caller's own school (never a passwordHash), used to
// populate the teacher picker on TeacherAssignmentsPage.
export interface TeacherListItem {
  id: string;
  fullName: string;
  phone: string;
  isActive: boolean;
}

export function getTeacherList() {
  return api.get<TeacherListItem[]>('/teacher/list');
}

// ---------------------------------------------------------------------
// Teacher Attendance (Part 1). POST /teacher/attendance — @Roles('teacher').
// One call per student (backend has no bulk endpoint — see
// CreateAttendanceDto/TeacherController.recordAttendance). Upserts on
// (studentId, date): resubmitting the same student+date corrects the
// existing row instead of duplicating or erroring (see
// AttendanceService.record on the backend), so retrying a failed submit
// is always safe.
// ---------------------------------------------------------------------

export type AttendanceStatusValue = 'present' | 'absent' | 'late' | 'excused';

export interface RecordAttendanceInput {
  studentId: string;
  date: string;
  status: AttendanceStatusValue;
  note?: string;
}

// Mirrors backend AttendanceView (attendance-view.dto.ts) as returned by
// this route's toAttendanceView().
export interface AttendanceView {
  id: string;
  studentId: string;
  studentName?: string;
  academicYearId: string;
  date: string;
  status: string;
  note: string | null;
  recordedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export function recordAttendance(dto: RecordAttendanceInput) {
  return api.post<AttendanceView>('/teacher/attendance', dto);
}

// ---------------------------------------------------------------------
// Teacher Assessments. POST /teacher/assessments — @Roles('teacher').
// Same "one call per student, no bulk endpoint" shape as attendance
// above (see CreateAssessmentDto/TeacherController.recordAssessment).
// Upserts on (studentId, subjectId, academicYearId, term): resubmitting
// the same student+subject+term corrects the existing row instead of
// duplicating or erroring (see AssessmentsService.record on the
// backend), so retrying a failed submit is always safe.
//
// maxScore is part of CreateAssessmentDto (optional, defaults to 20 on
// the backend) but is not exposed as a field on this page's spec — left
// out of RecordAssessmentInput entirely rather than always sending the
// default, same "don't send what the backend already defaults" restraint
// as note being optional below.
// ---------------------------------------------------------------------

export type AssessmentTermValue = 'first_term' | 'second_term';

export interface RecordAssessmentInput {
  studentId: string;
  subjectId: string;
  term: AssessmentTermValue;
  score: number;
  note?: string;
}

// Mirrors backend AssessmentView (assessment-view.dto.ts) as returned by
// this route's toAssessmentView().
export interface AssessmentView {
  id: string;
  studentId: string;
  subjectId: string;
  subjectTitle?: string;
  academicYearId: string;
  term: string;
  score: number;
  maxScore: number;
  note: string | null;
  recordedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export function recordAssessment(dto: RecordAssessmentInput) {
  return api.post<AssessmentView>('/teacher/assessments', dto);
}

// ---------------------------------------------------------------------
// Teacher Homework. POST/GET/PUT/DELETE /teacher/homework — @Roles('teacher').
// Unlike attendance/assessments above, this is a real CRUD resource (not
// a fire-and-forget upsert): every write is scoped to homework the
// calling teacher created themselves, and create/update additionally
// require the teacher to hold a TeacherAssignment for the exact
// (gradeId, subjectId) pair (see HomeworkService.assertAssigned on the
// backend) — same assignment gate recordAssessment already enforces.
//
// Mirrors backend HomeworkView (homework-view.dto.ts) as returned by
// this route's toHomeworkView().
// ---------------------------------------------------------------------

export interface HomeworkView {
  id: string;
  academicYearId: string;
  gradeId: string;
  gradeTitle?: string;
  subjectId: string;
  subjectTitle?: string;
  teacherId: string;
  teacherName?: string;
  title: string;
  description: string;
  dueDate: string;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Optional narrowing filters on GET /teacher/homework — omitted entirely
// returns every homework row the calling teacher has posted. Mirrors
// QueryHomeworkDto minus teacherId (the backend always scopes to the
// caller, never accepts it from the query string on this route).
export interface QueryHomeworkParams {
  gradeId?: string;
  subjectId?: string;
  academicYearId?: string;
}

export function getHomework(params?: QueryHomeworkParams) {
  return api.get<HomeworkView[]>('/teacher/homework', { params });
}

// teacherId is deliberately NOT a field here — same "derived from the
// token, never taken from the body" reasoning as CreateHomeworkDto on
// the backend.
export interface CreateHomeworkInput {
  academicYearId: string;
  gradeId: string;
  subjectId: string;
  title: string;
  description: string;
  dueDate: string;
  attachmentUrl?: string;
}

export function createHomework(dto: CreateHomeworkInput) {
  return api.post<HomeworkView>('/teacher/homework', dto);
}

// Every field optional, matching UpdateHomeworkDto's hand-written partial
// shape. attachmentUrl: pass null to clear a previously-set attachment,
// omit to leave it unchanged.
export interface UpdateHomeworkInput {
  academicYearId?: string;
  gradeId?: string;
  subjectId?: string;
  title?: string;
  description?: string;
  dueDate?: string;
  attachmentUrl?: string | null;
}

export function updateHomework(id: string, dto: UpdateHomeworkInput) {
  return api.put<HomeworkView>(`/teacher/homework/${id}`, dto);
}

// DELETE /teacher/homework/:id — @Roles('teacher'). 204 No Content, same
// shape as deleteAssignment above.
export function deleteHomework(id: string) {
  return api.delete<void>(`/teacher/homework/${id}`);
}

// ---------------------------------------------------------------------
// Teacher Timetable (Phase 5K). GET /teacher/timetable — @Roles('teacher').
// Read-only: every scheduled period for the caller, within their own
// school (TeacherController.getMyTimetable takes no query params, unlike
// the school_admin-facing GET /timetable — always the caller's full
// schedule).
//
// Mirrors backend TimetableEntryView (timetable-entry-view.dto.ts) as
// returned by this route's toTimetableEntryView(). weekday follows the
// backend's Weekday enum (0 = Saturday ... 6 = Friday); startTime/endTime
// are always 'HH:MM'.
// ---------------------------------------------------------------------

export interface TimetableEntryView {
  id: string;
  academicYearId: string;
  gradeId: string;
  gradeTitle?: string;
  subjectId: string;
  subjectTitle?: string;
  teacherId: string;
  teacherName?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getTimetable() {
  return api.get<TimetableEntryView[]>('/teacher/timetable');
}

