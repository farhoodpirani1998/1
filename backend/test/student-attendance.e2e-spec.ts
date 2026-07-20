import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  linkStudentUser,
  createAttendance,
  AttendanceStatus,
  authHeader,
  Role,
} from './setup/factories';

/**
 * ADR-001 Task 4C: Student Attendance API
 *
 * Proves that:
 * 1. GET /student/attendance resolves entirely from the caller's own
 *    CurrentUser -> StudentUser -> Student link (same resolution
 *    StudentService.getMyProfile already uses) and returns that
 *    student's own attendance history, in the same narrow
 *    ParentAttendanceView shape the parent portal already uses (no
 *    recordedById, no schoolId/studentId).
 * 2. A student can never see another student's attendance -- there is no
 *    id in the URL to manipulate in the first place, so this is really a
 *    proof that the route never reads a client-supplied id.
 * 3. A Role.STUDENT user with no StudentUser link yet gets 404, the same
 *    "missing link is a handled outcome" shape as GET /student/profile.
 * 4. Non-student roles are rejected (403), and unauthenticated calls are
 *    rejected (401).
 */
describe('Student attendance (ADR-001 Task 4C e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;

  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA: Awaited<ReturnType<typeof createGrade>>;

  let studentA1: Awaited<ReturnType<typeof createStudent>>;
  let studentA2: Awaited<ReturnType<typeof createStudent>>;

  let studentUserA1: Awaited<ReturnType<typeof createUser>>;
  let studentUserA2: Awaited<ReturnType<typeof createUser>>;
  let unlinkedStudentUser: Awaited<ReturnType<typeof createUser>>;

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

    studentUserA1 = await createUser(app, {
      role: Role.STUDENT,
      schoolId: schoolA.id,
      username: 'student.a1',
    });
    await linkStudentUser(app, studentUserA1.id, studentA1.id);

    studentUserA2 = await createUser(app, {
      role: Role.STUDENT,
      schoolId: schoolA.id,
      username: 'student.a2',
    });
    await linkStudentUser(app, studentUserA2.id, studentA2.id);

    // Role.STUDENT, but never linked to a Student row (mirrors the
    // "provisioned but not linked" login case from
    // student-authentication.e2e-spec.ts).
    unlinkedStudentUser = await createUser(app, {
      role: Role.STUDENT,
      schoolId: schoolA.id,
      username: 'student.unlinked',
    });

    await createAttendance(app, {
      schoolId: schoolA.id,
      studentId: studentA1.id,
      academicYearId: acadYearA.id,
      date: '2026-07-01',
      status: AttendanceStatus.LATE,
      note: 'Bus was delayed',
    });
    await createAttendance(app, {
      schoolId: schoolA.id,
      studentId: studentA2.id,
      academicYearId: acadYearA.id,
      date: '2026-07-01',
      status: AttendanceStatus.PRESENT,
    });
  });

  describe('GET /student/attendance', () => {
    it("returns the caller's own attendance history in the narrow parent-style shape", async () => {
      const res = await request(server)
        .get('/api/v1/student/attendance')
        .set('Authorization', authHeader(app, studentUserA1));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual(
        expect.objectContaining({ status: 'late', note: 'Bus was delayed' }),
      );
      // Narrow shape only -- no internal/staff-only fields leak through.
      expect(res.body[0].recordedById).toBeUndefined();
      expect(res.body[0].studentId).toBeUndefined();
      expect(res.body[0].schoolId).toBeUndefined();
    });

    it("never returns another student's attendance -- each student sees only their own", async () => {
      const res = await request(server)
        .get('/api/v1/student/attendance')
        .set('Authorization', authHeader(app, studentUserA2));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual(expect.objectContaining({ status: 'present' }));
      // studentA1's note never shows up for studentA2's login.
      expect(res.body.some((r: any) => r.note === 'Bus was delayed')).toBe(false);
    });

    it('returns 404 for a student-role user with no StudentUser link', async () => {
      const res = await request(server)
        .get('/api/v1/student/attendance')
        .set('Authorization', authHeader(app, unlinkedStudentUser));

      expect(res.status).toBe(404);
    });

    it('rejects non-student roles', async () => {
      const res = await request(server)
        .get('/api/v1/student/attendance')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(403);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(server).get('/api/v1/student/attendance');

      expect(res.status).toBe(401);
    });
  });
});
