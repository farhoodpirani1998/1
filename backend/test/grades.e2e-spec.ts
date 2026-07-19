import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import { createSchool, createUser, createGrade, createStudent, authHeader, Role } from './setup/factories';
import { Grade } from '../src/modules/grades/entities/grade.entity';

/**
 * Grades — previously had zero dedicated e2e coverage; only ever hit
 * incidentally by a single GET call inside parent-portal specs. The
 * delete-guard in GradesService (refusing to remove a grade that still
 * has students assigned) had no coverage at all.
 *
 * Proves that:
 * 1. school_admin can create, list, fetch, update, and delete grades.
 * 2. accountant/staff can read (GET) but not write.
 * 3. parent and teacher are rejected on every route.
 * 4. Deleting a grade with students assigned is blocked with 409 and the
 *    grade survives; deleting an empty grade succeeds.
 * 5. Tenant isolation: school A can never fetch, update, or delete school
 *    B's grades (404, not leaked or mutated).
 * 6. DTO validation rejects bad input (missing/too-long title, unknown
 *    fields).
 */
describe('Grades (e2e)', () => {
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
  // POST /grades
  // -------------------------------------------------------------------

  describe('POST /grades', () => {
    it('lets school_admin create a grade', async () => {
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'هفتم' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('هفتم');
      expect(res.body.schoolId).toBe(schoolA.id);
    });

    it('rejects a missing title', async () => {
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({});
      expect(res.status).toBe(400);
    });

    it('rejects a title over the max length', async () => {
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'a'.repeat(51) });
      expect(res.status).toBe(400);
    });

    it('rejects unknown fields (whitelist validation)', async () => {
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'هفتم', notAField: 'nope' });
      expect(res.status).toBe(400);
    });

    it('rejects accountant, staff, teacher, and parent', async () => {
      for (const user of [accountantA, staffA, teacherA, parentA]) {
        const res = await request(server)
          .post('/api/v1/grades')
          .set('Authorization', authHeader(app, user))
          .send({ title: 'هفتم' });
        expect(res.status).toBe(403);
      }
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(server).post('/api/v1/grades').send({ title: 'هفتم' });
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // GET /grades, GET /grades/:id
  // -------------------------------------------------------------------

  describe('GET /grades', () => {
    it('lets school_admin, accountant, and staff list grades for their own school only', async () => {
      await createGrade(app, schoolA.id, { title: 'هفتم' });
      await createGrade(app, schoolA.id, { title: 'هشتم' });
      await createGrade(app, schoolB.id, { title: 'نهم' });

      for (const user of [schoolAdminA, accountantA, staffA]) {
        const res = await request(server)
          .get('/api/v1/grades')
          .set('Authorization', authHeader(app, user));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body.every((g: any) => g.schoolId === schoolA.id)).toBe(true);
      }
    });

    it('rejects teacher and parent', async () => {
      for (const user of [teacherA, parentA]) {
        const res = await request(server)
          .get('/api/v1/grades')
          .set('Authorization', authHeader(app, user));
        expect(res.status).toBe(403);
      }
    });
  });

  describe('GET /grades/:id', () => {
    it("404s on another school's grade instead of leaking it", async () => {
      const gradeB = await createGrade(app, schoolB.id, { title: 'نهم' });

      const res = await request(server)
        .get(`/api/v1/grades/${gradeB.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(404);
    });

    it('404s on a non-existent id', async () => {
      const res = await request(server)
        .get('/api/v1/grades/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------
  // PATCH /grades/:id
  // -------------------------------------------------------------------

  describe('PATCH /grades/:id', () => {
    it('lets school_admin rename a grade', async () => {
      const grade = await createGrade(app, schoolA.id, { title: 'Old Title' });

      const res = await request(server)
        .patch(`/api/v1/grades/${grade.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Title');
    });

    it("404s when trying to update another school's grade", async () => {
      const gradeB = await createGrade(app, schoolB.id, { title: 'Grade B' });

      const res = await request(server)
        .patch(`/api/v1/grades/${gradeB.id}`)
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: 'Hijacked' });

      expect(res.status).toBe(404);

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(Grade).findOne({ where: { id: gradeB.id } });
      expect(refreshed?.title).toBe('Grade B');
    });

    it('rejects accountant, staff, teacher, and parent', async () => {
      const grade = await createGrade(app, schoolA.id);
      for (const user of [accountantA, staffA, teacherA, parentA]) {
        const res = await request(server)
          .patch(`/api/v1/grades/${grade.id}`)
          .set('Authorization', authHeader(app, user))
          .send({ title: 'Should Not Work' });
        expect(res.status).toBe(403);
      }
    });
  });

  // -------------------------------------------------------------------
  // DELETE /grades/:id
  // -------------------------------------------------------------------

  describe('DELETE /grades/:id', () => {
    it('lets school_admin delete an empty grade', async () => {
      const grade = await createGrade(app, schoolA.id);

      const res = await request(server)
        .delete(`/api/v1/grades/${grade.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(Grade).findOne({ where: { id: grade.id } });
      expect(refreshed).toBeNull();
    });

    it('blocks deleting a grade that still has students assigned', async () => {
      const grade = await createGrade(app, schoolA.id);
      await createStudent(app, schoolA.id, { gradeId: grade.id });

      const res = await request(server)
        .delete(`/api/v1/grades/${grade.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(409);

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(Grade).findOne({ where: { id: grade.id } });
      expect(refreshed).not.toBeNull();
    });

    it("404s when trying to delete another school's grade", async () => {
      const gradeB = await createGrade(app, schoolB.id);

      const res = await request(server)
        .delete(`/api/v1/grades/${gradeB.id}`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(404);

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(Grade).findOne({ where: { id: gradeB.id } });
      expect(refreshed).not.toBeNull();
    });

    it('rejects accountant, staff, teacher, and parent', async () => {
      for (const user of [accountantA, staffA, teacherA, parentA]) {
        const grade = await createGrade(app, schoolA.id);
        const res = await request(server)
          .delete(`/api/v1/grades/${grade.id}`)
          .set('Authorization', authHeader(app, user));
        expect(res.status).toBe(403);
      }
    });
  });
});
