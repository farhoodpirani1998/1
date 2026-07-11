import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import { createSchool, createUser, TEST_PASSWORD, Role } from './setup/factories';
import { User } from '../src/modules/users/entities/user.entity';
import { School } from '../src/modules/schools/entities/school.entity';

describe('Auth security (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await truncateAll(app);
  });

  it('rejects a JWT issued before a password change (tokenVersion bump)', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    expect(loginRes.status).toBe(200);
    const oldToken = loginRes.body.accessToken;

    // Old token works before the password change.
    const before = await request(server)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(before.status).toBe(200);

    const changeRes = await request(server)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'BrandNewPassw0rd!' });
    expect(changeRes.status).toBe(200);

    // Same token, now stale — must be rejected even though it hasn't expired.
    const after = await request(server)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(after.status).toBe(401);

    // A fresh login with the new password gets a token that works fine.
    const reloginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: 'BrandNewPassw0rd!' });
    expect(reloginRes.status).toBe(200);

    const withNewToken = await request(server)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${reloginRes.body.accessToken}`);
    expect(withNewToken.status).toBe(200);
  });

  it('rejects a valid JWT once the user has been deactivated', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    const token = loginRes.body.accessToken;

    const before = await request(server)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    const ds = getDataSource(app);
    await ds.getRepository(User).update({ id: user.id }, { isActive: false });

    const after = await request(server)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('rejects a valid JWT once the user is deactivated mid-session (no re-login needed to revoke)', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.ACCOUNTANT, schoolId: school.id });
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    const token = loginRes.body.accessToken;

    const ds = getDataSource(app);
    await ds.getRepository(User).update({ id: user.id }, { isActive: false });

    const res = await request(server)
      .get('/api/v1/payments')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("rejects a valid JWT once the user's school has been deactivated", async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    const token = loginRes.body.accessToken;

    const before = await request(server)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);

    const ds = getDataSource(app);
    await ds.getRepository(School).update({ id: school.id }, { isActive: false });

    const after = await request(server)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('refuses to issue a new token via login once the school is inactive', async () => {
    const school = await createSchool(app, { isActive: false });
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('refuses to issue a new token via login for a deactivated user', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.STAFF, schoolId: school.id, isActive: false });

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects change-password with the wrong current password', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });

    const res = await request(server)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ currentPassword: 'totally-wrong-password', newPassword: 'AnotherNewPassw0rd!' });

    expect(res.status).toBe(400);
  });
});
