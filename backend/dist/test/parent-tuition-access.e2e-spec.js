"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Parent tuition & payment access (Phase 5B e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let parentA;
    let parentB;
    let studentA1;
    let studentA2;
    let studentB1;
    let planA1;
    let planA2;
    let planB1;
    let installmentA1;
    let installmentA2;
    let installmentB1;
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
        parentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id, fullName: 'Parent A' });
        parentB = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolB.id, fullName: 'Parent B' });
        const acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id);
        const gradeA = await (0, factories_1.createGrade)(app, schoolA.id);
        studentA1 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
            fullName: 'Student A1',
        });
        studentA2 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
            fullName: 'Student A2',
        });
        const acadYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
        const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
        studentB1 = await (0, factories_1.createStudent)(app, schoolB.id, {
            academicYearId: acadYearB.id,
            gradeId: gradeB.id,
            fullName: 'Student B1',
        });
        planA1 = await (0, factories_1.createTuitionPlan)(app, {
            studentId: studentA1.id,
            academicYearId: acadYearA.id,
            baseAmount: 100_000_000,
            discountAmount: 10_000_000,
        });
        planA2 = await (0, factories_1.createTuitionPlan)(app, {
            studentId: studentA2.id,
            academicYearId: acadYearA.id,
            baseAmount: 100_000_000,
            discountAmount: 0,
        });
        planB1 = await (0, factories_1.createTuitionPlan)(app, {
            studentId: studentB1.id,
            academicYearId: acadYearB.id,
            baseAmount: 80_000_000,
            discountAmount: 5_000_000,
        });
        installmentA1 = await (0, factories_1.createInstallment)(app, {
            tuitionPlanId: planA1.id,
            installmentNumber: 1,
            amount: 30_000_000,
            dueDate: '2026-10-01',
            paidAmount: 0,
        });
        installmentA2 = await (0, factories_1.createInstallment)(app, {
            tuitionPlanId: planA2.id,
            installmentNumber: 1,
            amount: 25_000_000,
            dueDate: '2026-10-15',
            paidAmount: 0,
        });
        installmentB1 = await (0, factories_1.createInstallment)(app, {
            tuitionPlanId: planB1.id,
            installmentNumber: 1,
            amount: 25_000_000,
            dueDate: '2026-11-01',
            paidAmount: 0,
        });
        await (0, factories_1.linkParentStudent)(app, parentA.id, studentA1.id);
        await (0, factories_1.linkParentStudent)(app, parentA.id, studentA2.id);
        await (0, factories_1.linkParentStudent)(app, parentB.id, studentB1.id);
    });
    describe('GET /parent/students/:id/tuition', () => {
        it('allows parent to view tuition plan for linked student', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({
                id: planA1.id,
                baseAmount: 100_000_000,
                discountAmount: 10_000_000,
                finalAmount: 90_000_000,
            }));
        });
        it('returns correct academic year title', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body.academicYearTitle).toBeDefined();
        });
        it('denies parent access to unlinked student tuition', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA2.id}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
        it('denies parent access to student from different school', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentB1.id}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(404);
        });
        it('returns 404 for non-existent student', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${fakeId}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(404);
        });
        it('returns 401 without authentication', async () => {
            const res = await (0, supertest_1.default)(server).get(`/parent/students/${studentA1.id}/tuition`);
            expect(res.status).toBe(401);
        });
    });
    describe('GET /parent/students/:id/installments', () => {
        it('allows parent to view installments for linked student', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toEqual(expect.objectContaining({
                id: installmentA1.id,
                amount: 30_000_000,
                paidAmount: 0,
                remainingAmount: 30_000_000,
                status: 'pending',
            }));
        });
        it('calculates remaining amount correctly', async () => {
            const payment = await (0, factories_1.createPayment)(app, {
                installmentId: installmentA1.id,
                amount: 10_000_000,
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            const installment = res.body[0];
            expect(installment.paidAmount).toBeGreaterThan(0);
            expect(installment.remainingAmount).toBeLessThan(30_000_000);
        });
        it('denies parent access to unlinked student installments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA2.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
        it('denies access to student from different school', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentB1.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(404);
        });
        it('returns empty array when student has no installments', async () => {
            const acadYear = await (0, factories_1.createAcademicYear)(app, schoolA.id);
            const grade = await (0, factories_1.createGrade)(app, schoolA.id);
            const newStudent = await (0, factories_1.createStudent)(app, schoolA.id, {
                academicYearId: acadYear.id,
                gradeId: grade.id,
            });
            await (0, factories_1.linkParentStudent)(app, parentA.id, newStudent.id);
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${newStudent.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });
    describe('GET /parent/students/:id/payments', () => {
        it('returns empty payment history when no payments made', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
        it('allows parent to view payment history for linked student', async () => {
            const payment = await (0, factories_1.createPayment)(app, {
                installmentId: installmentA1.id,
                amount: 15_000_000,
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
            expect(res.body[0]).toEqual(expect.objectContaining({
                id: payment.id,
                amount: 15_000_000,
                paymentMethod: 'cash',
            }));
        });
        it('returns payments sorted by date (most recent first)', async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const payment1 = await (0, factories_1.createPayment)(app, {
                installmentId: installmentA1.id,
                amount: 10_000_000,
                paidAt: yesterday,
            });
            const payment2 = await (0, factories_1.createPayment)(app, {
                installmentId: installmentA1.id,
                amount: 20_000_000,
                paidAt: now,
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            if (res.body.length > 1) {
                const firstPaymentTime = new Date(res.body[0].paidAt).getTime();
                const secondPaymentTime = new Date(res.body[1].paidAt).getTime();
                expect(firstPaymentTime).toBeGreaterThanOrEqual(secondPaymentTime);
            }
        });
        it('denies parent access to unlinked student payments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA2.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
        it('denies access to student from different school', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentB1.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(404);
        });
        it('includes receipt number in payment view', async () => {
            const payment = await (0, factories_1.createPayment)(app, {
                installmentId: installmentA1.id,
                amount: 5_000_000,
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body[0]).toHaveProperty('receiptNumber');
        });
    });
    describe('Tenant isolation for tuition access', () => {
        it('parent from school A cannot access school B student tuition', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentB1.id}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(404);
        });
        it('parent from school B cannot access school A student tuition', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
        it('parent from school A cannot access school B student installments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentB1.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(404);
        });
        it('parent from school B cannot access school A student installments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
        it('parent from school A cannot access school B student payments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentB1.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(404);
        });
        it('parent from school B cannot access school A student payments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
    });
    describe('Authorization checks', () => {
        it('only parent role can access /parent/students/:id/tuition', async () => {
            const admin = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolA.id });
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, admin));
            expect(res.status).toBe(403);
        });
        it('only parent role can access /parent/students/:id/installments', async () => {
            const admin = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolA.id });
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, admin));
            expect(res.status).toBe(403);
        });
        it('only parent role can access /parent/students/:id/payments', async () => {
            const admin = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolA.id });
            const res = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, admin));
            expect(res.status).toBe(403);
        });
    });
    describe('Multiple students per parent', () => {
        it('parent can access both linked students tuition', async () => {
            const res1 = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            const res2 = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA2.id}/tuition`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
            expect(res1.body.id).toBe(planA1.id);
            expect(res2.body.id).toBe(planA2.id);
        });
        it('parent can access both linked students installments', async () => {
            const res1 = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA1.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            const res2 = await (0, supertest_1.default)(server)
                .get(`/parent/students/${studentA2.id}/installments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
            expect(res1.body).toHaveLength(1);
            expect(res2.body).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=parent-tuition-access.e2e-spec.js.map