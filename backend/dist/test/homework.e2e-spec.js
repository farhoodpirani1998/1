"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Homework & Assignments (Phase 5L e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let schoolAdminA;
    let staffA;
    let accountantA;
    let teacherA;
    let otherTeacherA;
    let schoolAdminB;
    let teacherB;
    let parentA;
    let otherParentA;
    let parentB;
    let acadYearA;
    let gradeA;
    let otherGradeA;
    let subjectA;
    let acadYearB;
    let gradeB;
    let subjectB;
    let studentA1;
    let studentA2;
    let studentB1;
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
        otherTeacherA = await (0, factories_1.createUser)(app, { role: factories_1.Role.TEACHER, schoolId: schoolA.id });
        schoolAdminB = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolB.id });
        teacherB = await (0, factories_1.createUser)(app, { role: factories_1.Role.TEACHER, schoolId: schoolB.id });
        parentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id });
        otherParentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id });
        parentB = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolB.id });
        acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id);
        gradeA = await (0, factories_1.createGrade)(app, schoolA.id);
        otherGradeA = await (0, factories_1.createGrade)(app, schoolA.id);
        subjectA = await (0, factories_1.createSubject)(app, schoolA.id);
        acadYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
        gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
        subjectB = await (0, factories_1.createSubject)(app, schoolB.id);
        studentA1 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
        });
        studentA2 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: otherGradeA.id,
        });
        studentB1 = await (0, factories_1.createStudent)(app, schoolB.id, {
            academicYearId: acadYearB.id,
            gradeId: gradeB.id,
        });
        await (0, factories_1.linkParentStudent)(app, parentA.id, studentA1.id);
        await (0, factories_1.createTeacherAssignment)(app, {
            schoolId: schoolA.id,
            teacherId: teacherA.id,
            gradeId: gradeA.id,
            subjectId: subjectA.id,
        });
    });
    function validPayload(overrides = {}) {
        return {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
            subjectId: subjectA.id,
            title: 'Chapter 3 Exercises',
            description: 'Solve exercises 1 through 10 on page 42.',
            dueDate: '2026-09-01',
            ...overrides,
        };
    }
    describe('POST /teacher/homework', () => {
        it('lets an assigned teacher post homework for their own grade+subject', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send(validPayload({ attachmentUrl: 'https://storage.example.com/ch3.pdf' }));
            expect(res.status).toBe(201);
            expect(res.body.gradeId).toBe(gradeA.id);
            expect(res.body.subjectId).toBe(subjectA.id);
            expect(res.body.teacherId).toBe(teacherA.id);
            expect(res.body.title).toBe('Chapter 3 Exercises');
            expect(res.body.dueDate).toBe('2026-09-01');
            expect(res.body.attachmentUrl).toBe('https://storage.example.com/ch3.pdf');
            expect(res.body.createdAt).toBeDefined();
        });
        it('omits attachmentUrl (optional) and stores null', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send(validPayload());
            expect(res.status).toBe(201);
            expect(res.body.attachmentUrl).toBeNull();
        });
        it('rejects a teacher posting for a grade+subject they are not assigned to', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, otherTeacherA))
                .send(validPayload());
            expect(res.status).toBe(403);
        });
        it("rejects a teacher posting for another school's grade", async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send(validPayload({ gradeId: gradeB.id }));
            expect(res.status).toBe(403);
        });
        it.each([
            ['school_admin', () => schoolAdminA],
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['parent', () => parentA],
        ])('rejects %s (not teacher)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()))
                .send(validPayload());
            expect(res.status).toBe(403);
        });
        it('rejects an unauthenticated request', async () => {
            const res = await (0, supertest_1.default)(server).post('/api/v1/teacher/homework').send(validPayload());
            expect(res.status).toBe(401);
        });
        it('rejects a missing title', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send(validPayload({ title: undefined }));
            expect(res.status).toBe(400);
        });
        it('rejects a blank title', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send(validPayload({ title: '' }));
            expect(res.status).toBe(400);
        });
        it('rejects an invalid dueDate', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send(validPayload({ dueDate: 'not-a-date' }));
            expect(res.status).toBe(400);
        });
        it('rejects a non-URL attachmentUrl', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send(validPayload({ attachmentUrl: 'not-a-url' }));
            expect(res.status).toBe(400);
        });
        it('rejects a teacherId supplied in the body (ignored/rejected, never trusted)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send(validPayload({ teacherId: otherTeacherA.id }));
            expect(res.status).toBe(400);
        });
    });
    describe('GET /teacher/homework', () => {
        it("lists only the calling teacher's own postings", async () => {
            const mine = await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: teacherA.id,
                title: 'Mine',
            });
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: otherTeacherA.id,
                gradeId: otherGradeA.id,
                subjectId: subjectA.id,
            });
            await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: otherGradeA.id,
                subjectId: subjectA.id,
                teacherId: otherTeacherA.id,
                title: 'Not mine',
            });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].id).toBe(mine.id);
        });
        it.each([
            ['school_admin', () => schoolAdminA],
            ['parent', () => parentA],
        ])('rejects %s (not teacher)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
    });
    describe('PUT /teacher/homework/:id', () => {
        it('lets the creating teacher correct their own homework', async () => {
            const homework = await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: teacherA.id,
            });
            const res = await (0, supertest_1.default)(server)
                .put(`/api/v1/teacher/homework/${homework.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ title: 'Updated Title', dueDate: '2026-10-01' });
            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Updated Title');
            expect(res.body.dueDate).toBe('2026-10-01');
        });
        it("404s (not 403) updating another teacher's homework", async () => {
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: otherTeacherA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
            });
            const homework = await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: otherTeacherA.id,
            });
            const res = await (0, supertest_1.default)(server)
                .put(`/api/v1/teacher/homework/${homework.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ title: 'Hijacked' });
            expect(res.status).toBe(404);
        });
        it("404s updating another school's homework", async () => {
            const homework = await (0, factories_1.createHomework)(app, {
                schoolId: schoolB.id,
                academicYearId: acadYearB.id,
                gradeId: gradeB.id,
                subjectId: subjectB.id,
                teacherId: teacherB.id,
            });
            const res = await (0, supertest_1.default)(server)
                .put(`/api/v1/teacher/homework/${homework.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ title: 'Hijacked' });
            expect(res.status).toBe(404);
        });
        it('rejects moving homework to a grade+subject the teacher is not assigned to', async () => {
            const homework = await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: teacherA.id,
            });
            const res = await (0, supertest_1.default)(server)
                .put(`/api/v1/teacher/homework/${homework.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ gradeId: otherGradeA.id });
            expect(res.status).toBe(403);
        });
    });
    describe('DELETE /teacher/homework/:id', () => {
        it('lets the creating teacher delete their own homework', async () => {
            const homework = await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: teacherA.id,
            });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/teacher/homework/${homework.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(204);
            const list = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(list.body).toHaveLength(0);
        });
        it("404s (not 403) deleting another teacher's homework", async () => {
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: otherTeacherA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
            });
            const homework = await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: otherTeacherA.id,
            });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/teacher/homework/${homework.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(404);
        });
        it('404s deleting a nonexistent id', async () => {
            const res = await (0, supertest_1.default)(server)
                .delete('/api/v1/teacher/homework/00000000-0000-0000-0000-000000000000')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(404);
        });
    });
    describe('GET /homework', () => {
        it("lets school_admin list every homework row in their own school", async () => {
            await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: teacherA.id,
                title: 'A1',
            });
            await (0, factories_1.createHomework)(app, {
                schoolId: schoolB.id,
                academicYearId: acadYearB.id,
                gradeId: gradeB.id,
                subjectId: subjectB.id,
                teacherId: teacherB.id,
                title: 'B1',
            });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].title).toBe('A1');
        });
        it('filters by gradeId', async () => {
            await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: teacherA.id,
                title: 'For gradeA',
            });
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: otherTeacherA.id,
                gradeId: otherGradeA.id,
                subjectId: subjectA.id,
            });
            await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: otherGradeA.id,
                subjectId: subjectA.id,
                teacherId: otherTeacherA.id,
                title: 'For otherGradeA',
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/homework?gradeId=${gradeA.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].title).toBe('For gradeA');
        });
        it.each([
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
            ['parent', () => parentA],
        ])('rejects %s (not school_admin)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/homework')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
    });
    describe('GET /parent/students/:id/homework', () => {
        it("returns only the parent's own linked child's grade homework", async () => {
            const homework = await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: teacherA.id,
                title: 'Grade A homework',
            });
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: otherTeacherA.id,
                gradeId: otherGradeA.id,
                subjectId: subjectA.id,
            });
            await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: otherGradeA.id,
                subjectId: subjectA.id,
                teacherId: otherTeacherA.id,
                title: 'Other grade homework',
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/homework`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].id).toBe(homework.id);
            expect(res.body[0].title).toBe('Grade A homework');
        });
        it("404s (not 403) for a parent probing a student they're not linked to", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA2.id}/homework`)
                .set('Authorization', (0, factories_1.authHeader)(app, otherParentA));
            expect(res.status).toBe(404);
        });
        it("404s for a parent probing another school's student", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/homework`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
        it.each([
            ['school_admin', () => schoolAdminA],
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
        ])('rejects %s (not parent)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/homework`)
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
    });
    describe('GET /students/:id/profile homework section', () => {
        it('is available-but-empty when the grade has no homework', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.homework).toEqual({ available: true, records: [] });
        });
        it('is populated with recent homework once it exists for the grade', async () => {
            await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: teacherA.id,
                title: 'Reading Assignment',
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.homework.available).toBe(true);
            expect(res.body.homework.records).toHaveLength(1);
            expect(res.body.homework.records[0].title).toBe('Reading Assignment');
        });
        it("is populated in the parent-facing profile for the parent's own linked child", async () => {
            await (0, factories_1.createHomework)(app, {
                schoolId: schoolA.id,
                academicYearId: acadYearA.id,
                gradeId: gradeA.id,
                subjectId: subjectA.id,
                teacherId: teacherA.id,
                title: 'Parent Visible Homework',
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body.homework.records).toHaveLength(1);
            expect(res.body.homework.records[0].title).toBe('Parent Visible Homework');
        });
    });
});
//# sourceMappingURL=homework.e2e-spec.js.map