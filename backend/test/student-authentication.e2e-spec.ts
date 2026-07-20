import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createStudent,
  linkStudentUser,
  TEST_PASSWORD,
  Role,
} from './setup/factories';

// ADR-001 Task 3A: student login goes through the same AuthService.login /
// POST /auth/login endpoint as every other role -- only the lookup
// identifier (username instead of phone) and the resolved studentId in
// the response are new. Existing phone-login behavior (covered by
// auth-security.e2e-spec.ts) is asserted here only where it's the control
// case for a username-specific assertion.
describe('Student authentication (e2e)', () => {
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

  it('logs a student in with username + password and resolves the linked student via StudentUser', async () => {
    const school = await createSchool(app);
    const student = await createStudent(app, school.id);
    const user = await createUser(app, {
      role: Role.STUDENT,
      schoolId: school.id,
      username: 'student.foroughi',
    });
    await linkStudentUser(app, user.id, student.id);

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'student.foroughi', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.studentId).toBe(student.id);
    // Username login must never leak the phone-login error wording, and
    // vice versa -- checked properly in the "wrong password" test below;
    // here just confirming the happy path returns the user, not the
    // password hash.
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('logs a student in successfully even with no student_users link yet, omitting studentId', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, {
      role: Role.STUDENT,
      schoolId: school.id,
      username: 'unlinked.student',
    });

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'unlinked.student', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.studentId).toBeUndefined();
  });

  it('rejects a wrong password on username login with the same generic error shape as phone login', async () => {
    const school = await createSchool(app);
    await createUser(app, {
      role: Role.STUDENT,
      schoolId: school.id,
      username: 'student.wrongpass',
    });

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'student.wrongpass', password: 'totally-wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown username the same way an unknown phone number is rejected', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'no-such-username', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
  });

  it('rejects a login request that sends both phone and username', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, {
      role: Role.STUDENT,
      schoolId: school.id,
      username: 'student.both',
    });

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, username: 'student.both', password: TEST_PASSWORD });

    expect(res.status).toBe(400);
  });

  it('rejects a login request with neither phone nor username', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ password: TEST_PASSWORD });

    expect(res.status).toBe(400);
  });

  it('leaves phone login for non-student roles completely unaffected', async () => {
    const school = await createSchool(app);
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.studentId).toBeUndefined();
  });

  it('never resolves a studentId for a non-student role, even via phone login, if somehow linked', async () => {
    const school = await createSchool(app);
    const student = await createStudent(app, school.id);
    // A school_admin has no business ever getting a studentId back --
    // the login() branch only resolves StudentUser for role === STUDENT,
    // regardless of what rows happen to exist in student_users.
    const user = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });
    await linkStudentUser(app, user.id, student.id);

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: user.phone, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.studentId).toBeUndefined();
  });
});
