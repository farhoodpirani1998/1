import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import { AnnouncementRead } from '../src/modules/announcements/entities/announcement-read.entity';
import {
  createSchool,
  createUser,
  createAnnouncement,
  createAnnouncementRead,
  authHeader,
  Role,
  AnnouncementTargetType,
} from './setup/factories';

/**
 * Sprint A.4 — Teacher Announcement Read Tracking
 *
 * Proves that:
 * 1. POST /teacher/announcements/:id/read creates exactly one
 *    AnnouncementRead row for the caller, and GET /teacher/announcements
 *    reflects it as isRead: true with a matching readAt, while every
 *    pre-existing field on that route (id, title, message, targetType,
 *    createdAt) is unchanged.
 * 2. Unread announcements come back isRead: false, readAt: null.
 * 3. Marking as read is idempotent: a second POST for the same
 *    announcement doesn't create a second row and doesn't move readAt.
 * 4. Read status is per-user: one teacher marking an announcement read
 *    never affects what another teacher sees.
 * 5. A teacher can only mark as read an announcement actually visible to
 *    them: an 'all'/'teachers' announcement in their own school 200s: a
 *    'parents'/'staff'-only announcement in their own school 403s, and
 *    an announcement belonging to another school 404s -- same
 *    "wrong-tenant looks identical to nonexistent, wrong-audience is a
 *    403" split every other audience-scoped route in this codebase uses.
 * 6. The route is rejected for every non-teacher role and an
 *    unauthenticated caller.
 */
describe('Teacher Announcement Read Tracking (Sprint A.4 e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let parentA: Awaited<ReturnType<typeof createUser>>;
  let teacherA: Awaited<ReturnType<typeof createUser>>;
  let teacherA2: Awaited<ReturnType<typeof createUser>>;
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
    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id });
    teacherA = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    teacherA2 = await createUser(app, { role: Role.TEACHER, schoolId: schoolA.id });
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });
  });

  // -------------------------------------------------------------------
  // POST /teacher/announcements/:id/read
  // -------------------------------------------------------------------

  describe('POST /teacher/announcements/:id/read', () => {
    it('marks an "all"-targeted announcement as read and persists exactly one row', async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.ALL,
      });

      const res = await request(server)
        .post(`/api/v1/teacher/announcements/${announcement.id}/read`)
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(announcement.id);
      expect(res.body.isRead).toBe(true);
      expect(res.body.readAt).toBeDefined();

      const ds = getDataSource(app);
      const rows = await ds.getRepository(AnnouncementRead).find({
        where: { announcementId: announcement.id, userId: teacherA.id },
      });
      expect(rows).toHaveLength(1);
    });

    it('marks a "teachers"-targeted announcement as read', async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.TEACHERS,
      });

      const res = await request(server)
        .post(`/api/v1/teacher/announcements/${announcement.id}/read`)
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.isRead).toBe(true);
    });

    it('is idempotent: a second call does not create a second row or move readAt', async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.ALL,
      });

      const first = await request(server)
        .post(`/api/v1/teacher/announcements/${announcement.id}/read`)
        .set('Authorization', authHeader(app, teacherA));
      expect(first.status).toBe(200);
      const firstReadAt = first.body.readAt;

      await new Promise((resolve) => setTimeout(resolve, 20));

      const second = await request(server)
        .post(`/api/v1/teacher/announcements/${announcement.id}/read`)
        .set('Authorization', authHeader(app, teacherA));
      expect(second.status).toBe(200);
      expect(second.body.readAt).toBe(firstReadAt);

      const ds = getDataSource(app);
      const rows = await ds.getRepository(AnnouncementRead).find({
        where: { announcementId: announcement.id, userId: teacherA.id },
      });
      expect(rows).toHaveLength(1);
    });

    it('tracks read status per user: one teacher reading it does not mark it read for another', async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.ALL,
      });

      await request(server)
        .post(`/api/v1/teacher/announcements/${announcement.id}/read`)
        .set('Authorization', authHeader(app, teacherA))
        .expect(200);

      const ds = getDataSource(app);
      const rowsForTeacherA2 = await ds.getRepository(AnnouncementRead).find({
        where: { announcementId: announcement.id, userId: teacherA2.id },
      });
      expect(rowsForTeacherA2).toHaveLength(0);

      const listRes = await request(server)
        .get('/api/v1/teacher/announcements')
        .set('Authorization', authHeader(app, teacherA2));
      const row = listRes.body.find((a: any) => a.id === announcement.id);
      expect(row.isRead).toBe(false);
      expect(row.readAt).toBeNull();
    });

    it('rejects a "parents"-only announcement in the caller\'s own school (visible, but not to teachers)', async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.PARENTS,
      });

      const res = await request(server)
        .post(`/api/v1/teacher/announcements/${announcement.id}/read`)
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(403);
    });

    it('rejects a "staff"-only announcement in the caller\'s own school', async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.STAFF,
      });

      const res = await request(server)
        .post(`/api/v1/teacher/announcements/${announcement.id}/read`)
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(403);
    });

    it("404s for another school's announcement (looks identical to a nonexistent id)", async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolB.id,
        targetType: AnnouncementTargetType.ALL,
      });

      const res = await request(server)
        .post(`/api/v1/teacher/announcements/${announcement.id}/read`)
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(404);
    });

    it('404s for a nonexistent announcement id', async () => {
      const res = await request(server)
        .post('/api/v1/teacher/announcements/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(404);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['parent', () => parentA],
    ])('rejects %s (not teacher)', async (_label, getUser) => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.ALL,
      });

      const res = await request(server)
        .post(`/api/v1/teacher/announcements/${announcement.id}/read`)
        .set('Authorization', authHeader(app, getUser()));

      expect(res.status).toBe(403);
    });

    it('rejects an unauthenticated request', async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.ALL,
      });

      const res = await request(server).post(`/api/v1/teacher/announcements/${announcement.id}/read`);

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // GET /teacher/announcements — isRead / readAt
  // -------------------------------------------------------------------

  describe('GET /teacher/announcements with read status', () => {
    it('returns isRead: false and readAt: null for an unread announcement, alongside every existing field unchanged', async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        title: 'Unread One',
        message: 'Body text',
        targetType: AnnouncementTargetType.ALL,
      });

      const res = await request(server)
        .get('/api/v1/teacher/announcements')
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const row = res.body.find((a: any) => a.id === announcement.id);
      expect(row).toMatchObject({
        id: announcement.id,
        title: 'Unread One',
        message: 'Body text',
        targetType: 'all',
        isRead: false,
        readAt: null,
      });
      expect(row.createdAt).toBeDefined();
      expect(row.createdById).toBeUndefined();
    });

    it('returns isRead: true and a matching readAt for an already-read announcement', async () => {
      const announcement = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.TEACHERS,
      });
      const readRow = await createAnnouncementRead(app, {
        announcementId: announcement.id,
        userId: teacherA.id,
        schoolId: schoolA.id,
      });

      const res = await request(server)
        .get('/api/v1/teacher/announcements')
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(200);
      const row = res.body.find((a: any) => a.id === announcement.id);
      expect(row.isRead).toBe(true);
      expect(new Date(row.readAt).toISOString()).toBe(readRow.readAt.toISOString());
    });

    it('never returns a "parents"/"staff"-only or another school\'s announcement, same as before this sprint', async () => {
      const visible = await createAnnouncement(app, {
        schoolId: schoolA.id,
        targetType: AnnouncementTargetType.ALL,
      });
      await createAnnouncement(app, { schoolId: schoolA.id, targetType: AnnouncementTargetType.PARENTS });
      await createAnnouncement(app, { schoolId: schoolA.id, targetType: AnnouncementTargetType.STAFF });
      await createAnnouncement(app, { schoolId: schoolB.id, targetType: AnnouncementTargetType.ALL });

      const res = await request(server)
        .get('/api/v1/teacher/announcements')
        .set('Authorization', authHeader(app, teacherA));

      expect(res.status).toBe(200);
      expect(res.body.map((a: any) => a.id)).toEqual([visible.id]);
    });

    it.each([
      ['school_admin', () => schoolAdminA],
      ['staff', () => staffA],
      ['accountant', () => accountantA],
      ['parent', () => parentA],
    ])('still rejects %s (not teacher)', async (_label, getUser) => {
      const res = await request(server)
        .get('/api/v1/teacher/announcements')
        .set('Authorization', authHeader(app, getUser()));
      expect(res.status).toBe(403);
    });
  });
});
