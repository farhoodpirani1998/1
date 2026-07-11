"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Student profile (Phase 5D e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let schoolAdminA;
    let accountantA;
    let staffA;
    let schoolAdminB;
    let parentA;
    let otherParentA;
    let parentB;
    let studentA1;
    let studentB1;
    let gradeA;
    let acadYearA;
    let guardianA1;
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
        accountantA = await (0, factories_1.createUser)(app, { role: factories_1.Role.ACCOUNTANT, schoolId: schoolA.id });
        staffA = await (0, factories_1.createUser)(app, { role: factories_1.Role.STAFF, schoolId: schoolA.id });
        schoolAdminB = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolB.id });
        parentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id, fullName: 'Parent A' });
        otherParentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id, fullName: 'Other Parent A' });
        parentB = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolB.id, fullName: 'Parent B' });
        acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id, { title: '1404-1405', isCurrent: true });
        gradeA = await (0, factories_1.createGrade)(app, schoolA.id, { title: 'Grade 7' });
        guardianA1 = await (0, factories_1.createGuardian)(app, schoolA.id, { fullName: 'Guardian A1', phone: '+989111111111' });
        studentA1 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
            guardianId: guardianA1.id,
            fullName: 'Student A1',
        });
        const acadYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
        const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
        studentB1 = await (0, factories_1.createStudent)(app, schoolB.id, {
            academicYearId: acadYearB.id,
            gradeId: gradeB.id,
            fullName: 'Student B1',
        });
        const plan = await (0, factories_1.createTuitionPlan)(app, {
            studentId: studentA1.id,
            academicYearId: acadYearA.id,
            baseAmount: 100_000_000,
            discountAmount: 10_000_000,
        });
        const installment1 = await (0, factories_1.createInstallment)(app, {
            tuitionPlanId: plan.id,
            installmentNumber: 1,
            amount: 45_000_000,
            dueDate: '2026-10-01',
            paidAmount: 45_000_000,
        });
        await (0, factories_1.createInstallment)(app, {
            tuitionPlanId: plan.id,
            installmentNumber: 2,
            amount: 45_000_000,
            dueDate: '2026-12-01',
            paidAmount: 0,
        });
        await (0, factories_1.createPayment)(app, {
            installmentId: installment1.id,
            amount: 45_000_000,
            paidAt: new Date('2026-09-15T10:00:00Z'),
        });
        await (0, factories_1.linkParentStudent)(app, parentA.id, studentA1.id);
    });
    describe('GET /students/:id/profile (school_admin)', () => {
        it('returns the full profile for school_admin', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.student).toEqual(expect.objectContaining({ id: studentA1.id, fullName: 'Student A1' }));
            expect(res.body.school).toEqual({ id: schoolA.id, name: 'School A' });
            expect(res.body.grade).toEqual({ id: gradeA.id, title: 'Grade 7' });
            expect(res.body.academicYear).toEqual(expect.objectContaining({ id: acadYearA.id, title: '1404-1405', isCurrent: true }));
        });
        it('includes both the guardian and any linked parent-portal accounts in parents[]', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            const types = res.body.parents.map((p) => p.type).sort();
            expect(types).toEqual(['guardian', 'parent_account']);
            expect(res.body.parents).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: guardianA1.id, fullName: 'Guardian A1', type: 'guardian' }),
                expect.objectContaining({ id: parentA.id, fullName: 'Parent A', type: 'parent_account' }),
            ]));
        });
        it('returns an accurate tuition summary', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.tuitionSummary).toEqual(expect.objectContaining({
                totalDue: 90_000_000,
                totalPaid: 45_000_000,
                totalRemaining: 45_000_000,
            }));
            expect(res.body.tuitionSummary.plans).toHaveLength(1);
            expect(res.body.tuitionSummary.plans[0]).toEqual(expect.objectContaining({
                baseAmount: 100_000_000,
                discountAmount: 10_000_000,
                finalAmount: 90_000_000,
                installmentCount: 2,
            }));
        });
        it('returns an accurate payment summary', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.paymentSummary).toEqual(expect.objectContaining({
                totalPayments: 1,
                totalAmountPaid: 45_000_000,
            }));
            expect(res.body.paymentSummary.lastPaymentAt).toBeTruthy();
            expect(res.body.paymentSummary.recentPayments).toHaveLength(1);
            expect(res.body.paymentSummary.recentPayments[0]).toEqual(expect.objectContaining({ amount: 45_000_000 }));
        });
        it('returns empty future-ready sections', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            for (const key of ['documents', 'announcements']) {
                expect(res.body[key]).toEqual({ available: false, records: [] });
            }
            expect(res.body.attendance).toEqual({ available: true, records: [] });
            expect(res.body.assessments).toEqual(expect.objectContaining({ available: true, records: [] }));
            expect(res.body.assessments.reportSummary.overallAverage).toBeNull();
        });
        it('allows accountant', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, accountantA));
            expect(res.status).toBe(200);
        });
        it('rejects staff (no financial access, same gate as /reports/student/:id/statement)', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, staffA));
            expect(res.status).toBe(403);
        });
        it('rejects parent role on the school_admin-side endpoint', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(403);
        });
        it('returns 404 when School A admin reads School B student (tenant isolation)', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentB1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
        it("does not leak School B's student even to its own admin cross-checking a foreign id incorrectly", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminB));
            expect(res.status).toBe(404);
        });
        it('returns 404 for a non-existent student', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${fakeId}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
        it('returns 401 without authentication', async () => {
            const res = await (0, supertest_1.default)(server).get(`/api/v1/students/${studentA1.id}/profile`);
            expect(res.status).toBe(401);
        });
    });
    describe('GET /parent/students/:id/profile', () => {
        it('allows a parent to view the profile of their linked child', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body.student).toEqual(expect.objectContaining({ id: studentA1.id, fullName: 'Student A1' }));
            expect(res.body.tuitionSummary).toEqual(expect.objectContaining({
                totalDue: 90_000_000,
                totalPaid: 45_000_000,
                totalRemaining: 45_000_000,
            }));
        });
        it('returns empty future-ready sections for parents too', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            for (const key of ['documents', 'announcements']) {
                expect(res.body[key]).toEqual({ available: false, records: [] });
            }
            expect(res.body.attendance).toEqual({ available: true, records: [] });
            expect(res.body.assessments).toEqual(expect.objectContaining({ available: true, records: [] }));
        });
        it('denies a parent access to a student they are not linked to (same school)', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, otherParentA));
            expect(res.status).toBe(404);
        });
        it('denies a parent access to a student from a different school', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
        it('returns 404 for a non-existent student', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${fakeId}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(404);
        });
        it('rejects non-parent roles', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(403);
        });
        it('returns 401 without authentication', async () => {
            const res = await (0, supertest_1.default)(server).get(`/api/v1/parent/students/${studentA1.id}/profile`);
            expect(res.status).toBe(401);
        });
    });
});
//# sourceMappingURL=student-profile.e2e-spec.js.map