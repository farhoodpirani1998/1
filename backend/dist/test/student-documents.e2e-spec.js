"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Student Document Management (Phase 5I e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let schoolAdminA;
    let staffA;
    let accountantA;
    let teacherA;
    let schoolAdminB;
    let parentA;
    let otherParentA;
    let parentB;
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
        schoolAdminB = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolB.id });
        parentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id });
        otherParentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id });
        parentB = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolB.id });
        const acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id);
        const gradeA = await (0, factories_1.createGrade)(app, schoolA.id);
        studentA1 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
        });
        studentA2 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
        });
        const acadYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
        const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
        studentB1 = await (0, factories_1.createStudent)(app, schoolB.id, {
            academicYearId: acadYearB.id,
            gradeId: gradeB.id,
        });
        await (0, factories_1.linkParentStudent)(app, parentA.id, studentA1.id);
    });
    describe('POST /students/:id/documents', () => {
        it('lets school_admin attach a document to a student in their own school', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                title: 'Birth Certificate',
                documentType: factories_1.StudentDocumentType.IDENTITY,
                fileUrl: 'https://storage.example.com/birth-certificate.pdf',
                description: 'Copy of national birth certificate.',
            });
            expect(res.status).toBe(201);
            expect(res.body.studentId).toBe(studentA1.id);
            expect(res.body.title).toBe('Birth Certificate');
            expect(res.body.documentType).toBe('identity');
            expect(res.body.fileUrl).toBe('https://storage.example.com/birth-certificate.pdf');
            expect(res.body.description).toBe('Copy of national birth certificate.');
            expect(res.body.uploadedById).toBe(schoolAdminA.id);
            expect(res.body.createdAt).toBeDefined();
        });
        it('lets staff attach a document', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, staffA))
                .send({
                title: 'Enrollment Form',
                documentType: factories_1.StudentDocumentType.REGISTRATION,
                fileUrl: 'https://storage.example.com/enrollment.pdf',
            });
            expect(res.status).toBe(201);
            expect(res.body.uploadedById).toBe(staffA.id);
            expect(res.body.description).toBeNull();
        });
        it.each([
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
            ['parent', () => parentA],
        ])('rejects %s (not school_admin/staff)', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()))
                .send({
                title: 'x',
                documentType: factories_1.StudentDocumentType.OTHER,
                fileUrl: 'https://storage.example.com/x.pdf',
            });
            expect(res.status).toBe(403);
        });
        it('rejects an unauthenticated request', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentA1.id}/documents`)
                .send({
                title: 'x',
                documentType: factories_1.StudentDocumentType.OTHER,
                fileUrl: 'https://storage.example.com/x.pdf',
            });
            expect(res.status).toBe(401);
        });
        it("404s (not 403) attaching a document to another school's student", async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentB1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                title: 'x',
                documentType: factories_1.StudentDocumentType.OTHER,
                fileUrl: 'https://storage.example.com/x.pdf',
            });
            expect(res.status).toBe(404);
        });
        it('404s attaching a document to a nonexistent student', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/students/00000000-0000-0000-0000-000000000000/documents')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                title: 'x',
                documentType: factories_1.StudentDocumentType.OTHER,
                fileUrl: 'https://storage.example.com/x.pdf',
            });
            expect(res.status).toBe(404);
        });
        it('rejects a missing title', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ documentType: factories_1.StudentDocumentType.OTHER, fileUrl: 'https://storage.example.com/x.pdf' });
            expect(res.status).toBe(400);
        });
        it('rejects a blank title', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                title: '',
                documentType: factories_1.StudentDocumentType.OTHER,
                fileUrl: 'https://storage.example.com/x.pdf',
            });
            expect(res.status).toBe(400);
        });
        it('rejects an invalid documentType', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ title: 'x', documentType: 'passport', fileUrl: 'https://storage.example.com/x.pdf' });
            expect(res.status).toBe(400);
        });
        it('rejects a non-URL fileUrl', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ title: 'x', documentType: factories_1.StudentDocumentType.OTHER, fileUrl: 'not-a-url' });
            expect(res.status).toBe(400);
        });
        it('rejects unknown extra fields (forbidNonWhitelisted)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({
                title: 'x',
                documentType: factories_1.StudentDocumentType.OTHER,
                fileUrl: 'https://storage.example.com/x.pdf',
                schoolId: schoolB.id,
            });
            expect(res.status).toBe(400);
        });
    });
    describe('GET /students/:id/documents', () => {
        it("lists only the requested student's documents, most recent first", async () => {
            const older = await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                title: 'Older',
            });
            await new Promise((r) => setTimeout(r, 5));
            const newer = await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                title: 'Newer',
            });
            await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolA.id,
                studentId: studentA2.id,
                title: 'Other Student',
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body.map((d) => d.id)).toEqual([newer.id, older.id]);
            expect(res.body.every((d) => d.title !== 'Other Student')).toBe(true);
        });
        it.each([
            ['school_admin', () => schoolAdminA],
            ['staff', () => staffA],
            ['accountant', () => accountantA],
        ])('allows %s to read the list', async (_label, getUser) => {
            await (0, factories_1.createStudentDocument)(app, { schoolId: schoolA.id, studentId: studentA1.id });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
        });
        it.each([
            ['teacher', () => teacherA],
            ['parent', () => parentA],
        ])('rejects %s', async (_label, getUser) => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
        it("404s (not 403) reading another school's student", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentB1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
    });
    describe('DELETE /documents/:id', () => {
        it('lets school_admin delete a document in their own school', async () => {
            const document = await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
            });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/documents/${document.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(204);
            const list = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(list.body).toHaveLength(0);
        });
        it('lets staff delete a document', async () => {
            const document = await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
            });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/documents/${document.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, staffA));
            expect(res.status).toBe(204);
        });
        it("404s (not 403) deleting another school's document", async () => {
            const document = await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolB.id,
                studentId: studentB1.id,
            });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/documents/${document.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
        it('404s deleting a nonexistent id', async () => {
            const res = await (0, supertest_1.default)(server)
                .delete('/api/v1/documents/00000000-0000-0000-0000-000000000000')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
        it.each([
            ['accountant', () => accountantA],
            ['teacher', () => teacherA],
            ['parent', () => parentA],
        ])('rejects %s (not school_admin/staff)', async (_label, getUser) => {
            const document = await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
            });
            const res = await (0, supertest_1.default)(server)
                .delete(`/api/v1/documents/${document.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
    });
    describe('GET /parent/students/:id/documents', () => {
        it("returns only the parent's own linked child's documents", async () => {
            const doc = await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                title: 'Report Card Scan',
                uploadedById: schoolAdminA.id,
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].id).toBe(doc.id);
            expect(res.body[0].title).toBe('Report Card Scan');
            expect(res.body[0].uploadedById).toBeUndefined();
            expect(res.body[0].studentId).toBeUndefined();
        });
        it("404s (not 403) for a parent probing a student they're not linked to", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA2.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, otherParentA));
            expect(res.status).toBe(404);
        });
        it("404s for a parent probing another school's student", async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/documents`)
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
                .get(`/api/v1/parent/students/${studentA1.id}/documents`)
                .set('Authorization', (0, factories_1.authHeader)(app, getUser()));
            expect(res.status).toBe(403);
        });
    });
    describe('GET /students/:id/profile documents section', () => {
        it('is available-but-empty when the student has no documents', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.documents).toEqual({ available: true, records: [] });
        });
        it('is populated with recent documents once they exist', async () => {
            await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                title: 'Medical Form',
                documentType: factories_1.StudentDocumentType.MEDICAL,
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.documents.available).toBe(true);
            expect(res.body.documents.records).toHaveLength(1);
            expect(res.body.documents.records[0].title).toBe('Medical Form');
            expect(res.body.documents.records[0].documentType).toBe('medical');
        });
        it("is populated in the parent-facing profile for the parent's own linked child", async () => {
            await (0, factories_1.createStudentDocument)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                title: 'ID Copy',
                documentType: factories_1.StudentDocumentType.IDENTITY,
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body.documents.records).toHaveLength(1);
            expect(res.body.documents.records[0].title).toBe('ID Copy');
        });
    });
});
//# sourceMappingURL=student-documents.e2e-spec.js.map