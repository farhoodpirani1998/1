import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  createSubject,
  createTeacherAssignment,
  createHomework,
  linkParentStudent,
  authHeader,
  Role,
} from './setup/factories';

/**
 * Phase 5L: Homework & Assignments
 *
 * Proves that:
 * 1. A teacher can post homework (POST /teacher/homework) only for a
 *    (grade, subject) pair they hold a TeacherAssignment for; an
 *    unassigned pair is rejected (403), and a cross-school
 *    grade/subject/academicYear id 404s or 403s the same way
 *    TimetableService's relation checks do.
 * 2. GET /teacher/homework only ever returns the calling teacher's own
 *    postings.
 * 3. PUT/DELETE /teacher/homework/:id only ever operate on homework the
 *    calling teacher created themselves -- another teacher's row (or
 *    another school's) 404s, not 403.
 * 4. DTO validation rejects a malformed create payload (missing/blank
 *    title, invalid dueDate, non-URL attachmentUrl).
 * 5. GET /homework (school_admin) returns every homework row in the
 *    caller's own school, optionally filtered, and is rejected for every
 *    non-school_admin role.
 * 6. GET /parent/students/:id/homework only ever returns a parent's own
 *    linked child's *grade* homework -- never another family's, never
 *    cross-school -- and is rejected for every non-parent role.
 * 7. GET /students/:id/profile's homework section is populated
 *    (available: true) with recent records once homework exists for the
 *    student's grade.
 */
describe('Homework & Assignments (Phase 5L e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let otherTeacherA: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminB: Awaited<ReturnType<typeof createUser>>;
  let teacherB: Awaited<ReturnType<typeof createUser>>;

  let parentA: Awaited<ReturnType<typeof createUser>>;
  let otherParentA: Awaited<ReturnType<typeof createUser>>;
  let parentB: Awaited<ReturnType<typeof createUser>>;

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA: Awaited<ReturnType<typeof createGrade>>;
  let otherGradeA: Awaited<ReturnType<typeof createGrade>>;
  let subjectA: Awaited<ReturnType<typeof createSubject>>;

  let acadYearB: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeB: Awaited<ReturnType<typeof createGrade>>;
  let subjectB: Awaited<ReturnType<typeof createSubject>>;

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
    otherTeacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });
    teacherB = await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id });

    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    otherParentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    parentB = await createUser(app, { role: Role.PARENT, schoolId: schoolB.id });

    acadYearA = await createAcademicYear(app, schoolA.id);
    gradeA = await createGrade(app, schoolA.id);
    otherGradeA = await createGrade(app, schoolA.id);
    subjectA = await createSubject(app, schoolA.id);

    acadYearB = await createAcademicYear(app, schoolB.id);
    gradeB = await createGrade(app, schoolB.id);
    subjectB = await createSubject(app, schoolB.id);

    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
    });
    studentA2 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: otherGradeA.id,
    });
    studentB1 = await createStudent(app, schoolB.id, {
      academicYearId: acadYearB.id,
      gradeId: gradeB.id,
    });

    await linkParentStudent(app, parentA.id, studentA1.id);

    // teacherA is assigned to (gradeA, subjectA) only.
    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: teacherA.id,
      gradeId: gradeA.id,
      subjectId: subjectA.id,
    });
  });

  function validPayload(overrides: Record<string, unknown> = {}) {
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

  // -------------------------------------------------------------------
  // POST /teacher/homework
  // -------------------------------------------------------------------

  describe('POST /teacher/homework', () => {
    it('lets an assigned teacher post homework for their own grade+subject', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
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
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
        .send(validPayload());
      expect(res.status).toBe(201);
      expect(res.body.attachmentUrl).toBeNull();
    });

    it('rejects a teacher posting for a grade+subject they are not assigned to', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, otherTeacherA))
        .send(validPayload());
      expect(res.status).toBe(403);
    });

    it("rejects a teacher posting for another school's grade", async () => {
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
        .send(validPayload({ gradeId: gradeB.id }));
      expect(res.status).toBe(403);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['parent', () => parentA],
    ])('rejects %s (not teacher)', async (_label, getUser) => {
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, getUser()))
        .send(validPayload());
      expect(res.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(server).post('/api/v1/teacher/homework').send(validPayload());
      expect(res.status).toBe(401);
    });

    it('rejects a missing title', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
        .send(validPayload({ title: undefined }));
      expect(res.status).toBe(400);
    });

    it('rejects a blank title', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
        .send(validPayload({ title: '' }));
      expect(res.status).toBe(400);
    });

    it('rejects an invalid dueDate', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
        .send(validPayload({ dueDate: 'not-a-date' }));
      expect(res.status).toBe(400);
    });

    it('rejects a non-URL attachmentUrl', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
        .send(validPayload({ attachmentUrl: 'not-a-url' }));
      expect(res.status).toBe(400);
    });

    it('rejects a teacherId supplied in the body (ignored/rejected, never trusted)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
        .send(validPayload({ teacherId: otherTeacherA.id }));
      // forbidNonWhitelisted rejects the unknown field outright.
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // GET /teacher/homework
  // -------------------------------------------------------------------

  describe('GET /teacher/homework', () => {
    it("lists only the calling teacher's own postings", async () => {
      const mine = await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        title: 'Mine',
      });
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: otherTeacherA.id,
        gradeId: otherGradeA.id,
        subjectId: subjectA.id,
      });
      await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: otherGradeA.id,
        subjectId: subjectA.id,
        teacherId: otherTeacherA.id,
        title: 'Not mine',
      });

      const res = await request(server)
        .get('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(mine.id);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['parent', () => parentA],
    ])('rejects %s (not teacher)', async (_label, getUser) => {
      const res = await request(server)
        .get('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // PUT /teacher/homework/:id
  // -------------------------------------------------------------------

  describe('PUT /teacher/homework/:id', () => {
    it('lets the creating teacher correct their own homework', async () => {
      const homework = await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });

      const res = await request(server)
        .put(`/api/v1/teacher/homework/${homework.id}`)
        .set('Authorization', authHeader(app, teacherA))
        .send({ title: 'Updated Title', dueDate: '2026-10-01' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
      expect(res.body.dueDate).toBe('2026-10-01');
    });

    it("404s (not 403) updating another teacher's homework", async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: otherTeacherA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
      });
      const homework = await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: otherTeacherA.id,
      });

      const res = await request(server)
        .put(`/api/v1/teacher/homework/${homework.id}`)
        .set('Authorization', authHeader(app, teacherA))
        .send({ title: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    it("404s updating another school's homework", async () => {
      const homework = await createHomework(app, {
        schoolId: schoolB.id,
        academicYearId: acadYearB.id,
        gradeId: gradeB.id,
        subjectId: subjectB.id,
        teacherId: teacherB.id,
      });
      const res = await request(server)
        .put(`/api/v1/teacher/homework/${homework.id}`)
        .set('Authorization', authHeader(app, teacherA))
        .send({ title: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    it('rejects moving homework to a grade+subject the teacher is not assigned to', async () => {
      const homework = await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });
      const res = await request(server)
        .put(`/api/v1/teacher/homework/${homework.id}`)
        .set('Authorization', authHeader(app, teacherA))
        .send({ gradeId: otherGradeA.id });
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // DELETE /teacher/homework/:id
  // -------------------------------------------------------------------

  describe('DELETE /teacher/homework/:id', () => {
    it('lets the creating teacher delete their own homework', async () => {
      const homework = await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });
      const res = await request(server)
        .delete(`/api/v1/teacher/homework/${homework.id}`)
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(204);

      const list = await request(server)
        .get('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA));
      expect(list.body).toHaveLength(0);
    });

    it("404s (not 403) deleting another teacher's homework", async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: otherTeacherA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
      });
      const homework = await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: otherTeacherA.id,
      });
      const res = await request(server)
        .delete(`/api/v1/teacher/homework/${homework.id}`)
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(404);
    });

    it('404s deleting a nonexistent id', async () => {
      const res = await request(server)
        .delete('/api/v1/teacher/homework/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------
  // GET /homework (school_admin)
  // -------------------------------------------------------------------

  describe('GET /homework', () => {
    it("lets school_admin list every homework row in their own school", async () => {
      await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        title: 'A1',
      });
      await createHomework(app, {
        schoolId: schoolB.id,
        academicYearId: acadYearB.id,
        gradeId: gradeB.id,
        subjectId: subjectB.id,
        teacherId: teacherB.id,
        title: 'B1',
      });

      const res = await request(server)
        .get('/api/v1/homework')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('A1');
    });

    it('filters by gradeId', async () => {
      await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        title: 'For gradeA',
      });
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: otherTeacherA.id,
        gradeId: otherGradeA.id,
        subjectId: subjectA.id,
      });
      await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: otherGradeA.id,
        subjectId: subjectA.id,
        teacherId: otherTeacherA.id,
        title: 'For otherGradeA',
      });

      const res = await request(server)
        .get(`/api/v1/homework?gradeId=${gradeA.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));

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
      const res = await request(server)
        .get('/api/v1/homework')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /parent/students/:id/homework
  // -------------------------------------------------------------------

  describe('GET /parent/students/:id/homework', () => {
    it("returns only the parent's own linked child's grade homework", async () => {
      const homework = await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        title: 'Grade A homework',
      });
      // Another grade's homework must never appear.
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: otherTeacherA.id,
        gradeId: otherGradeA.id,
        subjectId: subjectA.id,
      });
      await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: otherGradeA.id,
        subjectId: subjectA.id,
        teacherId: otherTeacherA.id,
        title: 'Other grade homework',
      });

      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/homework`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(homework.id);
      expect(res.body[0].title).toBe('Grade A homework');
    });

    it("404s (not 403) for a parent probing a student they're not linked to", async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA2.id}/homework`)
        .set('Authorization', authHeader(app, otherParentA));
      expect(res.status).toBe(404);
    });

    it("404s for a parent probing another school's student", async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/homework`)
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
        .get(`/api/v1/parent/students/${studentA1.id}/homework`)
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /students/:id/profile — homework section
  // -------------------------------------------------------------------

  describe('GET /students/:id/profile homework section', () => {
    it('is available-but-empty when the grade has no homework', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.homework).toEqual({ available: true, records: [] });
    });

    it('is populated with recent homework once it exists for the grade', async () => {
      await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        title: 'Reading Assignment',
      });

      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.homework.available).toBe(true);
      expect(res.body.homework.records).toHaveLength(1);
      expect(res.body.homework.records[0].title).toBe('Reading Assignment');
    });

    it("is populated in the parent-facing profile for the parent's own linked child", async () => {
      await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        title: 'Parent Visible Homework',
      });

      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body.homework.records).toHaveLength(1);
      expect(res.body.homework.records[0].title).toBe('Parent Visible Homework');
    });
  });
});
