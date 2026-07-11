import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createSubject,
  createTeacherAssignment,
  createTimetableEntry,
  createStudent,
  linkParentStudent,
  authHeader,
  Role,
  Weekday,
} from './setup/factories';

/**
 * Phase 5K: Timetable Foundation
 *
 * Proves that:
 * 1. school_admin can create/list/update/delete timetable entries for
 *    their own school. Every non-school_admin role is rejected on all
 *    four routes.
 * 2. Creating/updating an entry validates every referenced id
 *    (academicYearId, gradeId, subjectId, teacherId) against the caller's
 *    own school (404 nonexistent, 403 cross-school), requires the
 *    teacherId to reference a `teacher`-role user, and requires that
 *    teacher to already hold a TeacherAssignment for the exact
 *    (gradeId, subjectId) pair (Forbidden otherwise) -- reusing the
 *    existing assignment table rather than a separate check.
 * 3. DTO validation rejects malformed time strings and startTime >= endTime.
 * 4. Overlapping schedules are rejected (409) for the same teacher and
 *    for the same grade on the same weekday; back-to-back periods
 *    (one's endTime equal to the next's startTime) are allowed; a
 *    conflict against the entry's own previous state is not raised when
 *    updating.
 * 5. GET /timetable, PUT /timetable/:id, DELETE /timetable/:id never
 *    leak or act on another school's rows (404, not 403).
 * 6. GET /teacher/timetable returns only the caller's own entries,
 *    scoped to their own school.
 * 7. GET /parent/students/:id/timetable returns the linked child's
 *    grade timetable, and 404s for an unlinked or cross-school student.
 */
describe('Timetable Foundation (Phase 5K e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let otherTeacherA: Awaited<ReturnType<typeof createUser>>;
  let unassignedTeacherA: Awaited<ReturnType<typeof createUser>>;
  let parentA: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminB: Awaited<ReturnType<typeof createUser>>;

  let academicYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeA: Awaited<ReturnType<typeof createGrade>>;
  let otherGradeA: Awaited<ReturnType<typeof createGrade>>;
  let subjectA: Awaited<ReturnType<typeof createSubject>>;

  let academicYearB: Awaited<ReturnType<typeof createAcademicYear>>;
  let gradeB: Awaited<ReturnType<typeof createGrade>>;
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
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    otherTeacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    unassignedTeacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });

    academicYearA = await createAcademicYear(app, schoolA.id);
    gradeA = await createGrade(app, schoolA.id);
    otherGradeA = await createGrade(app, schoolA.id);
    subjectA = await createSubject(app, schoolA.id);

    academicYearB = await createAcademicYear(app, schoolB.id);
    gradeB = await createGrade(app, schoolB.id);
    subjectB = await createSubject(app, schoolB.id);

    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: teacherA.id,
      gradeId: gradeA.id,
      subjectId: subjectA.id,
    });
    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: otherTeacherA.id,
      gradeId: gradeA.id,
      subjectId: subjectA.id,
    });
    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: teacherA.id,
      gradeId: otherGradeA.id,
      subjectId: subjectA.id,
    });
  });

  function validBody(overrides: Record<string, unknown> = {}) {
    return {
      academicYearId: academicYearA.id,
      gradeId: gradeA.id,
      subjectId: subjectA.id,
      teacherId: teacherA.id,
      weekday: Weekday.SATURDAY,
      startTime: '08:00',
      endTime: '09:00',
      ...overrides,
    };
  }

  // -------------------------------------------------------------------
  // POST /timetable
  // -------------------------------------------------------------------

  describe('POST /timetable', () => {
    it('lets school_admin create a timetable entry', async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ room: 'Room 101' }));

      expect(res.status).toBe(201);
      expect(res.body.gradeId).toBe(gradeA.id);
      expect(res.body.subjectId).toBe(subjectA.id);
      expect(res.body.teacherId).toBe(teacherA.id);
      expect(res.body.weekday).toBe(Weekday.SATURDAY);
      expect(res.body.startTime).toBe('08:00');
      expect(res.body.endTime).toBe('09:00');
      expect(res.body.room).toBe('Room 101');
    });

    it('allows room to be omitted', async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody());
      expect(res.status).toBe(201);
      expect(res.body.room).toBeNull();
    });

    it.each([
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s (not school_admin)', async (_label, getUser) => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, getUser()))
        .send(validBody());
      expect(res.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(server).post('/api/v1/timetable').send(validBody());
      expect(res.status).toBe(401);
    });

    it('404s a nonexistent academicYearId', async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ academicYearId: '00000000-0000-0000-0000-000000000000' }));
      expect(res.status).toBe(404);
    });

    it("403s another school's academicYearId", async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ academicYearId: academicYearB.id }));
      expect(res.status).toBe(403);
    });

    it("403s another school's gradeId", async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ gradeId: gradeB.id }));
      expect(res.status).toBe(403);
    });

    it("403s another school's subjectId", async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ subjectId: subjectB.id }));
      expect(res.status).toBe(403);
    });

    it("403s another school's teacherId", async () => {
      const teacherB = await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id });
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ teacherId: teacherB.id }));
      expect(res.status).toBe(403);
    });

    it('400s a teacherId that references a non-teacher user', async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ teacherId: staffA.id }));
      expect(res.status).toBe(400);
    });

    it('403s a teacher with no assignment for that grade+subject', async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ teacherId: unassignedTeacherA.id }));
      expect(res.status).toBe(403);
    });

    it('rejects an invalid time format', async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ startTime: '8:00' }));
      expect(res.status).toBe(400);
    });

    it('rejects startTime equal to endTime', async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ startTime: '09:00', endTime: '09:00' }));
      expect(res.status).toBe(400);
    });

    it('rejects startTime after endTime', async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ startTime: '10:00', endTime: '09:00' }));
      expect(res.status).toBe(400);
    });

    it('rejects an invalid weekday', async () => {
      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ weekday: 9 }));
      expect(res.status).toBe(400);
    });

    it('409s an overlapping schedule for the same teacher', async () => {
      await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        weekday: Weekday.SATURDAY,
        startTime: '08:00',
        endTime: '09:00',
      });

      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(
          validBody({
            gradeId: otherGradeA.id,
            startTime: '08:30',
            endTime: '09:30',
          }),
        );
      expect(res.status).toBe(409);
    });

    it('409s an overlapping schedule for the same grade with a different teacher', async () => {
      await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        weekday: Weekday.SATURDAY,
        startTime: '08:00',
        endTime: '09:00',
      });

      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(
          validBody({
            teacherId: otherTeacherA.id,
            startTime: '08:30',
            endTime: '09:30',
          }),
        );
      expect(res.status).toBe(409);
    });

    it('allows back-to-back periods (no overlap at the boundary)', async () => {
      await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        weekday: Weekday.SATURDAY,
        startTime: '08:00',
        endTime: '09:00',
      });

      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ startTime: '09:00', endTime: '10:00' }));
      expect(res.status).toBe(201);
    });

    it('allows the same time range on a different weekday', async () => {
      await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        weekday: Weekday.SATURDAY,
        startTime: '08:00',
        endTime: '09:00',
      });

      const res = await request(server)
        .post('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send(validBody({ weekday: Weekday.SUNDAY }));
      expect(res.status).toBe(201);
    });
  });

  // -------------------------------------------------------------------
  // GET /timetable
  // -------------------------------------------------------------------

  describe('GET /timetable', () => {
    it("lists only the caller's own school's entries", async () => {
      const mine = await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });
      await createTimetableEntry(app, {
        schoolId: schoolB.id,
        academicYearId: academicYearB.id,
        gradeId: gradeB.id,
        subjectId: subjectB.id,
        teacherId: (await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id })).id,
      });

      const res = await request(server)
        .get('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(mine.id);
    });

    it('filters by gradeId', async () => {
      await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });
      await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: otherGradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        weekday: Weekday.SUNDAY,
      });

      const res = await request(server)
        .get(`/api/v1/timetable?gradeId=${otherGradeA.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].gradeId).toBe(otherGradeA.id);
    });

    it.each([
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s (not school_admin)', async (_label, getUser) => {
      const res = await request(server)
        .get('/api/v1/timetable')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // PUT /timetable/:id
  // -------------------------------------------------------------------

  describe('PUT /timetable/:id', () => {
    it('lets school_admin update room and time', async () => {
      const entry = await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        startTime: '08:00',
        endTime: '09:00',
      });

      const res = await request(server)
        .put(`/api/v1/timetable/${entry.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ startTime: '10:00', endTime: '11:00', room: 'Room 202' });

      expect(res.status).toBe(200);
      expect(res.body.startTime).toBe('10:00');
      expect(res.body.endTime).toBe('11:00');
      expect(res.body.room).toBe('Room 202');
    });

    it('does not conflict with its own previous state', async () => {
      const entry = await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        startTime: '08:00',
        endTime: '09:00',
      });

      const res = await request(server)
        .put(`/api/v1/timetable/${entry.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ room: 'Room 303' });

      expect(res.status).toBe(200);
      expect(res.body.room).toBe('Room 303');
    });

    it('409s when moving into a conflicting slot', async () => {
      await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        weekday: Weekday.SATURDAY,
        startTime: '08:00',
        endTime: '09:00',
      });
      const other = await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: otherGradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        weekday: Weekday.SUNDAY,
        startTime: '08:00',
        endTime: '09:00',
      });

      const res = await request(server)
        .put(`/api/v1/timetable/${other.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ weekday: Weekday.SATURDAY });
      expect(res.status).toBe(409);
    });

    it("404s another school's entry", async () => {
      const entry = await createTimetableEntry(app, {
        schoolId: schoolB.id,
        academicYearId: academicYearB.id,
        gradeId: gradeB.id,
        subjectId: subjectB.id,
        teacherId: (await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id })).id,
      });

      const res = await request(server)
        .put(`/api/v1/timetable/${entry.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ room: 'x' });
      expect(res.status).toBe(404);
    });

    it.each([
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s (not school_admin)', async (_label, getUser) => {
      const entry = await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });
      const res = await request(server)
        .put(`/api/v1/timetable/${entry.id}`)
        .set('Authorization', authHeader(app, getUser()))
        .send({ room: 'x' });
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // DELETE /timetable/:id
  // -------------------------------------------------------------------

  describe('DELETE /timetable/:id', () => {
    it('lets school_admin delete an entry in their own school', async () => {
      const entry = await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });

      const res = await request(server)
        .delete(`/api/v1/timetable/${entry.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(204);

      const list = await request(server)
        .get('/api/v1/timetable')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(list.body).toHaveLength(0);
    });

    it("404s (not 403) deleting another school's entry", async () => {
      const entry = await createTimetableEntry(app, {
        schoolId: schoolB.id,
        academicYearId: academicYearB.id,
        gradeId: gradeB.id,
        subjectId: subjectB.id,
        teacherId: (await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id })).id,
      });

      const res = await request(server)
        .delete(`/api/v1/timetable/${entry.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });

    it.each([
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s (not school_admin)', async (_label, getUser) => {
      const entry = await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });
      const res = await request(server)
        .delete(`/api/v1/timetable/${entry.id}`)
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /teacher/timetable
  // -------------------------------------------------------------------

  describe('GET /teacher/timetable', () => {
    it("returns only the caller's own entries, within their own school", async () => {
      const mine = await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });
      await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: otherTeacherA.id,
        weekday: Weekday.SUNDAY,
      });

      const res = await request(server)
        .get('/api/v1/teacher/timetable')
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(mine.id);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['parent', () => parentA],
    ])('rejects %s (not teacher)', async (_label, getUser) => {
      const res = await request(server)
        .get('/api/v1/teacher/timetable')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /parent/students/:id/timetable
  // -------------------------------------------------------------------

  describe('GET /parent/students/:id/timetable', () => {
    it("returns the linked child's grade timetable", async () => {
      const student = await createStudent(app, schoolA.id, {
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
      });
      await linkParentStudent(app, parentA.id, student.id);

      const inGrade = await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      });
      await createTimetableEntry(app, {
        schoolId: schoolA.id,
        academicYearId: academicYearA.id,
        gradeId: otherGradeA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
        weekday: Weekday.SUNDAY,
      });

      const res = await request(server)
        .get(`/api/v1/parent/students/${student.id}/timetable`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(inGrade.id);
    });

    it('404s a student the parent is not linked to', async () => {
      const student = await createStudent(app, schoolA.id, {
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
      });

      const res = await request(server)
        .get(`/api/v1/parent/students/${student.id}/timetable`)
        .set('Authorization', authHeader(app, parentA));
      expect(res.status).toBe(404);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
    ])('rejects %s (not parent)', async (_label, getUser) => {
      const student = await createStudent(app, schoolA.id, {
        academicYearId: academicYearA.id,
        gradeId: gradeA.id,
      });
      const res = await request(server)
        .get(`/api/v1/parent/students/${student.id}/timetable`)
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });
});
