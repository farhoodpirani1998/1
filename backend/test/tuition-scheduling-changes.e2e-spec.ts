import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, getDataSource } from './setup/test-app';
import {
  createSchool,
  createUser,
  createAcademicYear,
  createGrade,
  createStudent,
  createTuitionPlan,
  createInstallment,
  createPayment,
  authHeader,
  Role,
  InstallmentStatus,
} from './setup/factories';
import { LedgerEntry, LedgerEntryType } from '../src/modules/ledger/entities/ledger-entry.entity';
import { Installment } from '../src/modules/tuition/entities/installment.entity';

describe('Tuition schedule changes — write-off / add / remove / redistribute / renegotiate (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let schoolId: string;
  let adminToken: string;
  let accountantToken: string;
  let academicYearId: string;
  let studentId: string;

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
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId });
    adminToken = authHeader(app, admin);
    const accountant = await createUser(app, { role: Role.ACCOUNTANT, schoolId });
    accountantToken = authHeader(app, accountant);

    const year = await createAcademicYear(app, schoolId);
    const grade = await createGrade(app, schoolId);
    const student = await createStudent(app, schoolId, { academicYearId: year.id, gradeId: grade.id });
    academicYearId = year.id;
    studentId = student.id;
  });

  // ---------------------------------------------------------------------
  // 1. Write-off
  // ---------------------------------------------------------------------
  describe('write-off', () => {
    let planId: string;
    let installmentId: string;

    beforeEach(async () => {
      const plan = await createTuitionPlan(app, {
        studentId,
        academicYearId,
        baseAmount: 90_000_000,
      });
      planId = plan.id;
      const installment = await createInstallment(app, {
        tuitionPlanId: planId,
        installmentNumber: 1,
        amount: 30_000_000,
        dueDate: '2026-09-01',
        status: InstallmentStatus.PENDING,
      });
      installmentId = installment.id;
    });

    it('rejects an accountant (school_admin only)', async () => {
      const res = await request(server)
        .patch(`/api/v1/installments/${installmentId}/write-off`)
        .set('Authorization', accountantToken)
        .send({ reason: 'Family financial hardship' });
      expect(res.status).toBe(403);
    });

    it('rejects a reason shorter than 5 characters', async () => {
      const res = await request(server)
        .patch(`/api/v1/installments/${installmentId}/write-off`)
        .set('Authorization', adminToken)
        .send({ reason: 'no' });
      expect(res.status).toBe(400);
    });

    it('writes off the full remaining amount of a pending installment', async () => {
      const res = await request(server)
        .patch(`/api/v1/installments/${installmentId}/write-off`)
        .set('Authorization', adminToken)
        .send({ reason: 'Family financial hardship, approved by board' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('written_off');

      const ds = getDataSource(app);
      const entry = await ds.getRepository(LedgerEntry).findOne({
        where: { referenceId: installmentId, entryType: LedgerEntryType.WRITE_OFF },
      });
      expect(entry).not.toBeNull();
      expect(Number(entry!.amount)).toBe(-30_000_000);
    });

    it('writes off only the unpaid remainder after a partial payment', async () => {
      await request(server)
        .post(`/api/v1/installments/${installmentId}/payments`)
        .set('Authorization', adminToken)
        .send({ amount: 10_000_000, paymentMethod: 'cash', paidAt: '2026-08-01' });

      const res = await request(server)
        .patch(`/api/v1/installments/${installmentId}/write-off`)
        .set('Authorization', adminToken)
        .send({ reason: 'Partial forgiveness after hardship review' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('written_off');

      const ds = getDataSource(app);
      const entry = await ds.getRepository(LedgerEntry).findOne({
        where: { referenceId: installmentId, entryType: LedgerEntryType.WRITE_OFF },
      });
      expect(Number(entry!.amount)).toBe(-20_000_000);
    });

    it('rejects writing off an installment that is already written off', async () => {
      await request(server)
        .patch(`/api/v1/installments/${installmentId}/write-off`)
        .set('Authorization', adminToken)
        .send({ reason: 'First write-off, approved by admin' });

      const second = await request(server)
        .patch(`/api/v1/installments/${installmentId}/write-off`)
        .set('Authorization', adminToken)
        .send({ reason: 'Trying to write off again' });

      expect(second.status).toBe(400);
    });

    it('rejects recording a payment against a written-off installment', async () => {
      await request(server)
        .patch(`/api/v1/installments/${installmentId}/write-off`)
        .set('Authorization', adminToken)
        .send({ reason: 'Forgiven per admin decision' });

      const payRes = await request(server)
        .post(`/api/v1/installments/${installmentId}/payments`)
        .set('Authorization', adminToken)
        .send({ amount: 1000, paymentMethod: 'cash', paidAt: '2026-08-01' });

      expect(payRes.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------
  // 2. Add installment
  // ---------------------------------------------------------------------
  describe('add installment', () => {
    let planId: string;

    beforeEach(async () => {
      const plan = await createTuitionPlan(app, {
        studentId,
        academicYearId,
        baseAmount: 50_000_000,
      });
      planId = plan.id;
      await createInstallment(app, {
        tuitionPlanId: planId,
        installmentNumber: 1,
        amount: 25_000_000,
        dueDate: '2026-09-01',
      });
      await createInstallment(app, {
        tuitionPlanId: planId,
        installmentNumber: 2,
        amount: 25_000_000,
        dueDate: '2026-10-01',
      });
    });

    it('rejects an accountant (school_admin only)', async () => {
      const res = await request(server)
        .post(`/api/v1/tuition-plans/${planId}/installments`)
        .set('Authorization', accountantToken)
        .send({ amount: 10_000_000, dueDate: '2026-11-01' });
      expect(res.status).toBe(403);
    });

    it('appends a new installment and renumbers by due date', async () => {
      const res = await request(server)
        .post(`/api/v1/tuition-plans/${planId}/installments`)
        .set('Authorization', adminToken)
        .send({ amount: 10_000_000, dueDate: '2026-11-01' });

      expect(res.status).toBe(201);
      expect(res.body.installmentNumber).toBe(3);
      expect(Number(res.body.amount)).toBe(10_000_000);

      const list = await request(server)
        .get(`/api/v1/tuition-plans/${planId}`)
        .set('Authorization', adminToken);
      expect(list.body.installments).toHaveLength(3);
    });

    it('renumbers correctly when the new installment is due before an existing one', async () => {
      const res = await request(server)
        .post(`/api/v1/tuition-plans/${planId}/installments`)
        .set('Authorization', adminToken)
        .send({ amount: 5_000_000, dueDate: '2026-08-15' }); // before both existing ones

      expect(res.status).toBe(201);
      expect(res.body.installmentNumber).toBe(1);

      const list = await request(server)
        .get(`/api/v1/tuition-plans/${planId}`)
        .set('Authorization', adminToken);
      const numbers = list.body.installments
        .sort((a: any, b: any) => a.dueDate.localeCompare(b.dueDate))
        .map((i: any) => i.installmentNumber);
      expect(numbers).toEqual([1, 2, 3]);
    });

    it('rejects adding an installment before any have been generated', async () => {
      const freshPlan = await createTuitionPlan(app, {
        studentId,
        academicYearId: (await createAcademicYear(app, schoolId)).id,
        baseAmount: 10_000_000,
      });
      const res = await request(server)
        .post(`/api/v1/tuition-plans/${freshPlan.id}/installments`)
        .set('Authorization', adminToken)
        .send({ amount: 5_000_000, dueDate: '2026-09-01' });
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------
  // 3. Remove installment
  // ---------------------------------------------------------------------
  describe('remove installment', () => {
    let planId: string;
    let installment1: string;
    let installment2: string;
    let installment3: string;

    beforeEach(async () => {
      const plan = await createTuitionPlan(app, {
        studentId,
        academicYearId,
        baseAmount: 90_000_000,
      });
      planId = plan.id;
      installment1 = (
        await createInstallment(app, {
          tuitionPlanId: planId,
          installmentNumber: 1,
          amount: 30_000_000,
          dueDate: '2026-09-01',
        })
      ).id;
      installment2 = (
        await createInstallment(app, {
          tuitionPlanId: planId,
          installmentNumber: 2,
          amount: 30_000_000,
          dueDate: '2026-10-01',
        })
      ).id;
      installment3 = (
        await createInstallment(app, {
          tuitionPlanId: planId,
          installmentNumber: 3,
          amount: 30_000_000,
          dueDate: '2026-11-01',
        })
      ).id;
    });

    it('rejects an accountant (school_admin only)', async () => {
      const res = await request(server)
        .delete(`/api/v1/installments/${installment2}`)
        .set('Authorization', accountantToken)
        .send({ reason: 'Merged into another installment' });
      expect(res.status).toBe(403);
    });

    it('removes a pending installment and renumbers the remainder', async () => {
      const res = await request(server)
        .delete(`/api/v1/installments/${installment2}`)
        .set('Authorization', adminToken)
        .send({ reason: 'Merged into installment 3 at family request' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(installment2);

      const list = await request(server)
        .get(`/api/v1/tuition-plans/${planId}`)
        .set('Authorization', adminToken);
      const remaining = list.body.installments.sort((a: any, b: any) =>
        a.dueDate.localeCompare(b.dueDate),
      );
      expect(remaining).toHaveLength(2);
      expect(remaining.map((i: any) => i.installmentNumber)).toEqual([1, 2]);
      expect(remaining.map((i: any) => i.id)).toEqual([installment1, installment3]);
    });

    it('rejects removing an installment that is not pending', async () => {
      // 'overdue' is derived by the nightly cron (markOverdueInstallments),
      // not reachable via a manual status override — set it directly via
      // the repository to simulate that, same as the cron would.
      const ds = getDataSource(app);
      await ds.getRepository(Installment).update(installment1, {
        status: InstallmentStatus.OVERDUE,
      });

      const res = await request(server)
        .delete(`/api/v1/installments/${installment1}`)
        .set('Authorization', adminToken)
        .send({ reason: 'Trying to delete an overdue installment' });

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------
  // 4. Discount after generation (redistribute across pending/overdue)
  // ---------------------------------------------------------------------
  describe('discount edit after installments are generated', () => {
    let planId: string;
    let installmentIds: string[];

    beforeEach(async () => {
      const plan = await createTuitionPlan(app, {
        studentId,
        academicYearId,
        baseAmount: 100_000_000,
      });
      planId = plan.id;
      installmentIds = [];
      for (let i = 0; i < 4; i++) {
        const inst = await createInstallment(app, {
          tuitionPlanId: planId,
          installmentNumber: i + 1,
          amount: 25_000_000,
          dueDate: `2026-0${9 + i}-01`,
        });
        installmentIds.push(inst.id);
      }
    });

    it('rejects an accountant editing discount once installments exist', async () => {
      const res = await request(server)
        .patch(`/api/v1/tuition-plans/${planId}`)
        .set('Authorization', accountantToken)
        .send({ discountAmount: 5_000_000 });
      expect(res.status).toBe(403);
    });

    it('redistributes the new final amount evenly across all-pending installments', async () => {
      const res = await request(server)
        .patch(`/api/v1/tuition-plans/${planId}`)
        .set('Authorization', adminToken)
        .send({ discountAmount: 20_000_000 });

      expect(res.status).toBe(200);
      expect(Number(res.body.finalAmount)).toBe(80_000_000);

      const list = await request(server)
        .get(`/api/v1/tuition-plans/${planId}`)
        .set('Authorization', adminToken);
      const sum = list.body.installments.reduce((acc: number, i: any) => acc + Number(i.amount), 0);
      expect(sum).toBe(80_000_000);
      for (const i of list.body.installments) {
        expect(Number(i.amount)).toBe(20_000_000);
      }
    });

    it('leaves a paid installment untouched and only redistributes the rest', async () => {
      await request(server)
        .post(`/api/v1/installments/${installmentIds[0]}/payments`)
        .set('Authorization', adminToken)
        .send({ amount: 25_000_000, paymentMethod: 'cash', paidAt: '2026-08-15' });

      const res = await request(server)
        .patch(`/api/v1/tuition-plans/${planId}`)
        .set('Authorization', adminToken)
        .send({ discountAmount: 10_000_000 }); // new finalAmount = 90,000,000

      expect(res.status).toBe(200);

      const list = await request(server)
        .get(`/api/v1/tuition-plans/${planId}`)
        .set('Authorization', adminToken);

      const paidOne = list.body.installments.find((i: any) => i.id === installmentIds[0]);
      expect(Number(paidOne.amount)).toBe(25_000_000); // untouched

      const others = list.body.installments.filter((i: any) => i.id !== installmentIds[0]);
      const othersSum = others.reduce((acc: number, i: any) => acc + Number(i.amount), 0);
      expect(othersSum).toBe(65_000_000); // 90,000,000 - 25,000,000 already locked in
    });

    it('rejects a discount that would push the final amount below what is already paid/locked', async () => {
      await request(server)
        .post(`/api/v1/installments/${installmentIds[0]}/payments`)
        .set('Authorization', adminToken)
        .send({ amount: 25_000_000, paymentMethod: 'cash', paidAt: '2026-08-15' });

      // finalAmount would become 100,000,000 - 80,000,000 = 20,000,000,
      // which is less than the 25,000,000 already paid and locked in.
      const res = await request(server)
        .patch(`/api/v1/tuition-plans/${planId}`)
        .set('Authorization', adminToken)
        .send({ discountAmount: 80_000_000 });

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------
  // 5. Renegotiate
  // ---------------------------------------------------------------------
  describe('renegotiate', () => {
    let planId: string;
    let installmentIds: string[];

    beforeEach(async () => {
      const plan = await createTuitionPlan(app, {
        studentId,
        academicYearId,
        baseAmount: 100_000_000,
      });
      planId = plan.id;
      installmentIds = [];
      for (let i = 0; i < 4; i++) {
        const inst = await createInstallment(app, {
          tuitionPlanId: planId,
          installmentNumber: i + 1,
          amount: 25_000_000,
          dueDate: `2026-0${9 + i}-01`,
        });
        installmentIds.push(inst.id);
      }
    });

    it('rejects an accountant (school_admin only)', async () => {
      const res = await request(server)
        .post(`/api/v1/tuition-plans/${planId}/installments/renegotiate`)
        .set('Authorization', accountantToken)
        .send({ count: 2, startDate: '2027-01-01', intervalDays: 30 });
      expect(res.status).toBe(403);
    });

    it('cancels the unpaid remainder and replaces it with a new schedule of the same total', async () => {
      // Pay off installment 1 in full first — this one must survive untouched.
      await request(server)
        .post(`/api/v1/installments/${installmentIds[0]}/payments`)
        .set('Authorization', adminToken)
        .send({ amount: 25_000_000, paymentMethod: 'cash', paidAt: '2026-08-15' });

      const res = await request(server)
        .post(`/api/v1/tuition-plans/${planId}/installments/renegotiate`)
        .set('Authorization', adminToken)
        .send({ count: 2, startDate: '2027-01-01', intervalDays: 30 });

      expect(res.status).toBe(201);

      const paid = res.body.filter((i: any) => i.status === 'paid');
      const cancelled = res.body.filter((i: any) => i.status === 'cancelled');
      const pending = res.body.filter((i: any) => i.status === 'pending');

      expect(paid).toHaveLength(1);
      expect(Number(paid[0].amount)).toBe(25_000_000);
      expect(cancelled).toHaveLength(3); // the 3 original unpaid ones
      expect(pending).toHaveLength(2); // the 2 new replacement installments

      const pendingSum = pending.reduce((acc: number, i: any) => acc + Number(i.amount), 0);
      expect(pendingSum).toBe(75_000_000); // exactly what was left unpaid
    });

    it('rejects renegotiating when nothing pending/overdue remains', async () => {
      // Cancel all installments manually first.
      for (const id of installmentIds) {
        await request(server)
          .patch(`/api/v1/installments/${id}/status`)
          .set('Authorization', adminToken)
          .send({ status: 'cancelled', reason: 'Student withdrew from school entirely' });
      }

      const res = await request(server)
        .post(`/api/v1/tuition-plans/${planId}/installments/renegotiate`)
        .set('Authorization', adminToken)
        .send({ count: 2, startDate: '2027-01-01', intervalDays: 30 });

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------
  // Bonus: soft amount-mismatch warning on manual edits
  // ---------------------------------------------------------------------
  describe('manual amount edit mismatch warning', () => {
    it('warns when a manual edit breaks the sum-equals-finalAmount invariant, and clears once fixed', async () => {
      const plan = await createTuitionPlan(app, {
        studentId,
        academicYearId,
        baseAmount: 100_000_000,
      });
      const inst1 = await createInstallment(app, {
        tuitionPlanId: plan.id,
        installmentNumber: 1,
        amount: 50_000_000,
        dueDate: '2026-09-01',
      });
      await createInstallment(app, {
        tuitionPlanId: plan.id,
        installmentNumber: 2,
        amount: 50_000_000,
        dueDate: '2026-10-01',
      });

      const broken = await request(server)
        .patch(`/api/v1/installments/${inst1.id}`)
        .set('Authorization', adminToken)
        .send({ amount: 40_000_000 });

      expect(broken.status).toBe(200);
      expect(typeof broken.body.amountMismatchWarning).toBe('string');
      expect(broken.body.amountMismatchWarning.length).toBeGreaterThan(0);

      const fixed = await request(server)
        .patch(`/api/v1/installments/${inst1.id}`)
        .set('Authorization', adminToken)
        .send({ amount: 50_000_000 });

      expect(fixed.status).toBe(200);
      expect(fixed.body.amountMismatchWarning).toBeFalsy();
    });
  });
});
