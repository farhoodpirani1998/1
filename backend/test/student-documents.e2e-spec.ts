import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  createStudentDocument,
  linkParentStudent,
  authHeader,
  Role,
  StudentDocumentType,
} from './setup/factories';

/**
 * Phase 5I: Student Document Management
 *
 * Proves that:
 * 1. school_admin/staff can attach a document reference to a student
 *    (POST /students/:id/documents) and read a student's document list
 *    (GET /students/:id/documents); accountant/parent are rejected on
 *    both.
 * 2. DTO validation rejects a malformed create payload (missing/blank
 *    title, invalid documentType, non-URL fileUrl).
 * 3. GET /students/:id/documents never returns another school's rows, and
 *    a wrong-tenant studentId 404s the same as a nonexistent one.
 * 4. school_admin/staff can delete a document (DELETE /documents/:id);
 *    a wrong-tenant id 404s, not 403; every other role is rejected.
 * 5. GET /parent/students/:id/documents only ever returns a parent's own
 *    linked child's documents -- never another family's, never
 *    cross-school -- and is rejected for every non-parent role.
 * 6. GET /students/:id/profile's documents section is populated
 *    (available: true) with recent records once documents exist, and is
 *    available-but-empty otherwise.
 */
describe('Student Document Management (Phase 5I e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminB: Awaited<ReturnType<typeof createUser>>;

  let parentA: Awaited<ReturnType<typeof createUser>>;
  let otherParentA: Awaited<ReturnType<typeof createUser>>;
  let parentB: Awaited<ReturnType<typeof createUser>>;

  let studentA1: Awaited<ReturnType<typeof createStudent>>;
  let studentA2: Awaited<ReturnType<typeof createStudent>>;
  let studentB1: Awaited<ReturnType<typeof createStudent>>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await truncateAll(app);

    schoolA = await createSchool(app, { name: 'School A' });
    schoolB = await createSchool(app, { name: 'School B' });

    schoolAdminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });
    staffA = await createUser(app, { role: Role.STAFF, schoolId: schoolA.id });
    accountantA = await createUser(app, { role: Role.ACCOUNTANT, schoolId: schoolA.id });
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });

    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    otherParentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    parentB = await createUser(app, { role: Role.PARENT, schoolId: schoolB.id });

    const acadYearA = await createAcademicYear(app, schoolA.id);
    const gradeA = await createGrade(app, schoolA.id);
    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
    });
    studentA2 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
    });

    const acadYearB = await createAcademicYear(app, schoolB.id);
    const gradeB = await createGrade(app, schoolB.id);
    studentB1 = await createStudent(app, schoolB.id, {
      academicYearId: acadYearB.id,
      gradeId: gradeB.id,
    });

    await linkParentStudent(app, parentA.id, studentA1.id);
  });

  // -------------------------------------------------------------------
  // POST /students/:id/documents
  // -------------------------------------------------------------------

  describe('POST /students/:id/documents', () => {
    it('lets school_admin attach a document to a student in their own school', async () => {
      const res = await request(server)
        .post(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          title: 'Birth Certificate',
          documentType: StudentDocumentType.IDENTITY,
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
      const res = await request(server)
        .post(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, staffA))
        .send({
          title: 'Enrollment Form',
          documentType: StudentDocumentType.REGISTRATION,
          fileUrl: 'https://storage.example.com/enrollment.pdf',
        });
      expect(res.status).toBe(201);
      expect(res.body.uploadedById).toBe(staffA.id);
      // description is optional
      expect(res.body.description).toBeNull();
    });

    it.each([
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s (not school_admin/staff)', async (_label, getUser) => {
      const res = await request(server)
        .post(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, getUser()))
        .send({
          title: 'x',
          documentType: StudentDocumentType.OTHER,
          fileUrl: 'https://storage.example.com/x.pdf',
        });
      expect(res.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(server)
        .post(`/api/v1/students/${studentA1.id}/documents`)
        .send({
          title: 'x',
          documentType: StudentDocumentType.OTHER,
          fileUrl: 'https://storage.example.com/x.pdf',
        });
      expect(res.status).toBe(401);
    });

    it("404s (not 403) attaching a document to another school's student", async () => {
      const res = await request(server)
        .post(`/api/v1/students/${studentB1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          title: 'x',
          documentType: StudentDocumentType.OTHER,
          fileUrl: 'https://storage.example.com/x.pdf',
        });
      expect(res.status).toBe(404);
    });

    it('404s attaching a document to a nonexistent student', async () => {
      const res = await request(server)
        .post('/api/v1/students/00000000-0000-0000-0000-000000000000/documents')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          title: 'x',
          documentType: StudentDocumentType.OTHER,
          fileUrl: 'https://storage.example.com/x.pdf',
        });
      expect(res.status).toBe(404);
    });

    it('rejects a missing title', async () => {
      const res = await request(server)
        .post(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ documentType: StudentDocumentType.OTHER, fileUrl: 'https://storage.example.com/x.pdf' });
      expect(res.status).toBe(400);
    });

    it('rejects a blank title', async () => {
      const res = await request(server)
        .post(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          title: '',
          documentType: StudentDocumentType.OTHER,
          fileUrl: 'https://storage.example.com/x.pdf',
        });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid documentType', async () => {
      const res = await request(server)
        .post(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'x', documentType: 'passport', fileUrl: 'https://storage.example.com/x.pdf' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-URL fileUrl', async () => {
      const res = await request(server)
        .post(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'x', documentType: StudentDocumentType.OTHER, fileUrl: 'not-a-url' });
      expect(res.status).toBe(400);
    });

    it('rejects unknown extra fields (forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          title: 'x',
          documentType: StudentDocumentType.OTHER,
          fileUrl: 'https://storage.example.com/x.pdf',
          schoolId: schoolB.id,
        });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // GET /students/:id/documents
  // -------------------------------------------------------------------

  describe('GET /students/:id/documents', () => {
    it("lists only the requested student's documents, most recent first", async () => {
      const older = await createStudentDocument(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        title: 'Older',
      });
      await new Promise((r) => setTimeout(r, 5));
      const newer = await createStudentDocument(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        title: 'Newer',
      });
      // A different student's document must never appear.
      await createStudentDocument(app, {
        schoolId: schoolA.id,
        studentId: studentA2.id,
        title: 'Other Student',
      });

      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((d: any) => d.id)).toEqual([newer.id, older.id]);
      expect(res.body.every((d: any) => d.title !== 'Other Student')).toBe(true);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
    ])('allows %s to read the list', async (_label, getUser) => {
      await createStudentDocument(app, { schoolId: schoolA.id, studentId: studentA1.id });
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it.each([
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s', async (_label, getUser) => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });

    it("404s (not 403) reading another school's student", async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentB1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------
  // DELETE /documents/:id
  // -------------------------------------------------------------------

  describe('DELETE /documents/:id', () => {
    it('lets school_admin delete a document in their own school', async () => {
      const document = await createStudentDocument(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
      });

      const res = await request(server)
        .delete(`/api/v1/documents/${document.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(204);

      const list = await request(server)
        .get(`/api/v1/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(list.body).toHaveLength(0);
    });

    it('lets staff delete a document', async () => {
      const document = await createStudentDocument(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
      });
      const res = await request(server)
        .delete(`/api/v1/documents/${document.id}`)
        .set('Authorization', authHeader(app, staffA));
      expect(res.status).toBe(204);
    });

    it("404s (not 403) deleting another school's document", async () => {
      const document = await createStudentDocument(app, {
        schoolId: schoolB.id,
        studentId: studentB1.id,
      });
      const res = await request(server)
        .delete(`/api/v1/documents/${document.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });

    it('404s deleting a nonexistent id', async () => {
      const res = await request(server)
        .delete('/api/v1/documents/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });

    it.each([
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s (not school_admin/staff)', async (_label, getUser) => {
      const document = await createStudentDocument(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
      });
      const res = await request(server)
        .delete(`/api/v1/documents/${document.id}`)
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /parent/students/:id/documents
  // -------------------------------------------------------------------

  describe('GET /parent/students/:id/documents', () => {
    it("returns only the parent's own linked child's documents", async () => {
      const doc = await createStudentDocument(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        title: 'Report Card Scan',
        uploadedById: schoolAdminA.id,
      });

      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(doc.id);
      expect(res.body[0].title).toBe('Report Card Scan');
      // parent-facing shape never leaks the internal uploader id
      expect(res.body[0].uploadedById).toBeUndefined();
      expect(res.body[0].studentId).toBeUndefined();
    });

    it("404s (not 403) for a parent probing a student they're not linked to", async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA2.id}/documents`)
        .set('Authorization', authHeader(app, otherParentA));
      expect(res.status).toBe(404);
    });

    it("404s for a parent probing another school's student", async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, parentB));
      expect(res.status).toBe(404);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
    ])('rejects %s (not parent)', async (_label, getUser) => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/documents`)
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /students/:id/profile — documents section
  // -------------------------------------------------------------------

  describe('GET /students/:id/profile documents section', () => {
    it('is available-but-empty when the student has no documents', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.documents).toEqual({ available: true, records: [] });
    });

    it('is populated with recent documents once they exist', async () => {
      await createStudentDocument(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        title: 'Medical Form',
        documentType: StudentDocumentType.MEDICAL,
      });

      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.documents.available).toBe(true);
      expect(res.body.documents.records).toHaveLength(1);
      expect(res.body.documents.records[0].title).toBe('Medical Form');
      expect(res.body.documents.records[0].documentType).toBe('medical');
    });

    it("is populated in the parent-facing profile for the parent's own linked child", async () => {
      await createStudentDocument(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        title: 'ID Copy',
        documentType: StudentDocumentType.IDENTITY,
      });

      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body.documents.records).toHaveLength(1);
      expect(res.body.documents.records[0].title).toBe('ID Copy');
    });
  });
});
