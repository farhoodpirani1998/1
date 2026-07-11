import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  createTuitionPlan,
  createInstallment,
  createPayment,
  createLedgerEntry,
  createAttendance,
  createSubject,
  createAssessment,
  createAnnouncement,
  authHeader,
  Role,
  InstallmentStatus,
  AttendanceStatus,
  AssessmentTerm,
  AnnouncementTargetType,
  LedgerEntryType,
  LedgerReferenceType,
} from './setup/factories';
import { Student, StudentStatus } from '../src/modules/students/entities/student.entity';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Phase 5J: Analytics Dashboard Foundation
 *
 * Proves that:
 * 1. GET /analytics/dashboard is school_admin-only -- staff/accountant/
 *    teacher/parent/unauthenticated are all rejected.
 * 2. Every section (students, finance, attendance, assessments,
 *    recentActivity, charts) is present and tenant-scoped: a school with
 *    no data gets an empty-but-well-shaped response, and a school with
 *    fixtures never sees another school's numbers mixed in.
 * 3. finance.overdueAmount matches ReportsService.overdueSummary()
 *    exactly (same source, not re-derived).
 * 4. assessments.averageScore / topStudents / lowestStudents match the
 *    same /20 normalization buildReportCard() already uses.
 * 5. charts.monthlyPayments matches ReportsService.monthlyIncome() for
 *    the current month once a ledger PAYMENT entry exists.
 * 6. Query validation rejects out-of-range/non-numeric recentLimit,
 *    trendDays, monthsBack.
 */
describe('Analytics Dashboard (Phase 5J e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let parentA: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminB: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await truncateAll(app);

    schoolA = await createSchool(app, { name: 'School A' });
    schoolB = await createSchool(app, { name: 'School B' });

    schoolAdminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });
    staffA = await createUser(app, { role: Role.STAFF, schoolId: schoolA.id });
    accountantA = await createUser(app, { role: Role.ACCOUNTANT, schoolId: schoolA.id });
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });
  });

  // -------------------------------------------------------------------
  // Authorization
  // -------------------------------------------------------------------

  describe('authorization', () => {
    it('allows school_admin', async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
    });

    it.each([
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s', async (_label, getUser) => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(server).get('/api/v1/analytics/dashboard');
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // Empty-school shape
  // -------------------------------------------------------------------

  describe('empty school', () => {
    it('returns a well-shaped, all-zero/empty response when there is no data', async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.students).toEqual({ total: 0, active: 0 });
      expect(res.body.finance).toEqual({
        totalTuition: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        overdueAmount: 0,
      });
      expect(res.body.attendance).toEqual({
        attendanceRate: 0,
        presentToday: 0,
        absentToday: 0,
        lateToday: 0,
      });
      expect(res.body.assessments).toEqual({ averageScore: null, topStudents: [], lowestStudents: [] });
      expect(res.body.recentActivity).toEqual({
        payments: [],
        attendance: [],
        assessments: [],
        announcements: [],
      });
      expect(res.body.charts.monthlyPayments).toHaveLength(6);
      expect(res.body.charts.monthlyRegistrations).toHaveLength(6);
      expect(res.body.charts.attendanceTrend).toHaveLength(7);
      expect(res.body.charts.paymentStatusDistribution).toEqual([]);
      expect(res.body.generatedAt).toBeDefined();
    });
  });

  // -------------------------------------------------------------------
  // Populated dashboard + tenant isolation
  // -------------------------------------------------------------------

  describe('populated dashboard', () => {
    let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
    let gradeA: Awaited<ReturnType<typeof createGrade>>;
    let studentA1: Awaited<ReturnType<typeof createStudent>>;
    let studentA2: Awaited<ReturnType<typeof createStudent>>;
    let studentA3Withdrawn: Awaited<ReturnType<typeof createStudent>>;

    beforeEach(async () => {
      acadYearA = await createAcademicYear(app, schoolA.id);
      gradeA = await createGrade(app, schoolA.id);
      studentA1 = await createStudent(app, schoolA.id, {
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        fullName: 'Student One',
      });
      studentA2 = await createStudent(app, schoolA.id, {
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        fullName: 'Student Two',
      });
      studentA3Withdrawn = await createStudent(app, schoolA.id, {
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        fullName: 'Student Three',
      });
      // Mark the third student withdrawn directly (no dedicated endpoint
      // needed for this fixture) so students.total !== students.active.
      await getDataSource(app)
        .getRepository(Student)
        .update(studentA3Withdrawn.id, { status: StudentStatus.WITHDRAWN });

      // A student in the other school must never leak into School A's numbers.
      const acadYearB = await createAcademicYear(app, schoolB.id);
      const gradeB = await createGrade(app, schoolB.id);
      await createStudent(app, schoolB.id, { academicYearId: acadYearB.id, gradeId: gradeB.id });

      // --- Finance ---
      const plan = await createTuitionPlan(app, {
        studentId: studentA1.id,
        academicYearId: acadYearA.id,
        baseAmount: 20_000_000,
        discountAmount: 0,
      });
      const installment = await createInstallment(app, {
        tuitionPlanId: plan.id,
        amount: 10_000_000,
        paidAmount: 4_000_000,
        status: InstallmentStatus.PARTIAL,
      });
      const overdueInstallment = await createInstallment(app, {
        tuitionPlanId: plan.id,
        installmentNumber: 2,
        amount: 10_000_000,
        paidAmount: 0,
        status: InstallmentStatus.OVERDUE,
      });
      const payment = await createPayment(app, { installmentId: installment.id, amount: 4_000_000 });
      await createLedgerEntry(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        entryType: LedgerEntryType.PAYMENT,
        amount: -4_000_000,
        referenceType: LedgerReferenceType.PAYMENT,
        referenceId: payment.id,
      });
      void overdueInstallment;

      // --- Attendance (today + a bit of history) ---
      const now = today();
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        academicYearId: acadYearA.id,
        date: now,
        status: AttendanceStatus.PRESENT,
      });
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA2.id,
        academicYearId: acadYearA.id,
        date: now,
        status: AttendanceStatus.ABSENT,
      });
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA3Withdrawn.id,
        academicYearId: acadYearA.id,
        date: now,
        status: AttendanceStatus.LATE,
      });

      // --- Assessments ---
      const subject = await createSubject(app, schoolA.id, { title: 'Math' });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        subjectId: subject.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
        score: 18,
        maxScore: 20,
      });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA2.id,
        subjectId: subject.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
        score: 10,
        maxScore: 20,
      });

      // --- Announcements ---
      await createAnnouncement(app, {
        schoolId: schoolA.id,
        createdById: schoolAdminA.id,
        title: 'Welcome',
        targetType: AnnouncementTargetType.ALL,
      });
    });

    it('reports correct students totals', async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body.students.total).toBe(3);
      expect(res.body.students.active).toBe(2);
    });

    it('reports finance totals matching the seeded plan/installments, and overdueAmount matching ReportsService', async () => {
      const [dashboardRes, overdueRes] = await Promise.all([
        request(server)
          .get('/api/v1/analytics/dashboard')
          .set('Authorization', authHeader(app, schoolAdminA)),
        request(server)
          .get('/api/v1/reports/overdue-summary')
          .set('Authorization', authHeader(app, schoolAdminA)),
      ]);

      expect(dashboardRes.status).toBe(200);
      expect(dashboardRes.body.finance.totalTuition).toBe(20_000_000);
      expect(dashboardRes.body.finance.totalPaid).toBe(4_000_000);
      expect(dashboardRes.body.finance.totalUnpaid).toBe(16_000_000);
      expect(dashboardRes.body.finance.overdueAmount).toBe(overdueRes.body.totalOverdueAmount);
      expect(dashboardRes.body.finance.overdueAmount).toBe(10_000_000);
    });

    it("reports today's attendance counts and a nonzero attendance rate", async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body.attendance.presentToday).toBe(1);
      expect(res.body.attendance.absentToday).toBe(1);
      expect(res.body.attendance.lateToday).toBe(1);
      // 1 present out of 3 total records = 33.33%
      expect(res.body.attendance.attendanceRate).toBeCloseTo(33.33, 1);
    });

    it('reports assessments average/top/lowest students normalized to /20', async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      // studentA1: 18/20 -> 18, studentA2: 10/20 -> 10, mean = 14
      expect(res.body.assessments.averageScore).toBeCloseTo(14, 1);
      expect(res.body.assessments.topStudents[0].studentId).toBe(studentA1.id);
      expect(res.body.assessments.topStudents[0].average).toBeCloseTo(18, 1);
      expect(res.body.assessments.lowestStudents[0].studentId).toBe(studentA2.id);
      expect(res.body.assessments.lowestStudents[0].average).toBeCloseTo(10, 1);
    });

    it('lists recent activity across payments/attendance/assessments/announcements', async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body.recentActivity.payments).toHaveLength(1);
      expect(res.body.recentActivity.payments[0].studentId).toBe(studentA1.id);
      expect(res.body.recentActivity.attendance).toHaveLength(3);
      expect(res.body.recentActivity.assessments).toHaveLength(2);
      expect(res.body.recentActivity.announcements).toHaveLength(1);
      expect(res.body.recentActivity.announcements[0].title).toBe('Welcome');
    });

    it("charts.monthlyPayments for the current month matches ReportsService.monthlyIncome, and chart lists are the requested length", async () => {
      const now = new Date();
      const [dashboardRes, incomeRes] = await Promise.all([
        request(server)
          .get('/api/v1/analytics/dashboard')
          .set('Authorization', authHeader(app, schoolAdminA)),
        request(server)
          .get('/api/v1/reports/monthly-income')
          .query({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 })
          .set('Authorization', authHeader(app, schoolAdminA)),
      ]);

      expect(dashboardRes.status).toBe(200);
      const currentMonthPoint = dashboardRes.body.charts.monthlyPayments.at(-1);
      expect(currentMonthPoint.year).toBe(incomeRes.body.year);
      expect(currentMonthPoint.month).toBe(incomeRes.body.month);
      expect(currentMonthPoint.totalIncome).toBe(incomeRes.body.totalIncome);
      expect(currentMonthPoint.totalIncome).toBe(4_000_000);

      expect(dashboardRes.body.charts.monthlyRegistrations).toHaveLength(6);
      expect(dashboardRes.body.charts.monthlyRegistrations.at(-1).count).toBe(3);
      expect(dashboardRes.body.charts.attendanceTrend).toHaveLength(7);
      expect(dashboardRes.body.charts.attendanceTrend.at(-1).date).toBe(today());

      const statuses = dashboardRes.body.charts.paymentStatusDistribution.map((p: any) => p.status);
      expect(statuses.sort()).toEqual(['overdue', 'partial']);
    });

    it("never mixes School A's data into School B's dashboard", async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', authHeader(app, schoolAdminB));

      expect(res.status).toBe(200);
      expect(res.body.students).toEqual({ total: 0, active: 0 });
      expect(res.body.finance).toEqual({
        totalTuition: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        overdueAmount: 0,
      });
      expect(res.body.attendance.presentToday).toBe(0);
      expect(res.body.assessments).toEqual({ averageScore: null, topStudents: [], lowestStudents: [] });
      expect(res.body.recentActivity.announcements).toHaveLength(0);
    });

    it('respects recentLimit for recent-activity lists', async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .query({ recentLimit: 1 })
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body.recentActivity.assessments).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------
  // Query DTO validation
  // -------------------------------------------------------------------

  describe('query validation', () => {
    it.each([
      ['recentLimit', { recentLimit: 0 }],
      ['recentLimit too high', { recentLimit: 21 }],
      ['recentLimit non-numeric', { recentLimit: 'abc' }],
      ['trendDays', { trendDays: 0 }],
      ['trendDays too high', { trendDays: 91 }],
      ['monthsBack', { monthsBack: 0 }],
      ['monthsBack too high', { monthsBack: 25 }],
    ])('rejects invalid %s', async (_label, query) => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .query(query)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(400);
    });

    it('rejects unknown extra query fields (forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .query({ foo: 'bar' })
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(400);
    });

    it('accepts valid boundary values', async () => {
      const res = await request(server)
        .get('/api/v1/analytics/dashboard')
        .query({ recentLimit: 20, trendDays: 90, monthsBack: 24 })
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body.charts.monthlyPayments).toHaveLength(24);
      expect(res.body.charts.attendanceTrend).toHaveLength(90);
    });
  });
});
