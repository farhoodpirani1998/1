import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  createSubject,
  linkStudentUser,
  createHomework,
  authHeader,
  Role,
  HomeworkSubmissionStatus,
} from './setup/factories';
import { HomeworkSubmission } from '../src/modules/homework/entities/homework-submission.entity';

/**
 * Sprint H1.5 — Student Homework Submission API
 *
 * Proves that:
 * 1. POST /student/homework/:homeworkId/submit records a `submitted` row
 *    for the caller's own resolved student when today is on/before the
 *    homework's dueDate.
 * 2. The same route records a `late` row instead once today is past
 *    dueDate — computed from a plain string-date compare, no new status
 *    a caller can set directly.
 * 3. Calling it twice for the same homework corrects the existing row
 *    (HomeworkSubmissionService.recordSubmission()'s existing upsert on
 *    (homeworkId, studentId)) rather than creating a second one.
 * 4. A homeworkId belonging to another school 404s the same way every
 *    other findOneForSchool-backed read in this codebase does.
 * 5. Non-student roles are rejected (403).
 * 6. A nonexistent homeworkId within the caller's own school 404s.
 * 7. A homeworkId that belongs to the caller's own school but a
 *    *different* grade is rejected with 403, and writes no submission
 *    row — the grade-ownership check StudentService.submitMyHomework()
 *    now enforces on top of HomeworkService.findOneForSchool()'s
 *    tenant-only check (see that method's doc comment).
 */
describe('Student homework submission (Sprint H1.5 e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA: Awaited<ReturnType<typeof createGrade>>;
  let gradeA2: Awaited<ReturnType<typeof createGrade>>; // same school as gradeA, different grade
  let subjectA: Awaited<ReturnType<typeof createSubject>>;

  let acadYearB: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeB: Awaited<ReturnType<typeof createGrade>>;
  let subjectB: Awaited<ReturnType<typeof createSubject>>;
  let teacherB: Awaited<ReturnType<typeof createUser>>;

  let studentA1: Awaited<ReturnType<typeof createStudent>>;
  let studentUserA1: Awaited<ReturnType<typeof createUser>>;

  let homeworkFuture: Awaited<ReturnType<typeof createHomework>>; // dueDate in the future -- 'submitted'
  let homeworkPast: Awaited<ReturnType<typeof createHomework>>; // dueDate in the past -- 'late'
  let homeworkOtherSchool: Awaited<ReturnType<typeof createHomework>>; // belongs to schoolB
  let homeworkOtherGrade: Awaited<ReturnType<typeof createHomework>>; // same school as studentA1, different grade

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
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    teacherB = await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id });

    acadYearA = await createAcademicYear(app, schoolA.id, { title: '1404-1405', isCurrent: true });
    gradeA = await createGrade(app, schoolA.id, { title: 'Grade 7' });
    gradeA2 = await createGrade(app, schoolA.id, { title: 'Grade 8' });
    subjectA = await createSubject(app, schoolA.id, { title: 'Math' });

    acadYearB = await createAcademicYear(app, schoolB.id, { title: '1404-1405', isCurrent: true });
    gradeB = await createGrade(app, schoolB.id, { title: 'Grade 7' });
    subjectB = await createSubject(app, schoolB.id, { title: 'Math' });

    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      fullName: 'Student A1',
    });
    studentUserA1 = await createUser(app, {
      role: Role.STUDENT,
      schoolId: schoolA.id,
      username: 'student.a1',
    });
    await linkStudentUser(app, studentUserA1.id, studentA1.id);

    // Fixed, deliberately far-future/far-past dates rather than
    // Date.now()-derived ones, so the test doesn't become
    // date-dependent/flaky as the suite ages.
    homeworkFuture = await createHomework(app, {
      schoolId: schoolA.id,
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      subjectId: subjectA.id,
      teacherId: teacherA.id,
      title: 'Future homework',
      dueDate: '2099-01-01',
    });
    homeworkPast = await createHomework(app, {
      schoolId: schoolA.id,
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      subjectId: subjectA.id,
      teacherId: teacherA.id,
      title: 'Past homework',
      dueDate: '2000-01-01',
    });
    homeworkOtherSchool = await createHomework(app, {
      schoolId: schoolB.id,
      academicYearId: acadYearB.id,
      gradeId: gradeB.id,
      subjectId: subjectB.id,
      teacherId: teacherB.id,
      title: 'Other school homework',
      dueDate: '2099-01-01',
    });
    homeworkOtherGrade = await createHomework(app, {
      schoolId: schoolA.id,
      academicYearId: acadYearA.id,
      gradeId: gradeA2.id,
      subjectId: subjectA.id,
      teacherId: teacherA.id,
      title: 'Other grade homework (same school)',
      dueDate: '2099-01-01',
    });
  });

  describe('POST /student/homework/:homeworkId/submit', () => {
    it("records a 'submitted' row when today is on/before dueDate", async () => {
      const res = await request(server)
        .post(`/api/v1/student/homework/${homeworkFuture.id}/submit`)
        .set('Authorization', authHeader(app, studentUserA1))
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({ id: homeworkFuture.id, submissionStatus: 'submitted' }),
      );
      expect(res.body.submittedAt).not.toBeNull();

      const ds = getDataSource(app);
      const row = await ds.getRepository(HomeworkSubmission).findOne({
        where: { homeworkId: homeworkFuture.id, studentId: studentA1.id },
      });
      expect(row?.status).toBe(HomeworkSubmissionStatus.SUBMITTED);
    });

    it("records a 'late' row when today is past dueDate", async () => {
      const res = await request(server)
        .post(`/api/v1/student/homework/${homeworkPast.id}/submit`)
        .set('Authorization', authHeader(app, studentUserA1))
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({ id: homeworkPast.id, submissionStatus: 'late' }),
      );

      const ds = getDataSource(app);
      const row = await ds.getRepository(HomeworkSubmission).findOne({
        where: { homeworkId: homeworkPast.id, studentId: studentA1.id },
      });
      expect(row?.status).toBe(HomeworkSubmissionStatus.LATE);
    });

    it('resubmitting the same homework corrects the existing row instead of creating a second one', async () => {
      const first = await request(server)
        .post(`/api/v1/student/homework/${homeworkFuture.id}/submit`)
        .set('Authorization', authHeader(app, studentUserA1))
        .send({});
      expect(first.status).toBe(201);

      const second = await request(server)
        .post(`/api/v1/student/homework/${homeworkFuture.id}/submit`)
        .set('Authorization', authHeader(app, studentUserA1))
        .send({});
      expect(second.status).toBe(201);
      expect(second.body.submissionStatus).toBe('submitted');

      const ds = getDataSource(app);
      const rows = await ds.getRepository(HomeworkSubmission).find({
        where: { homeworkId: homeworkFuture.id, studentId: studentA1.id },
      });
      // Exactly one row for this (homework, student) pair -- the unique
      // constraint's own guarantee, proven end-to-end through the route.
      expect(rows).toHaveLength(1);
    });

    it('returns 404 for a homeworkId belonging to another school', async () => {
      const res = await request(server)
        .post(`/api/v1/student/homework/${homeworkOtherSchool.id}/submit`)
        .set('Authorization', authHeader(app, studentUserA1))
        .send({});

      expect(res.status).toBe(404);

      const ds = getDataSource(app);
      const count = await ds.getRepository(HomeworkSubmission).count({
        where: { homeworkId: homeworkOtherSchool.id },
      });
      expect(count).toBe(0);
    });

    it('returns 403 for a homeworkId in the same school but a different grade, and writes no row', async () => {
      const res = await request(server)
        .post(`/api/v1/student/homework/${homeworkOtherGrade.id}/submit`)
        .set('Authorization', authHeader(app, studentUserA1))
        .send({});

      expect(res.status).toBe(403);

      const ds = getDataSource(app);
      const count = await ds.getRepository(HomeworkSubmission).count({
        where: { homeworkId: homeworkOtherGrade.id },
      });
      expect(count).toBe(0);
    });

    it('returns 404 for a nonexistent homeworkId', async () => {
      const res = await request(server)
        .post('/api/v1/student/homework/00000000-0000-0000-0000-000000000000/submit')
        .set('Authorization', authHeader(app, studentUserA1))
        .send({});

      expect(res.status).toBe(404);
    });

    it('rejects non-student roles', async () => {
      const res = await request(server)
        .post(`/api/v1/student/homework/${homeworkFuture.id}/submit`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({});

      expect(res.status).toBe(403);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(server)
        .post(`/api/v1/student/homework/${homeworkFuture.id}/submit`)
        .send({});

      expect(res.status).toBe(401);
    });
  });
});
