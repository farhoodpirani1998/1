"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Student Assessments (Phase 5F e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let schoolAdminA;
    let staffA;
    let accountantA;
    let schoolAdminB;
    let parentA;
    let otherParentA;
    let parentB;
    let acadYearA;
    let gradeA;
    let studentA1;
    let studentA2;
    let studentB1;
    let mathA;
    let scienceA;
    let subjectB;
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
        parentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id, fullName: 'Parent A' });
        otherParentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id, fullName: 'Other Parent A' });
        parentB = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolB.id, fullName: 'Parent B' });
        acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id, { title: '1404-1405', isCurrent: true });
        gradeA = await (0, factories_1.createGrade)(app, schoolA.id, { title: 'Grade 7' });
        studentA1 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
            fullName: 'Student A1',
        });
        studentA2 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
            fullName: 'Student A2',
        });
        const acadYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
        const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
        studentB1 = await (0, factories_1.createStudent)(app, schoolB.id, {
            academicYearId: acadYearB.id,
            gradeId: gradeB.id,
            fullName: 'Student B1',
        });
        mathA = await (0, factories_1.createSubject)(app, schoolA.id, { title: 'Math' });
        scienceA = await (0, factories_1.createSubject)(app, schoolA.id, { title: 'Science' });
        subjectB = await (0, factories_1.createSubject)(app, schoolB.id, { title: 'Subject B' });
        await (0, factories_1.linkParentStudent)(app, parentA.id, studentA1.id);
    });
    describe('POST /subjects', () => {
        it('school_admin can create a subject', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/subjects')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ title: 'History' });
            expect(res.status).toBe(201);
            expect(res.body.title).toBe('History');
        });
        it('rejects staff/accountant/parent from creating a subject', async () => {
            const staffRes = await (0, supertest_1.default)(server)
                .post('/api/v1/subjects')
                .set('Authorization', (0, factories_1.authHeader)(app, staffA))
                .send({ title: 'History' });
            expect(staffRes.status).toBe(403);
            const parentRes = await (0, supertest_1.default)(server)
                .post('/api/v1/subjects')
                .set('Authorization', (0, factories_1.authHeader)(app, parentA))
                .send({ title: 'History' });
            expect(parentRes.status).toBe(403);
        });
        it('staff can list subjects for their school', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/subjects')
                .set('Authorization', (0, factories_1.authHeader)(app, staffA));
            expect(res.status).toBe(200);
            const titles = res.body.map((s) => s.title).sort();
            expect(titles).toEqual(['Math', 'Science']);
        });
    });
    describe('POST /assessments', () => {
        it('school_admin can record a score', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 18.5 });
            expect(res.status).toBe(201);
            expect(res.body.studentId).toBe(studentA1.id);
            expect(res.body.subjectId).toBe(mathA.id);
            expect(res.body.score).toBe(18.5);
            expect(res.body.maxScore).toBe(20);
            expect(res.body.term).toBe('first_term');
        });
        it('staff can record a score with a custom maxScore', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, staffA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 85, maxScore: 100 });
            expect(res.status).toBe(201);
            expect(res.body.score).toBe(85);
            expect(res.body.maxScore).toBe(100);
        });
        it('rejects accountant and parent from recording a score', async () => {
            const accountantRes = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, accountantA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 18 });
            expect(accountantRes.status).toBe(403);
            const parentRes = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, parentA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 18 });
            expect(parentRes.status).toBe(403);
        });
        it('resubmitting the same student+subject+term corrects the row instead of duplicating it', async () => {
            const first = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 15 });
            expect(first.status).toBe(201);
            const second = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 19, note: 'Retake' });
            expect(second.status).toBe(201);
            expect(second.body.id).toBe(first.body.id);
            expect(second.body.score).toBe(19);
            expect(second.body.note).toBe('Retake');
            const history = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(history.body).toHaveLength(1);
        });
        it('rejects a student from another school (tenant isolation)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentB1.id, subjectId: mathA.id, term: 'first_term', score: 18 });
            expect(res.status).toBe(403);
        });
        it('rejects a subject from another school (tenant isolation)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, subjectId: subjectB.id, term: 'first_term', score: 18 });
            expect(res.status).toBe(403);
        });
        it('rejects a nonexistent studentId', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                studentId: '00000000-0000-0000-0000-000000000000',
                subjectId: mathA.id,
                term: 'first_term',
                score: 18,
            });
            expect(res.status).toBe(404);
        });
        it('rejects a nonexistent subjectId', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                studentId: studentA1.id,
                subjectId: '00000000-0000-0000-0000-000000000000',
                term: 'first_term',
                score: 18,
            });
            expect(res.status).toBe(404);
        });
    });
    describe('DTO validation', () => {
        it('rejects an unknown term enum value', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'third_term', score: 18 });
            expect(res.status).toBe(400);
        });
        it('rejects a score above maxScore', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 25 });
            expect(res.status).toBe(400);
        });
        it('rejects a negative score', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: -1 });
            expect(res.status).toBe(400);
        });
        it('rejects a missing studentId', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ subjectId: mathA.id, term: 'first_term', score: 18 });
            expect(res.status).toBe(400);
        });
        it('rejects an unknown field (whitelist)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/assessments')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 18, extraField: 'nope' });
            expect(res.status).toBe(400);
        });
    });
    describe('GET /assessments/student/:id', () => {
        beforeEach(async () => {
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                subjectId: mathA.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.FIRST_TERM,
                score: 18,
            });
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                subjectId: scienceA.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.FIRST_TERM,
                score: 16,
            });
        });
        it('returns the student assessment history', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });
        it('allows accountant and staff to read', async () => {
            const accountantRes = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, accountantA));
            expect(accountantRes.status).toBe(200);
            const staffRes = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, staffA));
            expect(staffRes.status).toBe(200);
        });
        it('rejects parent role on the staff-side endpoint', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(403);
        });
        it('404s for a student belonging to another school', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentB1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
    });
    describe('GET /assessments/student/:id/report-card', () => {
        beforeEach(async () => {
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                subjectId: mathA.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.FIRST_TERM,
                score: 18,
                maxScore: 20,
            });
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                subjectId: scienceA.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.FIRST_TERM,
                score: 16,
                maxScore: 20,
            });
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                subjectId: mathA.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.SECOND_TERM,
                score: 19,
                maxScore: 20,
            });
        });
        it('groups by term and computes averages', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentA1.id}/report-card`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.studentId).toBe(studentA1.id);
            expect(res.body.terms).toHaveLength(2);
            const firstTerm = res.body.terms.find((t) => t.term === 'first_term');
            expect(firstTerm.subjects).toHaveLength(2);
            expect(firstTerm.average).toBe(17);
            const secondTerm = res.body.terms.find((t) => t.term === 'second_term');
            expect(secondTerm.average).toBe(19);
            expect(res.body.overallAverage).toBe(18);
        });
        it('rejects parent role on the staff-side endpoint', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentA1.id}/report-card`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(403);
        });
        it('returns an empty report card for a student with no assessments', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentA2.id}/report-card`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.terms).toEqual([]);
            expect(res.body.overallAverage).toBeNull();
        });
        it('404s for a student belonging to another school', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/assessments/student/${studentB1.id}/report-card`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
    });
    describe('GET /parent/students/:id/assessments', () => {
        beforeEach(async () => {
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                subjectId: mathA.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.FIRST_TERM,
                score: 18,
                note: 'Great improvement',
            });
        });
        it("returns the linked child's assessments, without staff-only fields", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/assessments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].score).toBe(18);
            expect(res.body[0].note).toBe('Great improvement');
            expect(res.body[0].recordedById).toBeUndefined();
            expect(res.body[0].studentId).toBeUndefined();
        });
        it('404s for a parent not linked to the student', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/assessments`)
                .set('Authorization', (0, factories_1.authHeader)(app, otherParentA));
            expect(res.status).toBe(404);
        });
        it('404s for a parent in another school, even with a linked-looking id', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/assessments`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
        it('rejects non-parent roles', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/assessments`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(403);
        });
    });
    describe('GET /parent/students/:id/report-card', () => {
        beforeEach(async () => {
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                subjectId: mathA.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.FIRST_TERM,
                score: 18,
            });
        });
        it("returns the linked child's report card", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/report-card`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body.terms).toHaveLength(1);
            expect(res.body.overallAverage).toBe(18);
        });
        it('404s for a parent not linked to the student', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/report-card`)
                .set('Authorization', (0, factories_1.authHeader)(app, otherParentA));
            expect(res.status).toBe(404);
        });
        it('rejects non-parent roles', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/report-card`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(403);
        });
    });
    describe('Student profile assessments section', () => {
        it('is populated (available: true) with records and a report summary once assessments exist', async () => {
            await (0, factories_1.createAssessment)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                subjectId: mathA.id,
                academicYearId: acadYearA.id,
                term: factories_1.AssessmentTerm.FIRST_TERM,
                score: 18,
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.assessments.available).toBe(true);
            expect(res.body.assessments.records).toHaveLength(1);
            expect(res.body.assessments.records[0].score).toBe(18);
            expect(res.body.assessments.reportSummary.overallAverage).toBe(18);
        });
        it('is available but empty when no assessments exist yet', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA2.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.assessments.available).toBe(true);
            expect(res.body.assessments.records).toEqual([]);
            expect(res.body.assessments.reportSummary.overallAverage).toBeNull();
        });
    });
});
//# sourceMappingURL=student-assessments.e2e-spec.js.map