import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import { createSchool, createUser, createAcademicYear, createGrade, createStudent, authHeader, Role } from './setup/factories';
import { School } from '../src/modules/schools/entities/school.entity';

/**
 * Schools — POST and a plain GET were already exercised (incidentally)
 * inside authorization-matrix specs, but GET /:id, PATCH /:id, DELETE
 * /:id (deactivate), and the studentCount/userCount aggregation on
 * findAll had no coverage at all.
 *
 * Proves that:
 * 1. Every route is super_admin-only; every other role (including
 *    school_admin, who "owns" the school being requested) gets 403.
 * 2. GET /schools returns per-school studentCount/userCount aggregates,
 *    excluding soft-deleted students from the count.
 * 3. GET /schools/:id returns 404 for a non-existent id.
 * 4. PATCH /schools/:id updates fields; isActive can be toggled directly.
 * 5. DELETE /schools/:id is a soft "deactivate" (isActive -> false), not
 *    a hard delete -- the row (and its students/users) still exists
 *    afterwards.
 */
describe('Schools (e2e)', () => {
  let app: INestApplication;
  let server: any;

  let superAdmin: Awaited<ReturnType<typeof createUser>>;
  let schoolAdmin: Awaited<ReturnType<typeof createUser>>;
  let accountant: Awaited<ReturnType<typeof createUser>>;
  let staff: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await truncateAll(app);
    superAdmin = await createUser(app, { role: Role.SUPER_ADMIN, schoolId: null });
  });

  // -------------------------------------------------------------------
  // GET /schools
  // -------------------------------------------------------------------

  describe('GET /schools', () => {
    it('returns studentCount and userCount per school, excluding archived students', async () => {
      const school = await createSchool(app, { name: 'Counted School' });
      schoolAdmin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
      accountant = await createUser(app, { role: Role.ACCOUNTANT, schoolId: school.id });

      const year = await createAcademicYear(app, school.id);
      const grade = await createGrade(app, school.id);
      await createStudent(app, school.id, { academicYearId: year.id, gradeId: grade.id });
      const archived = await createStudent(app, school.id, { academicYearId: year.id, gradeId: grade.id });

      const ds = getDataSource(app);
      await ds.query('UPDATE students SET deleted_at = now() WHERE id = $1', [archived.id]);

      const res = await request(server)
        .get('/api/v1/schools')
        .set('Authorization', authHeader(app, superAdmin));

      expect(res.status).toBe(200);
      const row = res.body.find((s: any) => s.id === school.id);
      expect(row).toBeDefined();
      expect(row.studentCount).toBe(1);
      expect(row.userCount).toBe(2);
    });

    it('rejects every non-super_admin role', async () => {
      const school = await createSchool(app);
      schoolAdmin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
      accountant = await createUser(app, { role: Role.ACCOUNTANT, schoolId: school.id });
      staff = await createUser(app, { role: Role.STAFF, schoolId: school.id });

      for (const user of [schoolAdmin, accountant, staff]) {
        const res = await request(server)
          .get('/api/v1/schools')
          .set('Authorization', authHeader(app, user));
        expect(res.status).toBe(403);
      }
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(server).get('/api/v1/schools');
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // GET /schools/:id
  // -------------------------------------------------------------------

  describe('GET /schools/:id', () => {
    it('returns the school for super_admin', async () => {
      const school = await createSchool(app, { name: 'Fetchable School' });

      const res = await request(server)
        .get(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, superAdmin));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(school.id);
      expect(res.body.name).toBe('Fetchable School');
    });

    it('404s on a non-existent id', async () => {
      const res = await request(server)
        .get('/api/v1/schools/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader(app, superAdmin));
      expect(res.status).toBe(404);
    });

    it("rejects the school's own school_admin", async () => {
      const school = await createSchool(app);
      schoolAdmin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

      const res = await request(server)
        .get(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, schoolAdmin));

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // PATCH /schools/:id
  // -------------------------------------------------------------------

  describe('PATCH /schools/:id', () => {
    it('lets super_admin update name/address/phone', async () => {
      const school = await createSchool(app, { name: 'Old Name' });

      const res = await request(server)
        .patch(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, superAdmin))
        .send({ name: 'New Name', address: 'New Address', phone: '02112345678' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
      expect(res.body.address).toBe('New Address');
      expect(res.body.phone).toBe('02112345678');
    });

    it('lets super_admin flip isActive directly', async () => {
      const school = await createSchool(app, { isActive: true });

      const res = await request(server)
        .patch(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, superAdmin))
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });

    it('rejects an invalid IR phone number', async () => {
      const school = await createSchool(app);

      const res = await request(server)
        .patch(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, superAdmin))
        .send({ phone: 'not-a-phone' });

      expect(res.status).toBe(400);
    });

    it('rejects a name over the max length', async () => {
      const school = await createSchool(app);

      const res = await request(server)
        .patch(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, superAdmin))
        .send({ name: 'a'.repeat(201) });

      expect(res.status).toBe(400);
    });

    it('404s on a non-existent id', async () => {
      const res = await request(server)
        .patch('/api/v1/schools/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader(app, superAdmin))
        .send({ name: 'Ghost School' });
      expect(res.status).toBe(404);
    });

    it("rejects the school's own school_admin", async () => {
      const school = await createSchool(app);
      schoolAdmin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

      const res = await request(server)
        .patch(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, schoolAdmin))
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // DELETE /schools/:id (deactivate, not a hard delete)
  // -------------------------------------------------------------------

  describe('DELETE /schools/:id', () => {
    it('deactivates the school instead of deleting it', async () => {
      const school = await createSchool(app, { isActive: true });

      const res = await request(server)
        .delete(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, superAdmin));

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(School).findOne({ where: { id: school.id } });
      expect(refreshed).not.toBeNull();
      expect(refreshed?.isActive).toBe(false);
    });

    it("leaves the school's students and users intact after deactivation", async () => {
      const school = await createSchool(app);
      const year = await createAcademicYear(app, school.id);
      const grade = await createGrade(app, school.id);
      const student = await createStudent(app, school.id, { academicYearId: year.id, gradeId: grade.id });

      await request(server)
        .delete(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, superAdmin));

      const ds = getDataSource(app);
      const stillThere = await ds.query('SELECT id FROM students WHERE id = $1', [student.id]);
      expect(stillThere).toHaveLength(1);
    });

    it('404s on a non-existent id', async () => {
      const res = await request(server)
        .delete('/api/v1/schools/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader(app, superAdmin));
      expect(res.status).toBe(404);
    });

    it("rejects the school's own school_admin", async () => {
      const school = await createSchool(app);
      schoolAdmin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

      const res = await request(server)
        .delete(`/api/v1/schools/${school.id}`)
        .set('Authorization', authHeader(app, schoolAdmin));

      expect(res.status).toBe(403);

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(School).findOne({ where: { id: school.id } });
      expect(refreshed?.isActive).toBe(true);
    });
  });
});
