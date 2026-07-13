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
  authHeader,
  TEST_PASSWORD,
  Role,
} from './setup/factories';

/**
 * Teacher Portal — E2E Sprint.
 *
 * This file intentionally does NOT re-cover ground already exercised
 * elsewhere:
 *   - teacher-portal.e2e-spec.ts already covers assignment CRUD
 *     (create/duplicate/delete/validation/role auth), classes/subjects,
 *     students (load/grade filter/empty/unauthorized grade), attendance
 *     (record/upsert/validation/unassigned-grade rejection), and
 *     assessments (record/validation/duplicate-as-upsert/unassigned
 *     rejection).
 *   - homework.e2e-spec.ts already covers homework create/edit/delete,
 *     ownership 404s, and grade filtering on GET /homework (admin route).
 *   - timetable.e2e-spec.ts already covers GET /teacher/timetable's
 *     tenant/role scoping.
 *   - auth-security.e2e-spec.ts already covers tokenVersion/deactivation
 *     revocation.
 *
 * What's added here are the gaps the "E2E Sprint" scope calls out that
 * none of the above actually exercises: a plain teacher login/invalid-
 * credentials/protected-route flow, a dashboard-level aggregate
 * success/empty/unauthenticated pass over profile+classes+subjects
 * together, GET /teacher/homework's subject (and combined) filter, the
 * "assignment fallback" data contract the TeacherHomeworkPage edit form
 * relies on (a homework row survives its originating assignment being
 * removed), teacher timetable's empty state and retry-idempotency, and a
 * handful of 400-vs-403/404 edge cases (malformed gradeId, nonexistent
 * studentId, missing required fields) that the happy-path-focused specs
 * above don't touch.
 */
describe('Teacher Portal — E2E Sprint', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA1: Awaited<ReturnType<typeof createGrade>>;
  let subjectA1: Awaited<ReturnType<typeof createSubject>>;
  let studentA1: Awaited<ReturnType<typeof createStudent>>;

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
    schoolAdminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id, fullName: 'Teacher A' });

    acadYearA = await createAcademicYear(app, schoolA.id);
    gradeA1 = await createGrade(app, schoolA.id, { title: 'Grade 7' });
    subjectA1 = await createSubject(app, schoolA.id, { title: 'Math' });
    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      fullName: 'Student A1',
    });
  });

  // -------------------------------------------------------------------
  // 1. Authentication
  // -------------------------------------------------------------------

  describe('Authentication', () => {
    it('lets a teacher log in with valid credentials', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: teacherA.phone, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user.id).toBe(teacherA.id);
      expect(res.body.user.role).toBe('teacher');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects an invalid password with the same message as an unknown phone (no user enumeration)', async () => {
      const wrongPassword = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: teacherA.phone, password: 'TotallyWrongPassw0rd!' });
      const unknownPhone = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: '+989000000000', password: TEST_PASSWORD });

      expect(wrongPassword.status).toBe(401);
      expect(unknownPhone.status).toBe(401);
      expect(wrongPassword.body.message).toBe(unknownPhone.body.message);
    });

    it('rejects a malformed login payload (password below minimum length)', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: teacherA.phone, password: '123' });
      expect(res.status).toBe(400);
    });

    it('rejects an inactive teacher account at login', async () => {
      const inactive = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id, isActive: false });
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: inactive.phone, password: TEST_PASSWORD });
      expect(res.status).toBe(401);
    });

    it('rejects every /teacher/* route without a token (protected routes)', async () => {
      const routes = ['/api/v1/teacher/profile', '/api/v1/teacher/classes', '/api/v1/teacher/subjects'];
      for (const route of routes) {
        const res = await request(server).get(route);
        expect(res.status).toBe(401);
      }
    });

    it('rejects a garbage/invalid bearer token', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/profile')
        .set('Authorization', 'Bearer not-a-real-jwt');
      expect(res.status).toBe(401);
    });

    it('rejects a well-formed token for a role the route does not allow (role guard)', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/profile')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });

    it("login response's user.role lets the frontend route each persona to its own portal", async () => {
      const teacherLogin = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: teacherA.phone, password: TEST_PASSWORD });
      const adminLogin = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: schoolAdminA.phone, password: TEST_PASSWORD });

      expect(teacherLogin.body.user.role).toBe('teacher');
      expect(adminLogin.body.user.role).toBe('school_admin');
    });
  });

  // -------------------------------------------------------------------
  // 2. Teacher Dashboard (profile + classes + subjects, aggregated)
  // -------------------------------------------------------------------

  describe('Teacher Dashboard', () => {
    it('success: a teacher with assignments gets consistent profile/classes/subjects', async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });

      const [profile, classes, subjects] = await Promise.all([
        request(server).get('/api/v1/teacher/profile').set('Authorization', authHeader(app, teacherA)),
        request(server).get('/api/v1/teacher/classes').set('Authorization', authHeader(app, teacherA)),
        request(server).get('/api/v1/teacher/subjects').set('Authorization', authHeader(app, teacherA)),
      ]);

      expect(profile.status).toBe(200);
      expect(classes.status).toBe(200);
      expect(subjects.status).toBe(200);
      expect(profile.body.assignments).toHaveLength(1);
      expect(classes.body.map((c: any) => c.title)).toEqual(['Grade 7']);
      expect(subjects.body.map((s: any) => s.title)).toEqual(['Math']);
    });

    it('empty state: a freshly-created teacher with no assignments gets empty arrays, not an error', async () => {
      const freshTeacher = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });

      const [profile, classes, subjects] = await Promise.all([
        request(server).get('/api/v1/teacher/profile').set('Authorization', authHeader(app, freshTeacher)),
        request(server).get('/api/v1/teacher/classes').set('Authorization', authHeader(app, freshTeacher)),
        request(server).get('/api/v1/teacher/subjects').set('Authorization', authHeader(app, freshTeacher)),
      ]);

      expect(profile.status).toBe(200);
      expect(profile.body.assignments).toEqual([]);
      expect(classes.status).toBe(200);
      expect(classes.body).toEqual([]);
      expect(subjects.status).toBe(200);
      expect(subjects.body).toEqual([]);
    });

    it('error state: every dashboard request 401s cleanly without a token (what the frontend Retry surface reacts to)', async () => {
      const [profile, classes, subjects] = await Promise.all([
        request(server).get('/api/v1/teacher/profile'),
        request(server).get('/api/v1/teacher/classes'),
        request(server).get('/api/v1/teacher/subjects'),
      ]);
      expect(profile.status).toBe(401);
      expect(classes.status).toBe(401);
      expect(subjects.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // 4. Teacher Students — validation gap
  // -------------------------------------------------------------------

  describe('GET /teacher/students — validation', () => {
    it('rejects a malformed gradeId with 400 (validation), not 403 (authorization)', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/students')
        .query({ gradeId: 'not-a-uuid' })
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // 5. Teacher Attendance — error-handling gap
  // -------------------------------------------------------------------

  describe('POST /teacher/attendance — error handling', () => {
    beforeEach(async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
    });

    it('404s a nonexistent studentId', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/attendance')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: '00000000-0000-0000-0000-000000000000', date: '2026-07-01', status: 'present' });
      expect(res.status).toBe(404);
    });

    it('rejects a missing required field (date)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/attendance')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, status: 'present' });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // 6. Teacher Assessments — error-handling gap
  // -------------------------------------------------------------------

  describe('POST /teacher/assessments — error handling', () => {
    beforeEach(async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
    });

    it('404s a nonexistent studentId', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({
          studentId: '00000000-0000-0000-0000-000000000000',
          subjectId: subjectA1.id,
          term: 'first_term',
          score: 18,
        });
      expect(res.status).toBe(404);
    });

    it('rejects a missing required field (score)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: 'first_term' });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // 7. Teacher Homework — filter, academicYear, and assignment-fallback gaps
  // -------------------------------------------------------------------

  describe('GET /teacher/homework — filters', () => {
    let gradeA2: Awaited<ReturnType<typeof createGrade>>;
    let subjectA2: Awaited<ReturnType<typeof createSubject>>;

    beforeEach(async () => {
      gradeA2 = await createGrade(app, schoolA.id, { title: 'Grade 8' });
      subjectA2 = await createSubject(app, schoolA.id, { title: 'Science' });
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA2.id,
        subjectId: subjectA2.id,
      });
      await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
        teacherId: teacherA.id,
        title: 'Math homework',
      });
      await createHomework(app, {
        schoolId: schoolA.id,
        academicYearId: acadYearA.id,
        gradeId: gradeA2.id,
        subjectId: subjectA2.id,
        teacherId: teacherA.id,
        title: 'Science homework',
      });
    });

    it('filters by subjectId alone', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/homework')
        .query({ subjectId: subjectA2.id })
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(200);
      expect(res.body.map((h: any) => h.title)).toEqual(['Science homework']);
    });

    it('filters by gradeId and subjectId together', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/homework')
        .query({ gradeId: gradeA1.id, subjectId: subjectA1.id })
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(200);
      expect(res.body.map((h: any) => h.title)).toEqual(['Math homework']);
    });

    it('a mismatched grade+subject combination returns an empty list, not an error', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/homework')
        .query({ gradeId: gradeA1.id, subjectId: subjectA2.id })
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("every returned row carries academicYearId, independent of which grade/subject filter is applied (what the frontend's academic-year picker relies on)", async () => {
      const unfiltered = await request(server)
        .get('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA));
      const filtered = await request(server)
        .get('/api/v1/teacher/homework')
        .query({ gradeId: gradeA1.id })
        .set('Authorization', authHeader(app, teacherA));

      expect(unfiltered.body.every((h: any) => h.academicYearId === acadYearA.id)).toBe(true);
      expect(filtered.body.every((h: any) => h.academicYearId === acadYearA.id)).toBe(true);
      // The unfiltered list is the superset the frontend's
      // resolveAcademicYearOptions() must be built from — narrowing by
      // grade must never shrink the set of academic years available in
      // the create/edit form.
      expect(unfiltered.body.length).toBeGreaterThanOrEqual(filtered.body.length);
    });
  });

  describe('Homework — assignment fallback (survives assignment removal)', () => {
    it('a homework row remains fully readable, with its original grade/subject intact, after the underlying assignment is removed', async () => {
      const assignment = await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
      const created = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
        .send({
          academicYearId: acadYearA.id,
          gradeId: gradeA1.id,
          subjectId: subjectA1.id,
          title: 'Orphaned homework',
          description: 'Still valid even after the assignment is gone.',
          dueDate: '2026-12-15',
        });
      expect(created.status).toBe(201);

      // school_admin removes the (grade, subject) assignment this
      // homework was created under.
      const removed = await request(server)
        .delete(`/api/v1/teacher/assignments/${assignment.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(removed.status).toBe(204);

      // The homework list (and the record itself) must still show the
      // correct grade/subject — this is exactly the data
      // TeacherHomeworkPage's edit-mode Select falls back to when the
      // live assignment list no longer contains the pair.
      const list = await request(server)
        .get('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA));
      expect(list.status).toBe(200);
      const orphan = list.body.find((h: any) => h.id === created.body.id);
      expect(orphan).toBeDefined();
      expect(orphan.gradeId).toBe(gradeA1.id);
      expect(orphan.subjectId).toBe(subjectA1.id);
      expect(orphan.gradeTitle).toBe('Grade 7');
      expect(orphan.subjectTitle).toBe('Math');

      // Deleting an orphaned row is still allowed (ownership-only check,
      // no assignment gate) — a teacher must always be able to remove
      // their own homework.
      const del = await request(server)
        .delete(`/api/v1/teacher/homework/${created.body.id}`)
        .set('Authorization', authHeader(app, teacherA));
      expect(del.status).toBe(204);
    });

    it('editing an orphaned row back onto the same (now-unassigned) grade/subject is rejected (intentional — assignment is re-validated on every write)', async () => {
      const assignment = await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
      const created = await request(server)
        .post('/api/v1/teacher/homework')
        .set('Authorization', authHeader(app, teacherA))
        .send({
          academicYearId: acadYearA.id,
          gradeId: gradeA1.id,
          subjectId: subjectA1.id,
          title: 'Orphaned homework',
          description: 'Editable only while the assignment still exists.',
          dueDate: '2026-12-15',
        });

      await request(server)
        .delete(`/api/v1/teacher/assignments/${assignment.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));

      // A title-only correction still re-validates the (unchanged)
      // grade/subject against the teacher's current assignments — this
      // documents existing, intentional behavior (see
      // HomeworkService.update()'s doc comment: a partial update can
      // never land in a state create() would have rejected outright), it
      // is not something this sprint changes.
      const res = await request(server)
        .put(`/api/v1/teacher/homework/${created.body.id}`)
        .set('Authorization', authHeader(app, teacherA))
        .send({ title: 'Corrected title' });
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // 8. Teacher Timetable — empty state, unauthenticated, retry
  // -------------------------------------------------------------------

  describe('GET /teacher/timetable — empty state and retry', () => {
    it('returns an empty list (not an error) for a teacher with no scheduled periods', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/timetable')
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(server).get('/api/v1/teacher/timetable');
      expect(res.status).toBe(401);
    });

    it('is idempotent across repeated calls (what a frontend Retry button relies on)', async () => {
      const first = await request(server)
        .get('/api/v1/teacher/timetable')
        .set('Authorization', authHeader(app, teacherA));
      const second = await request(server)
        .get('/api/v1/teacher/timetable')
        .set('Authorization', authHeader(app, teacherA));
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
    });
  });
});
