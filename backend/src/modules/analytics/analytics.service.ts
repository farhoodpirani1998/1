import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student, StudentStatus } from '../students/entities/student.entity';
import { Attendance, AttendanceStatus } from '../attendance/entities/attendance.entity';
import { Assessment } from '../student-assessments/entities/assessment.entity';
import { Payment } from '../tuition/entities/payment.entity';
import { Installment } from '../tuition/entities/installment.entity';
import { TuitionPlan } from '../tuition/entities/tuition-plan.entity';
import { ReportsService } from '../reports/reports.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { buildReportCard } from '../student-assessments/dto/report-card-view.dto';
import { GetDashboardQueryDto } from './dto/get-dashboard-query.dto';
import {
  DashboardView,
  DashboardStudentsSummary,
  DashboardFinanceSummary,
  DashboardAttendanceSummary,
  DashboardAssessmentsSummary,
  DashboardStudentAverage,
  DashboardRecentActivity,
  DashboardRecentPayment,
  DashboardRecentAttendance,
  DashboardRecentAssessment,
  DashboardRecentAnnouncement,
  DashboardCharts,
  MonthlyPaymentsPoint,
  MonthlyRegistrationsPoint,
  AttendanceTrendPoint,
  PaymentStatusDistributionPoint,
} from './dto/dashboard-view.dto';

const DEFAULT_RECENT_LIMIT = 5;
const DEFAULT_TREND_DAYS = 7;
const DEFAULT_MONTHS_BACK = 6;
const TOP_STUDENTS_LIMIT = 5;
const ROUND_DECIMALS = 2;

function round(value: number): number {
  const factor = 10 ** ROUND_DECIMALS;
  return Math.round(value * factor) / factor;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Oldest-first list of {year, month}, ending at the current calendar month. */
function lastNMonths(n: number, now = new Date()): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return months;
}

/** Oldest-first list of YYYY-MM-DD dates, ending today. */
function lastNDates(n: number, now = new Date()): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    dates.push(formatDate(d));
  }
  return dates;
}

/**
 * Phase 5J: Analytics Dashboard Foundation.
 *
 * Composes GET /analytics/dashboard entirely from data other modules
 * already own. Two reuse shapes appear throughout, deliberately kept
 * distinct:
 *  - Calls into an existing service (ReportsService.overdueSummary/
 *    monthlyIncome, AttendanceService.findByDate, AnnouncementsService.
 *    findAllForSchool, buildReportCard) wherever one already computes the
 *    number needed, so that module's own business rule is never
 *    re-derived here.
 *  - Narrow, read-only repository queries (Student/Attendance/Assessment/
 *    Payment/Installment/TuitionPlan) for school-wide totals no existing
 *    method returns -- same "this module declares its own repos for the
 *    reads it needs directly" convention StudentDocumentsModule /
 *    StudentProfileModule already use, chosen over modifying
 *    attendance/tuition/assessments to keep those modules untouched per
 *    the phase's constraints.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(TuitionPlan)
    private readonly tuitionPlanRepo: Repository<TuitionPlan>,
    private readonly reportsService: ReportsService,
    private readonly attendanceService: AttendanceService,
    private readonly announcementsService: AnnouncementsService,
  ) {}

  async getDashboard(schoolId: string, query: GetDashboardQueryDto): Promise<DashboardView> {
    const recentLimit = query.recentLimit ?? DEFAULT_RECENT_LIMIT;
    const trendDays = query.trendDays ?? DEFAULT_TREND_DAYS;
    const monthsBack = query.monthsBack ?? DEFAULT_MONTHS_BACK;

    const [students, finance, attendance, assessments, recentActivity, charts] = await Promise.all([
      this.getStudentsSummary(schoolId),
      this.getFinanceSummary(schoolId),
      this.getAttendanceSummary(schoolId),
      this.getAssessmentsSummary(schoolId),
      this.getRecentActivity(schoolId, recentLimit),
      this.getCharts(schoolId, monthsBack, trendDays),
    ]);

    return { students, finance, attendance, assessments, recentActivity, charts, generatedAt: new Date() };
  }

  // -------------------------------------------------------------------
  // 1. Students
  // -------------------------------------------------------------------

  private async getStudentsSummary(schoolId: string): Promise<DashboardStudentsSummary> {
    const [total, active] = await Promise.all([
      this.studentRepo.count({ where: { schoolId } }),
      this.studentRepo.count({ where: { schoolId, status: StudentStatus.ACTIVE } }),
    ]);
    return { total, active };
  }

  // -------------------------------------------------------------------
  // 2. Finance
  // -------------------------------------------------------------------

  private async getFinanceSummary(schoolId: string): Promise<DashboardFinanceSummary> {
    // totalTuition/totalPaid mirror the exact same additive definition
    // ReportsService.studentStatement() uses per student (sum of
    // plan.finalAmount / installment.paidAmount), just aggregated across
    // the whole school in one query instead of one student at a time --
    // no new financial rule, only a wider scope.
    const [tuitionRaw, paidRaw, overdue] = await Promise.all([
      this.tuitionPlanRepo
        .createQueryBuilder('plan')
        .innerJoin('plan.student', 'student')
        .where('student.schoolId = :schoolId', { schoolId })
        .select('COALESCE(SUM(plan.finalAmount), 0)', 'totalTuition')
        .getRawOne<{ totalTuition: string }>(),
      this.installmentRepo
        .createQueryBuilder('installment')
        .innerJoin('installment.tuitionPlan', 'plan')
        .innerJoin('plan.student', 'student')
        .where('student.schoolId = :schoolId', { schoolId })
        .select('COALESCE(SUM(installment.paidAmount), 0)', 'totalPaid')
        .getRawOne<{ totalPaid: string }>(),
      // Reused outright -- "what counts as overdue" is decided by the
      // installment status-machine / scheduler cron, not here.
      this.reportsService.overdueSummary(schoolId),
    ]);

    const totalTuition = Number(tuitionRaw?.totalTuition ?? 0);
    const totalPaid = Number(paidRaw?.totalPaid ?? 0);

    return {
      totalTuition,
      totalPaid,
      totalUnpaid: totalTuition - totalPaid,
      overdueAmount: overdue.totalOverdueAmount,
    };
  }

  // -------------------------------------------------------------------
  // 3. Attendance
  // -------------------------------------------------------------------

  private async getAttendanceSummary(schoolId: string): Promise<DashboardAttendanceSummary> {
    const today = formatDate(new Date());

    const [todayRecords, totalCount, presentCount] = await Promise.all([
      // Reused outright -- AttendanceService.findByDate() already is the
      // "attendance roster for one day" query; today's present/absent/
      // late counts are just tallied from what it returns.
      this.attendanceService.findByDate(today, schoolId, {}),
      this.attendanceRepo.count({ where: { schoolId } }),
      this.attendanceRepo.count({ where: { schoolId, status: AttendanceStatus.PRESENT } }),
    ]);

    const presentToday = todayRecords.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const absentToday = todayRecords.filter((r) => r.status === AttendanceStatus.ABSENT).length;
    const lateToday = todayRecords.filter((r) => r.status === AttendanceStatus.LATE).length;

    return {
      attendanceRate: totalCount > 0 ? round((presentCount / totalCount) * 100) : 0,
      presentToday,
      absentToday,
      lateToday,
    };
  }

  // -------------------------------------------------------------------
  // 4. Assessments
  // -------------------------------------------------------------------

  private async getAssessmentsSummary(schoolId: string): Promise<DashboardAssessmentsSummary> {
    const assessments = await this.assessmentRepo.find({
      where: { schoolId },
      relations: ['student', 'subject'],
    });

    if (assessments.length === 0) {
      return { averageScore: null, topStudents: [], lowestStudents: [] };
    }

    const byStudent = new Map<string, Assessment[]>();
    for (const assessment of assessments) {
      const list = byStudent.get(assessment.studentId) ?? [];
      list.push(assessment);
      byStudent.set(assessment.studentId, list);
    }

    // Reuses buildReportCard() (same normalization AssessmentsService.
    // getReportCard() and the student-profile report summary already
    // use: each subject rescaled to /20 before averaging) instead of
    // re-deriving an averaging rule here.
    const studentAverages: DashboardStudentAverage[] = [];
    for (const [studentId, list] of byStudent) {
      const reportCard = buildReportCard(studentId, list);
      if (reportCard.overallAverage !== null) {
        studentAverages.push({
          studentId,
          studentFullName: list[0].student?.fullName ?? '',
          average: reportCard.overallAverage,
        });
      }
    }

    const averageScore =
      studentAverages.length > 0
        ? round(studentAverages.reduce((sum, s) => sum + s.average, 0) / studentAverages.length)
        : null;

    const sortedDesc = [...studentAverages].sort((a, b) => b.average - a.average);
    const topStudents = sortedDesc.slice(0, TOP_STUDENTS_LIMIT);
    const lowestStudents = [...sortedDesc].reverse().slice(0, TOP_STUDENTS_LIMIT);

    return { averageScore, topStudents, lowestStudents };
  }

  // -------------------------------------------------------------------
  // 5. Recent Activity
  // -------------------------------------------------------------------

  private async getRecentActivity(schoolId: string, limit: number): Promise<DashboardRecentActivity> {
    const [payments, attendance, assessments, announcements] = await Promise.all([
      this.getRecentPayments(schoolId, limit),
      this.getRecentAttendance(schoolId, limit),
      this.getRecentAssessments(schoolId, limit),
      this.getRecentAnnouncements(schoolId, limit),
    ]);
    return { payments, attendance, assessments, announcements };
  }

  private async getRecentPayments(schoolId: string, limit: number): Promise<DashboardRecentPayment[]> {
    const raw = await this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.installment', 'installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .where('student.schoolId = :schoolId', { schoolId })
      .select('payment.id', 'id')
      .addSelect('payment.amount', 'amount')
      .addSelect('payment.paymentMethod', 'paymentMethod')
      .addSelect('payment.paidAt', 'paidAt')
      .addSelect('student.id', 'studentId')
      .addSelect('student.fullName', 'studentFullName')
      .orderBy('payment.paidAt', 'DESC')
      .limit(limit)
      .getRawMany<{
        id: string;
        amount: string;
        paymentMethod: string | null;
        paidAt: Date;
        studentId: string;
        studentFullName: string;
      }>();

    return raw.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentFullName: r.studentFullName,
      amount: Number(r.amount),
      paymentMethod: r.paymentMethod as DashboardRecentPayment['paymentMethod'],
      paidAt: r.paidAt,
    }));
  }

  private async getRecentAttendance(schoolId: string, limit: number): Promise<DashboardRecentAttendance[]> {
    const rows = await this.attendanceRepo.find({
      where: { schoolId },
      relations: ['student'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentFullName: a.student?.fullName ?? '',
      date: a.date,
      status: a.status,
    }));
  }

  private async getRecentAssessments(schoolId: string, limit: number): Promise<DashboardRecentAssessment[]> {
    const rows = await this.assessmentRepo.find({
      where: { schoolId },
      relations: ['student', 'subject'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentFullName: a.student?.fullName ?? '',
      subjectTitle: a.subject?.title,
      term: a.term,
      score: Number(a.score),
      maxScore: Number(a.maxScore),
    }));
  }

  private async getRecentAnnouncements(
    schoolId: string,
    limit: number,
  ): Promise<DashboardRecentAnnouncement[]> {
    // Reused outright -- AnnouncementsService already returns every
    // announcement for the school, most recent first; the dashboard just
    // takes the top slice instead of re-querying the announcements table.
    const rows = await this.announcementsService.findAllForSchool(schoolId);
    return rows.slice(0, limit).map((a) => ({
      id: a.id,
      title: a.title,
      targetType: a.targetType,
      createdAt: a.createdAt,
    }));
  }

  // -------------------------------------------------------------------
  // 6. Charts
  // -------------------------------------------------------------------

  private async getCharts(schoolId: string, monthsBack: number, trendDays: number): Promise<DashboardCharts> {
    const [monthlyPayments, monthlyRegistrations, attendanceTrend, paymentStatusDistribution] =
      await Promise.all([
        this.getMonthlyPayments(schoolId, monthsBack),
        this.getMonthlyRegistrations(schoolId, monthsBack),
        this.getAttendanceTrend(schoolId, trendDays),
        this.getPaymentStatusDistribution(schoolId),
      ]);
    return { monthlyPayments, monthlyRegistrations, attendanceTrend, paymentStatusDistribution };
  }

  /**
   * Reused outright, one call per trailing month -- ReportsService.
   * monthlyIncome() already is "cash collected in one calendar month"
   * (read from the ledger, not re-summed from `payments` here), the same
   * number GET /reports/monthly-income returns for a single month.
   */
  private async getMonthlyPayments(schoolId: string, monthsBack: number): Promise<MonthlyPaymentsPoint[]> {
    const months = lastNMonths(monthsBack);
    return Promise.all(months.map(({ year, month }) => this.reportsService.monthlyIncome(schoolId, year, month)));
  }

  private async getMonthlyRegistrations(
    schoolId: string,
    monthsBack: number,
  ): Promise<MonthlyRegistrationsPoint[]> {
    const months = lastNMonths(monthsBack);
    const start = new Date(Date.UTC(months[0].year, months[0].month - 1, 1));

    const raw = await this.studentRepo
      .createQueryBuilder('student')
      .where('student.schoolId = :schoolId', { schoolId })
      .andWhere('student.createdAt >= :start', { start })
      .select("to_char(student.createdAt, 'YYYY-MM')", 'yearMonth')
      .addSelect('COUNT(*)', 'count')
      .groupBy("to_char(student.createdAt, 'YYYY-MM')")
      .getRawMany<{ yearMonth: string; count: string }>();

    const countByMonth = new Map(raw.map((r) => [r.yearMonth, Number(r.count)]));

    return months.map(({ year, month }) => ({
      year,
      month,
      count: countByMonth.get(`${year}-${String(month).padStart(2, '0')}`) ?? 0,
    }));
  }

  /**
   * Reused outright, one call per trailing day -- AttendanceService.
   * findByDate() is the same "roster for one day" query
   * getAttendanceSummary()'s today counts use; the trend just tallies
   * present/total per day instead of a single day.
   */
  private async getAttendanceTrend(schoolId: string, trendDays: number): Promise<AttendanceTrendPoint[]> {
    const dates = lastNDates(trendDays);
    return Promise.all(
      dates.map(async (date) => {
        const records = await this.attendanceService.findByDate(date, schoolId, {});
        const totalCount = records.length;
        const presentCount = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
        return {
          date,
          presentCount,
          totalCount,
          rate: totalCount > 0 ? round((presentCount / totalCount) * 100) : 0,
        };
      }),
    );
  }

  /**
   * One row per installment status (pending/paid/overdue/partial/
   * cancelled/deferred/disputed) -- same join shape as ReportsService.
   * overdueSummary(), just grouped by status instead of filtered to one.
   */
  private async getPaymentStatusDistribution(schoolId: string): Promise<PaymentStatusDistributionPoint[]> {
    const raw = await this.installmentRepo
      .createQueryBuilder('installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .where('student.schoolId = :schoolId', { schoolId })
      .select('installment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(installment.amount - installment.paidAmount), 0)', 'outstandingAmount')
      .groupBy('installment.status')
      .getRawMany<{ status: string; count: string; outstandingAmount: string }>();

    return raw.map((r) => ({
      status: r.status as PaymentStatusDistributionPoint['status'],
      count: Number(r.count),
      outstandingAmount: Number(r.outstandingAmount),
    }));
  }
}
