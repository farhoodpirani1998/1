"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
const payment_entity_1 = require("../src/modules/tuition/entities/payment.entity");
const installment_entity_1 = require("../src/modules/tuition/entities/installment.entity");
describe('Payment concurrency (e2e)', () => {
    let app;
    let server;
    let schoolId;
    let adminToken;
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
        const admin = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId });
        adminToken = (0, factories_1.authHeader)(app, admin);
    });
    async function setUpInstallment(amount) {
        const year = await (0, factories_1.createAcademicYear)(app, schoolId);
        const grade = await (0, factories_1.createGrade)(app, schoolId);
        const student = await (0, factories_1.createStudent)(app, schoolId, { academicYearId: year.id, gradeId: grade.id });
        const plan = await (0, factories_1.createTuitionPlan)(app, {
            studentId: student.id,
            academicYearId: year.id,
            baseAmount: amount,
        });
        return (0, factories_1.createInstallment)(app, { tuitionPlanId: plan.id, amount });
    }
    it('never lets two concurrent payments exceed the installment amount', async () => {
        const installment = await setUpInstallment(10_000_000);
        const fire = () => (0, supertest_1.default)(server)
            .post(`/api/v1/installments/${installment.id}/payments`)
            .set('Authorization', adminToken)
            .send({ amount: 7_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
        const [first, second] = await Promise.all([fire(), fire()]);
        const statuses = [first.status, second.status].sort();
        expect(statuses).toEqual([201, 400]);
        const ds = (0, test_app_1.getDataSource)(app);
        const paymentsRepo = ds.getRepository(payment_entity_1.Payment);
        const installmentRepo = ds.getRepository(installment_entity_1.Installment);
        const payments = await paymentsRepo.find({ where: { installmentId: installment.id } });
        expect(payments).toHaveLength(1);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        expect(totalPaid).toBeLessThanOrEqual(10_000_000);
        const fresh = await installmentRepo.findOne({ where: { id: installment.id } });
        expect(Number(fresh.paidAmount)).toBeLessThanOrEqual(10_000_000);
    });
    it('allows two concurrent payments that together exactly fill the installment', async () => {
        const installment = await setUpInstallment(10_000_000);
        const pay = (amount) => (0, supertest_1.default)(server)
            .post(`/api/v1/installments/${installment.id}/payments`)
            .set('Authorization', adminToken)
            .send({ amount, paymentMethod: 'cash', paidAt: '2026-07-01' });
        const [first, second] = await Promise.all([pay(6_000_000), pay(4_000_000)]);
        expect([first.status, second.status].every((s) => s === 201)).toBe(true);
        const ds = (0, test_app_1.getDataSource)(app);
        const installmentRepo = ds.getRepository(installment_entity_1.Installment);
        const fresh = await installmentRepo.findOne({ where: { id: installment.id } });
        expect(Number(fresh.paidAmount)).toBe(10_000_000);
        expect(fresh.status).toBe('paid');
    });
    it('rejects a single payment for more than the remaining balance', async () => {
        const installment = await setUpInstallment(5_000_000);
        const res = await (0, supertest_1.default)(server)
            .post(`/api/v1/installments/${installment.id}/payments`)
            .set('Authorization', adminToken)
            .send({ amount: 5_000_001, paymentMethod: 'cash', paidAt: '2026-07-01' });
        expect(res.status).toBe(400);
    });
    it('does not create a duplicate payment when the same idempotencyKey is reused', async () => {
        const installment = await setUpInstallment(10_000_000);
        const idempotencyKey = 'submit-click-12345';
        const send = () => (0, supertest_1.default)(server)
            .post(`/api/v1/installments/${installment.id}/payments`)
            .set('Authorization', adminToken)
            .send({ amount: 3_000_000, paymentMethod: 'cash', paidAt: '2026-07-01', idempotencyKey });
        const first = await send();
        const second = await send();
        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
        expect(second.body.payment.id).toBe(first.body.payment.id);
        expect(second.body.idempotentReplay).toBe(true);
        const ds = (0, test_app_1.getDataSource)(app);
        const paymentsRepo = ds.getRepository(payment_entity_1.Payment);
        const payments = await paymentsRepo.find({ where: { installmentId: installment.id } });
        expect(payments).toHaveLength(1);
    });
    it('never creates two payment rows when the same idempotencyKey is sent concurrently', async () => {
        const installment = await setUpInstallment(10_000_000);
        const idempotencyKey = 'concurrent-double-click';
        const send = () => (0, supertest_1.default)(server)
            .post(`/api/v1/installments/${installment.id}/payments`)
            .set('Authorization', adminToken)
            .send({ amount: 3_000_000, paymentMethod: 'cash', paidAt: '2026-07-01', idempotencyKey });
        const [first, second] = await Promise.all([send(), send()]);
        expect([first.status, second.status]).toContain(201);
        const ds = (0, test_app_1.getDataSource)(app);
        const paymentsRepo = ds.getRepository(payment_entity_1.Payment);
        const payments = await paymentsRepo.find({ where: { installmentId: installment.id } });
        expect(payments.length).toBe(1);
    });
});
//# sourceMappingURL=payment-concurrency.e2e-spec.js.map