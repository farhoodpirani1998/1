import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createGuardian,
  createStudent,
  createTuitionPlan,
  createInstallment,
  createPayment,
  linkParentStudent,
  authHeader,
  Role,
} from './setup/factories';

/**
 * Phase 5D: Student Profile
 *
 * Proves that:
 * 1. GET /students/:id/profile (school_admin/accountant) returns student,
 *    school, grade, academic year, parents, tuition summary, and payment
 *    summary, aggregated from existing data (no new financial logic).
 * 2. GET /parent/students/:id/profile returns the same shape for a
 *    parent's own linked child.
 * 3. Tenant isolation holds: neither endpoint leaks another school's
 *    student.
 * 4. A parent can never read a profile for a student they aren't linked
 *    to, even within their own school.
 * 5. Role gates match the rest of the app: staff (no financial access)
 *    is rejected on the school_admin-side endpoint; non-parent roles are
 *    rejected on the parent-side endpoint.
 * 6. The future-ready sections without their own phase yet (documents/
 *    announcements) are present but empty on both endpoints. attendance
 *    (Phase 5E) and assessments (Phase 5F) are present, available, and
 *    empty here since this suite's fixtures don't create any attendance
 *    or assessment records -- see attendance.e2e-spec.ts /
 *    student-assessments.e2e-spec.ts for those sections populated.
 */
describe('Student profile (Phase 5D e2e)', () => {
  let app: INestApplication;
  let server: any;

  let schoolA: Awaited<ReturnType<typeof createSchool>>;
  let schoolB: Awaited<ReturnType<typeof createSchool>>;

  let schoolAdminA: Awaited<ReturnType<typeof createUser>>;
  let accountantA: Awaited<ReturnType<typeof createUser>>;
  let staffA: Awaited<ReturnType<typeof createUser>>;
  let schoolAdminB: Awaited<ReturnType<typeof createUser>>;

  let parentA: Awaited<ReturnType<typeof createUser>>;
  let otherParentA: Awaited<ReturnType<typeof createUser>>;
  let parentB: Awaited<ReturnType<typeof createUser>>;

  let studentA1: Awaited<ReturnType<typeof createStudent>>;
  let studentB1: Awaited<ReturnType<typeof createStudent>>;

  let gradeA: Awaited<ReturnType<typeof createGrade>>;
  let acadYearA: Awaited<ReturnType<typeof createAcademicYear>>;
  let guardianA1: Awaited<ReturnType<typeof createGuardian>>;

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
    schoolAdminB = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: schoolB.id });

    parentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id, fullName: 'Parent A' });
    otherParentA = await createUser(app, { role: Role.PARENT, schoolId: schoolA.id, fullName: 'Other Parent A' });
    parentB = await createUser(app, { role: Role.PARENT, schoolId: schoolB.id, fullName: 'Parent B' });

    acadYearA = await createAcademicYear(app, schoolA.id, { title: '1404-1405', isCurrent: true });
    gradeA = await createGrade(app, schoolA.id, { title: 'Grade 7' });
    guardianA1 = await createGuardian(app, schoolA.id, { fullName: 'Guardian A1', phone: '+989111111111' });

    studentA1 = await createStudent(app, schoolA.id, {
      academicYearId: acadYearA.id,
      gradeId: gradeA.id,
      guardianId: guardianA1.id,
      fullName: 'Student A1',
    });

    const acadYearB = await createAcademicYear(app, schoolB.id);
    const gradeB = await createGrade(app, schoolB.id);
    studentB1 = await createStudent(app, schoolB.id, {
      academicYearId: acadYearB.id,
      gradeId: gradeB.id,
      fullName: 'Student B1',
    });

    const plan = await createTuitionPlan(app, {
      studentId: studentA1.id,
      academicYearId: acadYearA.id,
      baseAmount: 100_000_000,
      discountAmount: 10_000_000,
    });
    const installment1 = await createInstallment(app, {
      tuitionPlanId: plan.id,
      installmentNumber: 1,
      amount: 45_000_000,
      dueDate: '2026-10-01',
      paidAmount: 45_000_000,
    });
    await createInstallment(app, {
      tuitionPlanId: plan.id,
      installmentNumber: 2,
      amount: 45_000_000,
      dueDate: '2026-12-01',
      paidAmount: 0,
    });
    await createPayment(app, {
      installmentId: installment1.id,
      amount: 45_000_000,
      paidAt: new Date('2026-09-15T10:00:00Z'),
    });

    await linkParentStudent(app, parentA.id, studentA1.id);
  });

  describe('GET /students/:id/profile (school_admin)', () => {
    it('returns the full profile for school_admin', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.student).toEqual(
        expect.objectContaining({ id: studentA1.id, fullName: 'Student A1' }),
      );
      expect(res.body.school).toEqual({ id: schoolA.id, name: 'School A' });
      expect(res.body.grade).toEqual({ id: gradeA.id, title: 'Grade 7' });
      expect(res.body.academicYear).toEqual(
        expect.objectContaining({ id: acadYearA.id, title: '1404-1405', isCurrent: true }),
      );
    });

    it('includes both the guardian and any linked parent-portal accounts in parents[]', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      const types = res.body.parents.map((p: any) => p.type).sort();
      expect(types).toEqual(['guardian', 'parent_account']);
      expect(res.body.parents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: guardianA1.id, fullName: 'Guardian A1', type: 'guardian' }),
          expect.objectContaining({ id: parentA.id, fullName: 'Parent A', type: 'parent_account' }),
        ]),
      );
    });

    it('returns an accurate tuition summary', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.tuitionSummary).toEqual(
        expect.objectContaining({
          totalDue: 90_000_000,
          totalPaid: 45_000_000,
          totalRemaining: 45_000_000,
        }),
      );
      expect(res.body.tuitionSummary.plans).toHaveLength(1);
      expect(res.body.tuitionSummary.plans[0]).toEqual(
        expect.objectContaining({
          baseAmount: 100_000_000,
          discountAmount: 10_000_000,
          finalAmount: 90_000_000,
          installmentCount: 2,
        }),
      );
    });

    it('returns an accurate payment summary', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      expect(res.body.paymentSummary).toEqual(
        expect.objectContaining({
          totalPayments: 1,
          totalAmountPaid: 45_000_000,
        }),
      );
      expect(res.body.paymentSummary.lastPaymentAt).toBeTruthy();
      expect(res.body.paymentSummary.recentPayments).toHaveLength(1);
      expect(res.body.paymentSummary.recentPayments[0]).toEqual(
        expect.objectContaining({ amount: 45_000_000 }),
      );
    });

    it('returns empty future-ready sections', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(200);
      for (const key of ['documents', 'announcements']) {
        expect(res.body[key]).toEqual({ available: false, records: [] });
      }
      // attendance (5E) and assessments (5F) are real, populated
      // sections now -- available, just empty since this suite creates
      // no attendance/assessment fixtures.
      expect(res.body.attendance).toEqual({ available: true, records: [] });
      expect(res.body.assessments).toEqual(
        expect.objectContaining({ available: true, records: [] }),
      );
      expect(res.body.assessments.reportSummary.overallAverage).toBeNull();
    });

    it('allows accountant', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, accountantA));

      expect(res.status).toBe(200);
    });

    it('rejects staff (no financial access, same gate as /reports/student/:id/statement)', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, staffA));

      expect(res.status).toBe(403);
    });

    it('rejects parent role on the school_admin-side endpoint', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(403);
    });

    it('returns 404 when School A admin reads School B student (tenant isolation)', async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentB1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(404);
    });

    it("does not leak School B's student even to its own admin cross-checking a foreign id incorrectly", async () => {
      const res = await request(server)
        .get(`/api/v1/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminB));

      expect(res.status).toBe(404);
    });

    it('returns 404 for a non-existent student', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(server)
        .get(`/api/v1/students/${fakeId}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(404);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(server).get(`/api/v1/students/${studentA1.id}/profile`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /parent/students/:id/profile', () => {
    it('allows a parent to view the profile of their linked child', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      expect(res.body.student).toEqual(
        expect.objectContaining({ id: studentA1.id, fullName: 'Student A1' }),
      );
      expect(res.body.tuitionSummary).toEqual(
        expect.objectContaining({
          totalDue: 90_000_000,
          totalPaid: 45_000_000,
          totalRemaining: 45_000_000,
        }),
      );
    });

    it('returns empty future-ready sections for parents too', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(200);
      for (const key of ['documents', 'announcements']) {
        expect(res.body[key]).toEqual({ available: false, records: [] });
      }
      expect(res.body.attendance).toEqual({ available: true, records: [] });
      expect(res.body.assessments).toEqual(
        expect.objectContaining({ available: true, records: [] }),
      );
    });

    it('denies a parent access to a student they are not linked to (same school)', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, otherParentA));

      expect(res.status).toBe(404);
    });

    it('denies a parent access to a student from a different school', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, parentB));

      expect(res.status).toBe(404);
    });

    it('returns 404 for a non-existent student', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(server)
        .get(`/api/v1/parent/students/${fakeId}/profile`)
        .set('Authorization', authHeader(app, parentA));

      expect(res.status).toBe(404);
    });

    it('rejects non-parent roles', async () => {
      const res = await request(server)
        .get(`/api/v1/parent/students/${studentA1.id}/profile`)
        .set('Authorization', authHeader(app, schoolAdminA));

      expect(res.status).toBe(403);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(server).get(`/api/v1/parent/students/${studentA1.id}/profile`);

      expect(res.status).toBe(401);
    });
  });
});
