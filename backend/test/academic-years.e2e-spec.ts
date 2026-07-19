import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import { createSchool, createUser, createAcademicYear, authHeader, Role } from './setup/factories';
import { AcademicYear } from '../src/modules/academic-years/entities/academic-year.entity';

/**
 * Academic Years — previously had zero dedicated e2e coverage; only
 * incidentally touched by a single GET call inside parent-portal specs.
 *
 * Proves that:
 * 1. school_admin can create, list, fetch, and update academic years.
 * 2. accountant/staff can read (GET) but not write (POST/PATCH).
 * 3. parent and teacher are rejected on every route — the controller's
 *    own comments flag this as a regression-prone spot ("Phase 5A's new
 *    'parent' role must be excluded here same as everywhere else").
 * 4. Marking a year isCurrent automatically unsets any previously-current
 *    year for that school, both on create and on update.
 * 5. Tenant isolation: school A can never list, fetch, or update school
 *    B's academic years (404, not leaked data).
 * 6. DTO validation rejects bad input (missing title, invalid date,
 *    unknown fields).
 */
describe('Academic Years (e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let parentA: Awaited<ReturnType<typeof createUser>>;
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
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });
  });

  // -------------------------------------------------------------------
  // POST /academic-years
  // -------------------------------------------------------------------

  describe('POST /academic-years', () => {
    it('lets school_admin create an academic year', async () => {
      const res = await request(server)
        .post('/api/v1/academic-years')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: '1404-1405', startDate: '2025-09-23', endDate: '2026-06-21' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('1404-1405');
      expect(res.body.schoolId).toBe(schoolA.id);
      expect(res.body.isCurrent).toBe(false);
    });

    it('unsets the previously-current year for the school when creating a new current year', async () => {
      const oldCurrent = await createAcademicYear(app, schoolA.id, { isCurrent: true });

      const res = await request(server)
        .post('/api/v1/academic-years')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: '1405-1406', isCurrent: true });

      expect(res.status).toBe(201);
      expect(res.body.isCurrent).toBe(true);

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(AcademicYear).findOne({ where: { id: oldCurrent.id } });
      expect(refreshed?.isCurrent).toBe(false);
    });

    it('does not unset another school\'s current year', async () => {
      const otherSchoolCurrent = await createAcademicYear(app, schoolB.id, { isCurrent: true });

      await request(server)
        .post('/api/v1/academic-years')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: '1405-1406', isCurrent: true });

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(AcademicYear).findOne({ where: { id: otherSchoolCurrent.id } });
      expect(refreshed?.isCurrent).toBe(true);
    });

    it('rejects a missing title', async () => {
      const res = await request(server)
        .post('/api/v1/academic-years')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ startDate: '2025-09-23' });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid date', async () => {
      const res = await request(server)
        .post('/api/v1/academic-years')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: '1404-1405', startDate: 'not-a-date' });
      expect(res.status).toBe(400);
    });

    it('rejects unknown fields (whitelist validation)', async () => {
      const res = await request(server)
        .post('/api/v1/academic-years')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: '1404-1405', notAField: 'nope' });
      expect(res.status).toBe(400);
    });

    it('rejects accountant, staff, teacher, and parent', async () => {
      for (const user of [accountantA, staffA, teacherA, parentA]) {
        const res = await request(server)
          .post('/api/v1/academic-years')
          .set('Authorization', authHeader(app, user))
          .send({ title: '1404-1405' });
        expect(res.status).toBe(403);
      }
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(server).post('/api/v1/academic-years').send({ title: '1404-1405' });
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // GET /academic-years
  // -------------------------------------------------------------------

  describe('GET /academic-years', () => {
    it('lets school_admin, accountant, and staff list years for their own school', async () => {
      await createAcademicYear(app, schoolA.id, { title: 'Year A1' });
      await createAcademicYear(app, schoolA.id, { title: 'Year A2' });
      await createAcademicYear(app, schoolB.id, { title: 'Year B1' });

      for (const user of [schoolAdminA, accountantA, staffA]) {
        const res = await request(server)
          .get('/api/v1/academic-years')
          .set('Authorization', authHeader(app, user));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body.every((y: any) => y.schoolId === schoolA.id)).toBe(true);
      }
    });

    it('rejects teacher and parent', async () => {
      for (const user of [teacherA, parentA]) {
        const res = await request(server)
          .get('/api/v1/academic-years')
          .set('Authorization', authHeader(app, user));
        expect(res.status).toBe(403);
      }
    });
  });

  // -------------------------------------------------------------------
  // GET /academic-years/:id
  // -------------------------------------------------------------------

  describe('GET /academic-years/:id', () => {
    it('returns the year for an authorized role', async () => {
      const year = await createAcademicYear(app, schoolA.id, { title: 'Year A1' });

      const res = await request(server)
        .get(`/api/v1/academic-years/${year.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(year.id);
    });

    it("404s on another school's academic year instead of leaking it", async () => {
      const yearB = await createAcademicYear(app, schoolB.id, { title: 'Year B1' });

      const res = await request(server)
        .get(`/api/v1/academic-years/${yearB.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(404);
    });

    it('404s on a non-existent id', async () => {
      const res = await request(server)
        .get('/api/v1/academic-years/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------
  // PATCH /academic-years/:id
  // -------------------------------------------------------------------

  describe('PATCH /academic-years/:id', () => {
    it('lets school_admin update a year', async () => {
      const year = await createAcademicYear(app, schoolA.id, { title: 'Old Title' });

      const res = await request(server)
        .patch(`/api/v1/academic-years/${year.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Title');
    });

    it('unsets the previously-current year when updating another year to current', async () => {
      const oldCurrent = await createAcademicYear(app, schoolA.id, { isCurrent: true });
      const target = await createAcademicYear(app, schoolA.id, { isCurrent: false });

      const res = await request(server)
        .patch(`/api/v1/academic-years/${target.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ isCurrent: true });

      expect(res.status).toBe(200);
      expect(res.body.isCurrent).toBe(true);

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(AcademicYear).findOne({ where: { id: oldCurrent.id } });
      expect(refreshed?.isCurrent).toBe(false);
    });

    it("404s when trying to update another school's academic year", async () => {
      const yearB = await createAcademicYear(app, schoolB.id, { title: 'Year B1' });

      const res = await request(server)
        .patch(`/api/v1/academic-years/${yearB.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'Hijacked' });

      expect(res.status).toBe(404);

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(AcademicYear).findOne({ where: { id: yearB.id } });
      expect(refreshed?.title).toBe('Year B1');
    });

    it('rejects accountant, staff, teacher, and parent', async () => {
      const year = await createAcademicYear(app, schoolA.id);
      for (const user of [accountantA, staffA, teacherA, parentA]) {
        const res = await request(server)
          .patch(`/api/v1/academic-years/${year.id}`)
          .set('Authorization', authHeader(app, user))
          .send({ title: 'Should Not Work' });
        expect(res.status).toBe(403);
      }
    });

    it('rejects an invalid date on update', async () => {
      const year = await createAcademicYear(app, schoolA.id);
      const res = await request(server)
        .patch(`/api/v1/academic-years/${year.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ endDate: 'not-a-date' });
      expect(res.status).toBe(400);
    });
  });
});
