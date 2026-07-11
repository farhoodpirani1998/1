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
  authHeader,
  Role,
} from './setup/factories';
import { Payment } from '../src/modules/tuition/entities/payment.entity';
import { Installment } from '../src/modules/tuition/entities/installment.entity';

/**
 * PaymentsService.create() row-locks the installment inside a transaction
 * (`lock: { mode: 'pessimistic_write' }`) before re-checking
 * `amount - paidAmount` against the requested payment. These tests fire
 * genuinely concurrent HTTP requests (Promise.all, not sequential awaits)
 * against a real Postgres instance so the lock is actually exercised —
 * against a mocked repository, two "concurrent" calls would just run
 * sequentially on the same event-loop tick and the bug this guards against
 * (both requests reading the same stale paidAmount) would never surface.
 */
describe('Payment concurrency (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let schoolId: string;
  let adminToken: string;

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
  });

  async function setUpInstallment(amount: number) {
    const year = await createAcademicYear(app, schoolId);
    const grade = await createGrade(app, schoolId);
    const student = await createStudent(app, schoolId, { academicYearId: year.id, gradeId: grade.id });
    const plan = await createTuitionPlan(app, {
      studentId: student.id,
      academicYearId: year.id,
      baseAmount: amount,
    });
    return createInstallment(app, { tuitionPlanId: plan.id, amount });
  }

  it('never lets two concurrent payments exceed the installment amount', async () => {
    const installment = await setUpInstallment(10_000_000);

    // Two requests for 7,000,000 each against a 10,000,000 installment —
    // only one can legally succeed; the total actually paid must never
    // exceed 10,000,000 no matter how the race resolves.
    const fire = () =>
      request(server)
        .post(`/api/v1/installments/${installment.id}/payments`)
        .set('Authorization', adminToken)
        .send({ amount: 7_000_000, paymentMethod: 'cash', paidAt: '2026-07-01' });

    const [first, second] = await Promise.all([fire(), fire()]);
    const statuses = [first.status, second.status].sort();

    // Exactly one succeeds (201), the other is rejected as over the
    // remaining balance (400) — never both succeeding.
    expect(statuses).toEqual([201, 400]);

    const ds = getDataSource(app);
    const paymentsRepo = ds.getRepository(Payment);
    const installmentRepo = ds.getRepository(Installment);

    const payments = await paymentsRepo.find({ where: { installmentId: installment.id } });
    expect(payments).toHaveLength(1);

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    expect(totalPaid).toBeLessThanOrEqual(10_000_000);

    const fresh = await installmentRepo.findOne({ where: { id: installment.id } });
    expect(Number(fresh!.paidAmount)).toBeLessThanOrEqual(10_000_000);
  });

  it('allows two concurrent payments that together exactly fill the installment', async () => {
    const installment = await setUpInstallment(10_000_000);

    const pay = (amount: number) =>
      request(server)
        .post(`/api/v1/installments/${installment.id}/payments`)
        .set('Authorization', adminToken)
        .send({ amount, paymentMethod: 'cash', paidAt: '2026-07-01' });

    const [first, second] = await Promise.all([pay(6_000_000), pay(4_000_000)]);

    expect([first.status, second.status].every((s) => s === 201)).toBe(true);

    const ds = getDataSource(app);
    const installmentRepo = ds.getRepository(Installment);
    const fresh = await installmentRepo.findOne({ where: { id: installment.id } });
    expect(Number(fresh!.paidAmount)).toBe(10_000_000);
    expect(fresh!.status).toBe('paid');
  });

  it('rejects a single payment for more than the remaining balance', async () => {
    const installment = await setUpInstallment(5_000_000);

    const res = await request(server)
      .post(`/api/v1/installments/${installment.id}/payments`)
      .set('Authorization', adminToken)
      .send({ amount: 5_000_001, paymentMethod: 'cash', paidAt: '2026-07-01' });

    expect(res.status).toBe(400);
  });

  it('does not create a duplicate payment when the same idempotencyKey is reused', async () => {
    const installment = await setUpInstallment(10_000_000);
    const idempotencyKey = 'submit-click-12345';

    const send = () =>
      request(server)
        .post(`/api/v1/installments/${installment.id}/payments`)
        .set('Authorization', adminToken)
        .send({ amount: 3_000_000, paymentMethod: 'cash', paidAt: '2026-07-01', idempotencyKey });

    const first = await send();
    const second = await send();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.payment.id).toBe(first.body.payment.id);
    expect(second.body.idempotentReplay).toBe(true);

    const ds = getDataSource(app);
    const paymentsRepo = ds.getRepository(Payment);
    const payments = await paymentsRepo.find({ where: { installmentId: installment.id } });
    expect(payments).toHaveLength(1);
  });

  it('never creates two payment rows when the same idempotencyKey is sent concurrently', async () => {
    const installment = await setUpInstallment(10_000_000);
    const idempotencyKey = 'concurrent-double-click';

    const send = () =>
      request(server)
        .post(`/api/v1/installments/${installment.id}/payments`)
        .set('Authorization', adminToken)
        .send({ amount: 3_000_000, paymentMethod: 'cash', paidAt: '2026-07-01', idempotencyKey });

    const [first, second] = await Promise.all([send(), send()]);

    // The app-level idempotency check (SELECT-then-INSERT) is a
    // read-committed race in the truly-concurrent case: whichever request
    // loses the race may surface as a 500 from the underlying
    // `uq_payments_idempotency_key` unique-index violation instead of a
    // clean "here's your existing payment" response. Either shape is
    // acceptable here — the one invariant that must never break is "no
    // two rows with the same idempotency key", which the unique index
    // guarantees regardless of application-layer behavior. At least one
    // of the two requests must succeed.
    expect([first.status, second.status]).toContain(201);

    const ds = getDataSource(app);
    const paymentsRepo = ds.getRepository(Payment);
    const payments = await paymentsRepo.find({ where: { installmentId: installment.id } });
    expect(payments.length).toBe(1);
  });
});
