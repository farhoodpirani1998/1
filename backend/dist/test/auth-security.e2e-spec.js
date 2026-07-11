"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
const user_entity_1 = require("../src/modules/users/entities/user.entity");
const school_entity_1 = require("../src/modules/schools/entities/school.entity");
describe('Auth security (e2e)', () => {
    let app;
    let server;
    beforeAll(async () => {
        app = await (0, test_app_1.createTestApp)();
        server = app.getHttpServer();
    });
    afterAll(async () => {
        await (0, test_app_1.closeTestApp)(app);
    });
    beforeEach(async () => {
        await (0, test_app_1.truncateAll)(app);
    });
    it('rejects a JWT issued before a password change (tokenVersion bump)', async () => {
        const school = await (0, factories_1.createSchool)(app);
        const user = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: school.id });
        const loginRes = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/login')
            .send({ phone: user.phone, password: factories_1.TEST_PASSWORD });
        expect(loginRes.status).toBe(200);
        const oldToken = loginRes.body.accessToken;
        const before = await (0, supertest_1.default)(server)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${oldToken}`);
        expect(before.status).toBe(200);
        const changeRes = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${oldToken}`)
            .send({ currentPassword: factories_1.TEST_PASSWORD, newPassword: 'BrandNewPassw0rd!' });
        expect(changeRes.status).toBe(200);
        const after = await (0, supertest_1.default)(server)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${oldToken}`);
        expect(after.status).toBe(401);
        const reloginRes = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/login')
            .send({ phone: user.phone, password: 'BrandNewPassw0rd!' });
        expect(reloginRes.status).toBe(200);
        const withNewToken = await (0, supertest_1.default)(server)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${reloginRes.body.accessToken}`);
        expect(withNewToken.status).toBe(200);
    });
    it('rejects a valid JWT once the user has been deactivated', async () => {
        const school = await (0, factories_1.createSchool)(app);
        const user = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: school.id });
        const loginRes = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/login')
            .send({ phone: user.phone, password: factories_1.TEST_PASSWORD });
        const token = loginRes.body.accessToken;
        const before = await (0, supertest_1.default)(server)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${token}`);
        expect(before.status).toBe(200);
        const ds = (0, test_app_1.getDataSource)(app);
        await ds.getRepository(user_entity_1.User).update({ id: user.id }, { isActive: false });
        const after = await (0, supertest_1.default)(server)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(401);
    });
    it('rejects a valid JWT once the user is deactivated mid-session (no re-login needed to revoke)', async () => {
        const school = await (0, factories_1.createSchool)(app);
        const user = await (0, factories_1.createUser)(app, { role: factories_1.Role.ACCOUNTANT, schoolId: school.id });
        const loginRes = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/login')
            .send({ phone: user.phone, password: factories_1.TEST_PASSWORD });
        const token = loginRes.body.accessToken;
        const ds = (0, test_app_1.getDataSource)(app);
        await ds.getRepository(user_entity_1.User).update({ id: user.id }, { isActive: false });
        const res = await (0, supertest_1.default)(server)
            .get('/api/v1/payments')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
    });
    it("rejects a valid JWT once the user's school has been deactivated", async () => {
        const school = await (0, factories_1.createSchool)(app);
        const user = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: school.id });
        const loginRes = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/login')
            .send({ phone: user.phone, password: factories_1.TEST_PASSWORD });
        const token = loginRes.body.accessToken;
        const before = await (0, supertest_1.default)(server)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${token}`);
        expect(before.status).toBe(200);
        const ds = (0, test_app_1.getDataSource)(app);
        await ds.getRepository(school_entity_1.School).update({ id: school.id }, { isActive: false });
        const after = await (0, supertest_1.default)(server)
            .get('/api/v1/students')
            .set('Authorization', `Bearer ${token}`);
        expect(after.status).toBe(401);
    });
    it('refuses to issue a new token via login once the school is inactive', async () => {
        const school = await (0, factories_1.createSchool)(app, { isActive: false });
        const user = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: school.id });
        const res = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/login')
            .send({ phone: user.phone, password: factories_1.TEST_PASSWORD });
        expect(res.status).toBe(401);
    });
    it('refuses to issue a new token via login for a deactivated user', async () => {
        const school = await (0, factories_1.createSchool)(app);
        const user = await (0, factories_1.createUser)(app, { role: factories_1.Role.STAFF, schoolId: school.id, isActive: false });
        const res = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/login')
            .send({ phone: user.phone, password: factories_1.TEST_PASSWORD });
        expect(res.status).toBe(401);
    });
    it('rejects change-password with the wrong current password', async () => {
        const school = await (0, factories_1.createSchool)(app);
        const user = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: school.id });
        const loginRes = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/login')
            .send({ phone: user.phone, password: factories_1.TEST_PASSWORD });
        const res = await (0, supertest_1.default)(server)
            .post('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
            .send({ currentPassword: 'totally-wrong-password', newPassword: 'AnotherNewPassw0rd!' });
        expect(res.status).toBe(400);
    });
});
//# sourceMappingURL=auth-security.e2e-spec.js.map