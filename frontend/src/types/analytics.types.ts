// Analytics domain types.
// Mirrors AnalyticsService's DashboardView 1:1 (backend:
// src/modules/analytics/dto/dashboard-view.dto.ts) — same
// one-types-file-per-backend-module convention as report.types.ts.
//
// NOTE: GET /analytics/dashboard is @Roles('school_admin') only, unlike
// /reports/* which is also open to accountant. Only school_admin call
// sites should ever import from this file.

import type { InstallmentStatus } from './tuition.types';

// No attendance.types.ts exists on the frontend yet (attendance has no
// dedicated page/feature wired up here) — status is kept as a plain
// string rather than introducing a new type file for one field.
type AttendanceStatus = string;

export interface DashboardStudentsSummary {
  total: number;
  active: number;
}

export interface DashboardFinanceSummary {
  totalTuition: number;
  totalPaid: number;
  totalUnpaid: number;
  overdueAmount: number;
}

export interface DashboardAttendanceSummary {
  attendanceRate: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
}

export interface DashboardStudentAverage {
  studentId: string;
  studentFullName: string;
  average: number;
}

export interface DashboardAssessmentsSummary {
  averageScore: number | null;
  topStudents: DashboardStudentAverage[];
  lowestStudents: DashboardStudentAverage[];
}

export interface DashboardRecentPayment {
  id: string;
  studentId: string;
  studentFullName: string;
  amount: number;
  paymentMethod: string | null;
  paidAt: string;
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
  term: string;
  score: number;
  maxScore: number;
}

export interface DashboardRecentAnnouncement {
  id: string;
  title: string;
  targetType: string;
  createdAt: string;
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
  generatedAt: string;
}
