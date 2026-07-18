import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  createTeacherAssignment,
  linkFounderSchool,
  authHeader,
  Role,
} from './setup/factories';

/**
 * POST/GET /students/:id/parent(s) — create-or-link a parent-portal
 * login directly from a student record — and GET /founder/teachers, the
 * cross-school teacher directory.
 */
describe('Student-linked parent creation + founder cross-school teachers (e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let studentA1: Awaited<ReturnType<typeof createStudent>>;
  let studentA2: Awaited<ReturnType<typeof createStudent>>;
  let studentB: Awaited<ReturnType<typeof createStudent>>;

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

    const yearA = await createAcademicYear(app, schoolA.id);
    const gradeA = await createGrade(app, schoolA.id);
    studentA1 = await createStudent(app, schoolA.id, { academicYearId: yearA.id, gradeId: gradeA.id, fullName: 'Student One' });
    studentA2 = await createStudent(app, schoolA.id, { academicYearId: yearA.id, gradeId: gradeA.id, fullName: 'Student Two' });

    const yearB = await createAcademicYear(app, schoolB.id);
    const gradeB = await createGrade(app, schoolB.id);
    studentB = await createStudent(app, schoolB.id, { academicYearId: yearB.id, gradeId: gradeB.id });
  });

  describe('POST /students/:id/parent', () => {
    it('school_admin can create a new parent and link it to a student', async () => {
      const res = await request(server)
        .post(`/students/${studentA1.id}/parent`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ fullName: 'Parent One', phone: '+989120000001', password: 'Passw0rd!2345' });

      expect(res.status).toBe(201);
      expect(res.body.fullName).toBe('Parent One');
      expect(res.body.phone).toBe('+989120000001');
      expect(res.body.linkId).toBeDefined();
      expect(res.body.passwordHash).toBeUndefined();

      // The new login can actually authenticate via the parent portal.
      const loginRes = await request(server)
        .post('/auth/login')
        .send({ phone: '+989120000001', password: 'Passw0rd!2345' });
      expect(loginRes.status).toBe(201);
      expect(loginRes.body.user.role).toBe('parent');

      const parentToken = `Bearer ${loginRes.body.accessToken}`;
      const myStudents = await request(server).get('/parent/students').set('Authorization', parentToken);
      expect(myStudents.status).toBe(200);
      expect(myStudents.body.map((s: any) => s.id)).toEqual([studentA1.id]);
    });

    it('a second student sharing the same parent phone reuses the account, not a duplicate user', async () => {
      const first = await request(server)
        .post(`/students/${studentA1.id}/parent`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ fullName: 'Shared Parent', phone: '+989120000002', password: 'Passw0rd!2345' });
      expect(first.status).toBe(201);

      const second = await request(server)
        .post(`/students/${studentA2.id}/parent`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ fullName: 'Shared Parent', phone: '+989120000002', password: 'Passw0rd!2345' });
      expect(second.status).toBe(201);

      // Same parent user id for both students — no duplicate account.
      expect(second.body.id).toBe(first.body.id);

      const loginRes = await request(server)
        .post('/auth/login')
        .send({ phone: '+989120000002', password: 'Passw0rd!2345' });
      const parentToken = `Bearer ${loginRes.body.accessToken}`;
      const myStudents = await request(server).get('/parent/students').set('Authorization', parentToken);
      expect(myStudents.body.map((s: any) => s.id).sort()).toEqual([studentA1.id, studentA2.id].sort());
    });

    it('school_admin cannot create a parent for a student in another school (404)', async () => {
      const res = await request(server)
        .post(`/students/${studentB.id}/parent`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ fullName: 'Cross School', phone: '+989120000003', password: 'Passw0rd!2345' });

      expect(res.status).toBe(404);
    });

    it('staff can also create a linked parent (allowed role)', async () => {
      const res = await request(server)
        .post(`/students/${studentA1.id}/parent`)
        .set('Authorization', authHeader(app, staffA))
        .send({ fullName: 'Staff Created Parent', phone: '+989120000004', password: 'Passw0rd!2345' });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /students/:id/parents', () => {
    it('lists every parent linked to a student, including the link id', async () => {
      const createRes = await request(server)
        .post(`/students/${studentA1.id}/parent`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ fullName: 'Listed Parent', phone: '+989120000005', password: 'Passw0rd!2345' });
      expect(createRes.status).toBe(201);

      const listRes = await request(server)
        .get(`/students/${studentA1.id}/parents`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].linkId).toBe(createRes.body.linkId);
      expect(listRes.body[0].phone).toBe('+989120000005');
    });

    it('the linked parent can be removed via the existing DELETE /parent/link/:id', async () => {
      const createRes = await request(server)
        .post(`/students/${studentA1.id}/parent`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ fullName: 'Removable Parent', phone: '+989120000006', password: 'Passw0rd!2345' });

      const delRes = await request(server)
        .delete(`/parent/link/${createRes.body.linkId}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(delRes.status).toBe(204);

      const listRes = await request(server)
        .get(`/students/${studentA1.id}/parents`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(listRes.body).toHaveLength(0);
    });
  });

  describe('GET /founder/teachers', () => {
    it('returns teachers from every owned school, tagged with school info, and none from an unowned school', async () => {
      const founder = await createUser(app, { role: Role.FOUNDER, schoolId: null });
      await linkFounderSchool(app, founder.id, schoolA.id);
      await linkFounderSchool(app, founder.id, schoolB.id);

      const schoolC = await createSchool(app, { name: 'School C (not owned)' });
      const teacherC = await createUser(app, { role: Role.TEACHER, schoolId: schoolC.id, fullName: 'Teacher C' });

      const teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id, fullName: 'Teacher A' });
      const gradeA = await createGrade(app, schoolA.id);
      const subjectA = (await request(server)
        .post('/subjects')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'Math' })).body;
      await createTeacherAssignment(app, {
        schoolId: schoolA.id,
        teacherId: teacherA.id,
        gradeId: gradeA.id,
        subjectId: subjectA.id,
      });

      const teacherB = await createUser(app, { role: Role.TEACHER, schoolId: schoolB.id, fullName: 'Teacher B' });

      const res = await request(server)
        .get('/founder/teachers')
        .set('Authorization', authHeader(app, founder));

      expect(res.status).toBe(200);
      const ids = res.body.map((t: any) => t.id);
      expect(ids).toEqual(expect.arrayContaining([teacherA.id, teacherB.id]));
      expect(ids).not.toContain(teacherC.id);

      const rowA = res.body.find((t: any) => t.id === teacherA.id);
      expect(rowA.schoolId).toBe(schoolA.id);
      expect(rowA.schoolName).toBe('School A');
      expect(rowA.assignments).toHaveLength(1);

      const rowB = res.body.find((t: any) => t.id === teacherB.id);
      expect(rowB.schoolId).toBe(schoolB.id);
      expect(rowB.schoolName).toBe('School B');
    });

    it('a founder who owns no schools gets an empty list', async () => {
      const founder = await createUser(app, { role: Role.FOUNDER, schoolId: null });

      const res = await request(server)
        .get('/founder/teachers')
        .set('Authorization', authHeader(app, founder));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
