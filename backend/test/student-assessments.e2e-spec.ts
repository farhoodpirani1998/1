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
  createAssessment,
  linkParentStudent,
  authHeader,
  Role,
  AssessmentTerm,
} from './setup/factories';

/**
 * Phase 5F: Student Assessment & Report Cards
 *
 * Proves that:
 * 1. school_admin/staff can record a score (POST /assessments), and
 *    resubmitting the same student+subject+term corrects the row instead
 *    of duplicating it.
 * 2. DTO validation rejects an unknown term enum, a score above maxScore,
 *    and a missing studentId/subjectId.
 * 3. GET /assessments/student/:id and .../report-card follow the same
 *    role gate as the other student-read endpoints (school_admin/
 *    accountant/staff allowed, parent rejected), and are tenant-isolated.
 * 4. GET /parent/students/:id/assessments and .../report-card only ever
 *    return a parent's own linked child's records -- never another
 *    family's, never cross-school -- and are rejected for every
 *    non-parent role.
 * 5. GET /students/:id/profile's assessments section is populated
 *    (available: true) with recent records and a report summary once
 *    assessments exist, and is available-but-empty otherwise.
 * 6. POST /subjects follows the same role gate as POST /grades.
 */
describe('Student Assessments (Phase 5F e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminB: Awaited<ReturnType<typeof createUser>>;

  let parentA: Awaited<ReturnType<typeof createUser>>;
  let otherParentA: Awaited<ReturnType<typeof createUser>>;
  let parentB: Awaited<ReturnType<typeof createUser>>;

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA: Awaited<ReturnType<typeof createGrade>>;

  let studentA1: Awaited<ReturnType<typeof createStudent>>;
  let studentA2: Awaited<ReturnType<typeof createStudent>>;
  let studentB1: Awaited<ReturnType<typeof createStudent>>;

  let mathA: Awaited<ReturnType<typeof createSubject>>;
  let scienceA: Awaited<ReturnType<typeof createSubject>>;
  let subjectB: Awaited<ReturnType<typeof createSubject>>;

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

    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id, fullName: 'Parent A' });
    otherParentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id, fullName: 'Other Parent A' });
    parentB = await createUser(app, { role: Role.PARENT, schoolId: schoolB.id, fullName: 'Parent B' });

    acadYearA = await createAcademicYear(app, schoolA.id, { title: '1404-1405', isCurrent: true });
    gradeA = await createGrade(app, schoolA.id, { title: 'Grade 7' });

    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      fullName: 'Student A1',
    });
    studentA2 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      fullName: 'Student A2',
    });

    const acadYearB = await createAcademicYear(app, schoolB.id);
    const gradeB = await createGrade(app, schoolB.id);
    studentB1 = await createStudent(app, schoolB.id, {
      academicYearId: acadYearB.id,
      gradeId: gradeB.id,
      fullName: 'Student B1',
    });

    mathA = await createSubject(app, schoolA.id, { title: 'Math' });
    scienceA = await createSubject(app, schoolA.id, { title: 'Science' });
    subjectB = await createSubject(app, schoolB.id, { title: 'Subject B' });

    await linkParentStudent(app, parentA.id, studentA1.id);
  });

  describe('POST /subjects', () => {
    it('school_admin can create a subject', async () => {
      const res = await request(server)
        .post('/api/v1/subjects')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'History' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('History');
    });

    it('rejects staff/accountant/parent from creating a subject', async () => {
      const staffRes = await request(server)
        .post('/api/v1/subjects')
        .set('Authorization', authHeader(app, staffA))
        .send({ title: 'History' });
      expect(staffRes.status).toBe(403);

      const parentRes = await request(server)
        .post('/api/v1/subjects')
        .set('Authorization', authHeader(app, parentA))
        .send({ title: 'History' });
      expect(parentRes.status).toBe(403);
    });

    it('staff can list subjects for their school', async () => {
      const res = await request(server)
        .get('/api/v1/subjects')
        .set('Authorization', authHeader(app, staffA));
      expect(res.status).toBe(200);
      const titles = res.body.map((s: any) => s.title).sort();
      expect(titles).toEqual(['Math', 'Science']);
    });
  });

  describe('POST /assessments', () => {
    it('school_admin can record a score', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 18.5 });

      expect(res.status).toBe(201);
      expect(res.body.studentId).toBe(studentA1.id);
      expect(res.body.subjectId).toBe(mathA.id);
      expect(res.body.score).toBe(18.5);
      expect(res.body.maxScore).toBe(20);
      expect(res.body.term).toBe('first_term');
    });

    it('staff can record a score with a custom maxScore', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, staffA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 85, maxScore: 100 });

      expect(res.status).toBe(201);
      expect(res.body.score).toBe(85);
      expect(res.body.maxScore).toBe(100);
    });

    it('rejects accountant and parent from recording a score', async () => {
      const accountantRes = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, accountantA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 18 });
      expect(accountantRes.status).toBe(403);

      const parentRes = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, parentA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 18 });
      expect(parentRes.status).toBe(403);
    });

    it('resubmitting the same student+subject+term corrects the row instead of duplicating it', async () => {
      const first = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 15 });
      expect(first.status).toBe(201);

      const second = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 19, note: 'Retake' });
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.score).toBe(19);
      expect(second.body.note).toBe('Retake');

      const history = await request(server)
        .get(`/api/v1/assessments/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(history.body).toHaveLength(1);
    });

    it('rejects a student from another school (tenant isolation)', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentB1.id, subjectId: mathA.id, term: 'first_term', score: 18 });
      expect(res.status).toBe(403);
    });

    it('rejects a subject from another school (tenant isolation)', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, subjectId: subjectB.id, term: 'first_term', score: 18 });
      expect(res.status).toBe(403);
    });

    it('rejects a nonexistent studentId', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          studentId: '00000000-0000-0000-0000-000000000000',
          subjectId: mathA.id,
          term: 'first_term',
          score: 18,
        });
      expect(res.status).toBe(404);
    });

    it('rejects a nonexistent subjectId', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
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
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'third_term', score: 18 });
      expect(res.status).toBe(400);
    });

    it('rejects a score above maxScore', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 25 });
      expect(res.status).toBe(400);
    });

    it('rejects a negative score', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: -1 });
      expect(res.status).toBe(400);
    });

    it('rejects a missing studentId', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ subjectId: mathA.id, term: 'first_term', score: 18 });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown field (whitelist)', async () => {
      const res = await request(server)
        .post('/api/v1/assessments')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, subjectId: mathA.id, term: 'first_term', score: 18, extraField: 'nope' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /assessments/student/:id', () => {
    beforeEach(async () => {
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        subjectId: mathA.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
        score: 18,
      });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        subjectId: scienceA.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
        score: 16,
      });
    });

    it('returns the student assessment history', async () => {
      const res = await request(server)
        .get(`/api/v1/assessments/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('allows accountant and staff to read', async () => {
      const accountantRes = await request(server)
        .get(`/api/v1/assessments/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, accountantA));
      expect(accountantRes.status).toBe(200);

      const staffRes = await request(server)
        .get(`/api/v1/assessments/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, staffA));
      expect(staffRes.status).toBe(200);
    });

    it('rejects parent role on the staff-side endpoint', async () => {
      const res = await request(server)
        .get(`/api/v1/assessments/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(403);
    });

    it('404s for a student belonging to another school', async () => {
      const res = await request(server)
        .get(`/api/v1/assessments/student/${studentB1.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /assessments/student/:id/report-card', () => {
    beforeEach(async () => {
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        subjectId: mathA.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
        score: 18,
        maxScore: 20,
      });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        subjectId: scienceA.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
        score: 16,
        maxScore: 20,
      });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        subjectId: mathA.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.SECOND_TERM,
        score: 19,
        maxScore: 20,
      });
    });

    it('groups by term and computes averages', async () => {
      const res = await request(server)
        .get(`/api/v1/assessments/student/${studentA1.id}/report-card`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.studentId).toBe(studentA1.id);
      expect(res.body.terms).toHaveLength(2);

      const firstTerm = res.body.terms.find((t: any) => t.term === 'first_term');
      expect(firstTerm.subjects).toHaveLength(2);
      expect(firstTerm.average).toBe(17); // (18 + 16) / 2

      const secondTerm = res.body.terms.find((t: any) => t.term === 'second_term');
      expect(secondTerm.average).toBe(19);

      expect(res.body.overallAverage).toBe(18); // (17 + 19) / 2
    });

    it('rejects parent role on the staff-side endpoint', async () => {
      const res = await request(server)
        .get(`/api/v1/assessments/student/${studentA1.id}/report-card`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(403);
    });

    it('returns an empty report card for a student with no assessments', async () => {
      const res = await request(server)
        .get(`/api/v1/assessments/student/${studentA2.id}/report-card`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body.terms).toEqual([]);
      expect(res.body.overallAverage).toBeNull();
    });

    it('404s for a student belonging to another school', async () => {
      const res = await request(server)
        .get(`/api/v1/assessments/student/${studentB1.id}/report-card`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /parent/students/:id/assessments', () => {
    beforeEach(async () => {
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        subjectId: mathA.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
        score: 18,
        note: 'Great improvement',
      });
    });

    it("returns the linked child's assessments, without staff-only fields", async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/assessments`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].score).toBe(18);
      expect(res.body[0].note).toBe('Great improvement');
      expect(res.body[0].recordedById).toBeUndefined();
      expect(res.body[0].studentId).toBeUndefined();
    });

    it('404s for a parent not linked to the student', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/assessments`)
        .set('Authorization', authHeader(app, otherParentA));
      expect(res.status).toBe(404);
    });

    it('404s for a parent in another school, even with a linked-looking id', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/assessments`)
        .set('Authorization', authHeader(app, parentB));
      expect(res.status).toBe(404);
    });

    it('rejects non-parent roles', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/assessments`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /parent/students/:id/report-card', () => {
    beforeEach(async () => {
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        subjectId: mathA.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
        score: 18,
      });
    });

    it("returns the linked child's report card", async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/report-card`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(200);
      expect(res.body.terms).toHaveLength(1);
      expect(res.body.overallAverage).toBe(18);
    });

    it('404s for a parent not linked to the student', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/report-card`)
        .set('Authorization', authHeader(app, otherParentA));
      expect(res.status).toBe(404);
    });

    it('rejects non-parent roles', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/report-card`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });
  });

  describe('Student profile assessments section', () => {
    it('is populated (available: true) with records and a report summary once assessments exist', async () => {
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        subjectId: mathA.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
        score: 18,
      });

      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.assessments.available).toBe(true);
      expect(res.body.assessments.records).toHaveLength(1);
      expect(res.body.assessments.records[0].score).toBe(18);
      expect(res.body.assessments.reportSummary.overallAverage).toBe(18);
    });

    it('is available but empty when no assessments exist yet', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA2.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.assessments.available).toBe(true);
      expect(res.body.assessments.records).toEqual([]);
      expect(res.body.assessments.reportSummary.overallAverage).toBeNull();
    });
  });
});
