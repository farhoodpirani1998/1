import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import { createSchool, createUser, TEST_PASSWORD, Role } from './setup/factories';

describe('Users management (e2e)', () => {
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

  async function loginAsSuperAdmin() {
    const school = await createSchool(app);
    const superAdmin = await createUser(app, { role: Role.SUPER_ADMIN, schoolId: null });
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: superAdmin.phone, password: TEST_PASSWORD });
    return { token: res.body.accessToken as string, school };
  }

  it('rejects a school_admin/accountant/staff-only page for super_admin — covered on the frontend, but the API itself must still 200 for super_admin per RolesGuard bypass', async () => {
    // Sanity check on the backend side of item 1: super_admin's JWT still
    // passes RolesGuard everywhere (frontend is what shows "دسترسی محدود"),
    // so GET /students for a super_admin returns 200 with an empty/irrelevant
    // list rather than 403 — this is exactly why the frontend route guard
    // was necessary.
    const { token } = await loginAsSuperAdmin();
    const res = await request(server).get('/api/v1/students').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('PATCH /users/:id updates fullName/phone', async () => {
    const { token, school } = await loginAsSuperAdmin();
    const user = await createUser(app, { role: Role.STAFF, schoolId: school.id, fullName: 'Old Name' });

    const res = await request(server)
      .patch(`/api/v1/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'New Name', phone: '+989123456789' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('New Name');
    expect(res.body.phone).toBe('+989123456789');
  });

  it('PATCH /users/:id with a duplicate phone returns 409', async () => {
    const { token, school } = await loginAsSuperAdmin();
    const existing = await createUser(app, { role: Role.STAFF, schoolId: school.id });
    const target = await createUser(app, { role: Role.STAFF, schoolId: school.id });

    const res = await request(server)
      .patch(`/api/v1/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: existing.phone });

    expect(res.status).toBe(409);
  });

  it('PATCH /users/:id ignores/rejects role and schoolId changes', async () => {
    const { token, school } = await loginAsSuperAdmin();
    const otherSchool = await createSchool(app);
    const user = await createUser(app, { role: Role.STAFF, schoolId: school.id });

    const res = await request(server)
      .patch(`/api/v1/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: Role.SCHOOL_ADMIN, schoolId: otherSchool.id, fullName: 'Still Staff' });

    // ValidationPipe's whitelist+forbidNonWhitelisted rejects any field not
    // declared on UpdateUserDto — role/schoolId aren't, so the whole
    // request is rejected rather than silently ignored.
    expect(res.status).toBe(400);
  });

  it('PATCH /users/:id/reset-password invalidates the old token', async () => {
    const { token, school } = await loginAsSuperAdmin();
    const user = await createUser(app, { role: Role.STAFF, schoolId: school.id });

    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });
    const userToken = loginRes.body.accessToken as string;

    const beforeReset = await request(server)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${userToken}`);
    expect(beforeReset.status).toBe(200);

    const resetRes = await request(server)
      .patch(`/api/v1/users/${user.id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'BrandNewPassw0rd!' });
    expect(resetRes.status).toBe(200);

    const afterReset = await request(server)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${userToken}`);
    expect(afterReset.status).toBe(401);

    const reloginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: 'BrandNewPassw0rd!' });
    expect(reloginRes.status).toBe(200);
  });
});
