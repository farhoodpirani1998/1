import { AttendanceStatus } from '../../attendance/entities/attendance.entity';
import { AssessmentTerm } from '../../student-assessments/entities/assessment.entity';
import { InstallmentStatus } from '../../tuition/entities/installment.entity';
import { PaymentMethod } from '../../tuition/entities/payment.entity';
import { AnnouncementTargetType } from '../../announcements/entities/announcement.entity';

/**
 * Phase 5J: Analytics Dashboard Foundation.
 *
 * A single read-model that aggregates data already owned by other
 * modules (students, tuition/payments via ReportsService, attendance via
 * AttendanceService, assessments via the same report-card normalization
 * student-assessments already uses, announcements via
 * AnnouncementsService) into one response. No new financial, attendance,
 * or academic *decision* logic lives here — see AnalyticsService for
 * which numbers are reused outright (e.g. overdueAmount from
 * ReportsService.overdueSummary, monthlyPayments from
 * ReportsService.monthlyIncome) versus which are plain read-only
 * aggregates this module adds because no existing method returns a
 * school-wide total.
 */

export interface DashboardStudentsSummary {
  total: number;
  active: number;
}

export interface DashboardFinanceSummary {
  totalTuition: number;
  totalPaid: number;
  totalUnpaid: number;
  // Reused as-is from ReportsService.overdueSummary() -- the definition
  // of "overdue" (an installment whose status the overdue-marking cron
  // has flipped to OVERDUE) lives there, not here.
  overdueAmount: number;
}

export interface DashboardAttendanceSummary {
  // Present markings as a percentage of every attendance record ever
  // taken in this school (all statuses, all time).
  attendanceRate: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
}

export interface DashboardStudentAverage {
  studentId: string;
  studentFullName: string;
  // Normalized to a 0–20 scale via the same buildReportCard() the
  // standalone report-card endpoints use -- see AnalyticsService.
  average: number;
}

export interface DashboardAssessmentsSummary {
  // Average of every student's own report-card overallAverage, not a
  // flat average of every raw score -- so a student with many recorded
  // assessments doesn't outweigh one with few. `null` when the school has
  // no assessments yet, same "null means no data, not zero" convention
  // ReportCardView.overallAverage already uses.
  averageScore: number | null;
  topStudents: DashboardStudentAverage[];
  lowestStudents: DashboardStudentAverage[];
}

export interface DashboardRecentPayment {
  id: string;
  studentId: string;
  studentFullName: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paidAt: Date;
}

export interface DashboardRecentAttendance {
  id: string;
  studentId: string;
  studentFullName: string;
  date: string;
  status: AttendanceStatus;
}

export interface DashboardRecentAssessment {
  id: string;
  studentId: string;
  studentFullName: string;
  subjectTitle?: string;
  term: AssessmentTerm;
  score: number;
  maxScore: number;
}

export interface DashboardRecentAnnouncement {
  id: string;
  title: string;
  targetType: AnnouncementTargetType;
  createdAt: Date;
}

export interface DashboardRecentActivity {
  payments: DashboardRecentPayment[];
  attendance: DashboardRecentAttendance[];
  assessments: DashboardRecentAssessment[];
  announcements: DashboardRecentAnnouncement[];
}

export interface MonthlyPaymentsPoint {
  year: number;
  month: number;
  totalIncome: number;
  paymentCount: number;
}

export interface MonthlyRegistrationsPoint {
  year: number;
  month: number;
  count: number;
}

export interface AttendanceTrendPoint {
  date: string;
  presentCount: number;
  totalCount: number;
  rate: number;
}

export interface PaymentStatusDistributionPoint {
  status: InstallmentStatus;
  count: number;
  outstandingAmount: number;
}

// Every array below is chronological / frontend-chart-ready as-is (no
// further sorting or bucketing needed on the client) -- oldest point
// first for the two time-series charts, so a chart library can render
// them left-to-right without re-sorting.
export interface DashboardCharts {
  monthlyPayments: MonthlyPaymentsPoint[];
  monthlyRegistrations: MonthlyRegistrationsPoint[];
  attendanceTrend: AttendanceTrendPoint[];
  paymentStatusDistribution: PaymentStatusDistributionPoint[];
}

export interface DashboardView {
  students: DashboardStudentsSummary;
  finance: DashboardFinanceSummary;
  attendance: DashboardAttendanceSummary;
  assessments: DashboardAssessmentsSummary;
  recentActivity: DashboardRecentActivity;
  charts: DashboardCharts;
  generatedAt: Date;
}
