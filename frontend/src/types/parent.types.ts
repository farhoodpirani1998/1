// Parent portal domain types.
// Mirrors the backend Parent module view DTOs 1:1 (see
// backend/src/modules/parent/dto/*.ts). Do NOT add fields/concepts here
// that don't exist on those DTOs — same rule as every other types/*.ts
// file in this project.

import type { InstallmentStatus } from './tuition.types';
import type { PaymentMethod } from './payment.types';

// Mirrors backend ParentStudentView (parent-student-view.dto.ts).
export interface ParentStudentView {
  id: string;
  fullName: string;
  status: string;
  enrollmentDate: string | null;
  school: { id: string; name: string };
  grade: { id: string; title: string };
  academicYear: { id: string; title: string; isCurrent: boolean };
}

// Mirrors backend ParentTuitionViewDto (parent-tuition-view.dto.ts).
export interface ParentTuitionView {
  id: string;
  academicYearTitle: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  createdAt: string;
}

// Mirrors backend ParentInstallmentViewDto (parent-installments-view.dto.ts).
export interface ParentInstallmentView {
  id: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  dueDate: string;
}

// Mirrors backend ParentPaymentViewDto (parent-payments-view.dto.ts).
export interface ParentPaymentView {
  id: string;
  installmentId: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paidAt: string;
  receiptNumber: string | null;
}

// Mirrors backend RecipientAnnouncementView (announcements/dto/announcement-view.dto.ts),
// returned by GET /parent/announcements.
export interface ParentAnnouncementView {
  id: string;
  title: string;
  message: string;
  targetType: string;
  createdAt: string;
}

// Mirrors backend AssessmentTerm (student-assessments/entities/assessment.entity.ts).
export type AssessmentTerm = 'first_term' | 'second_term';

// Mirrors backend ParentAssessmentView (student-assessments/dto/assessment-view.dto.ts),
// returned by GET /parent/students/:id/assessments.
export interface ParentAssessmentView {
  id: string;
  subjectId: string;
  subjectTitle?: string;
  term: AssessmentTerm;
  score: number;
  maxScore: number;
  note: string | null;
}

// Mirrors backend ReportCardView (student-assessments/dto/report-card-view.dto.ts),
// returned by GET /parent/students/:id/report-card.
export interface ReportCardSubjectEntry {
  subjectId: string;
  subjectTitle?: string;
  score: number;
  maxScore: number;
}

export interface ReportCardTermSummary {
  term: AssessmentTerm;
  subjects: ReportCardSubjectEntry[];
  average: number | null;
}

export interface ReportCardView {
  studentId: string;
  academicYearId: string | null;
  terms: ReportCardTermSummary[];
  overallAverage: number | null;
}

// Mirrors backend AttendanceStatus (attendance/entities/attendance.entity.ts).
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

// Mirrors backend ParentAttendanceView (attendance/dto/attendance-view.dto.ts),
// returned by GET /parent/students/:id/attendance.
export interface ParentAttendanceView {
  id: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
}

// Mirrors backend ParentStudentDocumentView (student-documents/dto/student-document-view.dto.ts),
// returned by GET /parent/students/:id/documents.
export interface ParentStudentDocumentView {
  id: string;
  title: string;
  documentType: string;
  fileUrl: string;
  description: string | null;
  createdAt: string;
}

// Mirrors backend RecipientTimetableEntryView (timetable/dto/timetable-entry-view.dto.ts),
// returned by GET /parent/students/:id/timetable.
export interface ParentTimetableEntryView {
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
}

// Mirrors backend RecipientHomeworkView (homework/dto/homework-view.dto.ts),
// returned by GET /parent/students/:id/homework.
export interface ParentHomeworkView {
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
}
