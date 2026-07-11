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
  createNotification,
  linkParentStudent,
  authHeader,
  Role,
} from './setup/factories';
import { Notification, NotificationType } from '../src/modules/notifications/entities/notification.entity';

/**
 * Phase 5C: Parent Notifications
 *
 * Proves that:
 * 1. A parent's notification list spans every student they're linked to.
 * 2. It never includes notifications belonging to another school
 *    (tenant isolation) or an unlinked student.
 * 3. ?isRead=true / ?isRead=false filter correctly — the exact bug this
 *    phase's DTO fixes: query strings are text, not booleans, and a naive
 *    Boolean('false') === true coercion would invert the filter.
 * 4. A notification can be marked read, is idempotent, and a parent can
 *    never mark another parent's (or another school's) notification read.
 * 5. Non-parent roles are rejected by RolesGuard.
 * 6. Recording a payment through the real API still ends up producing a
 *    payment_received notification via the existing Domain Events /
 *    NotificationsService wiring (no separate code path introduced).
 */
describe('Parent notifications (Phase 5C e2e)', () => {
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

  async function setupSchoolWithParent(schoolName: string) {
    const school = await createSchool(app, { name: schoolName });
    const parent = await createUser(app, { role: Role.PARENT, schoolId: school.id });
    const year = await createAcademicYear(app, school.id);
    const grade = await createGrade(app, school.id);
    const student = await createStudent(app, school.id, {
      academicYearId: year.id,
      gradeId: grade.id,
      fullName: `${schoolName} Student`,
    });
    const plan = await createTuitionPlan(app, { studentId: student.id, academicYearId: year.id });
    const installment = await createInstallment(app, { tuitionPlanId: plan.id });
    await linkParentStudent(app, parent.id, student.id);
    return { school, parent, student, plan, installment };
  }

  it('lists notifications across every linked student, newest first', async () => {
    const { parent, student, installment } = await setupSchoolWithParent('School A');

    const older = await createNotification(app, {
      studentId: student.id,
      installmentId: installment.id,
      type: NotificationType.OVERDUE_INSTALLMENT,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const newer = await createNotification(app, {
      studentId: student.id,
      installmentId: installment.id,
      type: NotificationType.UPCOMING_DUE,
      createdAt: new Date('2026-02-01T00:00:00Z'),
    });

    const res = await request(server)
      .get('/api/v1/parent/notifications')
      .set('Authorization', authHeader(app, parent));

    expect(res.status).toBe(200);
    expect(res.body.map((n: any) => n.id)).toEqual([newer.id, older.id]);
    expect(res.body[0]).toMatchObject({
      type: NotificationType.UPCOMING_DUE,
      isRead: false,
      studentId: student.id,
    });
    expect(typeof res.body[0].message).toBe('string');
    expect(res.body[0].message.length).toBeGreaterThan(0);
  });

  it('never returns notifications for another school, or an unlinked student', async () => {
    const a = await setupSchoolWithParent('School A');
    const b = await setupSchoolWithParent('School B');

    await createNotification(app, { studentId: a.student.id, installmentId: a.installment.id });
    await createNotification(app, { studentId: b.student.id, installmentId: b.installment.id });

    // A student in A's school that A's parent is NOT linked to.
    const unlinkedStudent = await createStudent(app, a.school.id, {
      academicYearId: a.plan.academicYearId,
      gradeId: a.student.gradeId,
    });
    const unlinkedPlan = await createTuitionPlan(app, {
      studentId: unlinkedStudent.id,
      academicYearId: a.plan.academicYearId,
    });
    const unlinkedInstallment = await createInstallment(app, { tuitionPlanId: unlinkedPlan.id });
    await createNotification(app, {
      studentId: unlinkedStudent.id,
      installmentId: unlinkedInstallment.id,
    });

    const res = await request(server)
      .get('/api/v1/parent/notifications')
      .set('Authorization', authHeader(app, a.parent));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].studentId).toBe(a.student.id);
  });

  it('correctly converts ?isRead=true / ?isRead=false query strings', async () => {
    const { parent, student, installment } = await setupSchoolWithParent('School A');

    const readOne = await createNotification(app, {
      studentId: student.id,
      installmentId: installment.id,
      readAt: new Date(),
    });
    const unreadOne = await createNotification(app, {
      studentId: student.id,
      installmentId: installment.id,
      readAt: null,
    });

    const readRes = await request(server)
      .get('/api/v1/parent/notifications?isRead=true')
      .set('Authorization', authHeader(app, parent));
    expect(readRes.status).toBe(200);
    expect(readRes.body.map((n: any) => n.id)).toEqual([readOne.id]);
    expect(readRes.body[0].isRead).toBe(true);

    const unreadRes = await request(server)
      .get('/api/v1/parent/notifications?isRead=false')
      .set('Authorization', authHeader(app, parent));
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.map((n: any) => n.id)).toEqual([unreadOne.id]);
    expect(unreadRes.body[0].isRead).toBe(false);

    // Bogus value must be rejected by validation, not silently coerced.
    const badRes = await request(server)
      .get('/api/v1/parent/notifications?isRead=notabool')
      .set('Authorization', authHeader(app, parent));
    expect(badRes.status).toBe(400);
  });

  it('marks a notification read, idempotently', async () => {
    const { parent, student, installment } = await setupSchoolWithParent('School A');
    const notification = await createNotification(app, {
      studentId: student.id,
      installmentId: installment.id,
    });

    const first = await request(server)
      .patch(`/api/v1/parent/notifications/${notification.id}/read`)
      .set('Authorization', authHeader(app, parent));
    expect(first.status).toBe(200);
    expect(first.body.isRead).toBe(true);
    const firstReadAt = first.body.readAt;
    expect(firstReadAt).not.toBeNull();

    const second = await request(server)
      .patch(`/api/v1/parent/notifications/${notification.id}/read`)
      .set('Authorization', authHeader(app, parent));
    expect(second.status).toBe(200);
    // Already-read stays read; timestamp isn't clobbered on a repeat call.
    expect(second.body.readAt).toBe(firstReadAt);
  });

  it("rejects marking another school's / unlinked parent's notification as read", async () => {
    const a = await setupSchoolWithParent('School A');
    const b = await setupSchoolWithParent('School B');

    const notificationForA = await createNotification(app, {
      studentId: a.student.id,
      installmentId: a.installment.id,
    });

    const res = await request(server)
      .patch(`/api/v1/parent/notifications/${notificationForA.id}/read`)
      .set('Authorization', authHeader(app, b.parent));

    expect(res.status).toBe(404);
  });

  it('rejects non-parent roles', async () => {
    const { school } = await setupSchoolWithParent('School A');
    const admin = await createUser(app, { role: Role.SCHOOL_ADMIN, schoolId: school.id });

    const res = await request(server)
      .get('/api/v1/parent/notifications')
      .set('Authorization', authHeader(app, admin));

    expect(res.status).toBe(403);
  });

  it('recording a payment produces a payment_received notification via the existing event wiring', async () => {
    const { school, parent, student, installment } = await setupSchoolWithParent('School A');
    const accountant = await createUser(app, { role: Role.ACCOUNTANT, schoolId: school.id });

    const res = await request(server)
      .post(`/api/v1/installments/${installment.id}/payments`)
      .set('Authorization', authHeader(app, accountant))
      .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: new Date().toISOString() });
    expect(res.status).toBe(201);

    // PaymentEventsListener reacts to the emitted event asynchronously;
    // poll briefly instead of asserting immediately after the response.
    const ds = getDataSource(app);
    const repo = ds.getRepository(Notification);
    let found: Notification | null = null;
    for (let i = 0; i < 20 && !found; i++) {
      found = await repo.findOne({
        where: { studentId: student.id, type: NotificationType.PAYMENT_RECEIVED },
      });
      if (!found) await new Promise((r) => setTimeout(r, 100));
    }

    expect(found).not.toBeNull();

    const listRes = await request(server)
      .get('/api/v1/parent/notifications')
      .set('Authorization', authHeader(app, parent));
    expect(listRes.status).toBe(200);
    expect(
      listRes.body.some((n: any) => n.type === NotificationType.PAYMENT_RECEIVED),
    ).toBe(true);
  });
});
