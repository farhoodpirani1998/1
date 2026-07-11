import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  createAttendance,
  linkParentStudent,
  authHeader,
  Role,
  AttendanceStatus,
} from './setup/factories';

/**
 * Phase 5E: Attendance
 *
 * Proves that:
 * 1. school_admin/staff can record attendance (POST /attendance), and
 *    resubmitting the same student+date corrects the row instead of
 *    duplicating it.
 * 2. DTO validation rejects a bad status enum, a malformed date, and a
 *    missing studentId.
 * 3. GET /attendance/student/:id and GET /attendance/date/:date follow
 *    the same role gate as the other student-read endpoints
 *    (school_admin/accountant/staff allowed, parent rejected), and are
 *    tenant-isolated.
 * 4. GET /parent/students/:id/attendance only ever returns a parent's own
 *    linked child's records — never another family's, never cross-school
 *    — and is rejected for every non-parent role.
 * 5. GET /students/:id/profile's attendance section is now populated
 *    (available: true) once records exist.
 */
describe('Attendance (Phase 5E e2e)', () => {
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
  let gradeA2: Awaited<ReturnType<typeof createGrade>>;

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
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });

    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id, fullName: 'Parent A' });
    otherParentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id, fullName: 'Other Parent A' });
    parentB = await createUser(app, { role: Role.PARENT, schoolId: schoolB.id, fullName: 'Parent B' });

    acadYearA = await createAcademicYear(app, schoolA.id, { title: '1404-1405', isCurrent: true });
    gradeA = await createGrade(app, schoolA.id, { title: 'Grade 7' });
    gradeA2 = await createGrade(app, schoolA.id, { title: 'Grade 8' });

    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
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

    await linkParentStudent(app, parentA.id, studentA1.id);
  });

  describe('POST /attendance', () => {
    it('school_admin can record attendance for a student', async () => {
      const res = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, date: '2026-07-05', status: 'present' });

      expect(res.status).toBe(201);
      expect(res.body.studentId).toBe(studentA1.id);
      expect(res.body.status).toBe('present');
      expect(res.body.date).toBe('2026-07-05');
    });

    it('staff can record attendance', async () => {
      const res = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, staffA))
        .send({ studentId: studentA1.id, date: '2026-07-05', status: 'absent' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('absent');
    });

    it('rejects accountant and parent from recording attendance', async () => {
      const accountantRes = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, accountantA))
        .send({ studentId: studentA1.id, date: '2026-07-05', status: 'present' });
      expect(accountantRes.status).toBe(403);

      const parentRes = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, parentA))
        .send({ studentId: studentA1.id, date: '2026-07-05', status: 'present' });
      expect(parentRes.status).toBe(403);
    });

    it('resubmitting the same student+date corrects the row instead of duplicating it', async () => {
      const first = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, date: '2026-07-05', status: 'absent' });
      expect(first.status).toBe(201);

      const second = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, date: '2026-07-05', status: 'late', note: 'Arrived 20 min late' });
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.status).toBe('late');
      expect(second.body.note).toBe('Arrived 20 min late');

      const history = await request(server)
        .get(`/api/v1/attendance/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(history.body).toHaveLength(1);
    });

    it('rejects a student from another school (tenant isolation)', async () => {
      const res = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentB1.id, date: '2026-07-05', status: 'present' });
      expect(res.status).toBe(403);
    });

    it('rejects a nonexistent studentId', async () => {
      const res = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: '00000000-0000-0000-0000-000000000000', date: '2026-07-05', status: 'present' });
      expect(res.status).toBe(404);
    });
  });

  describe('DTO validation', () => {
    it('rejects an unknown status enum value', async () => {
      const res = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, date: '2026-07-05', status: 'on_vacation' });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed date', async () => {
      const res = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, date: 'not-a-date', status: 'present' });
      expect(res.status).toBe(400);
    });

    it('rejects a missing studentId', async () => {
      const res = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ date: '2026-07-05', status: 'present' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown field (whitelist)', async () => {
      const res = await request(server)
        .post('/api/v1/attendance')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ studentId: studentA1.id, date: '2026-07-05', status: 'present', extraField: 'nope' });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed date on GET /attendance/date/:date', async () => {
      const res = await request(server)
        .get('/api/v1/attendance/date/not-a-date')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /attendance/student/:id', () => {
    beforeEach(async () => {
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        academicYearId: acadYearA.id,
        date: '2026-07-01',
        status: AttendanceStatus.PRESENT,
      });
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        academicYearId: acadYearA.id,
        date: '2026-07-02',
        status: AttendanceStatus.EXCUSED,
      });
    });

    it('returns the student history ordered most-recent first', async () => {
      const res = await request(server)
        .get(`/api/v1/attendance/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].date).toBe('2026-07-02');
      expect(res.body[1].date).toBe('2026-07-01');
    });

    it('allows accountant and staff to read', async () => {
      const accountantRes = await request(server)
        .get(`/api/v1/attendance/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, accountantA));
      expect(accountantRes.status).toBe(200);

      const staffRes = await request(server)
        .get(`/api/v1/attendance/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, staffA));
      expect(staffRes.status).toBe(200);
    });

    it('rejects parent role on the staff-side endpoint', async () => {
      const res = await request(server)
        .get(`/api/v1/attendance/student/${studentA1.id}`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(403);
    });

    it('404s for a student belonging to another school', async () => {
      const res = await request(server)
        .get(`/api/v1/attendance/student/${studentB1.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /attendance/date/:date', () => {
    beforeEach(async () => {
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        academicYearId: acadYearA.id,
        date: '2026-07-05',
        status: AttendanceStatus.PRESENT,
      });
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA2.id,
        academicYearId: acadYearA.id,
        date: '2026-07-05',
        status: AttendanceStatus.ABSENT,
      });
      await createAttendance(app, {
        schoolId: schoolB.id,
        studentId: studentB1.id,
        academicYearId: (await createAcademicYear(app, schoolB.id)).id,
        date: '2026-07-05',
        status: AttendanceStatus.PRESENT,
      });
    });

    it('returns only this school\'s records for the date', async () => {
      const res = await request(server)
        .get('/api/v1/attendance/date/2026-07-05')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const studentIds = res.body.map((r: any) => r.studentId).sort();
      expect(studentIds).toEqual([studentA1.id, studentA2.id].sort());
    });

    it('returns an empty list for a date with no records', async () => {
      const res = await request(server)
        .get('/api/v1/attendance/date/2026-01-01')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('filters by gradeId', async () => {
      const res = await request(server)
        .get('/api/v1/attendance/date/2026-07-05')
        .query({ gradeId: gradeA.id })
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].studentId).toBe(studentA1.id);
    });

    it('rejects parent role', async () => {
      const res = await request(server)
        .get('/api/v1/attendance/date/2026-07-05')
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /parent/students/:id/attendance', () => {
    beforeEach(async () => {
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        academicYearId: acadYearA.id,
        date: '2026-07-01',
        status: AttendanceStatus.LATE,
        note: 'Bus was delayed',
      });
    });

    it('returns the linked child\'s attendance, without staff-only fields', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/attendance`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('late');
      expect(res.body[0].note).toBe('Bus was delayed');
      expect(res.body[0].recordedById).toBeUndefined();
      expect(res.body[0].studentId).toBeUndefined();
    });

    it('404s for a parent not linked to the student', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/attendance`)
        .set('Authorization', authHeader(app, otherParentA));
      expect(res.status).toBe(404);
    });

    it('404s for a parent in another school, even with a linked-looking id', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/attendance`)
        .set('Authorization', authHeader(app, parentB));
      expect(res.status).toBe(404);
    });

    it('rejects non-parent roles', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/attendance`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });
  });

  describe('Student profile attendance section', () => {
    it('is populated (available: true) once attendance records exist', async () => {
      await createAttendance(app, {
        schoolId: schoolA.id,
        studentId: studentA1.id,
        academicYearId: acadYearA.id,
        date: '2026-07-01',
        status: AttendanceStatus.PRESENT,
      });

      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.attendance.available).toBe(true);
      expect(res.body.attendance.records).toHaveLength(1);
      expect(res.body.attendance.records[0].status).toBe('present');
    });

    it('is available but empty when no attendance records exist yet', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA2.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.attendance.available).toBe(true);
      expect(res.body.attendance.records).toEqual([]);
    });
  });
});
