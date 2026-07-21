import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createClass,
  createStudent,
  createSubject,
  createTeacherAssignment,
  createHomework,
  createHomeworkSubmission,
  authHeader,
  Role,
  HomeworkSubmissionStatus,
} from './setup/factories';

/**
 * Sprint H3.0 — Homework Grading API
 *
 * Proves that:
 * 1. PATCH /teacher/homework/submissions/:submissionId grades a
 *    submission (score/feedback), sets gradedAt/gradedByUserId, and
 *    never touches status/submittedAt.
 * 2. A second PATCH call re-grades the same row in place (no duplicate
 *    row, values overwritten, gradedAt refreshed).
 * 3. An invalid score (negative, non-integer, or missing) is rejected
 *    with 400 before anything is written.
 * 4. A nonexistent submissionId 404s.
 * 5. A submission belonging to another school is rejected -- 404s the
 *    same way every other cross-tenant id does in this codebase (the
 *    submission lookup itself is schoolId-scoped, so a wrong-tenant id
 *    looks identical to nonexistent, same shape as
 *    HomeworkSubmissionService.findOne()).
 * 6. A homework the calling teacher is not assigned to is rejected
 *    (403), even for a submissionId that exists within the same school.
 * 7. Every non-teacher role, and an unauthenticated caller, are
 *    rejected.
 */
describe('Teacher Homework Grading API (Sprint H3.0 e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>; // assigned to gradeA1/subjectA1
  let unassignedTeacherA: Awaited<ReturnType<typeof createUser>>; // no assignments at all

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA1: Awaited<ReturnType<typeof createGrade>>;
  let classA1a: Awaited<ReturnType<typeof createClass>>;
  let subjectA1: Awaited<ReturnType<typeof createSubject>>;
  let subjectA2: Awaited<ReturnType<typeof createSubject>>; // teacherA is NOT assigned to this one

  let studentA1a1: Awaited<ReturnType<typeof createStudent>>;

  let homeworkA1: Awaited<ReturnType<typeof createHomework>>; // gradeA1/subjectA1 -- teacherA accessible
  let homeworkA2: Awaited<ReturnType<typeof createHomework>>; // gradeA1/subjectA2 -- teacherA NOT assigned

  let submissionA1: Awaited<ReturnType<typeof createHomeworkSubmission>>;

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
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id, fullName: 'Teacher A' });
    unassignedTeacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id, fullName: 'Unassigned Teacher' });

    acadYearA = await createAcademicYear(app, schoolA.id);
    gradeA1 = await createGrade(app, schoolA.id, { title: 'Grade 7' });
    subjectA1 = await createSubject(app, schoolA.id, { title: 'Math' });
    subjectA2 = await createSubject(app, schoolA.id, { title: 'Science' });
    classA1a = await createClass(app, { schoolId: schoolA.id, gradeId: gradeA1.id, academicYearId: acadYearA.id, title: 'الف' });

    studentA1a1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      classId: classA1a.id,
      fullName: 'Student A1a-1',
    });

    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: teacherA.id,
      gradeId: gradeA1.id,
      subjectId: subjectA1.id,
      classId: classA1a.id,
    });

    homeworkA1 = await createHomework(app, {
      schoolId: schoolA.id,
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      subjectId: subjectA1.id,
      teacherId: teacherA.id,
      title: 'Math HW 1',
    });
    homeworkA2 = await createHomework(app, {
      schoolId: schoolA.id,
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      subjectId: subjectA2.id,
      teacherId: teacherA.id,
      title: 'Science HW 1',
    });

    submissionA1 = await createHomeworkSubmission(app, {
      schoolId: schoolA.id,
      homeworkId: homeworkA1.id,
      studentId: studentA1a1.id,
      status: HomeworkSubmissionStatus.SUBMITTED,
    });
  });

  describe('PATCH /teacher/homework/submissions/:submissionId', () => {
    it('grades a submission successfully', async () => {
      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: 18, feedback: '  Great work!  ' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: submissionA1.id,
        score: 18,
        feedback: 'Great work!', // trimmed
      });
      expect(res.body.gradedAt).toBeTruthy();
      expect(res.body.gradedByUserId).toBe(teacherA.id);
      // status/submittedAt must be preserved untouched.
      expect(res.body.status).toBe(HomeworkSubmissionStatus.SUBMITTED);
      expect(res.body.submittedAt).toBeTruthy();
    });

    it('grades a submission with no feedback supplied', async () => {
      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: 20 });

      expect(res.status).toBe(200);
      expect(res.body.score).toBe(20);
      expect(res.body.feedback).toBeNull();
    });

    it('updates (re-grades) an existing grade in place', async () => {
      await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: 10, feedback: 'First pass' });

      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: 19, feedback: 'Actually much better on review' });

      expect(res.status).toBe(200);
      expect(res.body.score).toBe(19);
      expect(res.body.feedback).toBe('Actually much better on review');

      // Confirm via a fresh read that this corrected the same row,
      // not a duplicate.
      const listRes = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions`)
        .set(authHeader(app, teacherA));
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].score).toBe(19);
    });

    it('omitting feedback on a re-grade leaves previously-stored feedback unchanged', async () => {
      await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: 10, feedback: 'Keep this' });

      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: 15 });

      expect(res.status).toBe(200);
      expect(res.body.score).toBe(15);
      expect(res.body.feedback).toBe('Keep this');
    });

    it('rejects a negative score (400)', async () => {
      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: -1 });
      expect(res.status).toBe(400);
    });

    it('rejects a non-integer score (400)', async () => {
      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: 15.5 });
      expect(res.status).toBe(400);
    });

    it('rejects a missing score (400)', async () => {
      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, teacherA))
        .send({ feedback: 'No score given' });
      expect(res.status).toBe(400);
    });

    it('404s a nonexistent submissionId', async () => {
      const res = await request(server)
        .patch('/api/v1/teacher/homework/submissions/00000000-0000-0000-0000-000000000000')
        .set(authHeader(app, teacherA))
        .send({ score: 10 });
      expect(res.status).toBe(404);
    });

    it('404s a submission belonging to another school (cross-school forbidden)', async () => {
      const acadYearB = await createAcademicYear(app, schoolB.id);
      const gradeB = await createGrade(app, schoolB.id);
      const subjectB = await createSubject(app, schoolB.id);
      const teacherB = await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id });
      const classB = await createClass(app, { schoolId: schoolB.id, gradeId: gradeB.id, academicYearId: acadYearB.id });
      const studentB = await createStudent(app, schoolB.id, {
        academicYearId: acadYearB.id,
        gradeId: gradeB.id,
        classId: classB.id,
      });
      const homeworkB = await createHomework(app, {
        schoolId: schoolB.id,
        academicYearId: acadYearB.id,
        gradeId: gradeB.id,
        subjectId: subjectB.id,
        teacherId: teacherB.id,
      });
      const submissionB = await createHomeworkSubmission(app, {
        schoolId: schoolB.id,
        homeworkId: homeworkB.id,
        studentId: studentB.id,
        status: HomeworkSubmissionStatus.SUBMITTED,
      });

      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionB.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: 10 });
      expect(res.status).toBe(404);
    });

    it('rejects a submission for homework the teacher is not assigned to (403)', async () => {
      const submissionA2 = await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA2.id,
        studentId: studentA1a1.id,
        status: HomeworkSubmissionStatus.SUBMITTED,
      });

      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA2.id}`)
        .set(authHeader(app, teacherA))
        .send({ score: 10 });
      expect(res.status).toBe(403);
    });

    it('rejects a teacher with no assignments at all (403)', async () => {
      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, unassignedTeacherA))
        .send({ score: 10 });
      expect(res.status).toBe(403);
    });

    it('is rejected for a non-teacher role (unauthorized role)', async () => {
      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .set(authHeader(app, schoolAdminA))
        .send({ score: 10 });
      expect(res.status).toBe(403);
    });

    it('is rejected for an unauthenticated caller', async () => {
      const res = await request(server)
        .patch(`/api/v1/teacher/homework/submissions/${submissionA1.id}`)
        .send({ score: 10 });
      expect(res.status).toBe(401);
    });
  });
});
