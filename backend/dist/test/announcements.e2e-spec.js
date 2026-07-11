"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('School Announcements (Phase 5H e2e)', () => {
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
    describe('POST /announcements', () => {
        it('lets school_admin create an announcement', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                title: 'Holiday Notice',
                message: 'School will be closed next Monday.',
                targetType: factories_1.AnnouncementTargetType.ALL,
            });
            expect(res.status).toBe(201);
            expect(res.body.title).toBe('Holiday Notice');
            expect(res.body.message).toBe('School will be closed next Monday.');
            expect(res.body.targetType).toBe('all');
            expect(res.body.createdById).toBe(schoolAdminA.id);
            expect(res.body.createdAt).toBeDefined();
        });
        it.each([
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
            ['parent', () => parentA],
        ])('rejects %s (not school_admin)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()))
                .send({ title: 'x', message: 'y', targetType: factories_1.AnnouncementTargetType.ALL });
            expect(res.status).toBe(403);
        });
        it('rejects an unauthenticated request', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/announcements')
                .send({ title: 'x', message: 'y', targetType: factories_1.AnnouncementTargetType.ALL });
            expect(res.status).toBe(401);
        });
        it('rejects a missing title', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ message: 'y', targetType: factories_1.AnnouncementTargetType.ALL });
            expect(res.status).toBe(400);
        });
        it('rejects a blank message', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ title: 'x', message: '', targetType: factories_1.AnnouncementTargetType.ALL });
            expect(res.status).toBe(400);
        });
        it('rejects an invalid targetType', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ title: 'x', message: 'y', targetType: 'everyone' });
            expect(res.status).toBe(400);
        });
        it('rejects a title over 200 characters', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ title: 'a'.repeat(201), message: 'y', targetType: factories_1.AnnouncementTargetType.ALL });
            expect(res.status).toBe(400);
        });
        it('rejects unknown extra fields (forbidNonWhitelisted)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                title: 'x',
                message: 'y',
                targetType: factories_1.AnnouncementTargetType.ALL,
                schoolId: schoolB.id,
            });
            expect(res.status).toBe(400);
        });
    });
    describe('GET /announcements', () => {
        it("lists only the caller's own school's announcements, most recent first", async () => {
            const older = await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                title: 'Older',
                targetType: factories_1.AnnouncementTargetType.PARENTS,
            });
            await new Promise((r) => setTimeout(r, 5));
            const newer = await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                title: 'Newer',
                targetType: factories_1.AnnouncementTargetType.TEACHERS,
            });
            await (0, factories_1.createAnnouncement)(app, { schoolId: schoolB.id, title: 'Other School' });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body.map((a) => a.id)).toEqual([newer.id, older.id]);
            expect(res.body.every((a) => a.title !== 'Other School')).toBe(true);
        });
        it.each([
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
            ['parent', () => parentA],
        ])('rejects %s (not school_admin)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
    });
    describe('DELETE /announcements/:id', () => {
        it('lets school_admin delete an announcement in their own school', async () => {
            const announcement = await (0, factories_1.createAnnouncement)(app, { schoolId: schoolA.id });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/announcements/${announcement.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(204);
            const list = await (0, supertest_1.default)(server)
                .get('/api/v1/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(list.body).toHaveLength(0);
        });
        it("404s (not 403) deleting another school's announcement", async () => {
            const announcement = await (0, factories_1.createAnnouncement)(app, { schoolId: schoolB.id });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/announcements/${announcement.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
        it('404s deleting a nonexistent id', async () => {
            const res = await (0, supertest_1.default)(server)
                .delete('/api/v1/announcements/00000000-0000-0000-0000-000000000000')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
        it.each([
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
            ['parent', () => parentA],
        ])('rejects %s (not school_admin)', async (_label, getUser) => {
            const announcement = await (0, factories_1.createAnnouncement)(app, { schoolId: schoolA.id });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/announcements/${announcement.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
    });
    describe('GET /teacher/announcements', () => {
        it("returns only 'all' and 'teachers' announcements from the caller's own school", async () => {
            const all = await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                title: 'All',
                targetType: factories_1.AnnouncementTargetType.ALL,
            });
            const teachers = await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                title: 'Teachers',
                targetType: factories_1.AnnouncementTargetType.TEACHERS,
            });
            await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                title: 'Parents',
                targetType: factories_1.AnnouncementTargetType.PARENTS,
            });
            await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                title: 'Staff',
                targetType: factories_1.AnnouncementTargetType.STAFF,
            });
            await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolB.id,
                title: 'Other School All',
                targetType: factories_1.AnnouncementTargetType.ALL,
            });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(200);
            const ids = res.body.map((a) => a.id).sort();
            expect(ids).toEqual([all.id, teachers.id].sort());
            expect(res.body.every((a) => a.createdById === undefined)).toBe(true);
        });
        it.each([
            ['school_admin', () => schoolAdminA],
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['parent', () => parentA],
        ])('rejects %s (not teacher)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
    });
    describe('GET /parent/announcements', () => {
        it("returns only 'all' and 'parents' announcements from the caller's own school", async () => {
            const all = await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                title: 'All',
                targetType: factories_1.AnnouncementTargetType.ALL,
            });
            const parents = await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                title: 'Parents',
                targetType: factories_1.AnnouncementTargetType.PARENTS,
            });
            await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolA.id,
                title: 'Teachers',
                targetType: factories_1.AnnouncementTargetType.TEACHERS,
            });
            await (0, factories_1.createAnnouncement)(app, {
                schoolId: schoolB.id,
                title: 'Other School Parents',
                targetType: factories_1.AnnouncementTargetType.PARENTS,
            });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/parent/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            const ids = res.body.map((a) => a.id).sort();
            expect(ids).toEqual([all.id, parents.id].sort());
        });
        it.each([
            ['school_admin', () => schoolAdminA],
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
        ])('rejects %s (not parent)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/parent/announcements')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
    });
});
//# sourceMappingURL=announcements.e2e-spec.js.map