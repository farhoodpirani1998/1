"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('DTO validation (e2e)', () => {
    let app;
    let server;
    let schoolId;
    let adminToken;
    let academicYearId;
    let gradeId;
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
        academicYearId = year.id;
        gradeId = grade.id;
        const student = await (0, factories_1.createStudent)(app, schoolId, { academicYearId, gradeId });
        studentId = student.id;
    });
    describe('invalid DTO values are rejected', () => {
        it('rejects a negative baseAmount on tuition plan creation', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({ studentId, academicYearId, baseAmount: -1 });
            expect(res.status).toBe(400);
        });
        it('rejects an unknown paymentMethod enum value', async () => {
            const planRes = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({ studentId, academicYearId, baseAmount: 10_000_000 });
            const genRes = await (0, supertest_1.default)(server)
                .post(`/api/v1/tuition-plans/${planRes.body.id}/installments/generate`)
                .set('Authorization', adminToken)
                .send({ count: 1, startDate: '2026-09-01', intervalDays: 30 });
            const installmentId = genRes.body[0].id;
            const payRes = await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentId}/payments`)
                .set('Authorization', adminToken)
                .send({ amount: 1000, paymentMethod: 'bitcoin', paidAt: '2026-07-01' });
            expect(payRes.status).toBe(400);
        });
        it('rejects a GenerateInstallmentsDto count above the max (24)', async () => {
            const planRes = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({ studentId, academicYearId, baseAmount: 10_000_000 });
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/tuition-plans/${planRes.body.id}/installments/generate`)
                .set('Authorization', adminToken)
                .send({ count: 25, startDate: '2026-09-01' });
            expect(res.status).toBe(400);
        });
        it('rejects an unparseable paidAt date string', async () => {
            const planRes = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({ studentId, academicYearId, baseAmount: 10_000_000 });
            const genRes = await (0, supertest_1.default)(server)
                .post(`/api/v1/tuition-plans/${planRes.body.id}/installments/generate`)
                .set('Authorization', adminToken)
                .send({ count: 1, startDate: '2026-09-01' });
            const installmentId = genRes.body[0].id;
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/installments/${installmentId}/payments`)
                .set('Authorization', adminToken)
                .send({ amount: 1000, paymentMethod: 'cash', paidAt: 'not-a-date' });
            expect(res.status).toBe(400);
        });
    });
    describe('missing required fields are rejected', () => {
        it('rejects a tuition plan with no studentId', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({ academicYearId, baseAmount: 10_000_000 });
            expect(res.status).toBe(400);
        });
        it('rejects a tuition plan with no baseAmount', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({ studentId, academicYearId });
            expect(res.status).toBe(400);
        });
        it('rejects a student with neither guardianId nor newGuardian', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/students')
                .set('Authorization', adminToken)
                .send({ academicYearId, gradeId, fullName: 'No Guardian Student' });
            expect(res.status).toBe(400);
        });
        it('rejects a login with no password', async () => {
            const res = await (0, supertest_1.default)(server).post('/api/v1/auth/login').send({ phone: '+989120000000' });
            expect(res.status).toBe(400);
        });
    });
    describe('malformed UUIDs are rejected', () => {
        it('rejects a non-UUID studentId on tuition plan creation', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({ studentId: 'not-a-uuid', academicYearId, baseAmount: 10_000_000 });
            expect(res.status).toBe(400);
        });
        it('rejects a non-UUID academicYearId on student creation', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/students')
                .set('Authorization', adminToken)
                .send({
                academicYearId: '12345',
                gradeId,
                fullName: 'Bad Year Student',
                guardianId: undefined,
                newGuardian: { fullName: 'A Guardian', phone: '+989120000001' },
            });
            expect(res.status).toBe(400);
        });
        it('a well-formed but non-existent UUID is a clean 404, not a 500', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/tuition-plans/00000000-0000-0000-0000-000000000000')
                .set('Authorization', adminToken);
            expect(res.status).toBe(404);
        });
    });
    describe('unknown fields are stripped/rejected (forbidNonWhitelisted)', () => {
        it('rejects a request body with a field not declared on the DTO', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/tuition-plans')
                .set('Authorization', adminToken)
                .send({
                studentId,
                academicYearId,
                baseAmount: 10_000_000,
                notARealField: 'should cause a 400',
            });
            expect(res.status).toBe(400);
        });
    });
});
//# sourceMappingURL=validation.e2e-spec.js.map