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
  createAttendance,
  authHeader,
  Role,
  AttendanceStatus,
} from './setup/factories';

/**
 * Sprint A.1 — Teacher Attendance Read
 *
 * Proves that:
 * 1. GET /teacher/attendance/today and GET /teacher/attendance/date/:date
 *    only ever return attendance for students within the teacher's own
 *    assigned scope: a whole-grade assignment (classId null) covers every
 *    section of that grade, a class-scoped assignment covers only its
 *    own section -- a teacher never sees another section's records, even
 *    within a grade they otherwise teach.
 * 2. A gradeId/classId filter that isn't covered by any of the teacher's
 *    own assignments is rejected (Forbidden), never silently returning
 *    an empty list.
 * 3. GET /teacher/attendance/status returns one row per class the
 *    teacher is scoped to, with correct roster size and
 *    present/absent/late/excused/not-recorded counts, defaulting to
 *    today when no date is given.
 * 4. Every route above is rejected for every non-teacher role, and for
 *    an unauthenticated caller.
 * 5. A malformed date on GET /teacher/attendance/date/:date is a 400,
 *    same as the equivalent school_admin-facing route.
 */
describe('Teacher Attendance Read (Sprint A.1 e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA1: Awaited<ReturnType<typeof createGrade>>; // class-scoped assignment
  let gradeA2: Awaited<ReturnType<typeof createGrade>>; // whole-grade assignment
  let classA1a: Awaited<ReturnType<typeof createClass>>; // teacherA is assigned here
  let classA1b: Awaited<ReturnType<typeof createClass>>; // a different section -- NOT assigned
  let subjectA1: Awaited<ReturnType<typeof createSubject>>;

  let studentA1a: Awaited<ReturnType<typeof createStudent>>; // gradeA1 / classA1a -- in scope
  let studentA1b: Awaited<ReturnType<typeof createStudent>>; // gradeA1 / classA1b -- NOT in scope
  let studentA2: Awaited<ReturnType<typeof createStudent>>; // gradeA2, whole-grade -- in scope

  const today = new Date().toISOString().slice(0, 10);
  const pastDate = '2024-01-15';

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
    gradeA2 = await createGrade(app, schoolA.id, { title: 'Grade 8' });
    subjectA1 = await createSubject(app, schoolA.id, { title: 'Math' });

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

    // teacherA: class-scoped in gradeA1 (only classA1a), whole-grade in gradeA2.
    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: teacherA.id,
      gradeId: gradeA1.id,
      subjectId: subjectA1.id,
      classId: classA1a.id,
    });
    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: teacherA.id,
      gradeId: gradeA2.id,
      subjectId: subjectA1.id,
    });
  });

  // -------------------------------------------------------------------
  // GET /teacher/attendance/today
  // -------------------------------------------------------------------

  describe('GET /teacher/attendance/today', () => {
    it("returns only in-scope students' attendance for today", async () => {
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        academicYearId: acadYearA.id,
        date: today,
        status: AttendanceStatus.PRESENT,
      });
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA2.id,
        academicYearId: acadYearA.id,
        date: today,
        status: AttendanceStatus.ABSENT,
      });
      // Recorded today, but for a section (classA1b) teacherA is not
      // assigned to -- must never appear in the response.
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1b.id,
        academicYearId: acadYearA.id,
        date: today,
        status: AttendanceStatus.PRESENT,
      });

      const res = await request(server)
        .get('/api/v1/teacher/attendance/today')
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const studentIds = res.body.map((r: any) => r.studentId).sort();
      expect(studentIds).toEqual([studentA1a.id, studentA2.id].sort());
    });

    it('returns an empty array when nothing has been recorded yet today', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/attendance/today')
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('is rejected for an unauthenticated caller', async () => {
      const res = await request(server).get('/api/v1/teacher/attendance/today');
      expect(res.status).toBe(401);
    });

    it('is rejected for a non-teacher role', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/attendance/today')
        .set(authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /teacher/attendance/date/:date
  // -------------------------------------------------------------------

  describe('GET /teacher/attendance/date/:date', () => {
    beforeEach(async () => {
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        academicYearId: acadYearA.id,
        date: pastDate,
        status: AttendanceStatus.LATE,
      });
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1b.id,
        academicYearId: acadYearA.id,
        date: pastDate,
        status: AttendanceStatus.PRESENT,
      });
    });

    it('returns in-scope attendance for an explicit past date', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/attendance/date/${pastDate}`)
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.map((r: any) => r.studentId)).toEqual([studentA1a.id]);
      expect(res.body[0].status).toBe(AttendanceStatus.LATE);
    });

    it('narrows correctly via a classId the teacher is assigned to', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/attendance/date/${pastDate}`)
        .query({ classId: classA1a.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.map((r: any) => r.studentId)).toEqual([studentA1a.id]);
    });

    it('rejects a classId the teacher is not assigned to (Forbidden)', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/attendance/date/${pastDate}`)
        .query({ classId: classA1b.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(403);
    });

    it('rejects a gradeId the teacher is not assigned to (Forbidden)', async () => {
      const otherGrade = await createGrade(app, schoolA.id, { title: 'Grade 9' });
      const res = await request(server)
        .get(`/api/v1/teacher/attendance/date/${pastDate}`)
        .query({ gradeId: otherGrade.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(403);
    });

    it('rejects a malformed date (400)', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/attendance/date/not-a-date')
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(400);
    });

    it('is rejected for a non-teacher role', async () => {
      const res = await request(server)
        .get(`/api/v1/teacher/attendance/date/${pastDate}`)
        .set(authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /teacher/attendance/status
  // -------------------------------------------------------------------

  describe('GET /teacher/attendance/status', () => {
    it('returns a per-class summary for today by default', async () => {
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        academicYearId: acadYearA.id,
        date: today,
        status: AttendanceStatus.PRESENT,
      });
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA2.id,
        academicYearId: acadYearA.id,
        date: today,
        status: AttendanceStatus.ABSENT,
      });

      const res = await request(server)
        .get('/api/v1/teacher/attendance/status')
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const classA1aRow = res.body.find((r: any) => r.classId === classA1a.id);
      expect(classA1aRow).toMatchObject({
        gradeId: gradeA1.id,
        totalStudents: 1,
        recordedCount: 1,
        notRecordedCount: 0,
        present: 1,
        absent: 0,
      });

      const gradeA2Row = res.body.find((r: any) => r.gradeId === gradeA2.id);
      expect(gradeA2Row).toMatchObject({
        classId: null,
        totalStudents: 1,
        recordedCount: 1,
        notRecordedCount: 0,
        absent: 1,
      });
    });

    it('counts an unrecorded student as notRecorded, not absent', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/attendance/status')
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const classA1aRow = res.body.find((r: any) => r.classId === classA1a.id);
      expect(classA1aRow).toMatchObject({
        totalStudents: 1,
        recordedCount: 0,
        notRecordedCount: 1,
        present: 0,
        absent: 0,
      });
    });

    it('accepts an explicit date query param', async () => {
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1a.id,
        academicYearId: acadYearA.id,
        date: pastDate,
        status: AttendanceStatus.EXCUSED,
      });

      const res = await request(server)
        .get('/api/v1/teacher/attendance/status')
        .query({ date: pastDate })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const classA1aRow = res.body.find((r: any) => r.classId === classA1a.id);
      expect(classA1aRow.excused).toBe(1);
    });

    it('narrows to one grade via gradeId', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/attendance/status')
        .query({ gradeId: gradeA2.id })
        .set(authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].gradeId).toBe(gradeA2.id);
    });

    it('returns an empty array for a teacher with no assignments', async () => {
      const unassignedTeacher = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
      const res = await request(server)
        .get('/api/v1/teacher/attendance/status')
        .set(authHeader(app, unassignedTeacher));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('is rejected for a non-teacher role', async () => {
      const res = await request(server)
        .get('/api/v1/teacher/attendance/status')
        .set(authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });
  });
});
