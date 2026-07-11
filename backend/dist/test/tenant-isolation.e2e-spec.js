"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Tenant isolation (e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let adminA;
    let adminB;
    let studentB;
    let planB;
    let installmentB;
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
        adminA = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolA.id });
        adminB = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolB.id });
        const academicYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
        const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
        studentB = await (0, factories_1.createStudent)(app, schoolB.id, {
            academicYearId: academicYearB.id,
            gradeId: gradeB.id,
        });
        planB = await (0, factories_1.createTuitionPlan)(app, {
            studentId: studentB.id,
            academicYearId: academicYearB.id,
            baseAmount: 100_000_000,
        });
        installmentB = await (0, factories_1.createInstallment)(app, { tuitionPlanId: planB.id, amount: 100_000_000 });
    });
    describe('TuitionPlan access', () => {
        it('returns 404 when School A reads School B tuition plan by (real, guessed) UUID', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/tuition-plans/${planB.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA));
            expect(res.status).toBe(404);
        });
        it('returns 403 when School A updates School B tuition plan', async () => {
            const res = await (0, supertest_1.default)(server)
                .patch(`/api/v1/tuition-plans/${planB.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA))
                .send({ discountAmount: 1000 });
            expect(res.status).toBe(403);
        });
        it("allows School B's own admin to read its own plan", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/tuition-plans/${planB.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminB));
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(planB.id);
        });
    });
    describe('Installment generation', () => {
        it("returns 403 when School A generates installments for School B's plan", async () => {
            const academicYearB2 = await (0, factories_1.createAcademicYear)(app, schoolB.id);
            const student2 = await (0, factories_1.createStudent)(app, schoolB.id, { academicYearId: academicYearB2.id });
            const plan2 = await (0, factories_1.createTuitionPlan)(app, {
                studentId: student2.id,
                academicYearId: academicYearB2.id,
                baseAmount: 60_000_000,
            });
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/tuition-plans/${plan2.id}/installments/generate`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA))
                .send({ count: 3, startDate: '2026-09-01', intervalDays: 30 });
            expect(res.status).toBe(403);
        });
        it('returns 404 when School A reads a School B installment by UUID', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/installments/${installmentB.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA));
            expect(res.status).toBe(404);
        });
        it('returns 404 when School A updates a School B installment', async () => {
            const res = await (0, supertest_1.default)(server)
                .patch(`/api/v1/installments/${installmentB.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA))
                .send({ amount: 1 });
            expect(res.status).toBe(404);
        });
    });
    describe('Student relations', () => {
        it('returns 404 when School A reads School B student by UUID', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentB.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA));
            expect(res.status).toBe(404);
        });
        it('returns 404 when School A updates School B student', async () => {
            const res = await (0, supertest_1.default)(server)
                .patch(`/api/v1/students/${studentB.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA))
                .send({ fullName: 'Renamed' });
            expect(res.status).toBe(404);
        });
        it("School A's student list never includes School B students", async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/students')
                .set('Authorization', (0, factories_1.authHeader)(app, adminA));
            expect(res.status).toBe(200);
            expect(res.body.find((s) => s.id === studentB.id)).toBeUndefined();
        });
    });
    describe('Payments', () => {
        it("returns 403 when School A pays School B's installment", async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentB.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA))
                .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
            expect(res.status).toBe(403);
        });
        it("returns 404 when School A fetches School B's payment receipt", async () => {
            const paymentRes = await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentB.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminB))
                .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
            expect(paymentRes.status).toBe(201);
            const paymentId = paymentRes.body.payment.id;
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/payments/${paymentId}/receipt`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA));
            expect(res.status).toBe(404);
        });
        it("School A's payment list never includes School B payments", async () => {
            await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentB.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminB))
                .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/payments')
                .set('Authorization', (0, factories_1.authHeader)(app, adminA));
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });
    describe('Reports', () => {
        it("returns 404 when School A requests School B's student statement", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/reports/student/${studentB.id}/statement`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminA));
            expect(res.status).toBe(404);
        });
        it("School A's debtor-students report never includes School B students", async () => {
            await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentB.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminB))
                .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/reports/debtor-students')
                .set('Authorization', (0, factories_1.authHeader)(app, adminA));
            expect(res.status).toBe(200);
            expect(res.body.find((d) => d.studentId === studentB.id)).toBeUndefined();
        });
        it("School A's monthly-income report never counts School B's payments", async () => {
            await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentB.id}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, adminB))
                .send({ amount: 5_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/reports/monthly-income?year=2026&month=7')
                .set('Authorization', (0, factories_1.authHeader)(app, adminA));
            expect(res.status).toBe(200);
            expect(res.body.totalIncome).toBe(0);
        });
    });
});
//# sourceMappingURL=tenant-isolation.e2e-spec.js.map