import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import {
  createSchool,
  createUser,
  createSchoolSettings,
  authHeader,
  Role,
  Weekday,
} from './setup/factories';
import { SchoolSettings } from '../src/modules/school-settings/entities/school-settings.entity';

/**
 * Phase 5M: School Settings
 *
 * Proves that:
 * 1. school_admin can GET /settings, and a default settings row is
 *    auto-created (seeded from the school's own name/address/phone) the
 *    first time it's requested -- no separate "create" endpoint exists.
 * 2. A second GET returns the exact same row (not a new one each time) --
 *    exactly one settings record per school.
 * 3. school_admin can PUT /settings to partially update fields; fields
 *    omitted from the body are left unchanged.
 * 4. Every other role (accountant, staff, teacher, parent) is rejected
 *    on both GET and PUT /settings.
 * 5. DTO validation rejects malformed input (invalid email/url/hex
 *    color/enum values/out-of-range numbers).
 * 6. Tenant isolation: school A's settings are entirely independent of
 *    school B's -- one school's admin can never see or mutate another
 *    school's settings, and there's no id-based route to even attempt
 *    it (schoolId always comes from the token).
 */
describe('School Settings (Phase 5M e2e)', () => {
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

    schoolA = await createSchool(app, {
      name: 'School A',
      address: '123 Main St',
      phone: '02112345678',
    });
    schoolB = await createSchool(app, { name: 'School B' });

    schoolAdminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });
    accountantA = await createUser(app, { role: Role.ACCOUNTANT, schoolId: schoolA.id });
    staffA = await createUser(app, { role: Role.STAFF, schoolId: schoolA.id });
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });
  });

  // -------------------------------------------------------------------
  // GET /settings
  // -------------------------------------------------------------------

  describe('GET /settings', () => {
    it('auto-creates and returns default settings the first time', async () => {
      const res = await request(server)
        .get('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.schoolId).toBe(schoolA.id);
      // Seeded from the school's own record.
      expect(res.body.schoolName).toBe('School A');
      expect(res.body.address).toBe('123 Main St');
      expect(res.body.phone).toBe('02112345678');
      // Defaults.
      expect(res.body.logoUrl).toBeNull();
      expect(res.body.timezone).toBe('Asia/Tehran');
      expect(res.body.language).toBe('fa');
      expect(res.body.currency).toBe('IRR');
      expect(res.body.weekStartsOn).toBe(Weekday.SATURDAY);
      expect(res.body.workingDays).toEqual([
        Weekday.SATURDAY,
        Weekday.SUNDAY,
        Weekday.MONDAY,
        Weekday.TUESDAY,
        Weekday.WEDNESDAY,
      ]);
      expect(res.body.passingScore).toBe(10);
      expect(res.body.attendanceLateMinutes).toBe(15);
      expect(res.body.tuitionReminderDays).toBe(7);
      expect(res.body.smsEnabled).toBe(true);
      expect(res.body.emailEnabled).toBe(false);
      expect(res.body.primaryColor).toBeNull();
      expect(res.body.secondaryColor).toBeNull();
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it('creates exactly one row per school -- a second GET returns the same row', async () => {
      const first = await request(server)
        .get('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA));
      const second = await request(server)
        .get('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.createdAt).toBe(first.body.createdAt);

      const ds = getDataSource(app);
      const count = await ds.getRepository(SchoolSettings).count({ where: { schoolId: schoolA.id } });
      expect(count).toBe(1);
    });

    it('rejects every non-school_admin role', async () => {
      for (const user of [accountantA, staffA, teacherA, parentA]) {
        const res = await request(server)
          .get('/api/v1/settings')
          .set('Authorization', authHeader(app, user));
        expect(res.status).toBe(403);
      }
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(server).get('/api/v1/settings');
      expect(res.status).toBe(401);
    });

    it("never returns another school's settings", async () => {
      await createSchoolSettings(app, schoolA.id, { schoolName: 'School A Custom' });
      await createSchoolSettings(app, schoolB.id, { schoolName: 'School B Custom' });

      const res = await request(server)
        .get('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.schoolId).toBe(schoolA.id);
      expect(res.body.schoolName).toBe('School A Custom');
    });
  });

  // -------------------------------------------------------------------
  // PUT /settings
  // -------------------------------------------------------------------

  describe('PUT /settings', () => {
    it('lets school_admin partially update settings', async () => {
      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          schoolName: 'Updated School Name',
          website: 'https://example.com',
          primaryColor: '#1A73E8',
          smsEnabled: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.schoolName).toBe('Updated School Name');
      expect(res.body.website).toBe('https://example.com');
      expect(res.body.primaryColor).toBe('#1A73E8');
      expect(res.body.smsEnabled).toBe(false);
      // Untouched fields keep their default values.
      expect(res.body.currency).toBe('IRR');
      expect(res.body.timezone).toBe('Asia/Tehran');
    });

    it('creates the default row first if none exists yet, then applies the update', async () => {
      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ currency: 'USD' });

      expect(res.status).toBe(200);
      expect(res.body.currency).toBe('USD');
      expect(res.body.schoolName).toBe('School A');
    });

    it('leaves omitted fields unchanged across repeated updates', async () => {
      await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ schoolName: 'First Update' });

      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ currency: 'USD' });

      expect(res.status).toBe(200);
      expect(res.body.currency).toBe('USD');
      expect(res.body.schoolName).toBe('First Update');
    });

    it('clears a nullable field when explicitly sent as null', async () => {
      await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ website: 'https://example.com' });

      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ website: null });

      expect(res.status).toBe(200);
      expect(res.body.website).toBeNull();
    });

    it('updates workingDays and weekStartsOn', async () => {
      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          weekStartsOn: Weekday.MONDAY,
          workingDays: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY],
        });

      expect(res.status).toBe(200);
      expect(res.body.weekStartsOn).toBe(Weekday.MONDAY);
      expect(res.body.workingDays).toEqual([Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY]);
    });

    it('rejects an invalid email', async () => {
      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid hex color', async () => {
      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ primaryColor: 'blue' });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid weekday enum value', async () => {
      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ weekStartsOn: 99 });
      expect(res.status).toBe(400);
    });

    it('rejects an out-of-range passingScore', async () => {
      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ passingScore: 25 });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid language', async () => {
      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ language: 'de' });
      expect(res.status).toBe(400);
    });

    it('rejects unknown fields (whitelist validation)', async () => {
      const res = await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ notAField: 'nope' });
      expect(res.status).toBe(400);
    });

    it('rejects every non-school_admin role', async () => {
      for (const user of [accountantA, staffA, teacherA, parentA]) {
        const res = await request(server)
          .put('/api/v1/settings')
          .set('Authorization', authHeader(app, user))
          .send({ schoolName: 'Should Not Work' });
        expect(res.status).toBe(403);
      }
    });

    it("never mutates another school's settings", async () => {
      await request(server)
        .put('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ schoolName: 'School A Renamed' });

      const bRes = await request(server)
        .get('/api/v1/settings')
        .set('Authorization', authHeader(app, schoolAdminB));

      expect(bRes.status).toBe(200);
      expect(bRes.body.schoolId).toBe(schoolB.id);
      expect(bRes.body.schoolName).toBe('School B');
    });
  });
});
