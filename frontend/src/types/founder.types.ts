// Founder domain types.
// Mirrors the backend `founder` module described in
// founder-frontend-prompt.md — a founder owns one or more schools and
// gets read-only access to aggregated + per-school dashboards under
// /founder/*. Same one-types-file-per-backend-module convention as the
// rest of types/*.

export interface FounderSchool {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
}

// GET /founder/overview
export interface FounderOverviewTotals {
  schoolCount: number;
  studentCount: number;
  teacherCount: number;
  staffCount: number;
  totalTuition: number;
  totalPaid: number;
  totalUnpaid: number;
  overdueAmount: number;
}

export interface FounderOverviewSchool {
  schoolId: string;
  schoolName: string;
  isActive: boolean;
  studentCount: number;
  teacherCount: number;
  staffCount: number;
  totalTuition: number;
  totalPaid: number;
  totalUnpaid: number;
  overdueAmount: number;
}

export interface FounderOverview {
  totals: FounderOverviewTotals;
  schools: FounderOverviewSchool[];
  generatedAt: string;
}

// GET /founder/schools/:schoolId/dashboard
export interface FounderDashboardStudents {
  total: number;
  active: number;
}

export interface FounderDashboardFinance {
  totalTuition: number;
  totalPaid: number;
  totalUnpaid: number;
  overdueAmount: number;
}

export interface FounderDashboardAttendance {
  attendanceRate: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
}

export interface FounderStudentAverage {
  studentId: string;
  studentFullName: string;
  average: number;
}

// averageScore is null when no assessment has been recorded yet — must be
// shown as "no data", not 0 (see founder-frontend-prompt.md §4).
export interface FounderDashboardAssessments {
  averageScore: number | null;
  topStudents: FounderStudentAverage[];
  lowestStudents: FounderStudentAverage[];
}

export interface FounderRecentPayment {
  id: string;
  studentId: string;
  studentFullName: string;
  amount: number;
  paymentMethod: string | null;
  paidAt: string;
}

export interface FounderRecentAttendance {
  id: string;
  studentId: string;
  studentFullName: string;
  date: string;
  status: string;
}

export interface FounderRecentAssessment {
  id: string;
  studentId: string;
  studentFullName: string;
  subjectTitle?: string;
  term: string;
  score: number;
  maxScore: number;
}

export interface FounderRecentAnnouncement {
  id: string;
  title: string;
  targetType: string;
  createdAt: string;
}

export interface FounderRecentActivity {
  payments: FounderRecentPayment[];
  attendance: FounderRecentAttendance[];
  assessments: FounderRecentAssessment[];
  announcements: FounderRecentAnnouncement[];
}

export interface FounderMonthlyPaymentsPoint {
  year: number;
  month: number;
  totalIncome: number;
  paymentCount: number;
}

export interface FounderMonthlyRegistrationsPoint {
  year: number;
  month: number;
  count: number;
}

export interface FounderAttendanceTrendPoint {
  date: string;
  presentCount: number;
  totalCount: number;
  rate: number;
}

export interface FounderPaymentStatusPoint {
  status: string;
  count: number;
  outstandingAmount: number;
}

export interface FounderDashboardCharts {
  monthlyPayments: FounderMonthlyPaymentsPoint[];
  monthlyRegistrations: FounderMonthlyRegistrationsPoint[];
  attendanceTrend: FounderAttendanceTrendPoint[];
  paymentStatusDistribution: FounderPaymentStatusPoint[];
}

export interface FounderSchoolDashboard {
  students: FounderDashboardStudents;
  finance: FounderDashboardFinance;
  attendance: FounderDashboardAttendance;
  assessments: FounderDashboardAssessments;
  recentActivity: FounderRecentActivity;
  charts: FounderDashboardCharts;
  generatedAt: string;
}

// GET /founder/schools/:schoolId/students
export interface FounderStudentGuardian {
  id: string;
  fullName: string;
  phone?: string;
}

export interface FounderStudentGrade {
  id: string;
  title: string;
}

export type FounderStudentStatus = 'active' | 'withdrawn' | 'graduated';

export interface FounderStudent {
  id: string;
  fullName: string;
  status: FounderStudentStatus;
  grade?: FounderStudentGrade | null;
  guardian?: FounderStudentGuardian | null;
}

export interface QueryFounderStudentsParams {
  status?: FounderStudentStatus;
  gradeId?: string;
  academicYearId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// GET /founder/schools/:schoolId/teachers
export interface FounderTeacherAssignment {
  gradeId: string;
  gradeTitle: string;
  subjectId: string;
  subjectTitle: string;
}

export interface FounderTeacher {
  id: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  assignments: FounderTeacherAssignment[];
}

// GET /founder/teachers — cross-school variant, tagged with which school
// each teacher belongs to (unlike FounderTeacher above, which is already
// scoped to one school via the :schoolId in its route).
export interface FounderTeacherWithSchool extends FounderTeacher {
  schoolId: string;
  schoolName: string;
}

// GET /founder/schools/:schoolId/staff
export type FounderStaffRole = 'school_admin' | 'accountant' | 'staff';

export interface FounderStaffMember {
  id: string;
  fullName: string;
  phone: string;
  role: FounderStaffRole;
  isActive: boolean;
  createdAt: string;
}

// GET /founder/schools/:schoolId/tuition
export interface FounderTuitionOverdue {
  overdueInstallmentCount: number;
  overdueStudentCount: number;
  totalOverdueAmount: number;
}

export interface FounderTopDebtor {
  studentId: string;
  studentFullName: string;
  outstandingBalance: number;
}

export interface FounderTuitionSummary {
  totalTuition: number;
  totalPaid: number;
  totalUnpaid: number;
  overdue: FounderTuitionOverdue;
  topDebtors: FounderTopDebtor[];
}

// POST /founder/link, DELETE /founder/link/:id — super_admin-only
// ownership management (not part of the founder's own read-only portal).
export interface FounderLink {
  id: string;
  founderId: string;
  schoolId: string;
}
