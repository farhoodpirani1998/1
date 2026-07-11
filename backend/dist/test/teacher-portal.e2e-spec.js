"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Teacher Portal (Phase 5G e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let schoolAdminA;
    let staffA;
    let accountantA;
    let schoolAdminB;
    let teacherA;
    let otherTeacherA;
    let teacherB;
    let acadYearA;
    let gradeA1;
    let gradeA2;
    let subjectA1;
    let subjectA2;
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
        schoolAdminB = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolB.id });
        teacherA = await (0, factories_1.createUser)(app, { role: factories_1.Role.TEACHER, schoolId: schoolA.id, fullName: 'Teacher A' });
        otherTeacherA = await (0, factories_1.createUser)(app, { role: factories_1.Role.TEACHER, schoolId: schoolA.id, fullName: 'Other Teacher' });
        teacherB = await (0, factories_1.createUser)(app, { role: factories_1.Role.TEACHER, schoolId: schoolB.id, fullName: 'Teacher B' });
        acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id);
        gradeA1 = await (0, factories_1.createGrade)(app, schoolA.id, { title: 'Grade 7' });
        gradeA2 = await (0, factories_1.createGrade)(app, schoolA.id, { title: 'Grade 8' });
        subjectA1 = await (0, factories_1.createSubject)(app, schoolA.id, { title: 'Math' });
        subjectA2 = await (0, factories_1.createSubject)(app, schoolA.id, { title: 'Science' });
        studentA1 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA1.id,
            fullName: 'Student A1',
        });
        studentA2 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA2.id,
            fullName: 'Student A2',
        });
        const acadYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
        const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
        studentB1 = await (0, factories_1.createStudent)(app, schoolB.id, {
            academicYearId: acadYearB.id,
            gradeId: gradeB.id,
            fullName: 'Student B1',
        });
    });
    describe('POST /teacher/assignments', () => {
        it('lets school_admin assign a teacher to a grade+subject', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
            expect(res.status).toBe(201);
            expect(res.body.teacherId).toBe(teacherA.id);
            expect(res.body.gradeId).toBe(gradeA1.id);
            expect(res.body.subjectId).toBe(subjectA1.id);
        });
        it('is idempotent: assigning the same triple twice returns the same row, not a duplicate', async () => {
            const first = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
            const second = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
            expect(first.status).toBe(201);
            expect(second.status).toBe(201);
            expect(second.body.id).toBe(first.body.id);
            const list = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/assignments')
                .query({ teacherId: teacherA.id })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(list.body).toHaveLength(1);
        });
        it('rejects a teacher from another school (Forbidden)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ teacherId: teacherB.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
            expect(res.status).toBe(403);
        });
        it('rejects a grade from another school (Forbidden)', async () => {
            const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ teacherId: teacherA.id, gradeId: gradeB.id, subjectId: subjectA1.id });
            expect(res.status).toBe(403);
        });
        it('rejects a subject from another school (Forbidden)', async () => {
            const subjectB = await (0, factories_1.createSubject)(app, schoolB.id);
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectB.id });
            expect(res.status).toBe(403);
        });
        it('rejects a user that is not a teacher (BadRequest)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ teacherId: staffA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
            expect(res.status).toBe(400);
        });
        it('rejects a nonexistent teacher/grade/subject id (NotFound)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                teacherId: '00000000-0000-0000-0000-000000000000',
                gradeId: gradeA1.id,
                subjectId: subjectA1.id,
            });
            expect(res.status).toBe(404);
        });
        it('rejects a malformed payload (missing gradeId)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ teacherId: teacherA.id, subjectId: subjectA1.id });
            expect(res.status).toBe(400);
        });
        it.each([
            ['staff', () => staffA],
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
        ])('rejects %s (not school_admin)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assignments')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()))
                .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
            expect(res.status).toBe(403);
        });
    });
    describe('DELETE /teacher/assignments/:id', () => {
        it('lets school_admin remove an assignment', async () => {
            const assignment = await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: teacherA.id,
                gradeId: gradeA1.id,
                subjectId: subjectA1.id,
            });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/teacher/assignments/${assignment.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(204);
            const list = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/assignments')
                .query({ teacherId: teacherA.id })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(list.body).toHaveLength(0);
        });
        it('404s for a cross-school assignment id', async () => {
            const assignment = await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: teacherA.id,
                gradeId: gradeA1.id,
                subjectId: subjectA1.id,
            });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/teacher/assignments/${assignment.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminB));
            expect(res.status).toBe(404);
        });
    });
    describe('GET /teacher/profile', () => {
        it("returns the teacher's own account and assignment summary", async () => {
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: teacherA.id,
                gradeId: gradeA1.id,
                subjectId: subjectA1.id,
            });
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/profile')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(teacherA.id);
            expect(res.body.fullName).toBe('Teacher A');
            expect(res.body.assignments).toHaveLength(1);
            expect(res.body.assignments[0].gradeTitle).toBe('Grade 7');
            expect(res.body.assignments[0].subjectTitle).toBe('Math');
        });
        it('rejects every non-teacher role', async () => {
            for (const user of [schoolAdminA, staffA, accountantA]) {
                const res = await (0, supertest_1.default)(server)
                    .get('/api/v1/teacher/profile')
                    .set('Authorization', (0, factories_1.authHeader)(app, user));
                expect(res.status).toBe(403);
            }
        });
    });
    describe('GET /teacher/classes and /teacher/subjects', () => {
        beforeEach(async () => {
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: teacherA.id,
                gradeId: gradeA1.id,
                subjectId: subjectA1.id,
            });
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: teacherA.id,
                gradeId: gradeA1.id,
                subjectId: subjectA2.id,
            });
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: teacherA.id,
                gradeId: gradeA2.id,
                subjectId: subjectA1.id,
            });
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: otherTeacherA.id,
                gradeId: gradeA1.id,
                subjectId: subjectA1.id,
            });
        });
        it('returns only the calling teacher\'s distinct assigned classes', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/classes')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(200);
            const titles = res.body.map((g) => g.title).sort();
            expect(titles).toEqual(['Grade 7', 'Grade 8']);
        });
        it('returns only the calling teacher\'s distinct assigned subjects', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/subjects')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(200);
            const titles = res.body.map((s) => s.title).sort();
            expect(titles).toEqual(['Math', 'Science']);
        });
        it('returns an empty list for a teacher with no assignments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/classes')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherB));
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });
    describe('GET /teacher/students', () => {
        beforeEach(async () => {
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: teacherA.id,
                gradeId: gradeA1.id,
                subjectId: subjectA1.id,
            });
        });
        it('returns students only from the assigned grade', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/students')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(200);
            const ids = res.body.map((s) => s.id);
            expect(ids).toContain(studentA1.id);
            expect(ids).not.toContain(studentA2.id);
            expect(ids).not.toContain(studentB1.id);
        });
        it('rejects a gradeId filter the teacher is not assigned to (Forbidden)', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/students')
                .query({ gradeId: gradeA2.id })
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(403);
        });
        it('returns an empty roster for a teacher with no assignments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/teacher/students')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherB));
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });
    describe('POST /teacher/attendance', () => {
        beforeEach(async () => {
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: teacherA.id,
                gradeId: gradeA1.id,
                subjectId: subjectA1.id,
            });
        });
        it('records attendance for a student in an assigned grade', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, date: '2026-07-01', status: 'present' });
            expect(res.status).toBe(201);
            expect(res.body.studentId).toBe(studentA1.id);
            expect(res.body.status).toBe('present');
        });
        it('upserts on resubmission for the same student+date (reuses AttendanceService)', async () => {
            await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, date: '2026-07-01', status: 'present' });
            const second = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, date: '2026-07-01', status: 'absent' });
            expect(second.status).toBe(201);
            const history = await (0, supertest_1.default)(server)
                .get(`/api/v1/attendance/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(history.body).toHaveLength(1);
            expect(history.body[0].status).toBe('absent');
        });
        it('rejects attendance for a student in an unassigned grade (Forbidden)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA2.id, date: '2026-07-01', status: 'present' });
            expect(res.status).toBe(403);
        });
        it('rejects attendance for a student in another school (Forbidden -- not an assigned class)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentB1.id, date: '2026-07-01', status: 'present' });
            expect(res.status).toBe(403);
        });
        it('rejects a malformed status enum', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, date: '2026-07-01', status: 'not-a-status' });
            expect(res.status).toBe(400);
        });
        it.each([
            ['school_admin', () => schoolAdminA],
            ['staff', () => staffA],
            ['accountant', () => accountantA],
        ])('rejects %s on the teacher route', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()))
                .send({ studentId: studentA1.id, date: '2026-07-01', status: 'present' });
            expect(res.status).toBe(403);
        });
    });
    describe('POST /teacher/assessments', () => {
        beforeEach(async () => {
            await (0, factories_1.createTeacherAssignment)(app, {
                schoolId: schoolA.id,
                teacherId: teacherA.id,
                gradeId: gradeA1.id,
                subjectId: subjectA1.id,
            });
        });
        it('records a score for the assigned grade+subject', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: factories_1.AssessmentTerm.FIRST_TERM, score: 18 });
            expect(res.status).toBe(201);
            expect(res.body.studentId).toBe(studentA1.id);
            expect(res.body.subjectId).toBe(subjectA1.id);
            expect(res.body.score).toBe(18);
        });
        it('upserts on resubmission for the same student+subject+term (reuses AssessmentsService)', async () => {
            await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: factories_1.AssessmentTerm.FIRST_TERM, score: 15 });
            const second = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: factories_1.AssessmentTerm.FIRST_TERM, score: 19 });
            expect(second.status).toBe(201);
            const history = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(history.body).toHaveLength(1);
            expect(history.body[0].score).toBe(19);
        });
        it('rejects a subject the teacher is assigned to for a different grade (Forbidden)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA2.id, subjectId: subjectA1.id, term: factories_1.AssessmentTerm.FIRST_TERM, score: 18 });
            expect(res.status).toBe(403);
        });
        it('rejects a subject the teacher is not assigned at all (Forbidden)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, subjectId: subjectA2.id, term: factories_1.AssessmentTerm.FIRST_TERM, score: 18 });
            expect(res.status).toBe(403);
        });
        it('rejects a student in another school (Forbidden -- no matching assignment)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentB1.id, subjectId: subjectA1.id, term: factories_1.AssessmentTerm.FIRST_TERM, score: 18 });
            expect(res.status).toBe(403);
        });
        it('rejects a score above maxScore (delegated AssessmentsService validation)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: factories_1.AssessmentTerm.FIRST_TERM, score: 25 });
            expect(res.status).toBe(400);
        });
        it('rejects a malformed term enum', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: 'third_term', score: 18 });
            expect(res.status).toBe(400);
        });
        it.each([
            ['school_admin', () => schoolAdminA],
            ['staff', () => staffA],
            ['accountant', () => accountantA],
        ])('rejects %s on the teacher route', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/teacher/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()))
                .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: factories_1.AssessmentTerm.FIRST_TERM, score: 18 });
            expect(res.status).toBe(403);
        });
    });
    describe('teacher role never leaks into pre-existing staff-facing endpoints', () => {
        it('rejects a teacher on GET /students', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/students')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA));
            expect(res.status).toBe(403);
        });
        it('rejects a teacher on POST /attendance', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, date: '2026-07-01', status: 'present' });
            expect(res.status).toBe(403);
        });
        it('rejects a teacher on POST /assessments', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, teacherA))
                .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: factories_1.AssessmentTerm.FIRST_TERM, score: 18 });
            expect(res.status).toBe(403);
        });
    });
});
//# sourceMappingURL=teacher-portal.e2e-spec.js.map