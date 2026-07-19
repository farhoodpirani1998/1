import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import { createSchool, createUser, createAcademicYear, createGrade, authHeader, Role } from './setup/factories';
import { AcademicYear } from '../src/modules/academic-years/entities/academic-year.entity';
import { Grade } from '../src/modules/grades/entities/grade.entity';

/**
 * Exploratory bug-hunt suite. Unlike the other *.e2e-spec.ts files (which
 * each prove one module's contract), this file goes looking for trouble
 * across the whole app: forged tokens, malformed input, and real
 * concurrency (Promise.all, not sequential requests). Every `it` here is
 * written to assert what SHOULD happen; if the app is wrong, the test
 * fails and the failure message says exactly what broke.
 *
 * One bug was already found by reading the code (not by running this
 * file, which needs a live Postgres/Redis to execute) and is flagged
 * below with "KNOWN ISSUE": no controller in this codebase uses
 * ParseUUIDPipe, so a malformed (non-UUID) :id in ANY route reaches
 * TypeORM, which lets Postgres reject it with "invalid input syntax for
 * type uuid" — an unhandled QueryFailedError, which AllExceptionsFilter
 * turns into a 500 instead of a 400. That test is written to expect the
 * *correct* 400 and will currently fail, which is the point: it's a
 * regression trip-wire until someone adds ParseUUIDPipe (or a global
 * exception filter case for QueryFailedError with code 22P02) to fix it.
 */
describe('Bug hunt: token integrity, malformed input, concurrency (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let jwt: JwtService;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await truncateAll(app);
    schoolA = await createSchool(app, { name: 'School A' });
    schoolB = await createSchool(app, { name: 'School B' });
    staffA = await createUser(app, { role: Role.STAFF, schoolId: schoolA.id });
    schoolAdminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });
  });

  // -------------------------------------------------------------------
  // Token / session integrity — forging a JWT payload should never win,
  // because JwtStrategy re-fetches the user (and their school) from the
  // DB on every request instead of trusting the payload's claims.
  // -------------------------------------------------------------------

  describe('token forgery', () => {
    it('rejects a token whose signature does not match JWT_SECRET', async () => {
      const fakeToken = jwt.sign(
        { sub: schoolAdminA.id, schoolId: schoolA.id, role: 'school_admin', tokenVersion: 0 },
        { secret: 'wrong-secret' },
      );
      const res = await request(server)
        .get('/api/v1/grades')
        .set('Authorization', `Bearer ${fakeToken}`);
      expect(res.status).toBe(401);
    });

    it('ignores a forged role claim and enforces the real DB role instead', async () => {
      // staffA is really 'staff' in the DB. Forge a token claiming
      // 'school_admin' and try a school_admin-only write (POST /grades).
      // If the app trusted the payload's role, this would succeed (201).
      // It must come back 403, because JwtStrategy sets req.user.role
      // from the freshly-fetched User row, not from payload.role.
      const forgedToken = jwt.sign({
        sub: staffA.id,
        schoolId: staffA.schoolId,
        role: 'school_admin',
        tokenVersion: staffA.tokenVersion,
      });
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', `Bearer ${forgedToken}`)
        .send({ title: 'Should Not Be Created' });
      expect(res.status).toBe(403);
    });

    it("ignores a forged schoolId claim and enforces the user's real schoolId instead", async () => {
      // schoolAdminA really belongs to schoolA. Forge a token claiming
      // schoolB, then create a grade -- if the payload's schoolId were
      // trusted, the grade would land in schoolB. It must land in schoolA.
      const forgedToken = jwt.sign({
        sub: schoolAdminA.id,
        schoolId: schoolB.id,
        role: 'school_admin',
        tokenVersion: schoolAdminA.tokenVersion,
      });
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', `Bearer ${forgedToken}`)
        .send({ title: 'Where Does This Land' });

      expect(res.status).toBe(201);
      expect(res.body.schoolId).toBe(schoolA.id);
    });

    it('rejects a token issued before a password change (tokenVersion bump)', async () => {
      const staleToken = jwt.sign({
        sub: staffA.id,
        schoolId: staffA.schoolId,
        role: staffA.role,
        tokenVersion: staffA.tokenVersion, // 0
      });

      const ds = getDataSource(app);
      await ds.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [staffA.id]);

      const res = await request(server)
        .get('/api/v1/grades')
        .set('Authorization', `Bearer ${staleToken}`);
      expect(res.status).toBe(401);
    });

    it("rejects a token for a user who's since been deactivated", async () => {
      const ds = getDataSource(app);
      await ds.query('UPDATE users SET is_active = false WHERE id = $1', [staffA.id]);

      const res = await request(server)
        .get('/api/v1/grades')
        .set('Authorization', authHeader(app, staffA));
      expect(res.status).toBe(401);
    });

    it("rejects a school_admin's token once their school is deactivated", async () => {
      const ds = getDataSource(app);
      await ds.query('UPDATE schools SET is_active = false WHERE id = $1', [schoolA.id]);

      const res = await request(server)
        .get('/api/v1/grades')
        .set('Authorization', authHeader(app, schoolAdminA));
      expect(res.status).toBe(401);
    });

    it('rejects a syntactically-garbage Authorization header', async () => {
      const res = await request(server)
        .get('/api/v1/grades')
        .set('Authorization', 'Bearer this-is-not-even-a-jwt');
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // Malformed / adversarial input
  // -------------------------------------------------------------------

  describe('malformed input', () => {
    it('KNOWN ISSUE: a malformed (non-UUID) id should 400, not 500', async () => {
      const res = await request(server)
        .get('/api/v1/grades/not-a-uuid-at-all')
        .set('Authorization', authHeader(app, schoolAdminA));
      // Currently returns 500 (unhandled Postgres "invalid input syntax
      // for type uuid" error) because no controller in the app validates
      // :id params with ParseUUIDPipe before they reach TypeORM. This
      // assertion documents the correct behavior; it will fail until
      // that's fixed.
      expect(res.status).toBe(400);
    });

    it('stores SQL-metacharacter strings as inert literal text, not executable SQL', async () => {
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: "Grade'; DROP TABLE grades; --" });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Grade'; DROP TABLE grades; --");

      // Prove the table is still there and still has exactly this row.
      const ds = getDataSource(app);
      const count = await ds.query('SELECT COUNT(*) FROM grades WHERE school_id = $1', [schoolA.id]);
      expect(Number(count[0].count)).toBe(1);
    });

    it('round-trips Persian/RTL text and emoji without mangling it', async () => {
      const title = 'پایه هفتم 🎓';
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe(title);
    });

    it('rejects a body where a string field is sent as an object', async () => {
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({ title: { nested: 'object' } });
      expect(res.status).toBe(400);
    });

    it('rejects a completely empty request body on a route requiring fields', async () => {
      const res = await request(server)
        .post('/api/v1/academic-years')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send({});
      expect(res.status).toBe(400);
    });

    it('does not 500 when the body is an array instead of an object', async () => {
      const res = await request(server)
        .post('/api/v1/grades')
        .set('Authorization', authHeader(app, schoolAdminA))
        .send([{ title: 'x' }] as any);
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------
  // Real concurrency (Promise.all, not sequential awaits) — the sequential
  // tests in academic-years.e2e-spec.ts prove the app-level pre-check
  // logic; this proves the DB-level partial unique index
  // (uq_academic_year_current) actually holds when two requests race.
  // -------------------------------------------------------------------

  describe('concurrency', () => {
    it('only one academic year ends up current when two "mark as current" creates race', async () => {
      const results = await Promise.allSettled([
        request(server)
          .post('/api/v1/academic-years')
          .set('Authorization', authHeader(app, schoolAdminA))
          .send({ title: 'Year Racer 1', isCurrent: true }),
        request(server)
          .post('/api/v1/academic-years')
          .set('Authorization', authHeader(app, schoolAdminA))
          .send({ title: 'Year Racer 2', isCurrent: true }),
      ]);

      // Both requests should still complete as valid HTTP responses (not
      // hang or crash the connection), whichever ordering the DB picks.
      for (const r of results) {
        expect(r.status).toBe('fulfilled');
      }

      const ds = getDataSource(app);
      const currentYears = await ds
        .getRepository(AcademicYear)
        .find({ where: { schoolId: schoolA.id, isCurrent: true } });
      expect(currentYears).toHaveLength(1);
    });

    it("a race between two schools' \"mark as current\" creates never cross-contaminates", async () => {
      const schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });
      const existingA = await createAcademicYear(app, schoolA.id, { isCurrent: true });
      const existingB = await createAcademicYear(app, schoolB.id, { isCurrent: true });

      await Promise.all([
        request(server)
          .post('/api/v1/academic-years')
          .set('Authorization', authHeader(app, schoolAdminA))
          .send({ title: 'New A Current', isCurrent: true }),
        request(server)
          .post('/api/v1/academic-years')
          .set('Authorization', authHeader(app, schoolAdminB))
          .send({ title: 'New B Current', isCurrent: true }),
      ]);

      const ds = getDataSource(app);
      const repo = ds.getRepository(AcademicYear);
      expect((await repo.findOne({ where: { id: existingA.id } }))?.isCurrent).toBe(false);
      expect((await repo.findOne({ where: { id: existingB.id } }))?.isCurrent).toBe(false);
      expect(await repo.count({ where: { schoolId: schoolA.id, isCurrent: true } })).toBe(1);
      expect(await repo.count({ where: { schoolId: schoolB.id, isCurrent: true } })).toBe(1);
    });

    it('creating the same grade title twice concurrently does not corrupt data (no unique constraint expected, but no crash either)', async () => {
      const grade = await createGrade(app, schoolA.id, { title: 'Duplicate Race' });

      const results = await Promise.allSettled([
        request(server)
          .patch(`/api/v1/grades/${grade.id}`)
          .set('Authorization', authHeader(app, schoolAdminA))
          .send({ title: 'Renamed To X' }),
        request(server)
          .patch(`/api/v1/grades/${grade.id}`)
          .set('Authorization', authHeader(app, schoolAdminA))
          .send({ title: 'Renamed To Y' }),
      ]);

      for (const r of results) {
        expect(r.status).toBe('fulfilled');
        if (r.status === 'fulfilled') {
          expect([200, 404]).toContain(r.value.status);
        }
      }

      const ds = getDataSource(app);
      const refreshed = await ds.getRepository(Grade).findOne({ where: { id: grade.id } });
      expect(['Renamed To X', 'Renamed To Y']).toContain(refreshed?.title);
    });
  });
});
