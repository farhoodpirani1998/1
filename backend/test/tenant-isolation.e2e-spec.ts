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

/**
 * Proves the core multi-tenant invariant: a user authenticated for School A
 * can never read or write School B's data, whether B's UUID is guessed,
 * enumerated, or simply reused from a previous session — regardless of
 * whether the resource itself carries school_id directly (Student) or only
 * transitively through a join (TuitionPlan -> Student, Installment ->
 * TuitionPlan -> Student, Payment -> Installment -> ... -> Student).
 */
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;
  let adminA: Awaited<ReturnType<typeof createUser>>;
  let adminB: Awaited<ReturnType<typeof createUser>>;
  let studentB: Awaited<ReturnType<typeof createStudent>>;
  let planB: Awaited<ReturnType<typeof createTuitionPlan>>;
  let installmentB: Awaited<ReturnType<typeof createInstallment>>;

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
    adminA = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });
    adminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });

    const academicYearB = await createAcademicYear(app, schoolB.id);
    const gradeB = await createGrade(app, schoolB.id);
    studentB = await createStudent(app, schoolB.id, {
      academicYearId: academicYearB.id,
      gradeId: gradeB.id,
    });
    planB = await createTuitionPlan(app, {
      studentId: studentB.id,
      academicYearId: academicYearB.id,
      baseAmount: 100_000_000,
    });
    installmentB = await createInstallment(app, { tuitionPlanId: planB.id, amount: 100_000_000 });
  });

  describe('TuitionPlan access', () => {
    it('returns 404 when School A reads School B tuition plan by (real, guessed) UUID', async () => {
      const res = await request(server)
        .get(`/api/v1/tuition-plans/${planB.id}`)
        .set('Authorization', authHeader(app, adminA));
      expect(res.status).toBe(404);
    });

    it('returns 403 when School A updates School B tuition plan', async () => {
      const res = await request(server)
        .patch(`/api/v1/tuition-plans/${planB.id}`)
        .set('Authorization', authHeader(app, adminA))
        .send({ discountAmount: 1000 });
      expect(res.status).toBe(403);
    });

    it("allows School B's own admin to read its own plan", async () => {
      const res = await request(server)
        .get(`/api/v1/tuition-plans/${planB.id}`)
        .set('Authorization', authHeader(app, adminB));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(planB.id);
    });
  });

  describe('Installment generation', () => {
    it("returns 403 when School A generates installments for School B's plan", async () => {
      // Use a fresh plan with zero installments so the only reason this
      // could fail is the tenant check itself, not the "already has
      // installments" guard.
      const academicYearB2 = await createAcademicYear(app, schoolB.id);
      const student2 = await createStudent(app, schoolB.id, { academicYearId: academicYearB2.id });
      const plan2 = await createTuitionPlan(app, {
        studentId: student2.id,
        academicYearId: academicYearB2.id,
        baseAmount: 60_000_000,
      });

      const res = await request(server)
        .post(`/api/v1/tuition-plans/${plan2.id}/installments/generate`)
        .set('Authorization', authHeader(app, adminA))
        .send({ count: 3, startDate: '2026-09-01', intervalDays: 30 });
      expect(res.status).toBe(403);
    });

    it('returns 404 when School A reads a School B installment by UUID', async () => {
      const res = await request(server)
        .get(`/api/v1/installments/${installmentB.id}`)
        .set('Authorization', authHeader(app, adminA));
      expect(res.status).toBe(404);
    });

    it('returns 404 when School A updates a School B installment', async () => {
      const res = await request(server)
        .patch(`/api/v1/installments/${installmentB.id}`)
        .set('Authorization', authHeader(app, adminA))
        .send({ amount: 1 });
      expect(res.status).toBe(404);
    });
  });

  describe('Student relations', () => {
    it('returns 404 when School A reads School B student by UUID', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentB.id}`)
        .set('Authorization', authHeader(app, adminA));
      expect(res.status).toBe(404);
    });

    it('returns 404 when School A updates School B student', async () => {
      const res = await request(server)
        .patch(`/api/v1/students/${studentB.id}`)
        .set('Authorization', authHeader(app, adminA))
        .send({ fullName: 'Renamed' });
      expect(res.status).toBe(404);
    });

    it("School A's student list never includes School B students", async () => {
      const res = await request(server)
        .get('/api/v1/students')
        .set('Authorization', authHeader(app, adminA));
      expect(res.status).toBe(200);
      expect(res.body.find((s: any) => s.id === studentB.id)).toBeUndefined();
    });
  });

  describe('Payments', () => {
    it("returns 403 when School A pays School B's installment", async () => {
      const res = await request(server)
        .post(`/api/v1/installments/${installmentB.id}/payments`)
        .set('Authorization', authHeader(app, adminA))
        .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
      expect(res.status).toBe(403);
    });

    it("returns 404 when School A fetches School B's payment receipt", async () => {
      // Record a real payment as School B first, then try to read it as A.
      const paymentRes = await request(server)
        .post(`/api/v1/installments/${installmentB.id}/payments`)
        .set('Authorization', authHeader(app, adminB))
        .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });
      expect(paymentRes.status).toBe(201);
      const paymentId = paymentRes.body.payment.id;

      const res = await request(server)
        .get(`/api/v1/payments/${paymentId}/receipt`)
        .set('Authorization', authHeader(app, adminA));
      expect(res.status).toBe(404);
    });

    it("School A's payment list never includes School B payments", async () => {
      await request(server)
        .post(`/api/v1/installments/${installmentB.id}/payments`)
        .set('Authorization', authHeader(app, adminB))
        .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });

      const res = await request(server)
        .get('/api/v1/payments')
        .set('Authorization', authHeader(app, adminA));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('Reports', () => {
    it("returns 404 when School A requests School B's student statement", async () => {
      const res = await request(server)
        .get(`/api/v1/reports/student/${studentB.id}/statement`)
        .set('Authorization', authHeader(app, adminA));
      expect(res.status).toBe(404);
    });

    it("School A's debtor-students report never includes School B students", async () => {
      await request(server)
        .post(`/api/v1/installments/${installmentB.id}/payments`)
        .set('Authorization', authHeader(app, adminB))
        .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });

      const res = await request(server)
        .get('/api/v1/reports/debtor-students')
        .set('Authorization', authHeader(app, adminA));
      expect(res.status).toBe(200);
      expect(res.body.find((d: any) => d.studentId === studentB.id)).toBeUndefined();
    });

    it("School A's monthly-income report never counts School B's payments", async () => {
      await request(server)
        .post(`/api/v1/installments/${installmentB.id}/payments`)
        .set('Authorization', authHeader(app, adminB))
        .send({ amount: 5_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });

      const res = await request(server)
        .get('/api/v1/reports/monthly-income?year=2026&month=7')
        .set('Authorization', authHeader(app, adminA));
      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBe(0);
    });
  });
});
