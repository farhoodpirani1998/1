import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createStudent,
  authHeader,
  TEST_PASSWORD,
  Role,
} from './setup/factories';

// Covers POST /students/:id/account (StudentsController.provisionAccount /
// StudentsService.provisionStudentAccount) -- the endpoint that used to
// fail on every call because the User row it created had no `phone`
// value, which conflicted with the (now relaxed) NOT NULL constraint on
// users.phone. See MakeUserPhoneNullable migration.
describe('Student account provisioning (e2e)', () => {
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

  it('lets a school_admin provision a student portal login, and that login works end-to-end', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    const student = await createStudent(app, school.id, { fullName: 'Sara Ahmadi' });

    const res = await request(server)
      .post(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ username: 'sara.ahmadi', password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.studentUserId).toBeDefined();
    expect(res.body.user.username).toBe('sara.ahmadi');
    expect(res.body.user.role).toBe(Role.STUDENT);
    expect(res.body.user.schoolId).toBe(school.id);
    // The provisioned User never carries a phone -- this is the exact
    // row shape that used to violate the NOT NULL constraint.
    expect(res.body.user.phone).toBeNull();
    expect(res.body.user.passwordHash).toBeUndefined();

    // The whole point of provisioning: the student can now actually log
    // in and land on their own record via the resolved studentId.
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'sara.ahmadi', password: TEST_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.studentId).toBe(student.id);
  });

  it('rejects provisioning a second account for a student that already has one', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    const student = await createStudent(app, school.id);

    const first = await request(server)
      .post(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ username: 'first.username', password: TEST_PASSWORD });
    expect(first.status).toBe(201);

    const second = await request(server)
      .post(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ username: 'second.username', password: TEST_PASSWORD });

    expect(second.status).toBe(409);
  });

  it('rejects a duplicate username across two different students', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    const studentA = await createStudent(app, school.id, { fullName: 'Student A' });
    const studentB = await createStudent(app, school.id, { fullName: 'Student B' });

    const first = await request(server)
      .post(`/api/v1/students/${studentA.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ username: 'shared.username', password: TEST_PASSWORD });
    expect(first.status).toBe(201);

    const second = await request(server)
      .post(`/api/v1/students/${studentB.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ username: 'shared.username', password: TEST_PASSWORD });

    expect(second.status).toBe(409);
  });

  it('never lets a school_admin provision an account for another school\'s student (tenant isolation)', async () => {
    const schoolA = await createSchool(app);
    const schoolB = await createSchool(app);
    const adminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });
    const studentA = await createStudent(app, schoolA.id);

    const res = await request(server)
      .post(`/api/v1/students/${studentA.id}/account`)
      .set('Authorization', authHeader(app, adminB))
      .send({ username: 'cross.school', password: TEST_PASSWORD });

    // Same 404-on-cross-school shape as every other student-scoped
    // endpoint (findOne/addParent) -- never a 403 that would confirm the
    // student exists in someone else's tenant.
    expect(res.status).toBe(404);
  });

  it('rejects provisioning from a role other than school_admin', async () => {
    const school = await createSchool(app);
    const staff = await createUser(app, { role: Role.STAFF, schoolId: school.id });
    const student = await createStudent(app, school.id);

    const res = await request(server)
      .post(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, staff))
      .send({ username: 'staff.attempt', password: TEST_PASSWORD });

    expect(res.status).toBe(403);
  });

  it('rejects a username containing characters other than letters/digits/dot/hyphen/underscore', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    const student = await createStudent(app, school.id);

    const res = await request(server)
      .post(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ username: 'sara ahmadi!', password: TEST_PASSWORD });

    expect(res.status).toBe(400);
  });

  it('rejects a password shorter than the minimum length', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    const student = await createStudent(app, school.id);

    const res = await request(server)
      .post(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ username: 'short.pw', password: '1234567' });

    expect(res.status).toBe(400);
  });

  it('reports no account for a student that was never provisioned', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    const student = await createStudent(app, school.id);

    const res = await request(server)
      .get(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasAccount: false, username: null, isActive: null, createdAt: null });
  });

  it('reports account status after provisioning, and lets school_admin reset the password and toggle access', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    const student = await createStudent(app, school.id);

    await request(server)
      .post(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ username: 'status.check', password: TEST_PASSWORD });

    const statusRes = await request(server)
      .get(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin));
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.hasAccount).toBe(true);
    expect(statusRes.body.username).toBe('status.check');
    expect(statusRes.body.isActive).toBe(true);

    // Reset the password, then confirm the old one no longer works and
    // the new one does.
    const newPassword = 'BrandNewPass123!';
    const resetRes = await request(server)
      .patch(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ newPassword });
    expect(resetRes.status).toBe(200);

    const oldLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'status.check', password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'status.check', password: newPassword });
    expect(newLogin.status).toBe(200);

    // Disable portal access, then confirm login is rejected even with
    // the correct (new) password.
    const disableRes = await request(server)
      .patch(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ isActive: false });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.isActive).toBe(false);

    const disabledLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'status.check', password: newPassword });
    expect(disabledLogin.status).toBe(401);
  });

  it('rejects resetting/toggling an account that was never provisioned', async () => {
    const school = await createSchool(app);
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    const student = await createStudent(app, school.id);

    const res = await request(server)
      .patch(`/api/v1/students/${student.id}/account`)
      .set('Authorization', authHeader(app, admin))
      .send({ isActive: false });

    expect(res.status).toBe(404);
  });

  it('never lets a school_admin read or modify another school\'s student account (tenant isolation)', async () => {
    const schoolA = await createSchool(app);
    const schoolB = await createSchool(app);
    const adminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });
    const adminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });
    const studentA = await createStudent(app, schoolA.id);

    await request(server)
      .post(`/api/v1/students/${studentA.id}/account`)
      .set('Authorization', authHeader(app, adminA))
      .send({ username: 'tenant.check', password: TEST_PASSWORD });

    const getRes = await request(server)
      .get(`/api/v1/students/${studentA.id}/account`)
      .set('Authorization', authHeader(app, adminB));
    expect(getRes.status).toBe(404);

    const patchRes = await request(server)
      .patch(`/api/v1/students/${studentA.id}/account`)
      .set('Authorization', authHeader(app, adminB))
      .send({ isActive: false });
    expect(patchRes.status).toBe(404);
  });
});
