"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Global Search (Phase 5N e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let schoolAdminA;
    let accountantA;
    let staffA;
    let teacherA;
    let parentUserA;
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
        accountantA = await (0, factories_1.createUser)(app, { role: factories_1.Role.ACCOUNTANT, schoolId: schoolA.id });
        staffA = await (0, factories_1.createUser)(app, { role: factories_1.Role.STAFF, schoolId: schoolA.id });
        teacherA = await (0, factories_1.createUser)(app, {
            role: factories_1.Role.TEACHER,
            schoolId: schoolA.id,
            fullName: 'Reza Karimi',
        });
        parentUserA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id });
        schoolAdminB = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolB.id });
        const acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id);
        const gradeA = await (0, factories_1.createGrade)(app, schoolA.id);
        const guardianA = await (0, factories_1.createGuardian)(app, schoolA.id, { fullName: 'Karim Ahmadi' });
        await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
            guardianId: guardianA.id,
            fullName: 'Karimzadeh Ali',
        });
        const subjectA = await (0, factories_1.createSubject)(app, schoolA.id, { title: 'Karimi Literature' });
        await (0, factories_1.createTeacherAssignment)(app, {
            schoolId: schoolA.id,
            teacherId: teacherA.id,
            gradeId: gradeA.id,
            subjectId: subjectA.id,
        });
        await (0, factories_1.createHomework)(app, {
            schoolId: schoolA.id,
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
            subjectId: subjectA.id,
            teacherId: teacherA.id,
            title: 'Karimi Poems Essay',
        });
        await (0, factories_1.createAnnouncement)(app, {
            schoolId: schoolA.id,
            title: 'Karimi Exam Schedule',
            targetType: factories_1.AnnouncementTargetType.ALL,
            createdById: schoolAdminA.id,
        });
        const acadYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
        const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
        const guardianB = await (0, factories_1.createGuardian)(app, schoolB.id, { fullName: 'Karimi Guardian B' });
        await (0, factories_1.createStudent)(app, schoolB.id, {
            academicYearId: acadYearB.id,
            gradeId: gradeB.id,
            guardianId: guardianB.id,
            fullName: 'Karimi Student B',
        });
        await (0, factories_1.createSubject)(app, schoolB.id, { title: 'Karimi Subject B' });
    });
    describe('GET /search', () => {
        it('returns grouped, matching results across all six categories', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'karim' })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toEqual(expect.objectContaining({
                students: expect.any(Array),
                parents: expect.any(Array),
                teachers: expect.any(Array),
                subjects: expect.any(Array),
                homework: expect.any(Array),
                announcements: expect.any(Array),
            }));
            expect(res.body.students).toHaveLength(1);
            expect(res.body.students[0].fullName).toBe('Karimzadeh Ali');
            expect(res.body.parents).toHaveLength(1);
            expect(res.body.parents[0].fullName).toBe('Karim Ahmadi');
            expect(res.body.teachers).toHaveLength(1);
            expect(res.body.teachers[0].fullName).toBe('Reza Karimi');
            expect(res.body.subjects).toHaveLength(1);
            expect(res.body.subjects[0].title).toBe('Karimi Literature');
            expect(res.body.homework).toHaveLength(1);
            expect(res.body.homework[0].title).toBe('Karimi Poems Essay');
            expect(res.body.announcements).toHaveLength(1);
            expect(res.body.announcements[0].title).toBe('Karimi Exam Schedule');
        });
        it('matches case-insensitively and partially', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'KARIMZADEH' })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.students).toHaveLength(1);
            expect(res.body.students[0].fullName).toBe('Karimzadeh Ali');
        });
        it('never returns another school\'s rows for the same term', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'karim' })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            const allNames = [
                ...res.body.students.map((s) => s.fullName),
                ...res.body.parents.map((p) => p.fullName),
                ...res.body.subjects.map((s) => s.title),
            ];
            expect(allNames).not.toContain('Karimi Student B');
            expect(allNames).not.toContain('Karimi Guardian B');
            expect(allNames).not.toContain('Karimi Subject B');
        });
        it('returns every group empty for a non-matching term', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'zzz-no-such-match-zzz' })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                students: [],
                parents: [],
                teachers: [],
                subjects: [],
                homework: [],
                announcements: [],
            });
        });
        it('returns every group empty for a whitespace-only term', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: '   ' })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                students: [],
                parents: [],
                teachers: [],
                subjects: [],
                homework: [],
                announcements: [],
            });
        });
        it('caps results per category at the requested limit', async () => {
            const acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id);
            const gradeA = await (0, factories_1.createGrade)(app, schoolA.id);
            for (let i = 0; i < 5; i += 1) {
                await (0, factories_1.createStudent)(app, schoolA.id, {
                    academicYearId: acadYearA.id,
                    gradeId: gradeA.id,
                    fullName: `Limitcase Student ${i}`,
                });
            }
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'Limitcase', limit: 2 })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.students).toHaveLength(2);
        });
        it('defaults to a limit of 10 when none is provided', async () => {
            const acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id);
            const gradeA = await (0, factories_1.createGrade)(app, schoolA.id);
            for (let i = 0; i < 12; i += 1) {
                await (0, factories_1.createStudent)(app, schoolA.id, {
                    academicYearId: acadYearA.id,
                    gradeId: gradeA.id,
                    fullName: `Defaultcase Student ${i}`,
                });
            }
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'Defaultcase' })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.students).toHaveLength(10);
        });
        it('rejects a missing q', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(400);
        });
        it('rejects a blank q', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: '' })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(400);
        });
        it('rejects a limit above the maximum', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'karim', limit: 51 })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(400);
        });
        it('rejects a limit below the minimum', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'karim', limit: 0 })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(400);
        });
        it('allows accountant and staff, same as school_admin', async () => {
            const resAccountant = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'karim' })
                .set('Authorization', (0, factories_1.authHeader)(app, accountantA));
            expect(resAccountant.status).toBe(200);
            const resStaff = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'karim' })
                .set('Authorization', (0, factories_1.authHeader)(app, staffA));
            expect(resStaff.status).toBe(200);
        });
        it('rejects teacher and parent roles', async () => {
            const resTeacher = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'karim' })
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(resTeacher.status).toBe(403);
            const resParent = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'karim' })
                .set('Authorization', (0, factories_1.authHeader)(app, parentUserA));
            expect(resParent.status).toBe(403);
        });
        it('rejects an unauthenticated request', async () => {
            const res = await (0, supertest_1.default)(server).get('/api/v1/search').query({ q: 'karim' });
            expect(res.status).toBe(401);
        });
        it('rejects cross-school super_admin-less access from another school (no leakage, still own-school scoped)', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/search')
                .query({ q: 'karim' })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminB));
            expect(res.status).toBe(200);
            expect(res.body.subjects.map((s) => s.title)).toEqual(['Karimi Subject B']);
            expect(res.body.students.map((s) => s.fullName)).toEqual(['Karimi Student B']);
        });
    });
});
//# sourceMappingURL=search.e2e-spec.js.map