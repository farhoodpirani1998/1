import { api } from '../lib/api';
import type {
  StudentSelfProfileView,
  StudentHomeworkView,
  StudentDashboardView,
} from '../types/studentPortal.types';
import type {
  ParentAttendanceView,
  ParentAssessmentView,
  ReportCardView,
  ParentAnnouncementView,
  ParentStudentDocumentView,
  ParentTimetableEntryView,
} from '../types/parent.types';

// Student Portal foundation (ADR-001). Every route below is
// @Roles('student') on the backend (StudentController) and resolves
// entirely from the caller's own token — none of them take or accept a
// studentId param, unlike the admin/teacher equivalents of these same
// reads. Named student.api.ts (singular) rather than students.api.ts —
// that file is the admin-side CRUD API for the Student entity; this one
// is the self-service portal, same "singular = self-service portal,
// plural = admin management" naming split as teacher.api.ts already
// established alongside it.

// GET /student/profile — the signed-in student's own basic profile.
export function getProfile() {
  return api.get<StudentSelfProfileView>('/student/profile');
}

// GET /student/attendance — the signed-in student's own attendance
// history. Same ParentAttendanceView shape GET /parent/students/:id/attendance
// already returns.
export function getAttendance() {
  return api.get<ParentAttendanceView[]>('/student/attendance');
}

// GET /student/assessments — the signed-in student's own recorded
// assessment scores. Same ParentAssessmentView shape as the parent
// portal's equivalent read.
export function getAssessments() {
  return api.get<ParentAssessmentView[]>('/student/assessments');
}

// GET /student/report-card — the signed-in student's own report card.
// Same ReportCardView shape as the parent/staff report-card routes —
// this is a caller-agnostic view, not reshaped per role.
export function getReportCard() {
  return api.get<ReportCardView>('/student/report-card');
}

// GET /student/homework — every homework assigned to the student's own
// grade, each row annotated with the student's own submission status.
export function getHomework() {
  return api.get<StudentHomeworkView[]>('/student/homework');
}

// POST /student/homework/:homeworkId/submit — Sprint H2. Records (or
// corrects, on a second call) the signed-in student's own submission for
// one homework. Body is intentionally empty (SubmitHomeworkDto has no
// fields — see StudentController's own comment: there's nothing to submit
// yet but the fact of submission itself, no note/no file this sprint), so
// this only ever needs the homeworkId, taken from the URL, never from a
// client-supplied studentId. Returns the same StudentHomeworkView shape
// getHomework() returns per row, so a caller can drop the response
// straight into its existing list without a new type.
export function submitHomework(homeworkId: string) {
  return api.post<StudentHomeworkView>(`/student/homework/${homeworkId}/submit`, {});
}

// GET /student/announcements — announcements targeted at 'all' or
// 'students', within the student's own school.
export function getAnnouncements() {
  return api.get<ParentAnnouncementView[]>('/student/announcements');
}

// GET /student/documents — documents uploaded against the student's own
// record.
export function getDocuments() {
  return api.get<ParentStudentDocumentView[]>('/student/documents');
}

// GET /student/timetable — the weekly schedule for the student's own
// grade.
export function getTimetable() {
  return api.get<ParentTimetableEntryView[]>('/student/timetable');
}

// GET /student/dashboard — single aggregate read combining every view
// above. Prefer this one call for the Dashboard page instead of firing
// the individual reads in parallel.
export function getDashboard() {
  return api.get<StudentDashboardView>('/student/dashboard');
}
