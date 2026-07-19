// Mirrors backend StudentProfileView 1:1 (see
// backend/src/modules/students/profile/student-profile-view.dto.ts).
// Served by GET /students/:id/profile (school_admin/accountant) and
// GET /teacher/students/:id/profile (teacher, scoped to their own
// assigned students) — same response shape from both routes, built by
// the same buildStudentProfileView() on the backend.
//
// `photo` deliberately does not exist here — the backend has no student
// photo field (see student.types.ts's own "don't add fields that don't
// exist on the backend" rule). <StudentProfileModal/> renders an
// initial-letter avatar instead, the same presentational-only pattern
// StudentDetailPage's <StudentAvatar/> already uses.

export interface StudentProfileParent {
  id: string;
  fullName: string;
  phone: string;
  type: 'guardian' | 'parent_account';
}

export interface StudentProfileTuitionPlanSummary {
  id: string;
  academicYearId: string;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  installmentCount: number;
}

export interface StudentProfileTuitionSummary {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  plans: StudentProfileTuitionPlanSummary[];
}

export interface StudentProfileRecentPayment {
  id: string;
  amount: number;
  paymentMethod: string | null;
  paidAt: string;
}

export interface StudentProfilePaymentSummary {
  totalPayments: number;
  totalAmountPaid: number;
  lastPaymentAt: string | null;
  recentPayments: StudentProfileRecentPayment[];
}

export interface StudentProfileAttendanceRecord {
  id: string;
  date: string;
  status: string;
  note: string | null;
}

export interface StudentProfileAttendanceSection {
  available: boolean;
  records: StudentProfileAttendanceRecord[];
}

export interface StudentProfileAssessmentRecord {
  id: string;
  subjectId: string;
  subjectTitle?: string;
  term: string;
  score: number;
  maxScore: number;
  note: string | null;
}

export interface ReportCardSubjectEntry {
  subjectId: string;
  subjectTitle?: string;
  score: number;
  maxScore: number;
}

export interface ReportCardTermSummary {
  term: string;
  subjects: ReportCardSubjectEntry[];
  average: number | null;
}

export interface ReportCardView {
  studentId: string;
  academicYearId: string | null;
  terms: ReportCardTermSummary[];
  overallAverage: number | null;
}

export interface StudentProfileAssessmentSection {
  available: boolean;
  records: StudentProfileAssessmentRecord[];
  reportSummary: ReportCardView;
}

export interface StudentProfileDocumentRecord {
  id: string;
  title: string;
  documentType: string;
  fileUrl: string;
  description: string | null;
  createdAt: string;
}

export interface StudentProfileDocumentSection {
  available: boolean;
  records: StudentProfileDocumentRecord[];
}

export interface StudentProfileHomeworkRecord {
  id: string;
  subjectId: string;
  subjectTitle?: string;
  title: string;
  description: string;
  dueDate: string;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface StudentProfileHomeworkSection {
  available: boolean;
  records: StudentProfileHomeworkRecord[];
}

export interface EmptyProfileSection {
  available: boolean;
  records: unknown[];
}

export interface StudentProfileView {
  student: {
    id: string;
    fullName: string;
    nationalId: string | null;
    status: string;
    enrollmentDate: string | null;
  };
  school: { id: string; name: string };
  grade: { id: string; title: string };
  academicYear: { id: string; title: string; isCurrent: boolean };
  parents: StudentProfileParent[];
  tuitionSummary: StudentProfileTuitionSummary;
  paymentSummary: StudentProfilePaymentSummary;
  attendance: StudentProfileAttendanceSection;
  assessments: StudentProfileAssessmentSection;
  documents: StudentProfileDocumentSection;
  homework: StudentProfileHomeworkSection;
  announcements: EmptyProfileSection;
}
