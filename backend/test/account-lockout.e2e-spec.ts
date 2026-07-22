import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import { createSchool, createUser, TEST_PASSWORD, Role } from './setup/factories';
import { User } from '../src/modules/users/entities/user.entity';

// Small, fixed values so these tests don't depend on (or need to wait
// out) the real defaults baked into auth.service.ts (5 attempts / 15
// minutes) -- see LOGIN_LOCKOUT_THRESHOLD / LOGIN_LOCKOUT_DURATION_MINUTES
// in env.validation.ts. Set before createTestApp() so the app's own
// ConfigService picks them up at boot, and restored in afterAll so they
// don't leak into any other e2e file sharing this Jest process
// (test:e2e runs --runInBand).
const LOCKOUT_THRESHOLD = 3;
const LOCKOUT_DURATION_MINUTES = 15;

describe('Account lockout (e2e)', () => {
  let app: INestApplication;
  let server: any;
  const previousEnv = {
    threshold: process.env.LOGIN_LOCKOUT_THRESHOLD,
    duration: process.env.LOGIN_LOCKOUT_DURATION_MINUTES,
  };

  beforeAll(async () => {
    process.env.LOGIN_LOCKOUT_THRESHOLD = String(LOCKOUT_THRESHOLD);
    process.env.LOGIN_LOCKOUT_DURATION_MINUTES = String(LOCKOUT_DURATION_MINUTES);
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
    if (previousEnv.threshold === undefined) {
      delete process.env.LOGIN_LOCKOUT_THRESHOLD;
    } else {
      process.env.LOGIN_LOCKOUT_THRESHOLD = previousEnv.threshold;
    }
    if (previousEnv.duration === undefined) {
      delete process.env.LOGIN_LOCKOUT_DURATION_MINUTES;
    } else {
      process.env.LOGIN_LOCKOUT_DURATION_MINUTES = previousEnv.duration;
    }
  });

  beforeEach(async () => {
    await truncateAll(app);
  });

  it('locks the account after LOGIN_LOCKOUT_THRESHOLD consecutive bad-password attempts (phone login)', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: user.phone, password: 'totally-wrong-password' });
      expect(res.status).toBe(401);
    }

    // Threshold reached — even the *correct* password is now rejected.
    const afterLock = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    expect(afterLock.status).toBe(401);

    const ds = getDataSource(app);
    const row = await ds.getRepository(User).findOne({ where: { id: user.id } });
    expect(row?.failedLoginAttempts).toBeGreaterThanOrEqual(LOCKOUT_THRESHOLD);
    expect(row?.lockedUntil).not.toBeNull();
  });

  it('returns the exact same generic response for a locked account as for a bad password', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    const badPasswordRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: 'wrong-once' });
    expect(badPasswordRes.status).toBe(401);
    const unlockedMessage = badPasswordRes.body.message;

    // Drive it to the lock threshold, then try the correct password.
    for (let i = 1; i < LOCKOUT_THRESHOLD; i += 1) {
      await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: user.phone, password: 'wrong-again' });
    }
    const lockedRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });

    expect(lockedRes.status).toBe(401);
    expect(lockedRes.body.message).toEqual(unlockedMessage);
  });

  it('resets the failed-attempt counter after a successful login', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    // Fail below the threshold...
    for (let i = 0; i < LOCKOUT_THRESHOLD - 1; i += 1) {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: user.phone, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    // ...then succeed. This must clear the counter, not just pause it.
    const successRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    expect(successRes.status).toBe(200);

    const ds = getDataSource(app);
    const afterSuccess = await ds.getRepository(User).findOne({ where: { id: user.id } });
    expect(afterSuccess?.failedLoginAttempts).toBe(0);

    // Failing (LOCKOUT_THRESHOLD - 1) more times must NOT lock the
    // account -- if the counter hadn't reset, this would already be at
    // (LOCKOUT_THRESHOLD - 1) + (LOCKOUT_THRESHOLD - 1) >= LOCKOUT_THRESHOLD.
    for (let i = 0; i < LOCKOUT_THRESHOLD - 1; i += 1) {
      await request(server)
        .post('/api/v1/auth/login')
        .send({ phone: user.phone, password: 'wrong-password-again' });
    }
    const stillUnlockedRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    expect(stillUnlockedRes.status).toBe(200);
  });

  it('allows login again once the lock has expired', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    const ds = getDataSource(app);
    // Simulate an already-expired lock directly, same convention
    // auth-security.e2e-spec.ts uses for isActive/school-active toggles --
    // avoids the test actually waiting out LOCKOUT_DURATION_MINUTES.
    await ds.getRepository(User).update(
      { id: user.id },
      { failedLoginAttempts: LOCKOUT_THRESHOLD, lockedUntil: new Date(Date.now() - 60_000) },
    );

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    expect(res.status).toBe(200);

    const row = await ds.getRepository(User).findOne({ where: { id: user.id } });
    expect(row?.lockedUntil).toBeNull();
    expect(row?.failedLoginAttempts).toBe(0);
  });

  it('protects a username-based (student) login the same way as a phone login', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, {
      role: Role.STUDENT,
      schoolId: school.id,
      username: 'lockout-test-student',
    });

    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ username: user.username, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    const afterLock = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: user.username, password: TEST_PASSWORD });
    expect(afterLock.status).toBe(401);

    const ds = getDataSource(app);
    const row = await ds.getRepository(User).findOne({ where: { id: user.id } });
    expect(row?.lockedUntil).not.toBeNull();
  });
});
