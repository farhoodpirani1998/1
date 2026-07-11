"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Authorization matrix (e2e)', () => {
    let app;
    let server;
    let schoolId;
    let superAdmin;
    let schoolAdmin;
    let accountant;
    let staff;
    let installmentId;
    beforeAll(async () => {
        app = await (0, test_app_1.createTestApp)();
        server = app.getHttpServer();
    });
    afterAll(async () => {
        await (0, test_app_1.closeTestApp)(app);
    });
    beforeEach(async () => {
        await (0, test_app_1.truncateAll)(app);
        const school = await (0, factories_1.createSchool)(app);
        schoolId = school.id;
        superAdmin = await (0, factories_1.createUser)(app, { role: factories_1.Role.SUPER_ADMIN, schoolId: null });
        schoolAdmin = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId });
        accountant = await (0, factories_1.createUser)(app, { role: factories_1.Role.ACCOUNTANT, schoolId });
        staff = await (0, factories_1.createUser)(app, { role: factories_1.Role.STAFF, schoolId });
        const year = await (0, factories_1.createAcademicYear)(app, schoolId);
        const grade = await (0, factories_1.createGrade)(app, schoolId);
        const student = await (0, factories_1.createStudent)(app, schoolId, { academicYearId: year.id, gradeId: grade.id });
        const plan = await (0, factories_1.createTuitionPlan)(app, {
            studentId: student.id,
            academicYearId: year.id,
            baseAmount: 20_000_000,
        });
        const installment = await (0, factories_1.createInstallment)(app, { tuitionPlanId: plan.id, amount: 20_000_000 });
        installmentId = installment.id;
    });
    describe('super_admin: global access', () => {
        it('can create a school (a route no other role can reach at all)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/schools')
                .set('Authorization', (0, factories_1.authHeader)(app, superAdmin))
                .send({ name: 'A Brand New School' });
            expect(res.status).toBe(201);
        });
        it('is rejected by SchoolsController if attempted by school_admin', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/schools')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdmin))
                .send({ name: 'Should Not Be Created' });
            expect(res.status).toBe(403);
        });
        it('bypasses per-route @Roles() restrictions (RolesGuard: super_admin always passes)', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/reports/overdue-summary')
                .set('Authorization', (0, factories_1.authHeader)(app, superAdmin));
            expect(res.status).toBe(200);
        });
    });
    describe('school_admin: own school only', () => {
        it('can manage students within its own school', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/students')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdmin));
            expect(res.status).toBe(200);
        });
        it('cannot reach the super_admin-only SchoolsController at all', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/schools')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdmin));
            expect(res.status).toBe(403);
        });
        it('holds PAYMENT_VOID and can void a payment', async () => {
            const payRes = await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentId}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdmin))
                .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
            expect(payRes.status).toBe(201);
            const voidRes = await (0, supertest_1.default)(server)
                .delete(`/api/v1/payments/${payRes.body.payment.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdmin))
                .send({ reason: 'Recorded against the wrong installment' });
            expect(voidRes.status).toBe(204);
        });
    });
    describe('accountant: financial operations allowed', () => {
        it('can record a payment', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentId}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, accountant))
                .send({ amount: 2_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
            expect(res.status).toBe(201);
        });
        it('can list payments and view reports', async () => {
            const paymentsRes = await (0, supertest_1.default)(server)
                .get('/api/v1/payments')
                .set('Authorization', (0, factories_1.authHeader)(app, accountant));
            expect(paymentsRes.status).toBe(200);
            const reportRes = await (0, supertest_1.default)(server)
                .get('/api/v1/reports/overdue-summary')
                .set('Authorization', (0, factories_1.authHeader)(app, accountant));
            expect(reportRes.status).toBe(200);
        });
        it('cannot void a payment (lacks PAYMENT_VOID; school_admin only)', async () => {
            const payRes = await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentId}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, accountant))
                .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
            const voidRes = await (0, supertest_1.default)(server)
                .delete(`/api/v1/payments/${payRes.body.payment.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, accountant))
                .send({ reason: 'Trying to void without permission' });
            expect(voidRes.status).toBe(403);
        });
    });
    describe('staff: no financial read access', () => {
        it('cannot list payments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/payments')
                .set('Authorization', (0, factories_1.authHeader)(app, staff));
            expect(res.status).toBe(403);
        });
        it('cannot view a payment receipt', async () => {
            const payRes = await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentId}/payments`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdmin))
                .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/payments/${payRes.body.payment.id}/receipt`)
                .set('Authorization', (0, factories_1.authHeader)(app, staff));
            expect(res.status).toBe(403);
        });
        it('cannot list installments or view financial reports', async () => {
            const installmentsRes = await (0, supertest_1.default)(server)
                .get('/api/v1/installments')
                .set('Authorization', (0, factories_1.authHeader)(app, staff));
            expect(installmentsRes.status).toBe(403);
            const reportRes = await (0, supertest_1.default)(server)
                .get('/api/v1/reports/debtor-students')
                .set('Authorization', (0, factories_1.authHeader)(app, staff));
            expect(reportRes.status).toBe(403);
        });
        it('can still manage non-financial student records', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/students')
                .set('Authorization', (0, factories_1.authHeader)(app, staff));
            expect(res.status).toBe(200);
        });
    });
});
//# sourceMappingURL=authorization-matrix.e2e-spec.js.map