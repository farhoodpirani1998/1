"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
const student_entity_1 = require("../src/modules/students/entities/student.entity");
function today() {
    return new Date().toISOString().slice(0, 10);
}
describe('Analytics Dashboard (Phase 5J e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let schoolAdminA;
    let staffA;
    let accountantA;
    let teacherA;
    let parentA;
    let schoolAdminB;
    beforeAll(async () => {
        app = await (0, test_app_1.createTestApp)();
        server = app.getHttpServer();
    });
    afterAll(async () => {
        await (0, test_app_1.closeTestApp)(app);
    });
    beforeEach(async () => {
        await (0, test_app_1.truncateAll)(app);
        schoolA = await (0, factories_1.createSchool)(app, { name: 'School A' });
        schoolB = await (0, factories_1.createSchool)(app, { name: 'School B' });
        schoolAdminA = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolA.id });
        staffA = await (0, factories_1.createUser)(app, { role: factories_1.Role.STAFF, schoolId: schoolA.id });
        accountantA = await (0, factories_1.createUser)(app, { role: factories_1.Role.ACCOUNTANT, schoolId: schoolA.id });
        teacherA = await (0, factories_1.createUser)(app, { role: factories_1.Role.TEACHER, schoolId: schoolA.id });
        parentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id });
        schoolAdminB = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolB.id });
    });
    describe('authorization', () => {
        it('allows school_admin', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
        });
        it.each([
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
            ['parent', () => parentA],
        ])('rejects %s', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
        it('rejects an unauthenticated request', async () => {
            const res = await (0, supertest_1.default)(server).get('/api/v1/analytics/dashboard');
            expect(res.status).toBe(401);
        });
    });
    describe('empty school', () => {
        it('returns a well-shaped, all-zero/empty response when there is no data', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
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
    describe('populated dashboard', () => {
        let acadYearA;
        let gradeA;
        let studentA1;
        let studentA2;
        let studentA3Withdrawn;
        beforeEach(async () => {
            acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id);
            gradeA = await (0, factories_1.createGrade)(app, schoolA.id);
            studentA1 = await (0, factories_1.createStudent)(app, schoolA.id, {
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                fullName: 'Student One',
            });
            studentA2 = await (0, factories_1.createStudent)(app, schoolA.id, {
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                fullName: 'Student Two',
            });
            studentA3Withdrawn = await (0, factories_1.createStudent)(app, schoolA.id, {
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                fullName: 'Student Three',
            });
            await (0, test_app_1.getDataSource)(app)
                .getRepository(student_entity_1.Student)
                .update(studentA3Withdrawn.id, { status: student_entity_1.StudentStatus.WITHDRAWN });
            const acadYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
            const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
            await (0, factories_1.createStudent)(app, schoolB.id, { academicYearId: acadYearB.id, gradeId: gradeB.id });
            const plan = await (0, factories_1.createTuitionPlan)(app, {
                studentId: studentA1.id,
                academicYearId: acadYearA.id,
                baseAmount: 20_000_000,
                discountAmount: 0,
            });
            const installment = await (0, factories_1.createInstallment)(app, {
                tuitionPlanId: plan.id,
                amount: 10_000_000,
                paidAmount: 4_000_000,
                status: factories_1.InstallmentStatus.PARTIAL,
            });
            const overdueInstallment = await (0, factories_1.createInstallment)(app, {
                tuitionPlanId: plan.id,
                installmentNumber: 2,
                amount: 10_000_000,
                paidAmount: 0,
                status: factories_1.InstallmentStatus.OVERDUE,
            });
            const payment = await (0, factories_1.createPayment)(app, { installmentId: installment.id, amount: 4_000_000 });
            await (0, factories_1.createLedgerEntry)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                entryType: factories_1.LedgerEntryType.PAYMENT,
                amount: -4_000_000,
                referenceType: factories_1.LedgerReferenceType.PAYMENT,
                referenceId: payment.id,
            });
            void overdueInstallment;
            const now = today();
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                academicYearId: acadYearA.id,
                date: now,
                status: factories_1.AttendanceStatus.PRESENT,
            });
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolA.id,
                studentId: studentA2.id,
                academicYearId: acadYearA.id,
                date: now,
                status: factories_1.AttendanceStatus.ABSENT,
            });
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolA.id,
                studentId: studentA3Withdrawn.id,
                academicYearId: acadYearA.id,
                date: now,
                status: factories_1.AttendanceStatus.LATE,
            });
            const subject = await (0, factories_1.createSubject)(app, schoolA.id, { title: 'Math' });
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                subjectId: subject.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.FIRST_TERM,
                score: 18,
                maxScore: 20,
            });
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA2.id,
                subjectId: subject.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.FIRST_TERM,
                score: 10,
                maxScore: 20,
            });
            await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                createdById: schoolAdminA.id,
                title: 'Welcome',
                targetType: factories_1.AnnouncementTargetType.ALL,
            });
        });
        it('reports correct students totals', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.students.total).toBe(3);
            expect(res.body.students.active).toBe(2);
        });
        it('reports finance totals matching the seeded plan/installments, and overdueAmount matching ReportsService', async () => {
            const [dashboardRes, overdueRes] = await Promise.all([
                (0, supertest_1.default)(server)
                    .get('/api/v1/analytics/dashboard')
                    .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA)),
                (0, supertest_1.default)(server)
                    .get('/api/v1/reports/overdue-summary')
                    .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA)),
            ]);
            expect(dashboardRes.status).toBe(200);
            expect(dashboardRes.body.finance.totalTuition).toBe(20_000_000);
            expect(dashboardRes.body.finance.totalPaid).toBe(4_000_000);
            expect(dashboardRes.body.finance.totalUnpaid).toBe(16_000_000);
            expect(dashboardRes.body.finance.overdueAmount).toBe(overdueRes.body.totalOverdueAmount);
            expect(dashboardRes.body.finance.overdueAmount).toBe(10_000_000);
        });
        it("reports today's attendance counts and a nonzero attendance rate", async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.attendance.presentToday).toBe(1);
            expect(res.body.attendance.absentToday).toBe(1);
            expect(res.body.attendance.lateToday).toBe(1);
            expect(res.body.attendance.attendanceRate).toBeCloseTo(33.33, 1);
        });
        it('reports assessments average/top/lowest students normalized to /20', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.assessments.averageScore).toBeCloseTo(14, 1);
            expect(res.body.assessments.topStudents[0].studentId).toBe(studentA1.id);
            expect(res.body.assessments.topStudents[0].average).toBeCloseTo(18, 1);
            expect(res.body.assessments.lowestStudents[0].studentId).toBe(studentA2.id);
            expect(res.body.assessments.lowestStudents[0].average).toBeCloseTo(10, 1);
        });
        it('lists recent activity across payments/attendance/assessments/announcements', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
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
                (0, supertest_1.default)(server)
                    .get('/api/v1/analytics/dashboard')
                    .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA)),
                (0, supertest_1.default)(server)
                    .get('/api/v1/reports/monthly-income')
                    .query({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 })
                    .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA)),
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
            const statuses = dashboardRes.body.charts.paymentStatusDistribution.map((p) => p.status);
            expect(statuses.sort()).toEqual(['overdue', 'partial']);
        });
        it("never mixes School A's data into School B's dashboard", async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminB));
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
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .query({ recentLimit: 1 })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.recentActivity.assessments).toHaveLength(1);
        });
    });
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
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .query(query)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(400);
        });
        it('rejects unknown extra query fields (forbidNonWhitelisted)', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .query({ foo: 'bar' })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(400);
        });
        it('accepts valid boundary values', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/analytics/dashboard')
                .query({ recentLimit: 20, trendDays: 90, monthsBack: 24 })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.charts.monthlyPayments).toHaveLength(24);
            expect(res.body.charts.attendanceTrend).toHaveLength(90);
        });
    });
});
//# sourceMappingURL=analytics.e2e-spec.js.map