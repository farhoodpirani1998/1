// Student Portal domain types (ADR-001 foundation).
// Mirrors the backend StudentController's own view DTOs 1:1 (see
// backend/src/modules/student/dto/*.ts). Named studentPortal.types.ts
// rather than student.types.ts — that name is already taken by the
// admin-facing Student entity types (see student.types.ts) — same
// "avoid a same-named-different-shape collision" reasoning that led
// api/student.api.ts (this portal) to sit alongside api/students.api.ts
// (admin CRUD) as two distinct files.
//
// Every field the student's own routes return that ISN'T new here
// (attendance, assessments, report card, announcements, documents,
// timetable) already has a matching type in parent.types.ts, because the
// backend deliberately reuses the exact same Parent*View shapes for the
// student's own reads (see StudentController's imports) — reusing those
// types here instead of redeclaring them is the same "don't duplicate"
// rule as the component reuse elsewhere in this portal.

import type { StudentStatus } from './student.types';
import type {
  ParentAttendanceView,
  ParentAssessmentView,
  ReportCardView,
  ParentAnnouncementView,
  ParentStudentDocumentView,
  ParentTimetableEntryView,
} from './parent.types';

// Mirrors backend StudentSelfProfileView (student/dto/student-self-profile-view.dto.ts),
// returned by GET /student/profile. Deliberately not the rich admin-facing
// StudentProfileView (types/studentProfile.types.ts) — just the Student
// record's own fields.
export interface StudentSelfProfileView {
  id: string;
  fullName: string;
  nationalId: string | null;
  status: StudentStatus;
  gradeId: string;
  academicYearId: string;
  classId: string | null;
  schoolId: string;
  enrollmentDate: string | null;
}

// Mirrors backend StudentHomeworkView (student/dto/student-homework-view.dto.ts),
// returned by GET /student/homework. Same shape as ParentHomeworkView
// (parent.types.ts) plus the two fields a parent's view doesn't carry:
// the authenticated student's own submission status for that homework.
export interface StudentHomeworkView {
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
  // Null means no submission row exists yet (not-yet-submitted is a
  // normal state, not an error) — never defaulted to a status string.
  submissionStatus: string | null;
  submittedAt: string | null;
}

// Mirrors backend StudentDashboardView (student/dto/student-dashboard-view.dto.ts),
// returned by GET /student/dashboard — a single aggregate read-model
// combining the same views every other /student/* route already returns.
// Use this one call for the Dashboard page rather than firing the
// individual queries below in parallel.
export interface StudentDashboardView {
  profile: StudentSelfProfileView;
  timetable: ParentTimetableEntryView[];
  recentAnnouncements: ParentAnnouncementView[];
  homework: StudentHomeworkView[];
  recentAttendance: ParentAttendanceView[];
  recentAssessments: ParentAssessmentView[];
  reportCard: ReportCardView;
  recentDocuments: ParentStudentDocumentView[];
}
