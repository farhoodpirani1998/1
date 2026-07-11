"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Tuition plan -> installment workflow (e2e)', () => {
    let app;
    let server;
    let schoolId;
    let adminToken;
    let academicYearId;
    let studentId;
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
        const year = await (0, factories_1.createAcademicYear)(app, schoolId);
        const grade = await (0, factories_1.createGrade)(app, schoolId);
        const student = await (0, factories_1.createStudent)(app, schoolId, { academicYearId: year.id, gradeId: grade.id });
        academicYearId = year.id;
        studentId = student.id;
    });
    it('creates a tuition plan with finalAmount = baseAmount - discountAmount', async () => {
        const res = await (0, supertest_1.default)(server)
            .post('/api/v1/tuition-plans')
            .set('Authorization', adminToken)
            .send({ studentId, academicYearId, baseAmount: 100_000_000, discountAmount: 5_000_000 });
        expect(res.status).toBe(201);
        expect(res.body.baseAmount).toBe('100000000');
        expect(res.body.discountAmount).toBe('5000000');
        expect(res.body.finalAmount).toBe('95000000');
    });
    it('rejects a second tuition plan for the same student + academic year', async () => {
        const first = await (0, supertest_1.default)(server)
            .post('/api/v1/tuition-plans')
            .set('Authorization', adminToken)
            .send({ studentId, academicYearId, baseAmount: 100_000_000 });
        expect(first.status).toBe(201);
        const duplicate = await (0, supertest_1.default)(server)
            .post('/api/v1/tuition-plans')
            .set('Authorization', adminToken)
            .send({ studentId, academicYearId, baseAmount: 50_000_000 });
        expect(duplicate.status).toBe(400);
    });
    it('rejects a discount greater than the base amount', async () => {
        const res = await (0, supertest_1.default)(server)
            .post('/api/v1/tuition-plans')
            .set('Authorization', adminToken)
            .send({ studentId, academicYearId, baseAmount: 10_000_000, discountAmount: 10_000_001 });
        expect(res.status).toBe(400);
    });
    describe('once a plan exists', () => {
        let planId;
        let finalAmount;
        beforeEach(async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({ studentId, academicYearId, baseAmount: 100_000_000, discountAmount: 1_000_000 });
            planId = res.body.id;
            finalAmount = Number(res.body.finalAmount);
        });
        it('generates installments whose count matches the request', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/tuition-plans/${planId}/installments/generate`)
                .set('Authorization', adminToken)
                .send({ count: 4, startDate: '2026-09-01', intervalDays: 30 });
            expect(res.status).toBe(201);
            expect(res.body).toHaveLength(4);
        });
        it('splits an amount that does not divide evenly, with the sum still matching finalAmount exactly', async () => {
            const planRes = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({
                studentId,
                academicYearId: (await (0, factories_1.createAcademicYear)(app, schoolId)).id,
                baseAmount: 100_000_001,
            });
            const oddPlanId = planRes.body.id;
            const oddFinalAmount = Number(planRes.body.finalAmount);
            const genRes = await (0, supertest_1.default)(server)
                .post(`/api/v1/tuition-plans/${oddPlanId}/installments/generate`)
                .set('Authorization', adminToken)
                .send({ count: 3, startDate: '2026-09-01', intervalDays: 30 });
            expect(genRes.status).toBe(201);
            const sum = genRes.body.reduce((acc, i) => acc + Number(i.amount), 0);
            expect(sum).toBe(oddFinalAmount);
        });
        it('sums installment amounts to exactly the plan finalAmount', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/tuition-plans/${planId}/installments/generate`)
                .set('Authorization', adminToken)
                .send({ count: 6, startDate: '2026-09-01', intervalDays: 30 });
            const sum = res.body.reduce((acc, i) => acc + Number(i.amount), 0);
            expect(sum).toBe(finalAmount);
        });
        it('rejects generating installments twice for the same plan', async () => {
            const first = await (0, supertest_1.default)(server)
                .post(`/api/v1/tuition-plans/${planId}/installments/generate`)
                .set('Authorization', adminToken)
                .send({ count: 2, startDate: '2026-09-01', intervalDays: 30 });
            expect(first.status).toBe(201);
            const second = await (0, supertest_1.default)(server)
                .post(`/api/v1/tuition-plans/${planId}/installments/generate`)
                .set('Authorization', adminToken)
                .send({ count: 2, startDate: '2026-09-01', intervalDays: 30 });
            expect(second.status).toBe(400);
        });
        describe('status overrides', () => {
            let installmentId;
            beforeEach(async () => {
                const genRes = await (0, supertest_1.default)(server)
                    .post(`/api/v1/tuition-plans/${planId}/installments/generate`)
                    .set('Authorization', adminToken)
                    .send({ count: 1, startDate: '2026-09-01', intervalDays: 30 });
                installmentId = genRes.body[0].id;
            });
            it('allows a valid manual transition (pending -> cancelled)', async () => {
                const res = await (0, supertest_1.default)(server)
                    .patch(`/api/v1/installments/${installmentId}/status`)
                    .set('Authorization', adminToken)
                    .send({ status: 'cancelled', reason: 'Student withdrew mid-term' });
                expect(res.status).toBe(200);
                expect(res.body.status).toBe('cancelled');
            });
            it('rejects an illegal transition out of a terminal state (cancelled -> pending)', async () => {
                const cancel = await (0, supertest_1.default)(server)
                    .patch(`/api/v1/installments/${installmentId}/status`)
                    .set('Authorization', adminToken)
                    .send({ status: 'cancelled', reason: 'Student withdrew mid-term' });
                expect(cancel.status).toBe(200);
                const reinstate = await (0, supertest_1.default)(server)
                    .patch(`/api/v1/installments/${installmentId}/status`)
                    .set('Authorization', adminToken)
                    .send({ status: 'pending', reason: 'Attempting to reinstate a cancelled installment' });
                expect(reinstate.status).toBe(400);
            });
            it('rejects paying an installment that was manually cancelled', async () => {
                await (0, supertest_1.default)(server)
                    .patch(`/api/v1/installments/${installmentId}/status`)
                    .set('Authorization', adminToken)
                    .send({ status: 'cancelled', reason: 'Student withdrew mid-term' });
                const payRes = await (0, supertest_1.default)(server)
                    .post(`/api/v1/installments/${installmentId}/payments`)
                    .set('Authorization', adminToken)
                    .send({ amount: 1000, paymentMethod: 'cash', paidAt: '2026-07-01' });
                expect(payRes.status).toBe(400);
            });
        });
    });
});
//# sourceMappingURL=tuition-workflow.e2e-spec.js.map