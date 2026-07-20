import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import { Assessment } from '../src/modules/student-assessments/entities/assessment.entity';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createClass,
  createStudent,
  createSubject,
  createTeacherAssignment,
  createAssessment,
  authHeader,
  Role,
  AssessmentTerm,
} from './setup/factories';

/**
 * Sprint A.2 — Teacher Assessment Read
 *
 * Proves that GET /teacher/assessments:
 * 1. Only ever returns assessments within the teacher's own assigned
 *    (grade, class, subject) scope: a whole-grade assignment (classId
 *    null) covers every section of that grade, a class-scoped
 *    assignment covers only its own section, and either kind only
 *    covers the subject it was assigned for (never another subject
 *    taught to the same students by a different teacher) -- same
 *    "never sees another section/subject, even within a grade they
 *    otherwise teach" isolation shape as Sprint A.1's attendance reads.
 * 2. gradeId/classId/subjectId filters that aren't covered by any of
 *    the teacher's own assignments are rejected (Forbidden), never
 *    silently returning an empty list.
 * 3. studentId narrows correctly, 404s for a student outside the
 *    school (cross-school isolation), and is rejected (Forbidden) for
 *    a student inside the school but outside the teacher's scope.
 * 4. fromDate/toDate narrow by Assessment.createdAt.
 * 5. The route is rejected for every non-teacher role and an
 *    unauthenticated caller, same as every Sprint A.1 route.
 * 6. Empty-state and invalid-filter responses behave predictably.
 */
describe('Teacher Assessment Read (Sprint A.2 e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let acadYearB: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA1: Awaited<ReturnType<typeof createGrade>>; // class-scoped assignment
  let gradeA2: Awaited<ReturnType<typeof createGrade>>; // whole-grade assignment
  let classA1a: Awaited<ReturnType<typeof createClass>>; // teacherA is assigned here
  let classA1b: Awaited<ReturnType<typeof createClass>>; // a different section -- NOT assigned

  let mathSubject: Awaited<ReturnType<typeof createSubject>>;
  let scienceSubject: Awaited<ReturnType<typeof createSubject>>; // taught by a different teacher

  let studentA1a: Awaited<ReturnType<typeof createStudent>>; // gradeA1 / classA1a -- in scope
  let studentA1b: Awaited<ReturnType<typeof createStudent>>; // gradeA1 / classA1b -- NOT in scope
  let studentA2: Awaited<ReturnType<typeof createStudent>>; // gradeA2, whole-grade -- in scope
  let studentB: Awaited<ReturnType<typeof createStudent>>; // school B -- cross-school

  const veryPastDate = '2023-01-01T00:00:00.000Z'; // strictly before pastDate -- nothing is ever seeded this early
  const pastDate = '2024-01-15T00:00:00.000Z';
  const midDate = '2024-06-15T00:00:00.000Z';
  const futureDate = '2025-01-15T00:00:00.000Z';

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

    acadYearA = await createAcademicYear(app, schoolA.id);
    acadYearB = await createAcademicYear(app, schoolB.id);
    gradeA1 = await createGrade(app, schoolA.id, { title: 'Grade 7' });
    gradeA2 = await createGrade(app, schoolA.id, { title: 'Grade 8' });

    mathSubject = await createSubject(app, schoolA.id, { title: 'Math' });
    scienceSubject = await createSubject(app, schoolA.id, { title: 'Science' });

    classA1a = await createClass(app, { schoolId: schoolA.id, gradeId: gradeA1.id, academicYearId: acadYearA.id, title: 'الف' });
    classA1b = await createClass(app, { schoolId: schoolA.id, gradeId: gradeA1.id, academicYearId: acadYearA.id, title: 'ب' });

    studentA1a = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      classId: classA1a.id,
      fullName: 'Student A1a',
    });
    studentA1b = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA1.id,
      classId: classA1b.id,
      fullName: 'Student A1b',
    });
    studentA2 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA2.id,
      fullName: 'Student A2',
    });
    studentB = await createStudent(app, schoolB.id, {
      academicYearId: acadYearB.id,
      gradeId: gradeA1.id, // deliberately reuses a school-A grade id shape; entity itself belongs to school B
      fullName: 'Student B',
    });

    // teacherA: class-scoped Math in gradeA1 (only classA1a), whole-grade
    // Math in gradeA2. Never assigned to Science anywhere, and never
    // assigned to classA1b.
    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: teacherA.id,
      gradeId: gradeA1.id,
      subjectId: mathSubject.id,
      classId: classA1a.id,
    });
    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: teacherA.id,
      gradeId: gradeA2.id,
      subjectId: mathSubject.id,
    });
  });

  // -------------------------------------------------------------------
  // scope isolation
  // -------------------------------------------------------------------

  describe('scope isolation', () => {
    it("returns only in-scope students' assessments", async () => {
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
        score: 18,
      });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA2.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
        score: 15,
      });
      // Different section of gradeA1 -- teacherA is not assigned to
      // classA1b -- must never appear.
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1b.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
        score: 20,
      });

      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const studentIds = res.body.map((r: any) => r.studentId).sort();
      expect(studentIds).toEqual([studentA1a.id, studentA2.id].sort());
    });

    it('excludes a subject the teacher is not assigned for, even for an in-scope student', async () => {
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
        score: 18,
      });
      // Same in-scope student, but Science -- teacherA is never assigned
      // to Science -- must never appear.
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        subjectId: scienceSubject.id,
        academicYearId: acadYearA.id,
        score: 12,
      });

      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].subjectId).toBe(mathSubject.id);
    });
  });

  // -------------------------------------------------------------------
  // whole-grade vs class-scoped assignments
  // -------------------------------------------------------------------

  describe('whole-grade vs class-scoped assignments', () => {
    it('a whole-grade assignment covers every section of that grade', async () => {
      const classA2a = await createClass(app, {
        schoolId: schoolA.id,
        gradeId: gradeA2.id,
        academicYearId: acadYearA.id,
        title: 'الف',
      });
      const studentA2b = await createStudent(app, schoolA.id, {
        academicYearId: acadYearA.id,
        gradeId: gradeA2.id,
        classId: classA2a.id,
        fullName: 'Student A2b',
      });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA2.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
      });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA2b.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
      });

      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ gradeId: gradeA2.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const studentIds = res.body.map((r: any) => r.studentId).sort();
      expect(studentIds).toEqual([studentA2.id, studentA2b.id].sort());
    });

    it('a class-scoped assignment covers only its own section', async () => {
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
      });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1b.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
      });

      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ gradeId: gradeA1.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.map((r: any) => r.studentId)).toEqual([studentA1a.id]);
    });

    it('narrows correctly via a classId the teacher is assigned to', async () => {
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
      });

      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ classId: classA1a.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.map((r: any) => r.studentId)).toEqual([studentA1a.id]);
    });
  });

  // -------------------------------------------------------------------
  // cross-school isolation
  // -------------------------------------------------------------------

  describe('cross-school isolation', () => {
    it('404s on a studentId belonging to another school', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ studentId: studentB.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(404);
    });

    it('never returns assessments recorded in another school', async () => {
      await createAssessment(app, {
        schoolId: schoolB.id,
        studentId: studentB.id,
        subjectId: mathSubject.id, // reused id is irrelevant -- schoolId scoping alone must exclude this row
        academicYearId: acadYearB.id,
      });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
      });

      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.map((r: any) => r.studentId)).toEqual([studentA1a.id]);
    });
  });

  // -------------------------------------------------------------------
  // invalid filters
  // -------------------------------------------------------------------

  describe('invalid filters', () => {
    it('rejects a gradeId the teacher is not assigned to (Forbidden)', async () => {
      const otherGrade = await createGrade(app, schoolA.id, { title: 'Grade 9' });
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ gradeId: otherGrade.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(403);
    });

    it('rejects a classId the teacher is not assigned to (Forbidden)', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ classId: classA1b.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(403);
    });

    it('rejects a subjectId the teacher is not assigned for (Forbidden)', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ subjectId: scienceSubject.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(403);
    });

    it('rejects a studentId inside the school but outside the teacher scope (Forbidden)', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ studentId: studentA1b.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(403);
    });

    it('rejects a malformed gradeId (400)', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ gradeId: 'not-a-uuid' })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(400);
    });

    it('rejects a malformed fromDate (400)', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ fromDate: 'not-a-date' })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // empty states
  // -------------------------------------------------------------------

  describe('empty states', () => {
    it('returns an empty array when nothing has been recorded yet', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns an empty array for a teacher with no assignments', async () => {
      const unassignedTeacher = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
      await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
      });

      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .set(authHeader(app, unassignedTeacher));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // role authorization
  // -------------------------------------------------------------------

  describe('role authorization', () => {
    it('is rejected for an unauthenticated caller', async () => {
      const res = await request(server).get('/api/v1/teacher/assessments');
      expect(res.status).toBe(401);
    });

    it('is rejected for a non-teacher role', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .set(authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // date filtering
  // -------------------------------------------------------------------

  describe('date filtering', () => {
    let recentAssessmentId: string;
    let oldAssessmentId: string;

    beforeEach(async () => {
      // createAssessment() doesn't accept a createdAt override (it's a
      // real @CreateDateColumn, DB-assigned on insert, same as every
      // other created-at column in this codebase) -- so fixtures are
      // seeded normally, then backdated directly via the repo to get
      // deterministic values for range assertions, rather than relying
      // on "now" relative to the test run.
      const ds = getDataSource(app);
      const assessmentRepo = ds.getRepository(Assessment);

      const old = await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.FIRST_TERM,
      });
      oldAssessmentId = old.id;
      await assessmentRepo.update({ id: old.id }, { createdAt: new Date(pastDate) } as any);

      const recent = await createAssessment(app, {
        schoolId: schoolA.id,
        studentId: studentA2.id,
        subjectId: mathSubject.id,
        academicYearId: acadYearA.id,
        term: AssessmentTerm.SECOND_TERM,
      });
      recentAssessmentId = recent.id;
      await assessmentRepo.update({ id: recent.id }, { createdAt: new Date(midDate) } as any);
    });

    it('narrows via fromDate', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ fromDate: midDate })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const ids = res.body.map((r: any) => r.id);
      expect(ids).toContain(recentAssessmentId);
      expect(ids).not.toContain(oldAssessmentId);
    });

    it('excludes everything with a fromDate in the future', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ fromDate: futureDate })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('excludes everything with a toDate before any seeded fixture', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ toDate: veryPastDate })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('combines fromDate and toDate as an inclusive-ish range', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/assessments')
        .query({ fromDate: pastDate, toDate: futureDate })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const ids = res.body.map((r: any) => r.id).sort();
      expect(ids).toEqual([oldAssessmentId, recentAssessmentId].sort());
    });
  });
});
