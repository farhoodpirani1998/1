import { Student } from '../entities/student.entity';
import { User } from '../../users/entities/user.entity';
import { StudentStatement } from '../../reports/reports.service';
import { Attendance } from '../../attendance/entities/attendance.entity';
import { Assessment } from '../../student-assessments/entities/assessment.entity';
import { buildReportCard, ReportCardView } from '../../student-assessments/dto/report-card-view.dto';
import { StudentDocument } from '../../student-documents/entities/student-document.entity';
import { Homework } from '../../homework/entities/homework.entity';

/**
 * Phase 5D: Student Profile.
 *
 * A single read-model that aggregates data already owned by other
 * modules (students, guardians, parent accounts, tuition/payments via
 * ReportsService) into one response. No new financial or academic
 * calculation lives here — this file only reshapes data that
 * StudentsService / ReportsService / the parent-link table already
 * produce.
 *
 * `announcements` remains an empty future-ready section below -- it exists
 * so the frontend can build against a stable response shape now; nothing
 * populates it until its own phase lands. `attendance` was populated for
 * real in Phase 5E via AttendanceService; `assessments` (formerly an empty
 * `grades` placeholder -- renamed to avoid colliding with modules/grades'
 * academic *grade level* entity) is populated for real in Phase 5F via
 * AssessmentsService; `documents` is populated for real in Phase 5I via
 * StudentDocumentsService; `homework` is populated for real in Phase 5L via
 * HomeworkService.
 */

export interface StudentProfileParent {
  id: string;
  fullName: string;
  phone: string;
  /**
   * 'guardian' — the contact-of-record captured on the student record
   * itself (students.guardian_id), used for admin/billing purposes.
   * 'parent_account' — a login under modules/parent (parent_students)
   * that can access the parent portal for this student. A student can
   * have zero, one, or several of these; they're not required to be the
   * same person as the guardian.
   */
  type: 'guardian' | 'parent_account';
}

export interface StudentProfileTuitionSummary {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  plans: Array<{
    id: string;
    academicYearId: string;
    baseAmount: number;
    discountAmount: number;
    finalAmount: number;
    installmentCount: number;
  }>;
}

export interface StudentProfilePaymentSummary {
  totalPayments: number;
  totalAmountPaid: number;
  lastPaymentAt: Date | null;
  recentPayments: Array<{
    id: string;
    amount: number;
    paymentMethod: string | null;
    paidAt: Date;
  }>;
}

export interface EmptyProfileSection {
  available: boolean;
  records: unknown[];
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

// Phase 5F: report-card summary embedded in the profile, built from the
// student's *entire* assessment history (not just the recent slice below)
// via the same buildReportCard() the standalone report-card endpoints use
// -- one calculation, reused everywhere it's needed.
export interface StudentProfileAssessmentSection {
  available: boolean;
  records: StudentProfileAssessmentRecord[];
  reportSummary: ReportCardView;
}

// Phase 5I: document summary embedded in the profile, built from the
// student's most recent uploads via the same
// StudentDocumentsService.findRecentForStudent() both the profile and
// StudentProfileService's other sections rely on for their "recent N"
// slices (see RECENT_ATTENDANCE_LIMIT / RECENT_ASSESSMENTS_LIMIT above).
export interface StudentProfileDocumentRecord {
  id: string;
  title: string;
  documentType: string;
  fileUrl: string;
  description: string | null;
  createdAt: Date;
}

export interface StudentProfileDocumentSection {
  available: boolean;
  records: StudentProfileDocumentRecord[];
}

// Phase 5L: homework summary embedded in the profile, built from the
// student's grade's most recent postings via the same
// HomeworkService.findRecentForGrade() the parent-portal
// GET /parent/students/:id/homework route relies on for the full list --
// keyed by gradeId (not studentId), since homework belongs to a grade,
// not an individual student.
export interface StudentProfileHomeworkRecord {
  id: string;
  subjectId: string;
  subjectTitle?: string;
  title: string;
  description: string;
  dueDate: string;
  attachmentUrl: string | null;
  createdAt: Date;
}

export interface StudentProfileHomeworkSection {
  available: boolean;
  records: StudentProfileHomeworkRecord[];
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
  // Phase 5E: attendance is now a real, populated section (see
  // buildStudentProfileView below and AttendanceService.findRecentForStudent).
  attendance: StudentProfileAttendanceSection;
  // Phase 5F: assessments is now a real, populated section (see
  // buildStudentProfileView below and AssessmentsService).
  assessments: StudentProfileAssessmentSection;
  // Phase 5I: documents is now a real, populated section (see
  // buildStudentProfileView below and
  // StudentDocumentsService.findRecentForStudent).
  documents: StudentProfileDocumentSection;
  // Phase 5L: homework is now a real, populated section (see
  // buildStudentProfileView below and HomeworkService.findRecentForGrade).
  homework: StudentProfileHomeworkSection;
  // Still future-ready — structure only, no implementation yet.
  announcements: EmptyProfileSection;
}

const RECENT_PAYMENTS_LIMIT = 5;
const RECENT_ATTENDANCE_LIMIT = 10;
const RECENT_ASSESSMENTS_LIMIT = 10;
const RECENT_DOCUMENTS_LIMIT = 10;
const RECENT_HOMEWORK_LIMIT = 10;

/**
 * Pure function (no DI, no I/O) so both the school_admin flow
 * (StudentProfileService.getForSchoolAdmin) and the parent flow
 * (StudentProfileService.getForParent) build the exact same shape from
 * the exact same inputs — one place to change the response contract.
 */
export function buildStudentProfileView(params: {
  student: Student;
  statement: StudentStatement;
  parentUsers: User[];
  attendanceRecords: Attendance[];
  assessmentRecords: Assessment[];
  documentRecords: StudentDocument[];
  homeworkRecords: Homework[];
}): StudentProfileView {
  const {
    student,
    statement,
    parentUsers,
    attendanceRecords,
    assessmentRecords,
    documentRecords,
    homeworkRecords,
  } = params;

  const parents: StudentProfileParent[] = [];
  if (student.guardian) {
    parents.push({
      id: student.guardian.id,
      fullName: student.guardian.fullName,
      phone: student.guardian.phone,
      type: 'guardian',
    });
  }
  for (const user of parentUsers) {
    parents.push({
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      type: 'parent_account',
    });
  }

  const tuitionSummary: StudentProfileTuitionSummary = {
    totalDue: statement.totals.totalDue,
    totalPaid: statement.totals.totalPaid,
    totalRemaining: statement.totals.totalRemaining,
    plans: statement.tuitionPlans.map((plan) => ({
      id: plan.id,
      academicYearId: plan.academicYearId,
      baseAmount: plan.baseAmount,
      discountAmount: plan.discountAmount,
      finalAmount: plan.finalAmount,
      installmentCount: plan.installments.length,
    })),
  };

  const allPayments = statement.tuitionPlans
    .flatMap((plan) => plan.installments)
    .flatMap((installment) => installment.payments)
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  const paymentSummary: StudentProfilePaymentSummary = {
    totalPayments: allPayments.length,
    totalAmountPaid: statement.totals.totalPaid,
    lastPaymentAt: allPayments[0]?.paidAt ?? null,
    recentPayments: allPayments.slice(0, RECENT_PAYMENTS_LIMIT).map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paidAt: p.paidAt,
    })),
  };

  return {
    student: {
      id: student.id,
      fullName: student.fullName,
      nationalId: student.nationalId,
      status: student.status,
      enrollmentDate: student.enrollmentDate,
    },
    school: { id: student.school.id, name: student.school.name },
    grade: { id: student.grade.id, title: student.grade.title },
    academicYear: {
      id: student.academicYear.id,
      title: student.academicYear.title,
      isCurrent: student.academicYear.isCurrent,
    },
    parents,
    tuitionSummary,
    paymentSummary,
    attendance: {
      available: true,
      records: attendanceRecords.slice(0, RECENT_ATTENDANCE_LIMIT).map((a) => ({
        id: a.id,
        date: a.date,
        status: a.status,
        note: a.note,
      })),
    },
    assessments: {
      available: true,
      records: assessmentRecords.slice(0, RECENT_ASSESSMENTS_LIMIT).map((a) => ({
        id: a.id,
        subjectId: a.subjectId,
        subjectTitle: a.subject?.title,
        term: a.term,
        score: Number(a.score),
        maxScore: Number(a.maxScore),
        note: a.note,
      })),
      reportSummary: buildReportCard(student.id, assessmentRecords),
    },
    documents: {
      available: true,
      records: documentRecords.slice(0, RECENT_DOCUMENTS_LIMIT).map((d) => ({
        id: d.id,
        title: d.title,
        documentType: d.documentType,
        fileUrl: d.fileUrl,
        description: d.description,
        createdAt: d.createdAt,
      })),
    },
    homework: {
      available: true,
      records: homeworkRecords.slice(0, RECENT_HOMEWORK_LIMIT).map((h) => ({
        id: h.id,
        subjectId: h.subjectId,
        subjectTitle: h.subject?.title,
        title: h.title,
        description: h.description,
        dueDate: h.dueDate,
        attachmentUrl: h.attachmentUrl,
        createdAt: h.createdAt,
      })),
    },
    announcements: { available: false, records: [] },
  };
}
