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
  authHeader,
  Role,
  AssessmentTerm,
} from './setup/factories';

/**
 * Phase 5G: Teacher Portal Foundation
 *
 * Proves that:
 * 1. school_admin can assign a teacher to a grade+subject
 *    (POST /teacher/assignments), and the same triple twice is a no-op,
 *    not a duplicate row. Only school_admin may manage assignments;
 *    tenant checks reject a teacher/grade/subject from another school.
 * 2. GET /teacher/profile, /teacher/classes, /teacher/subjects,
 *    /teacher/students only ever reflect the calling teacher's own
 *    assignments -- never another teacher's, never another school's.
 * 3. POST /teacher/attendance succeeds for a student in an assigned
 *    grade (any subject) and is rejected (Forbidden) for a student in a
 *    grade the teacher isn't assigned to, reusing AttendanceService's
 *    own upsert-on-resubmit behavior underneath.
 * 4. POST /teacher/assessments succeeds only when the teacher holds the
 *    exact (grade, subject) assignment matching the student+subject in
 *    the request, and is rejected otherwise, reusing AssessmentsService's
 *    own validation (score > maxScore, etc.) underneath.
 * 5. DTO validation rejects malformed assignment/attendance/assessment
 *    payloads.
 * 6. Every /teacher/* route is rejected for every non-teacher role
 *    (except the school_admin-only /teacher/assignments management
 *    routes), and every /teacher/assignments route is rejected for
 *    every non-school_admin role.
 * 7. Sprint 2B: assignment responses (POST and GET) also carry the
 *    resolved teacherName/gradeTitle/subjectTitle, and GET /teacher/list
 *    (school_admin-only) returns the caller's own school's teacher-role
 *    users only, never a passwordHash, for the assignment picker on
 *    TeacherAssignmentsPage.
 */
describe('Teacher Portal (Phase 5G e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminB: Awaited<ReturnType<typeof createUser>>;

  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let otherTeacherA: Awaited<ReturnType<typeof createUser>>;
  let teacherB: Awaited<ReturnType<typeof createUser>>;

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA1: Awaited<ReturnType<typeof createGrade>>;
  let gradeA2: Awaited<ReturnType<typeof createGrade>>;
  let subjectA1: Awaited<ReturnType<typeof createSubject>>;
  let subjectA2: Awaited<ReturnType<typeof createSubject>>;

  let studentA1: Awaited<ReturnType<typeof createStudent>>; // in gradeA1
  let studentA2: Awaited<ReturnType<typeof createStudent>>; // in gradeA2
  let studentB1: Awaited<ReturnType<typeof createStudent>>; // schoolB

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
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });

    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id, fullName: 'Teacher A' });
    otherTeacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id, fullName: 'Other Teacher' });
    teacherB = await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id, fullName: 'Teacher B' });

    acadYearA = await createAcademicYear(app, schoolA.id);
    gradeA1 = await createGrade(app, schoolA.id, { title: 'Grade 7' });
    gradeA2 = await createGrade(app, schoolA.id, { title: 'Grade 8' });
    subjectA1 = await createSubject(app, schoolA.id, { title: 'Math' });
    subjectA2 = await createSubject(app, schoolA.id, { title: 'Science' });

    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      fullName: 'Student A1',
    });
    studentA2 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA2.id,
      fullName: 'Student A2',
    });
    const acadYearB = await createAcademicYear(app, schoolB.id);
    const gradeB = await createGrade(app, schoolB.id);
    studentB1 = await createStudent(app, schoolB.id, {
      academicYearId: acadYearB.id,
      gradeId: gradeB.id,
      fullName: 'Student B1',
    });
  });

  // -------------------------------------------------------------------
  // Assignment management (school_admin-only)
  // -------------------------------------------------------------------

  describe('POST /teacher/assignments', () => {
    it('lets school_admin assign a teacher to a grade+subject', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });

      expect(res.status).toBe(201);
      expect(res.body.teacherId).toBe(teacherA.id);
      expect(res.body.gradeId).toBe(gradeA1.id);
      expect(res.body.subjectId).toBe(subjectA1.id);
      // Sprint 2B: assignment responses now also carry the resolved
      // teacher name / grade title / subject title.
      expect(res.body.teacherName).toBe('Teacher A');
      expect(res.body.gradeTitle).toBe('Grade 7');
      expect(res.body.subjectTitle).toBe('Math');
    });

    it('is idempotent: assigning the same triple twice returns the same row, not a duplicate', async () => {
      const first = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
      const second = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.teacherName).toBe('Teacher A');

      const list = await request(server)
        .get('/api/v1/teacher/assignments')
        .query({ teacherId: teacherA.id })
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(list.body).toHaveLength(1);
    });

    it('rejects a teacher from another school (Forbidden)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ teacherId: teacherB.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
      expect(res.status).toBe(403);
    });

    it('rejects a grade from another school (Forbidden)', async () => {
      const gradeB = await createGrade(app, schoolB.id);
      const res = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ teacherId: teacherA.id, gradeId: gradeB.id, subjectId: subjectA1.id });
      expect(res.status).toBe(403);
    });

    it('rejects a subject from another school (Forbidden)', async () => {
      const subjectB = await createSubject(app, schoolB.id);
      const res = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectB.id });
      expect(res.status).toBe(403);
    });

    it('rejects a user that is not a teacher (BadRequest)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ teacherId: staffA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
      expect(res.status).toBe(400);
    });

    it('rejects a nonexistent teacher/grade/subject id (NotFound)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          teacherId: '00000000-0000-0000-0000-000000000000',
          gradeId: gradeA1.id,
          subjectId: subjectA1.id,
        });
      expect(res.status).toBe(404);
    });

    it('rejects a malformed payload (missing gradeId)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ teacherId: teacherA.id, subjectId: subjectA1.id });
      expect(res.status).toBe(400);
    });

    it.each([
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
    ])('rejects %s (not school_admin)', async (_label, getUser) => {
      const res = await request(server)
        .post('/api/v1/teacher/assignments')
        .set('Authorization', authHeader(app, getUser()))
        .send({ teacherId: teacherA.id, gradeId: gradeA1.id, subjectId: subjectA1.id });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /teacher/assignments/:id', () => {
    it('lets school_admin remove an assignment', async () => {
      const assignment = await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });

      const res = await request(server)
        .delete(`/api/v1/teacher/assignments/${assignment.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(204);

      const list = await request(server)
        .get('/api/v1/teacher/assignments')
        .query({ teacherId: teacherA.id })
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(list.body).toHaveLength(0);
    });

    it('404s for a cross-school assignment id', async () => {
      const assignment = await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
      const res = await request(server)
        .delete(`/api/v1/teacher/assignments/${assignment.id}`)
        .set('Authorization', authHeader(app, schoolAdminB));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /teacher/list (Sprint 2B)', () => {
    it("returns only the caller's school's teacher-role users, sorted by name", async () => {
      const res = await request(server)
        .get('/api/v1/teacher/list')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      const names = res.body.map((t: { fullName: string }) => t.fullName);
      expect(names).toEqual(['Other Teacher', 'Teacher A']);
      expect(names).not.toContain('Teacher B');
    });

    it('never includes a passwordHash', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/list')
        .set('Authorization', authHeader(app, schoolAdminA));
      for (const teacher of res.body) {
        expect(teacher.passwordHash).toBeUndefined();
      }
    });

    it.each([
      ['teacher', () => teacherA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
    ])('rejects %s on the admin-only teacher list', async (_label, getUser) => {
      const res = await request(server)
        .get('/api/v1/teacher/list')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // Teacher self-service reads
  // -------------------------------------------------------------------

  describe('GET /teacher/profile', () => {
    it("returns the teacher's own account and assignment summary", async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });

      const res = await request(server)
        .get('/api/v1/teacher/profile')
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(teacherA.id);
      expect(res.body.fullName).toBe('Teacher A');
      expect(res.body.assignments).toHaveLength(1);
      expect(res.body.assignments[0].gradeTitle).toBe('Grade 7');
      expect(res.body.assignments[0].subjectTitle).toBe('Math');
    });

    it('rejects every non-teacher role', async () => {
      for (const user of [schoolAdminA, staffA, accountantA]) {
        const res = await request(server)
          .get('/api/v1/teacher/profile')
          .set('Authorization', authHeader(app, user));
        expect(res.status).toBe(403);
      }
    });
  });

  describe('GET /teacher/classes and /teacher/subjects', () => {
    beforeEach(async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA2.id,
      });
      // A second grade, taught for a different subject -- proves classes
      // and subjects are each deduplicated independently.
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA2.id,
        subjectId: subjectA1.id,
      });
      // Another teacher's own assignment must never leak into teacherA's view.
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: otherTeacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
    });

    it('returns only the calling teacher\'s distinct assigned classes', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/classes')
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(200);
      const titles = res.body.map((g: any) => g.title).sort();
      expect(titles).toEqual(['Grade 7', 'Grade 8']);
    });

    it('returns only the calling teacher\'s distinct assigned subjects', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/subjects')
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(200);
      const titles = res.body.map((s: any) => s.title).sort();
      expect(titles).toEqual(['Math', 'Science']);
    });

    it('returns an empty list for a teacher with no assignments', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/classes')
        .set('Authorization', authHeader(app, teacherB));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /teacher/students', () => {
    beforeEach(async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
    });

    it('returns students only from the assigned grade', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/students')
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(200);
      const ids = res.body.map((s: any) => s.id);
      expect(ids).toContain(studentA1.id);
      expect(ids).not.toContain(studentA2.id);
      expect(ids).not.toContain(studentB1.id);
    });

    it('rejects a gradeId filter the teacher is not assigned to (Forbidden)', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/students')
        .query({ gradeId: gradeA2.id })
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(403);
    });

    it('returns an empty roster for a teacher with no assignments', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/students')
        .set('Authorization', authHeader(app, teacherB));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // Teacher-scoped writes
  // -------------------------------------------------------------------

  describe('POST /teacher/attendance', () => {
    beforeEach(async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
    });

    it('records attendance for a student in an assigned grade', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/attendance')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, date: '2026-07-01', status: 'present' });
      expect(res.status).toBe(201);
      expect(res.body.studentId).toBe(studentA1.id);
      expect(res.body.status).toBe('present');
    });

    it('upserts on resubmission for the same student+date (reuses AttendanceService)', async () => {
      await request(server)
        .post('/api/v1/teacher/attendance')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, date: '2026-07-01', status: 'present' });
      const second = await request(server)
        .post('/api/v1/teacher/attendance')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, date: '2026-07-01', status: 'absent' });

      expect(second.status).toBe(201);
      const history = await request(server)
        .get(`/api/v1/attendance/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(history.body).toHaveLength(1);
      expect(history.body[0].status).toBe('absent');
    });

    it('rejects attendance for a student in an unassigned grade (Forbidden)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/attendance')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA2.id, date: '2026-07-01', status: 'present' });
      expect(res.status).toBe(403);
    });

    it('rejects attendance for a student in another school (Forbidden -- not an assigned class)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/attendance')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentB1.id, date: '2026-07-01', status: 'present' });
      expect(res.status).toBe(403);
    });

    it('rejects a malformed status enum', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/attendance')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, date: '2026-07-01', status: 'not-a-status' });
      expect(res.status).toBe(400);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
    ])('rejects %s on the teacher route', async (_label, getUser) => {
      const res = await request(server)
        .post('/api/v1/teacher/attendance')
        .set('Authorization', authHeader(app, getUser()))
        .send({ studentId: studentA1.id, date: '2026-07-01', status: 'present' });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /teacher/assessments', () => {
    beforeEach(async () => {
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA1.id,
        subjectId: subjectA1.id,
      });
    });

    it('records a score for the assigned grade+subject', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: AssessmentTerm.FIRST_TERM, score: 18 });
      expect(res.status).toBe(201);
      expect(res.body.studentId).toBe(studentA1.id);
      expect(res.body.subjectId).toBe(subjectA1.id);
      expect(res.body.score).toBe(18);
    });

    it('upserts on resubmission for the same student+subject+term (reuses AssessmentsService)', async () => {
      await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: AssessmentTerm.FIRST_TERM, score: 15 });
      const second = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: AssessmentTerm.FIRST_TERM, score: 19 });

      expect(second.status).toBe(201);
      const history = await request(server)
        .get(`/api/v1/assessments/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(history.body).toHaveLength(1);
      expect(history.body[0].score).toBe(19);
    });

    it('rejects a subject the teacher is assigned to for a different grade (Forbidden)', async () => {
      // teacherA is assigned to (gradeA1, subjectA1), not (gradeA2, subjectA1) --
      // studentA2 is in gradeA2, so this must be rejected even though the
      // teacher does hold *some* assignment for subjectA1.
      const res = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA2.id, subjectId: subjectA1.id, term: AssessmentTerm.FIRST_TERM, score: 18 });
      expect(res.status).toBe(403);
    });

    it('rejects a subject the teacher is not assigned at all (Forbidden)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, subjectId: subjectA2.id, term: AssessmentTerm.FIRST_TERM, score: 18 });
      expect(res.status).toBe(403);
    });

    it('rejects a student in another school (Forbidden -- no matching assignment)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentB1.id, subjectId: subjectA1.id, term: AssessmentTerm.FIRST_TERM, score: 18 });
      expect(res.status).toBe(403);
    });

    it('rejects a score above maxScore (delegated AssessmentsService validation)', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: AssessmentTerm.FIRST_TERM, score: 25 });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed term enum', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: 'third_term', score: 18 });
      expect(res.status).toBe(400);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
    ])('rejects %s on the teacher route', async (_label, getUser) => {
      const res = await request(server)
        .post('/api/v1/teacher/assessments')
        .set('Authorization', authHeader(app, getUser()))
        .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: AssessmentTerm.FIRST_TERM, score: 18 });
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // Existing endpoints stay unaffected by the new role
  // -------------------------------------------------------------------

  describe('teacher role never leaks into pre-existing staff-facing endpoints', () => {
    it('rejects a teacher on GET /students', async () => {
      const res = await request(server)
        .get('/api/v1/students')
        .set('Authorization', authHeader(app, teacherA));
      expect(res.status).toBe(403);
    });

    it('rejects a teacher on POST /attendance', async () => {
      const res = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, date: '2026-07-01', status: 'present' });
      expect(res.status).toBe(403);
    });

    it('rejects a teacher on POST /assessments', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, teacherA))
        .send({ studentId: studentA1.id, subjectId: subjectA1.id, term: AssessmentTerm.FIRST_TERM, score: 18 });
      expect(res.status).toBe(403);
    });
  });
});
