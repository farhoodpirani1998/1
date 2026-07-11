import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createGuardian,
  createStudent,
  createSubject,
  createTeacherAssignment,
  createHomework,
  createAnnouncement,
  AnnouncementTargetType,
  authHeader,
  Role,
} from './setup/factories';

/**
 * Phase 5N: Global Search
 *
 * Proves that:
 * 1. GET /search returns grouped results across students, parents,
 *    teachers, subjects, homework, and announcements for a matching term.
 * 2. Matching is case-insensitive and partial (substring), for every
 *    category.
 * 3. Results are strictly tenant-isolated -- a term that matches rows in
 *    another school never surfaces them.
 * 4. Only school_admin, accountant, and staff may call the endpoint;
 *    parent, teacher, and unauthenticated callers are rejected.
 * 5. DTO validation rejects a missing/blank `q` and an out-of-range
 *    `limit`.
 * 6. `limit` caps the number of results returned per category.
 * 7. An empty/whitespace-only term (post-trim) returns every group empty,
 *    without erroring.
 */
describe('Global Search (Phase 5N e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let parentUserA: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminB: Awaited<ReturnType<typeof createUser>>;

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
    accountantA = await createUser(app, { role: Role.ACCOUNTANT, schoolId: schoolA.id });
    staffA = await createUser(app, { role: Role.STAFF, schoolId: schoolA.id });
    teacherA = await createUser(app, {
      role: Role.TEACHER,
      schoolId: schoolA.id,
      fullName: 'Reza Karimi',
    });
    parentUserA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });

    const acadYearA = await createAcademicYear(app, schoolA.id);
    const gradeA = await createGrade(app, schoolA.id);
    const guardianA = await createGuardian(app, schoolA.id, { fullName: 'Karim Ahmadi' });
    await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      guardianId: guardianA.id,
      fullName: 'Karimzadeh Ali',
    });
    const subjectA = await createSubject(app, schoolA.id, { title: 'Karimi Literature' });
    await createTeacherAssignment(app, {
      schoolId: schoolA.id,
      teacherId: teacherA.id,
      gradeId: gradeA.id,
      subjectId: subjectA.id,
    });
    await createHomework(app, {
      schoolId: schoolA.id,
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      subjectId: subjectA.id,
      teacherId: teacherA.id,
      title: 'Karimi Poems Essay',
    });
    await createAnnouncement(app, {
      schoolId: schoolA.id,
      title: 'Karimi Exam Schedule',
      targetType: AnnouncementTargetType.ALL,
      createdById: schoolAdminA.id,
    });

    // School B fixtures -- same search term, must never leak into A's results.
    const acadYearB = await createAcademicYear(app, schoolB.id);
    const gradeB = await createGrade(app, schoolB.id);
    const guardianB = await createGuardian(app, schoolB.id, { fullName: 'Karimi Guardian B' });
    await createStudent(app, schoolB.id, {
      academicYearId: acadYearB.id,
      gradeId: gradeB.id,
      guardianId: guardianB.id,
      fullName: 'Karimi Student B',
    });
    await createSubject(app, schoolB.id, { title: 'Karimi Subject B' });
  });

  // -------------------------------------------------------------------
  // GET /search
  // -------------------------------------------------------------------

  describe('GET /search', () => {
    it('returns grouped, matching results across all six categories', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: 'karim' })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          students: expect.any(Array),
          parents: expect.any(Array),
          teachers: expect.any(Array),
          subjects: expect.any(Array),
          homework: expect.any(Array),
          announcements: expect.any(Array),
        }),
      );

      expect(res.body.students).toHaveLength(1);
      expect(res.body.students[0].fullName).toBe('Karimzadeh Ali');

      expect(res.body.parents).toHaveLength(1);
      expect(res.body.parents[0].fullName).toBe('Karim Ahmadi');

      expect(res.body.teachers).toHaveLength(1);
      expect(res.body.teachers[0].fullName).toBe('Reza Karimi');

      expect(res.body.subjects).toHaveLength(1);
      expect(res.body.subjects[0].title).toBe('Karimi Literature');

      expect(res.body.homework).toHaveLength(1);
      expect(res.body.homework[0].title).toBe('Karimi Poems Essay');

      expect(res.body.announcements).toHaveLength(1);
      expect(res.body.announcements[0].title).toBe('Karimi Exam Schedule');
    });

    it('matches case-insensitively and partially', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: 'KARIMZADEH' })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.students).toHaveLength(1);
      expect(res.body.students[0].fullName).toBe('Karimzadeh Ali');
    });

    it('never returns another school\'s rows for the same term', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: 'karim' })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      const allNames = [
        ...res.body.students.map((s: any) => s.fullName),
        ...res.body.parents.map((p: any) => p.fullName),
        ...res.body.subjects.map((s: any) => s.title),
      ];
      expect(allNames).not.toContain('Karimi Student B');
      expect(allNames).not.toContain('Karimi Guardian B');
      expect(allNames).not.toContain('Karimi Subject B');
    });

    it('returns every group empty for a non-matching term', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: 'zzz-no-such-match-zzz' })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        students: [],
        parents: [],
        teachers: [],
        subjects: [],
        homework: [],
        announcements: [],
      });
    });

    it('returns every group empty for a whitespace-only term', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: '   ' })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        students: [],
        parents: [],
        teachers: [],
        subjects: [],
        homework: [],
        announcements: [],
      });
    });

    it('caps results per category at the requested limit', async () => {
      const acadYearA = await createAcademicYear(app, schoolA.id);
      const gradeA = await createGrade(app, schoolA.id);
      for (let i = 0; i < 5; i += 1) {
        await createStudent(app, schoolA.id, {
          academicYearId: acadYearA.id,
          gradeId: gradeA.id,
          fullName: `Limitcase Student ${i}`,
        });
      }

      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: 'Limitcase', limit: 2 })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.students).toHaveLength(2);
    });

    it('defaults to a limit of 10 when none is provided', async () => {
      const acadYearA = await createAcademicYear(app, schoolA.id);
      const gradeA = await createGrade(app, schoolA.id);
      for (let i = 0; i < 12; i += 1) {
        await createStudent(app, schoolA.id, {
          academicYearId: acadYearA.id,
          gradeId: gradeA.id,
          fullName: `Defaultcase Student ${i}`,
        });
      }

      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: 'Defaultcase' })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.students).toHaveLength(10);
    });

    it('rejects a missing q', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(400);
    });

    it('rejects a blank q', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: '' })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(400);
    });

    it('rejects a limit above the maximum', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: 'karim', limit: 51 })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(400);
    });

    it('rejects a limit below the minimum', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: 'karim', limit: 0 })
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(400);
    });

    it('allows accountant and staff, same as school_admin', async () => {
      const resAccountant = await request(server)
        .get('/api/v1/search')
        .query({ q: 'karim' })
        .set('Authorization', authHeader(app, accountantA));
      expect(resAccountant.status).toBe(200);

      const resStaff = await request(server)
        .get('/api/v1/search')
        .query({ q: 'karim' })
        .set('Authorization', authHeader(app, staffA));
      expect(resStaff.status).toBe(200);
    });

    it('rejects teacher and parent roles', async () => {
      const resTeacher = await request(server)
        .get('/api/v1/search')
        .query({ q: 'karim' })
        .set('Authorization', authHeader(app, teacherA));
      expect(resTeacher.status).toBe(403);

      const resParent = await request(server)
        .get('/api/v1/search')
        .query({ q: 'karim' })
        .set('Authorization', authHeader(app, parentUserA));
      expect(resParent.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(server).get('/api/v1/search').query({ q: 'karim' });
      expect(res.status).toBe(401);
    });

    it('rejects cross-school super_admin-less access from another school (no leakage, still own-school scoped)', async () => {
      const res = await request(server)
        .get('/api/v1/search')
        .query({ q: 'karim' })
        .set('Authorization', authHeader(app, schoolAdminB));

      expect(res.status).toBe(200);
      // schoolAdminB only ever sees schoolB's own matching rows.
      expect(res.body.subjects.map((s: any) => s.title)).toEqual(['Karimi Subject B']);
      expect(res.body.students.map((s: any) => s.fullName)).toEqual(['Karimi Student B']);
    });
  });
});
