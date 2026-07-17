import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  createTuitionPlan,
  createInstallment,
  createPayment,
  linkFounderSchool,
  authHeader,
  Role,
} from './setup/factories';

/**
 * Founder Portal (e2e).
 *
 * Mirrors tenant-isolation.e2e-spec's shape but from the founder's side:
 * a founder sees exactly the schools it's linked to via founder_schools
 * (never more, never less), a school it doesn't own 404s the same way a
 * cross-tenant student/plan/installment does elsewhere, and the
 * cross-school overview totals really are the sum of each owned school's
 * own numbers.
 */
describe('Founder Portal (e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;
  let schoolC: Awaited<ReturnType<typeof createSchool>>; // not owned by the founder
  let founder: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;

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
    schoolC = await createSchool(app, { name: 'School C' });

    founder = await createUser(app, { role: Role.FOUNDER, schoolId: null });
    await linkFounderSchool(app, founder.id, schoolA.id);
    await linkFounderSchool(app, founder.id, schoolB.id);

    schoolAdminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });
  });

  describe('GET /founder/schools', () => {
    it('lists only the schools this founder is linked to', async () => {
      const res = await request(server)
        .get('/api/v1/founder/schools')
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(200);
      const ids = res.body.map((s: any) => s.id);
      expect(ids).toEqual(expect.arrayContaining([schoolA.id, schoolB.id]));
      expect(ids).not.toContain(schoolC.id);
    });

    it('rejects a non-founder role', async () => {
      const res = await request(server)
        .get('/api/v1/founder/schools')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(403);
    });
  });

  describe('Ownership scoping (404 on an unowned school)', () => {
    it('returns 404 for /founder/schools/:id/students on a school not owned by this founder', async () => {
      const res = await request(server)
        .get(`/api/v1/founder/schools/${schoolC.id}/students`)
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(404);
    });

    it('returns 404 for /founder/schools/:id/teachers on a school not owned by this founder', async () => {
      const res = await request(server)
        .get(`/api/v1/founder/schools/${schoolC.id}/teachers`)
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(404);
    });

    it('returns 404 for /founder/schools/:id/staff on a school not owned by this founder', async () => {
      const res = await request(server)
        .get(`/api/v1/founder/schools/${schoolC.id}/staff`)
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(404);
    });

    it('returns 404 for /founder/schools/:id/tuition on a school not owned by this founder', async () => {
      const res = await request(server)
        .get(`/api/v1/founder/schools/${schoolC.id}/tuition`)
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(404);
    });

    it('returns 404 for /founder/schools/:id/dashboard on a school not owned by this founder', async () => {
      const res = await request(server)
        .get(`/api/v1/founder/schools/${schoolC.id}/dashboard`)
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(404);
    });
  });

  describe('Directories for an owned school', () => {
    it("lists School A's students", async () => {
      const year = await createAcademicYear(app, schoolA.id);
      const grade = await createGrade(app, schoolA.id);
      const student = await createStudent(app, schoolA.id, { academicYearId: year.id, gradeId: grade.id, fullName: 'Sara' });

      const res = await request(server)
        .get(`/api/v1/founder/schools/${schoolA.id}/students`)
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(200);
      expect(res.body.find((s: any) => s.id === student.id)).toBeDefined();
    });

    it("lists School A's teachers with their assignments", async () => {
      const teacher = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id, fullName: 'Teacher One' });

      const res = await request(server)
        .get(`/api/v1/founder/schools/${schoolA.id}/teachers`)
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(200);
      expect(res.body.find((t: any) => t.id === teacher.id)).toBeDefined();
    });

    it("lists School A's staff (school_admin/accountant/staff) but not parents or teachers", async () => {
      const accountant = await createUser(app, { role: Role.ACCOUNTANT, schoolId: schoolA.id });
      const parent = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });

      const res = await request(server)
        .get(`/api/v1/founder/schools/${schoolA.id}/staff`)
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(200);
      const ids = res.body.map((s: any) => s.id);
      expect(ids).toContain(schoolAdminA.id);
      expect(ids).toContain(accountant.id);
      expect(ids).not.toContain(parent.id);
    });
  });

  describe('GET /founder/schools/:id/tuition', () => {
    it("summarizes School A's tuition, unaffected by School B's numbers", async () => {
      const yearA = await createAcademicYear(app, schoolA.id);
      const gradeA = await createGrade(app, schoolA.id);
      const studentA = await createStudent(app, schoolA.id, { academicYearId: yearA.id, gradeId: gradeA.id });
      const planA = await createTuitionPlan(app, { studentId: studentA.id, academicYearId: yearA.id, baseAmount: 100_000_000 });
      const installmentA = await createInstallment(app, { tuitionPlanId: planA.id, amount: 100_000_000 });
      await createPayment(app, { installmentId: installmentA.id, amount: 40_000_000 });

      const yearB = await createAcademicYear(app, schoolB.id);
      const gradeB = await createGrade(app, schoolB.id);
      const studentB = await createStudent(app, schoolB.id, { academicYearId: yearB.id, gradeId: gradeB.id });
      await createTuitionPlan(app, { studentId: studentB.id, academicYearId: yearB.id, baseAmount: 999_000_000 });

      const res = await request(server)
        .get(`/api/v1/founder/schools/${schoolA.id}/tuition`)
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(200);
      expect(res.body.totalTuition).toBe(100_000_000);
      expect(res.body.totalPaid).toBe(40_000_000);
      expect(res.body.totalUnpaid).toBe(60_000_000);
    });
  });

  describe('GET /founder/overview', () => {
    it('aggregates totals across every owned school, one row per school', async () => {
      const yearA = await createAcademicYear(app, schoolA.id);
      const gradeA = await createGrade(app, schoolA.id);
      const studentA = await createStudent(app, schoolA.id, { academicYearId: yearA.id, gradeId: gradeA.id });
      await createTuitionPlan(app, { studentId: studentA.id, academicYearId: yearA.id, baseAmount: 50_000_000 });
      await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });

      const yearB = await createAcademicYear(app, schoolB.id);
      const gradeB = await createGrade(app, schoolB.id);
      const studentB1 = await createStudent(app, schoolB.id, { academicYearId: yearB.id, gradeId: gradeB.id });
      const studentB2 = await createStudent(app, schoolB.id, { academicYearId: yearB.id, gradeId: gradeB.id });
      await createTuitionPlan(app, { studentId: studentB1.id, academicYearId: yearB.id, baseAmount: 30_000_000 });

      const res = await request(server)
        .get('/api/v1/founder/overview')
        .set('Authorization', authHeader(app, founder));
      expect(res.status).toBe(200);

      expect(res.body.totals.schoolCount).toBe(2);
      expect(res.body.totals.studentCount).toBe(3); // 1 in A + 2 in B
      expect(res.body.totals.teacherCount).toBe(1);
      expect(res.body.totals.totalTuition).toBe(80_000_000); // 50M + 30M

      const rowA = res.body.schools.find((s: any) => s.schoolId === schoolA.id);
      const rowB = res.body.schools.find((s: any) => s.schoolId === schoolB.id);
      expect(rowA.studentCount).toBe(1);
      expect(rowB.studentCount).toBe(2);
      expect(res.body.schools.find((s: any) => s.schoolId === schoolC.id)).toBeUndefined();
      void studentB2;
    });
  });

  describe('Link management (super_admin only)', () => {
    it('super_admin can link a founder to a new school, then the founder sees it', async () => {
      const superAdmin = await createUser(app, { role: Role.SUPER_ADMIN, schoolId: null });

      const linkRes = await request(server)
        .post('/api/v1/founder/link')
        .set('Authorization', authHeader(app, superAdmin))
        .send({ founderId: founder.id, schoolId: schoolC.id });
      expect(linkRes.status).toBe(201);

      const res = await request(server)
        .get('/api/v1/founder/schools')
        .set('Authorization', authHeader(app, founder));
      expect(res.body.map((s: any) => s.id)).toContain(schoolC.id);
    });

    it('rejects linking a school to a user who is not a founder', async () => {
      const superAdmin = await createUser(app, { role: Role.SUPER_ADMIN, schoolId: null });

      const res = await request(server)
        .post('/api/v1/founder/link')
        .set('Authorization', authHeader(app, superAdmin))
        .send({ founderId: schoolAdminA.id, schoolId: schoolC.id });
      expect(res.status).toBe(400);
    });

    it('a non-super_admin cannot link founders to schools', async () => {
      const res = await request(server)
        .post('/api/v1/founder/link')
        .set('Authorization', authHeader(app, founder))
        .send({ founderId: founder.id, schoolId: schoolC.id });
      expect(res.status).toBe(403);
    });

    it('super_admin can unlink a founder from a school, removing it from their list', async () => {
      const superAdmin = await createUser(app, { role: Role.SUPER_ADMIN, schoolId: null });
      const link = await linkFounderSchool(app, founder.id, schoolC.id);

      const res = await request(server)
        .delete(`/api/v1/founder/link/${link.id}`)
        .set('Authorization', authHeader(app, superAdmin));
      expect(res.status).toBe(204);

      const listRes = await request(server)
        .get('/api/v1/founder/schools')
        .set('Authorization', authHeader(app, founder));
      expect(listRes.body.map((s: any) => s.id)).not.toContain(schoolC.id);
    });
  });
});
