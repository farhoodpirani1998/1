import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  createTuitionPlan,
  createInstallment,
  authHeader,
  Role,
} from './setup/factories';

describe('Authorization matrix (e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolId: string;
  let superAdmin: Awaited<ReturnType<typeof createUser>>;
  let schoolAdmin: Awaited<ReturnType<typeof createUser>>;
  let accountant: Awaited<ReturnType<typeof createUser>>;
  let staff: Awaited<ReturnType<typeof createUser>>;
  let installmentId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await truncateAll(app);
    const school = await createSchool(app);
    schoolId = school.id;

    superAdmin = await createUser(app, { role: Role.SUPER_ADMIN, schoolId: null });
    schoolAdmin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId });
    accountant = await createUser(app, { role: Role.ACCOUNTANT, schoolId });
    staff = await createUser(app, { role: Role.STAFF, schoolId });

    const year = await createAcademicYear(app, schoolId);
    const grade = await createGrade(app, schoolId);
    const student = await createStudent(app, schoolId, { academicYearId: year.id, gradeId: grade.id });
    const plan = await createTuitionPlan(app, {
      studentId: student.id,
      academicYearId: year.id,
      baseAmount: 20_000_000,
    });
    const installment = await createInstallment(app, { tuitionPlanId: plan.id, amount: 20_000_000 });
    installmentId = installment.id;
  });

  describe('super_admin: global access', () => {
    it('can create a school (a route no other role can reach at all)', async () => {
      const res = await request(server)
        .post('/api/v1/schools')
        .set('Authorization', authHeader(app, superAdmin))
        .send({ name: 'A Brand New School' });
      expect(res.status).toBe(201);
    });

    it('is rejected by SchoolsController if attempted by school_admin', async () => {
      const res = await request(server)
        .post('/api/v1/schools')
        .set('Authorization', authHeader(app, schoolAdmin))
        .send({ name: 'Should Not Be Created' });
      expect(res.status).toBe(403);
    });

    it('bypasses per-route @Roles() restrictions (RolesGuard: super_admin always passes)', async () => {
      // /reports/overdue-summary is @Roles('school_admin','accountant') —
      // super_admin isn't in that list but RolesGuard special-cases the
      // role, so this must still be a 200, not a 403.
      const res = await request(server)
        .get('/api/v1/reports/overdue-summary')
        .set('Authorization', authHeader(app, superAdmin));
      expect(res.status).toBe(200);
    });
  });

  describe('school_admin: own school only', () => {
    it('can manage students within its own school', async () => {
      const res = await request(server)
        .get('/api/v1/students')
        .set('Authorization', authHeader(app, schoolAdmin));
      expect(res.status).toBe(200);
    });

    it('cannot reach the super_admin-only SchoolsController at all', async () => {
      const res = await request(server)
        .get('/api/v1/schools')
        .set('Authorization', authHeader(app, schoolAdmin));
      expect(res.status).toBe(403);
    });

    it('holds PAYMENT_VOID and can void a payment', async () => {
      const payRes = await request(server)
        .post(`/api/v1/installments/${installmentId}/payments`)
        .set('Authorization', authHeader(app, schoolAdmin))
        .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
      expect(payRes.status).toBe(201);

      const voidRes = await request(server)
        .delete(`/api/v1/payments/${payRes.body.payment.id}`)
        .set('Authorization', authHeader(app, schoolAdmin))
        .send({ reason: 'Recorded against the wrong installment' });
      expect(voidRes.status).toBe(204);
    });
  });

  describe('accountant: financial operations allowed', () => {
    it('can record a payment', async () => {
      const res = await request(server)
        .post(`/api/v1/installments/${installmentId}/payments`)
        .set('Authorization', authHeader(app, accountant))
        .send({ amount: 2_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
      expect(res.status).toBe(201);
    });

    it('can list payments and view reports', async () => {
      const paymentsRes = await request(server)
        .get('/api/v1/payments')
        .set('Authorization', authHeader(app, accountant));
      expect(paymentsRes.status).toBe(200);

      const reportRes = await request(server)
        .get('/api/v1/reports/overdue-summary')
        .set('Authorization', authHeader(app, accountant));
      expect(reportRes.status).toBe(200);
    });

    it('cannot void a payment (lacks PAYMENT_VOID; school_admin only)', async () => {
      const payRes = await request(server)
        .post(`/api/v1/installments/${installmentId}/payments`)
        .set('Authorization', authHeader(app, accountant))
        .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });

      const voidRes = await request(server)
        .delete(`/api/v1/payments/${payRes.body.payment.id}`)
        .set('Authorization', authHeader(app, accountant))
        .send({ reason: 'Trying to void without permission' });
      // RolesGuard already blocks this (@Roles('school_admin') on the
      // route), so accountant never even reaches PermissionsGuard.
      expect(voidRes.status).toBe(403);
    });
  });

  describe('staff: no financial read access', () => {
    it('cannot list payments', async () => {
      const res = await request(server)
        .get('/api/v1/payments')
        .set('Authorization', authHeader(app, staff));
      expect(res.status).toBe(403);
    });

    it('cannot view a payment receipt', async () => {
      const payRes = await request(server)
        .post(`/api/v1/installments/${installmentId}/payments`)
        .set('Authorization', authHeader(app, schoolAdmin))
        .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });

      const res = await request(server)
        .get(`/api/v1/payments/${payRes.body.payment.id}/receipt`)
        .set('Authorization', authHeader(app, staff));
      expect(res.status).toBe(403);
    });

    it('cannot list installments or view financial reports', async () => {
      const installmentsRes = await request(server)
        .get('/api/v1/installments')
        .set('Authorization', authHeader(app, staff));
      expect(installmentsRes.status).toBe(403);

      const reportRes = await request(server)
        .get('/api/v1/reports/debtor-students')
        .set('Authorization', authHeader(app, staff));
      expect(reportRes.status).toBe(403);
    });

    it('can still manage non-financial student records', async () => {
      const res = await request(server)
        .get('/api/v1/students')
        .set('Authorization', authHeader(app, staff));
      expect(res.status).toBe(200);
    });
  });
});
