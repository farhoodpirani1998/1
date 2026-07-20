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
 * Sprint A.3.3 — Teacher Homework Submission API
 *
 * Proves that:
 * 1. GET /teacher/homework/:id/submissions returns every submission row
 *    recorded for one of the teacher's own accessible homework, reusing
 *    HomeworkSubmissionService.findForHomework() -- and can be narrowed
 *    by an explicit `status` query param.
 * 2. GET /teacher/homework/:id/submissions/summary is roster-aware: its
 *    totalStudents/missingCount are derived from the teacher's actual
 *    assigned class roster (TeacherService.getMyStudents()), NOT merely
 *    from the submission rows that happen to exist -- a roster student
 *    with no row at all counts toward missingCount rather than vanishing.
 * 3. GET /teacher/homework/:id/submissions/statistics reports the same
 *    roster-aware counts plus percentage rates derived from them.
 * 4. A teacher may only reach any of the three routes for homework whose
 *    (gradeId, subjectId) they actually hold a TeacherAssignment for --
 *    an unassigned (grade, subject) pair is rejected (403), even for a
 *    homeworkId that exists within the same school.
 * 5. A cross-school homeworkId 404s the same way every other
 *    findOneForSchool-backed read does.
 * 6. Every route is rejected for every non-teacher role, and for an
 *    unauthenticated caller.
 */
describe('Teacher Homework Submission API (Sprint A.3.3 e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>; // assigned to gradeA1/subjectA1, class-scoped to classA1a
  let unassignedTeacherA: Awaited<ReturnType<typeof createUser>>; // no assignments at all

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA1: Awaited<ReturnType<typeof createGrade>>;
  let classA1a: Awaited<ReturnType<typeof createClass>>; // teacherA is assigned here
  let classA1b: Awaited<ReturnType<typeof createClass>>; // a different section -- NOT assigned
  let subjectA1: Awaited<ReturnType<typeof createSubject>>;
  let subjectA2: Awaited<ReturnType<typeof createSubject>>; // teacherA is NOT assigned to this one

  let studentA1a1: Awaited<ReturnType<typeof createStudent>>; // classA1a -- in scope, will submit
  let studentA1a2: Awaited<ReturnType<typeof createStudent>>; // classA1a -- in scope, no row at all
  let studentA1b: Awaited<ReturnType<typeof createStudent>>; // classA1b -- NOT in scope

  let homeworkA1: Awaited<ReturnType<typeof createHomework>>; // gradeA1/subjectA1 -- teacherA accessible
  let homeworkA2: Awaited<ReturnType<typeof createHomework>>; // gradeA1/subjectA2 -- teacherA NOT assigned to this subject

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
    classA1b = await createClass(app, { schoolId: schoolA.id, gradeId: gradeA1.id, academicYearId: acadYearA.id, title: 'ب' });

    studentA1a1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      classId: classA1a.id,
      fullName: 'Student A1a-1',
    });
    studentA1a2 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      classId: classA1a.id,
      fullName: 'Student A1a-2',
    });
    studentA1b = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      classId: classA1b.id,
      fullName: 'Student A1b',
    });

    // teacherA: class-scoped to classA1a only, for subjectA1 only.
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
  });

  // -------------------------------------------------------------------
  // GET /teacher/homework/:id/submissions
  // -------------------------------------------------------------------

  describe('GET /teacher/homework/:id/submissions', () => {
    it('returns every submission row for an accessible homework', async () => {
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a1.id,
        status: HomeworkSubmissionStatus.SUBMITTED,
      });
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1b.id,
        status: HomeworkSubmissionStatus.LATE,
      });

      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const studentIds = res.body.map((s: any) => s.studentId).sort();
      expect(studentIds).toEqual([studentA1a1.id, studentA1b.id].sort());
    });

    it('narrows by an explicit status query param', async () => {
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a1.id,
        status: HomeworkSubmissionStatus.SUBMITTED,
      });
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a2.id,
        status: HomeworkSubmissionStatus.PENDING,
      });

      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions`)
        .query({ status: HomeworkSubmissionStatus.SUBMITTED })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].studentId).toBe(studentA1a1.id);
    });

    it('rejects an invalid status query value (400)', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions`)
        .query({ status: 'not-a-real-status' })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(400);
    });

    it('rejects a homework the teacher is not assigned to (403)', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA2.id}/submissions`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(403);
    });

    it('rejects every homework for a teacher with no assignments at all (403)', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions`)
        .set(authHeader(app, unassignedTeacherA));

      expect(res.status).toBe(403);
    });

    it('404s a homeworkId from another school', async () => {
      const acadYearB = await createAcademicYear(app, schoolB.id);
      const gradeB = await createGrade(app, schoolB.id);
      const subjectB = await createSubject(app, schoolB.id);
      const teacherB = await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id });
      const homeworkB = await createHomework(app, {
        schoolId: schoolB.id,
        academicYearId: acadYearB.id,
        gradeId: gradeB.id,
        subjectId: subjectB.id,
        teacherId: teacherB.id,
      });

      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkB.id}/submissions`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(404);
    });

    it('is rejected for an unauthenticated caller', async () => {
      const res = await request(server).get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions`);
      expect(res.status).toBe(401);
    });

    it('is rejected for a non-teacher role', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions`)
        .set(authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /teacher/homework/:id/submissions/summary
  // -------------------------------------------------------------------

  describe('GET /teacher/homework/:id/submissions/summary', () => {
    it('is roster-aware: totalStudents reflects the assigned class, not just existing rows', async () => {
      // Only studentA1a1 has a submission row; studentA1a2 (also in the
      // teacher's assigned classA1a roster) has none at all.
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a1.id,
        status: HomeworkSubmissionStatus.SUBMITTED,
      });

      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/summary`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        homeworkId: homeworkA1.id,
        // Roster is classA1a only (teacherA's class-scoped assignment) --
        // studentA1b (classA1b) must never be counted, even though a row
        // for them would be scoped to the same homework/school.
        totalStudents: 2,
        submittedCount: 1,
        pendingCount: 0,
        lateCount: 0,
        // studentA1a2 has no row at all -- must be derived as missing,
        // not silently absent from every count.
        missingCount: 1,
      });
    });

    it('counts an explicit missing-status row the same as a student with no row', async () => {
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a1.id,
        status: HomeworkSubmissionStatus.MISSING,
      });
      // studentA1a2 has no row at all.

      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/summary`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.totalStudents).toBe(2);
      expect(res.body.missingCount).toBe(2);
    });

    it('never counts a submission row outside the teacher\'s own class scope', async () => {
      // studentA1b (classA1b -- NOT teacherA's assigned section) submits,
      // but must not inflate any count in teacherA's summary.
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1b.id,
        status: HomeworkSubmissionStatus.SUBMITTED,
      });

      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/summary`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.totalStudents).toBe(2);
      expect(res.body.submittedCount).toBe(0);
      expect(res.body.missingCount).toBe(2);
    });

    it('reports a full breakdown across all four statuses', async () => {
      const studentA1a3 = await createStudent(app, schoolA.id, {
        academicYearId: acadYearA.id,
        gradeId: gradeA1.id,
        classId: classA1a.id,
        fullName: 'Student A1a-3',
      });
      const studentA1a4 = await createStudent(app, schoolA.id, {
        academicYearId: acadYearA.id,
        gradeId: gradeA1.id,
        classId: classA1a.id,
        fullName: 'Student A1a-4',
      });

      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a1.id,
        status: HomeworkSubmissionStatus.SUBMITTED,
      });
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a2.id,
        status: HomeworkSubmissionStatus.PENDING,
      });
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a3.id,
        status: HomeworkSubmissionStatus.LATE,
      });
      // studentA1a4 gets no row -- derived as missing.

      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/summary`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totalStudents: 4,
        submittedCount: 1,
        pendingCount: 1,
        lateCount: 1,
        missingCount: 1,
      });
    });

    it('rejects a homework the teacher is not assigned to (403)', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA2.id}/submissions/summary`)
        .set(authHeader(app, teacherA));
      expect(res.status).toBe(403);
    });

    it('404s a nonexistent homeworkId', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/homework/00000000-0000-0000-0000-000000000000/submissions/summary')
        .set(authHeader(app, teacherA));
      expect(res.status).toBe(404);
    });

    it('is rejected for a non-teacher role', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/summary`)
        .set(authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });

    it('is rejected for an unauthenticated caller', async () => {
      const res = await request(server).get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/summary`);
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // GET /teacher/homework/:id/submissions/statistics
  // -------------------------------------------------------------------

  describe('GET /teacher/homework/:id/submissions/statistics', () => {
    it('reports roster-aware counts plus percentage rates', async () => {
      // Roster: studentA1a1 (submitted), studentA1a2 (no row -> missing).
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a1.id,
        status: HomeworkSubmissionStatus.SUBMITTED,
      });

      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/statistics`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totalStudents: 2,
        submittedCount: 1,
        missingCount: 1,
        submissionRate: 50,
        onTimeRate: 50,
        lateRate: 0,
        missingRate: 50,
        pendingRate: 0,
      });
    });

    it('folds late submissions into submissionRate alongside on-time ones', async () => {
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a1.id,
        status: HomeworkSubmissionStatus.LATE,
      });
      await createHomeworkSubmission(app, {
        schoolId: schoolA.id,
        homeworkId: homeworkA1.id,
        studentId: studentA1a2.id,
        status: HomeworkSubmissionStatus.SUBMITTED,
      });

      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/statistics`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.submissionRate).toBe(100);
      expect(res.body.onTimeRate).toBe(50);
      expect(res.body.lateRate).toBe(50);
    });

    it('rejects a homework the teacher is not assigned to (403)', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA2.id}/submissions/statistics`)
        .set(authHeader(app, teacherA));
      expect(res.status).toBe(403);
    });

    it('is rejected for a non-teacher role', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/statistics`)
        .set(authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });

    it('is rejected for an unauthenticated caller', async () => {
      const res = await request(server).get(`/api/v1/teacher/homework/${homeworkA1.id}/submissions/statistics`);
      expect(res.status).toBe(401);
    });
  });
});
