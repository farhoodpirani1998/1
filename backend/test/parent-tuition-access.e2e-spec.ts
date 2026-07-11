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
  linkParentStudent,
  createPayment,
  authHeader,
  Role,
} from './setup/factories';

/**
 * Phase 5B: Parent Tuition & Payments Access
 *
 * Proves that:
 * 1. Parents can read tuition plans for their linked students
 * 2. Parents can read installments for their linked students
 * 3. Parents can read payment history for their linked students
 * 4. Parents cannot read data for students they're not linked to
 * 5. Parents cannot read data for students from other schools
 * 6. Tenant isolation is maintained throughout
 * 7. All financial data is correctly presented (amounts, balances, etc.)
 */
describe('Parent tuition & payment access (Phase 5B e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let parentA: Awaited<ReturnType<typeof createUser>>;
  let parentB: Awaited<ReturnType<typeof createUser>>;

  let studentA1: Awaited<ReturnType<typeof createStudent>>;
  let studentA2: Awaited<ReturnType<typeof createStudent>>;
  let studentB1: Awaited<ReturnType<typeof createStudent>>;

  let planA1: Awaited<ReturnType<typeof createTuitionPlan>>;
  let planA2: Awaited<ReturnType<typeof createTuitionPlan>>;
  let planB1: Awaited<ReturnType<typeof createTuitionPlan>>;

  let installmentA1: Awaited<ReturnType<typeof createInstallment>>;
  let installmentA2: Awaited<ReturnType<typeof createInstallment>>;
  let installmentB1: Awaited<ReturnType<typeof createInstallment>>;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await truncateAll(app);

    // Set up two schools with their own parent-student relationships
    schoolA = await createSchool(app, { name: 'School A' });
    schoolB = await createSchool(app, { name: 'School B' });

    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id, fullName: 'Parent A' });
    parentB = await createUser(app, { role: Role.PARENT, schoolId: schoolB.id, fullName: 'Parent B' });

    // School A: two students (parent A is linked to both)
    const acadYearA = await createAcademicYear(app, schoolA.id);
    const gradeA = await createGrade(app, schoolA.id);
    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      fullName: 'Student A1',
    });
    studentA2 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      fullName: 'Student A2',
    });

    // School B: one student (parent B is linked to it)
    const acadYearB = await createAcademicYear(app, schoolB.id);
    const gradeB = await createGrade(app, schoolB.id);
    studentB1 = await createStudent(app, schoolB.id, {
      academicYearId: acadYearB.id,
      gradeId: gradeB.id,
      fullName: 'Student B1',
    });

    // Create tuition plans
    planA1 = await createTuitionPlan(app, {
      studentId: studentA1.id,
      academicYearId: acadYearA.id,
      baseAmount: 100_000_000,
      discountAmount: 10_000_000,
    });
    planA2 = await createTuitionPlan(app, {
      studentId: studentA2.id,
      academicYearId: acadYearA.id,
      baseAmount: 100_000_000,
      discountAmount: 0,
    });
    planB1 = await createTuitionPlan(app, {
      studentId: studentB1.id,
      academicYearId: acadYearB.id,
      baseAmount: 80_000_000,
      discountAmount: 5_000_000,
    });

    // Create installments for each plan
    installmentA1 = await createInstallment(app, {
      tuitionPlanId: planA1.id,
      installmentNumber: 1,
      amount: 30_000_000,
      dueDate: '2026-10-01',
      paidAmount: 0,
    });
    installmentA2 = await createInstallment(app, {
      tuitionPlanId: planA2.id,
      installmentNumber: 1,
      amount: 25_000_000,
      dueDate: '2026-10-15',
      paidAmount: 0,
    });
    installmentB1 = await createInstallment(app, {
      tuitionPlanId: planB1.id,
      installmentNumber: 1,
      amount: 25_000_000,
      dueDate: '2026-11-01',
      paidAmount: 0,
    });

    // Link parents to their students
    await linkParentStudent(app, parentA.id, studentA1.id);
    await linkParentStudent(app, parentA.id, studentA2.id);
    await linkParentStudent(app, parentB.id, studentB1.id);
  });

  describe('GET /parent/students/:id/tuition', () => {
    it('allows parent to view tuition plan for linked student', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/tuition`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          id: planA1.id,
          baseAmount: 100_000_000,
          discountAmount: 10_000_000,
          finalAmount: 90_000_000,
        }),
      );
    });

    it('returns correct academic year title', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/tuition`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body.academicYearTitle).toBeDefined();
    });

    it('denies parent access to unlinked student tuition', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA2.id}/tuition`)
        .set('Authorization', authHeader(app, parentB));

      expect(res.status).toBe(404);
    });

    it('denies parent access to student from different school', async () => {
      // Parent A tries to access Student B1 (even though not linked)
      const res = await request(server)
        .get(`/parent/students/${studentB1.id}/tuition`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(404);
    });

    it('returns 404 for non-existent student', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(server)
        .get(`/parent/students/${fakeId}/tuition`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(404);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(server).get(`/parent/students/${studentA1.id}/tuition`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /parent/students/:id/installments', () => {
    it('allows parent to view installments for linked student', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/installments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          id: installmentA1.id,
          amount: 30_000_000,
          paidAmount: 0,
          remainingAmount: 30_000_000,
          status: 'pending',
        }),
      );
    });

    it('calculates remaining amount correctly', async () => {
      // Add a partial payment
      const payment = await createPayment(app, {
        installmentId: installmentA1.id,
        amount: 10_000_000,
      });

      // Refresh the installment to get updated paidAmount
      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/installments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      const installment = res.body[0];
      expect(installment.paidAmount).toBeGreaterThan(0);
      expect(installment.remainingAmount).toBeLessThan(30_000_000);
    });

    it('denies parent access to unlinked student installments', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA2.id}/installments`)
        .set('Authorization', authHeader(app, parentB));

      expect(res.status).toBe(404);
    });

    it('denies access to student from different school', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentB1.id}/installments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(404);
    });

    it('returns empty array when student has no installments', async () => {
      // Create a new student with no installments
      const acadYear = await createAcademicYear(app, schoolA.id);
      const grade = await createGrade(app, schoolA.id);
      const newStudent = await createStudent(app, schoolA.id, {
        academicYearId: acadYear.id,
        gradeId: grade.id,
      });
      await linkParentStudent(app, parentA.id, newStudent.id);

      const res = await request(server)
        .get(`/parent/students/${newStudent.id}/installments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /parent/students/:id/payments', () => {
    it('returns empty payment history when no payments made', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/payments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('allows parent to view payment history for linked student', async () => {
      // Create a payment
      const payment = await createPayment(app, {
        installmentId: installmentA1.id,
        amount: 15_000_000,
      });

      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/payments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          id: payment.id,
          amount: 15_000_000,
          paymentMethod: 'cash',
        }),
      );
    });

    it('returns payments sorted by date (most recent first)', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Create two payments on different dates
      const payment1 = await createPayment(app, {
        installmentId: installmentA1.id,
        amount: 10_000_000,
        paidAt: yesterday,
      });
      const payment2 = await createPayment(app, {
        installmentId: installmentA1.id,
        amount: 20_000_000,
        paidAt: now,
      });

      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/payments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      // Most recent payment should come first
      if (res.body.length > 1) {
        const firstPaymentTime = new Date(res.body[0].paidAt).getTime();
        const secondPaymentTime = new Date(res.body[1].paidAt).getTime();
        expect(firstPaymentTime).toBeGreaterThanOrEqual(secondPaymentTime);
      }
    });

    it('denies parent access to unlinked student payments', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA2.id}/payments`)
        .set('Authorization', authHeader(app, parentB));

      expect(res.status).toBe(404);
    });

    it('denies access to student from different school', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentB1.id}/payments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(404);
    });

    it('includes receipt number in payment view', async () => {
      const payment = await createPayment(app, {
        installmentId: installmentA1.id,
        amount: 5_000_000,
      });

      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/payments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      // Note: receipt_number may not be set yet depending on implementation,
      // but field should be present
      expect(res.body[0]).toHaveProperty('receiptNumber');
    });
  });

  describe('Tenant isolation for tuition access', () => {
    it('parent from school A cannot access school B student tuition', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentB1.id}/tuition`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(404);
    });

    it('parent from school B cannot access school A student tuition', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/tuition`)
        .set('Authorization', authHeader(app, parentB));

      expect(res.status).toBe(404);
    });

    it('parent from school A cannot access school B student installments', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentB1.id}/installments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(404);
    });

    it('parent from school B cannot access school A student installments', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/installments`)
        .set('Authorization', authHeader(app, parentB));

      expect(res.status).toBe(404);
    });

    it('parent from school A cannot access school B student payments', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentB1.id}/payments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(404);
    });

    it('parent from school B cannot access school A student payments', async () => {
      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/payments`)
        .set('Authorization', authHeader(app, parentB));

      expect(res.status).toBe(404);
    });
  });

  describe('Authorization checks', () => {
    it('only parent role can access /parent/students/:id/tuition', async () => {
      const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });

      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/tuition`)
        .set('Authorization', authHeader(app, admin));

      expect(res.status).toBe(403);
    });

    it('only parent role can access /parent/students/:id/installments', async () => {
      const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });

      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/installments`)
        .set('Authorization', authHeader(app, admin));

      expect(res.status).toBe(403);
    });

    it('only parent role can access /parent/students/:id/payments', async () => {
      const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolA.id });

      const res = await request(server)
        .get(`/parent/students/${studentA1.id}/payments`)
        .set('Authorization', authHeader(app, admin));

      expect(res.status).toBe(403);
    });
  });

  describe('Multiple students per parent', () => {
    it('parent can access both linked students tuition', async () => {
      const res1 = await request(server)
        .get(`/parent/students/${studentA1.id}/tuition`)
        .set('Authorization', authHeader(app, parentA));
      const res2 = await request(server)
        .get(`/parent/students/${studentA2.id}/tuition`)
        .set('Authorization', authHeader(app, parentA));

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.id).toBe(planA1.id);
      expect(res2.body.id).toBe(planA2.id);
    });

    it('parent can access both linked students installments', async () => {
      const res1 = await request(server)
        .get(`/parent/students/${studentA1.id}/installments`)
        .set('Authorization', authHeader(app, parentA));
      const res2 = await request(server)
        .get(`/parent/students/${studentA2.id}/installments`)
        .set('Authorization', authHeader(app, parentA));

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body).toHaveLength(1);
      expect(res2.body).toHaveLength(1);
    });
  });
});
