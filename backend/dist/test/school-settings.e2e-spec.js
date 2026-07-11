"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
const school_settings_entity_1 = require("../src/modules/school-settings/entities/school-settings.entity");
describe('School Settings (Phase 5M e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let schoolAdminA;
    let accountantA;
    let staffA;
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
        schoolA = await (0, factories_1.createSchool)(app, {
            name: 'School A',
            address: '123 Main St',
            phone: '02112345678',
        });
        schoolB = await (0, factories_1.createSchool)(app, { name: 'School B' });
        schoolAdminA = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolA.id });
        accountantA = await (0, factories_1.createUser)(app, { role: factories_1.Role.ACCOUNTANT, schoolId: schoolA.id });
        staffA = await (0, factories_1.createUser)(app, { role: factories_1.Role.STAFF, schoolId: schoolA.id });
        teacherA = await (0, factories_1.createUser)(app, { role: factories_1.Role.TEACHER, schoolId: schoolA.id });
        parentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id });
        schoolAdminB = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolB.id });
    });
    describe('GET /settings', () => {
        it('auto-creates and returns default settings the first time', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.schoolId).toBe(schoolA.id);
            expect(res.body.schoolName).toBe('School A');
            expect(res.body.address).toBe('123 Main St');
            expect(res.body.phone).toBe('02112345678');
            expect(res.body.logoUrl).toBeNull();
            expect(res.body.timezone).toBe('Asia/Tehran');
            expect(res.body.language).toBe('fa');
            expect(res.body.currency).toBe('IRR');
            expect(res.body.weekStartsOn).toBe(factories_1.Weekday.SATURDAY);
            expect(res.body.workingDays).toEqual([
                factories_1.Weekday.SATURDAY,
                factories_1.Weekday.SUNDAY,
                factories_1.Weekday.MONDAY,
                factories_1.Weekday.TUESDAY,
                factories_1.Weekday.WEDNESDAY,
            ]);
            expect(res.body.passingScore).toBe(10);
            expect(res.body.attendanceLateMinutes).toBe(15);
            expect(res.body.tuitionReminderDays).toBe(7);
            expect(res.body.smsEnabled).toBe(true);
            expect(res.body.emailEnabled).toBe(false);
            expect(res.body.primaryColor).toBeNull();
            expect(res.body.secondaryColor).toBeNull();
            expect(res.body.createdAt).toBeDefined();
            expect(res.body.updatedAt).toBeDefined();
        });
        it('creates exactly one row per school -- a second GET returns the same row', async () => {
            const first = await (0, supertest_1.default)(server)
                .get('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            const second = await (0, supertest_1.default)(server)
                .get('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(first.status).toBe(200);
            expect(second.status).toBe(200);
            expect(second.body.createdAt).toBe(first.body.createdAt);
            const ds = (0, test_app_1.getDataSource)(app);
            const count = await ds.getRepository(school_settings_entity_1.SchoolSettings).count({ where: { schoolId: schoolA.id } });
            expect(count).toBe(1);
        });
        it('rejects every non-school_admin role', async () => {
            for (const user of [accountantA, staffA, teacherA, parentA]) {
                const res = await (0, supertest_1.default)(server)
                    .get('/api/v1/settings')
                    .set('Authorization', (0, factories_1.authHeader)(app, user));
                expect(res.status).toBe(403);
            }
        });
        it('rejects unauthenticated requests', async () => {
            const res = await (0, supertest_1.default)(server).get('/api/v1/settings');
            expect(res.status).toBe(401);
        });
        it("never returns another school's settings", async () => {
            await (0, factories_1.createSchoolSettings)(app, schoolA.id, { schoolName: 'School A Custom' });
            await (0, factories_1.createSchoolSettings)(app, schoolB.id, { schoolName: 'School B Custom' });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.schoolId).toBe(schoolA.id);
            expect(res.body.schoolName).toBe('School A Custom');
        });
    });
    describe('PUT /settings', () => {
        it('lets school_admin partially update settings', async () => {
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                schoolName: 'Updated School Name',
                website: 'https://example.com',
                primaryColor: '#1A73E8',
                smsEnabled: false,
            });
            expect(res.status).toBe(200);
            expect(res.body.schoolName).toBe('Updated School Name');
            expect(res.body.website).toBe('https://example.com');
            expect(res.body.primaryColor).toBe('#1A73E8');
            expect(res.body.smsEnabled).toBe(false);
            expect(res.body.currency).toBe('IRR');
            expect(res.body.timezone).toBe('Asia/Tehran');
        });
        it('creates the default row first if none exists yet, then applies the update', async () => {
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ currency: 'USD' });
            expect(res.status).toBe(200);
            expect(res.body.currency).toBe('USD');
            expect(res.body.schoolName).toBe('School A');
        });
        it('leaves omitted fields unchanged across repeated updates', async () => {
            await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ schoolName: 'First Update' });
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ currency: 'USD' });
            expect(res.status).toBe(200);
            expect(res.body.currency).toBe('USD');
            expect(res.body.schoolName).toBe('First Update');
        });
        it('clears a nullable field when explicitly sent as null', async () => {
            await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ website: 'https://example.com' });
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ website: null });
            expect(res.status).toBe(200);
            expect(res.body.website).toBeNull();
        });
        it('updates workingDays and weekStartsOn', async () => {
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                weekStartsOn: factories_1.Weekday.MONDAY,
                workingDays: [factories_1.Weekday.MONDAY, factories_1.Weekday.TUESDAY, factories_1.Weekday.WEDNESDAY],
            });
            expect(res.status).toBe(200);
            expect(res.body.weekStartsOn).toBe(factories_1.Weekday.MONDAY);
            expect(res.body.workingDays).toEqual([factories_1.Weekday.MONDAY, factories_1.Weekday.TUESDAY, factories_1.Weekday.WEDNESDAY]);
        });
        it('rejects an invalid email', async () => {
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ email: 'not-an-email' });
            expect(res.status).toBe(400);
        });
        it('rejects an invalid hex color', async () => {
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ primaryColor: 'blue' });
            expect(res.status).toBe(400);
        });
        it('rejects an invalid weekday enum value', async () => {
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ weekStartsOn: 99 });
            expect(res.status).toBe(400);
        });
        it('rejects an out-of-range passingScore', async () => {
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ passingScore: 25 });
            expect(res.status).toBe(400);
        });
        it('rejects an invalid language', async () => {
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ language: 'de' });
            expect(res.status).toBe(400);
        });
        it('rejects unknown fields (whitelist validation)', async () => {
            const res = await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ notAField: 'nope' });
            expect(res.status).toBe(400);
        });
        it('rejects every non-school_admin role', async () => {
            for (const user of [accountantA, staffA, teacherA, parentA]) {
                const res = await (0, supertest_1.default)(server)
                    .put('/api/v1/settings')
                    .set('Authorization', (0, factories_1.authHeader)(app, user))
                    .send({ schoolName: 'Should Not Work' });
                expect(res.status).toBe(403);
            }
        });
        it("never mutates another school's settings", async () => {
            await (0, supertest_1.default)(server)
                .put('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ schoolName: 'School A Renamed' });
            const bRes = await (0, supertest_1.default)(server)
                .get('/api/v1/settings')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminB));
            expect(bRes.status).toBe(200);
            expect(bRes.body.schoolId).toBe(schoolB.id);
            expect(bRes.body.schoolName).toBe('School B');
        });
    });
});
//# sourceMappingURL=school-settings.e2e-spec.js.map