import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAnnouncement,
  authHeader,
  Role,
  AnnouncementTargetType,
} from './setup/factories';

/**
 * Phase 5H: School Announcements
 *
 * Proves that:
 * 1. school_admin can create (POST /announcements), list
 *    (GET /announcements), and delete (DELETE /announcements/:id)
 *    announcements for their own school. Every non-school_admin role is
 *    rejected on all three routes.
 * 2. DTO validation rejects a malformed create payload (missing/blank
 *    title or message, invalid targetType).
 * 3. GET /announcements never returns another school's rows, and
 *    DELETE /announcements/:id 404s (not 403) on another school's id, so
 *    a school_admin probing an id can't tell "doesn't exist" from
 *    "exists but isn't yours".
 * 4. GET /teacher/announcements only ever returns announcements targeted
 *    at 'all' or 'teachers', scoped to the caller's own school -- never
 *    'parents'/'staff'-only rows, never another school's rows.
 * 5. GET /parent/announcements only ever returns announcements targeted
 *    at 'all' or 'parents', scoped to the caller's own school -- never
 *    'teachers'/'staff'-only rows, never another school's rows.
 * 6. Every /teacher/announcements and /parent/announcements route is
 *    rejected for every role outside teacher / parent respectively.
 */
describe('School Announcements (Phase 5H e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
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
    staffA = await createUser(app, { role: Role.STAFF, schoolId: schoolA.id });
    accountantA = await createUser(app, { role: Role.ACCOUNTANT, schoolId: schoolA.id });
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });
  });

  // -------------------------------------------------------------------
  // POST /announcements (school_admin only)
  // -------------------------------------------------------------------

  describe('POST /announcements', () => {
    it('lets school_admin create an announcement', async () => {
      const res = await request(server)
        .post('/api/v1/announcements')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          title: 'Holiday Notice',
          message: 'School will be closed next Monday.',
          targetType: AnnouncementTargetType.ALL,
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Holiday Notice');
      expect(res.body.message).toBe('School will be closed next Monday.');
      expect(res.body.targetType).toBe('all');
      expect(res.body.createdById).toBe(schoolAdminA.id);
      expect(res.body.createdAt).toBeDefined();
    });

    it.each([
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s (not school_admin)', async (_label, getUser) => {
      const res = await request(server)
        .post('/api/v1/announcements')
        .set('Authorization', authHeader(app, getUser()))
        .send({ title: 'x', message: 'y', targetType: AnnouncementTargetType.ALL });
      expect(res.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const res = await request(server)
        .post('/api/v1/announcements')
        .send({ title: 'x', message: 'y', targetType: AnnouncementTargetType.ALL });
      expect(res.status).toBe(401);
    });

    it('rejects a missing title', async () => {
      const res = await request(server)
        .post('/api/v1/announcements')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ message: 'y', targetType: AnnouncementTargetType.ALL });
      expect(res.status).toBe(400);
    });

    it('rejects a blank message', async () => {
      const res = await request(server)
        .post('/api/v1/announcements')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'x', message: '', targetType: AnnouncementTargetType.ALL });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid targetType', async () => {
      const res = await request(server)
        .post('/api/v1/announcements')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'x', message: 'y', targetType: 'everyone' });
      expect(res.status).toBe(400);
    });

    it('rejects a title over 200 characters', async () => {
      const res = await request(server)
        .post('/api/v1/announcements')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'a'.repeat(201), message: 'y', targetType: AnnouncementTargetType.ALL });
      expect(res.status).toBe(400);
    });

    it('rejects unknown extra fields (forbidNonWhitelisted)', async () => {
      const res = await request(server)
        .post('/api/v1/announcements')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({
          title: 'x',
          message: 'y',
          targetType: AnnouncementTargetType.ALL,
          schoolId: schoolB.id,
        });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // GET /announcements (school_admin only)
  // -------------------------------------------------------------------

  describe('GET /announcements', () => {
    it("lists only the caller's own school's announcements, most recent first", async () => {
      const older = await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'Older',
        targetType: AnnouncementTargetType.PARENTS,
      });
      await new Promise((r) => setTimeout(r, 5));
      const newer = await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'Newer',
        targetType: AnnouncementTargetType.TEACHERS,
      });
      await createAnnouncement(app, { schoolId: schoolB.id, title: 'Other School' });

      const res = await request(server)
        .get('/api/v1/announcements')
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((a: any) => a.id)).toEqual([newer.id, older.id]);
      expect(res.body.every((a: any) => a.title !== 'Other School')).toBe(true);
    });

    it.each([
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s (not school_admin)', async (_label, getUser) => {
      const res = await request(server)
        .get('/api/v1/announcements')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // DELETE /announcements/:id (school_admin only)
  // -------------------------------------------------------------------

  describe('DELETE /announcements/:id', () => {
    it('lets school_admin delete an announcement in their own school', async () => {
      const announcement = await createAnnouncement(app, { schoolId: schoolA.id });

      const res = await request(server)
        .delete(`/api/v1/announcements/${announcement.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(204);

      const list = await request(server)
        .get('/api/v1/announcements')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(list.body).toHaveLength(0);
    });

    it("404s (not 403) deleting another school's announcement", async () => {
      const announcement = await createAnnouncement(app, { schoolId: schoolB.id });

      const res = await request(server)
        .delete(`/api/v1/announcements/${announcement.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });

    it('404s deleting a nonexistent id', async () => {
      const res = await request(server)
        .delete('/api/v1/announcements/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });

    it.each([
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
      ['parent', () => parentA],
    ])('rejects %s (not school_admin)', async (_label, getUser) => {
      const announcement = await createAnnouncement(app, { schoolId: schoolA.id });
      const res = await request(server)
        .delete(`/api/v1/announcements/${announcement.id}`)
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /teacher/announcements
  // -------------------------------------------------------------------

  describe('GET /teacher/announcements', () => {
    it("returns only 'all' and 'teachers' announcements from the caller's own school", async () => {
      const all = await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'All',
        targetType: AnnouncementTargetType.ALL,
      });
      const teachers = await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'Teachers',
        targetType: AnnouncementTargetType.TEACHERS,
      });
      await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'Parents',
        targetType: AnnouncementTargetType.PARENTS,
      });
      await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'Staff',
        targetType: AnnouncementTargetType.STAFF,
      });
      await createAnnouncement(app, {
        schoolId: schoolB.id,
        title: 'Other School All',
        targetType: AnnouncementTargetType.ALL,
      });

      const res = await request(server)
        .get('/api/v1/teacher/announcements')
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const ids = res.body.map((a: any) => a.id).sort();
      expect(ids).toEqual([all.id, teachers.id].sort());
      // recipient view never leaks the internal creator id
      expect(res.body.every((a: any) => a.createdById === undefined)).toBe(true);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['parent', () => parentA],
    ])('rejects %s (not teacher)', async (_label, getUser) => {
      const res = await request(server)
        .get('/api/v1/teacher/announcements')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------
  // GET /parent/announcements
  // -------------------------------------------------------------------

  describe('GET /parent/announcements', () => {
    it("returns only 'all' and 'parents' announcements from the caller's own school", async () => {
      const all = await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'All',
        targetType: AnnouncementTargetType.ALL,
      });
      const parents = await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'Parents',
        targetType: AnnouncementTargetType.PARENTS,
      });
      await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'Teachers',
        targetType: AnnouncementTargetType.TEACHERS,
      });
      await createAnnouncement(app, {
        schoolId: schoolB.id,
        title: 'Other School Parents',
        targetType: AnnouncementTargetType.PARENTS,
      });

      const res = await request(server)
        .get('/api/v1/parent/announcements')
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      const ids = res.body.map((a: any) => a.id).sort();
      expect(ids).toEqual([all.id, parents.id].sort());
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['teacher', () => teacherA],
    ])('rejects %s (not parent)', async (_label, getUser) => {
      const res = await request(server)
        .get('/api/v1/parent/announcements')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });
});
