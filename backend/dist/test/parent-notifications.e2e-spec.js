"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
const notification_entity_1 = require("../src/modules/notifications/entities/notification.entity");
describe('Parent notifications (Phase 5C e2e)', () => {
    let app;
    let server;
    beforeAll(async () => {
        app = await (0, test_app_1.createTestApp)();
        server = app.getHttpServer();
    });
    afterAll(async () => {
        await (0, test_app_1.closeTestApp)(app);
    });
    beforeEach(async () => {
        await (0, test_app_1.truncateAll)(app);
    });
    async function setupSchoolWithParent(schoolName) {
        const school = await (0, factories_1.createSchool)(app, { name: schoolName });
        const parent = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: school.id });
        const year = await (0, factories_1.createAcademicYear)(app, school.id);
        const grade = await (0, factories_1.createGrade)(app, school.id);
        const student = await (0, factories_1.createStudent)(app, school.id, {
            academicYearId: year.id,
            gradeId: grade.id,
            fullName: `${schoolName} Student`,
        });
        const plan = await (0, factories_1.createTuitionPlan)(app, { studentId: student.id, academicYearId: year.id });
        const installment = await (0, factories_1.createInstallment)(app, { tuitionPlanId: plan.id });
        await (0, factories_1.linkParentStudent)(app, parent.id, student.id);
        return { school, parent, student, plan, installment };
    }
    it('lists notifications across every linked student, newest first', async () => {
        const { parent, student, installment } = await setupSchoolWithParent('School A');
        const older = await (0, factories_1.createNotification)(app, {
            studentId: student.id,
            installmentId: installment.id,
            type: notification_entity_1.NotificationType.OVERDUE_INSTALLMENT,
            createdAt: new Date('2026-01-01T00:00:00Z'),
        });
        const newer = await (0, factories_1.createNotification)(app, {
            studentId: student.id,
            installmentId: installment.id,
            type: notification_entity_1.NotificationType.UPCOMING_DUE,
            createdAt: new Date('2026-02-01T00:00:00Z'),
        });
        const res = await (0, supertest_1.default)(server)
            .get('/api/v1/parent/notifications')
            .set('Authorization', (0, factories_1.authHeader)(app, parent));
        expect(res.status).toBe(200);
        expect(res.body.map((n) => n.id)).toEqual([newer.id, older.id]);
        expect(res.body[0]).toMatchObject({
            type: notification_entity_1.NotificationType.UPCOMING_DUE,
            isRead: false,
            studentId: student.id,
        });
        expect(typeof res.body[0].message).toBe('string');
        expect(res.body[0].message.length).toBeGreaterThan(0);
    });
    it('never returns notifications for another school, or an unlinked student', async () => {
        const a = await setupSchoolWithParent('School A');
        const b = await setupSchoolWithParent('School B');
        await (0, factories_1.createNotification)(app, { studentId: a.student.id, installmentId: a.installment.id });
        await (0, factories_1.createNotification)(app, { studentId: b.student.id, installmentId: b.installment.id });
        const unlinkedStudent = await (0, factories_1.createStudent)(app, a.school.id, {
            academicYearId: a.plan.academicYearId,
            gradeId: a.student.gradeId,
        });
        const unlinkedPlan = await (0, factories_1.createTuitionPlan)(app, {
            studentId: unlinkedStudent.id,
            academicYearId: a.plan.academicYearId,
        });
        const unlinkedInstallment = await (0, factories_1.createInstallment)(app, { tuitionPlanId: unlinkedPlan.id });
        await (0, factories_1.createNotification)(app, {
            studentId: unlinkedStudent.id,
            installmentId: unlinkedInstallment.id,
        });
        const res = await (0, supertest_1.default)(server)
            .get('/api/v1/parent/notifications')
            .set('Authorization', (0, factories_1.authHeader)(app, a.parent));
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].studentId).toBe(a.student.id);
    });
    it('correctly converts ?isRead=true / ?isRead=false query strings', async () => {
        const { parent, student, installment } = await setupSchoolWithParent('School A');
        const readOne = await (0, factories_1.createNotification)(app, {
            studentId: student.id,
            installmentId: installment.id,
            readAt: new Date(),
        });
        const unreadOne = await (0, factories_1.createNotification)(app, {
            studentId: student.id,
            installmentId: installment.id,
            readAt: null,
        });
        const readRes = await (0, supertest_1.default)(server)
            .get('/api/v1/parent/notifications?isRead=true')
            .set('Authorization', (0, factories_1.authHeader)(app, parent));
        expect(readRes.status).toBe(200);
        expect(readRes.body.map((n) => n.id)).toEqual([readOne.id]);
        expect(readRes.body[0].isRead).toBe(true);
        const unreadRes = await (0, supertest_1.default)(server)
            .get('/api/v1/parent/notifications?isRead=false')
            .set('Authorization', (0, factories_1.authHeader)(app, parent));
        expect(unreadRes.status).toBe(200);
        expect(unreadRes.body.map((n) => n.id)).toEqual([unreadOne.id]);
        expect(unreadRes.body[0].isRead).toBe(false);
        const badRes = await (0, supertest_1.default)(server)
            .get('/api/v1/parent/notifications?isRead=notabool')
            .set('Authorization', (0, factories_1.authHeader)(app, parent));
        expect(badRes.status).toBe(400);
    });
    it('marks a notification read, idempotently', async () => {
        const { parent, student, installment } = await setupSchoolWithParent('School A');
        const notification = await (0, factories_1.createNotification)(app, {
            studentId: student.id,
            installmentId: installment.id,
        });
        const first = await (0, supertest_1.default)(server)
            .patch(`/api/v1/parent/notifications/${notification.id}/read`)
            .set('Authorization', (0, factories_1.authHeader)(app, parent));
        expect(first.status).toBe(200);
        expect(first.body.isRead).toBe(true);
        const firstReadAt = first.body.readAt;
        expect(firstReadAt).not.toBeNull();
        const second = await (0, supertest_1.default)(server)
            .patch(`/api/v1/parent/notifications/${notification.id}/read`)
            .set('Authorization', (0, factories_1.authHeader)(app, parent));
        expect(second.status).toBe(200);
        expect(second.body.readAt).toBe(firstReadAt);
    });
    it("rejects marking another school's / unlinked parent's notification as read", async () => {
        const a = await setupSchoolWithParent('School A');
        const b = await setupSchoolWithParent('School B');
        const notificationForA = await (0, factories_1.createNotification)(app, {
            studentId: a.student.id,
            installmentId: a.installment.id,
        });
        const res = await (0, supertest_1.default)(server)
            .patch(`/api/v1/parent/notifications/${notificationForA.id}/read`)
            .set('Authorization', (0, factories_1.authHeader)(app, b.parent));
        expect(res.status).toBe(404);
    });
    it('rejects non-parent roles', async () => {
        const { school } = await setupSchoolWithParent('School A');
        const admin = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: school.id });
        const res = await (0, supertest_1.default)(server)
            .get('/api/v1/parent/notifications')
            .set('Authorization', (0, factories_1.authHeader)(app, admin));
        expect(res.status).toBe(403);
    });
    it('recording a payment produces a payment_received notification via the existing event wiring', async () => {
        const { school, parent, student, installment } = await setupSchoolWithParent('School A');
        const accountant = await (0, factories_1.createUser)(app, { role: factories_1.Role.ACCOUNTANT, schoolId: school.id });
        const res = await (0, supertest_1.default)(server)
            .post(`/api/v1/installments/${installment.id}/payments`)
            .set('Authorization', (0, factories_1.authHeader)(app, accountant))
            .send({ amount: 1_000_000, paymentMethod: 'cash', paidAt: new Date().toISOString() });
        expect(res.status).toBe(201);
        const ds = (0, test_app_1.getDataSource)(app);
        const repo = ds.getRepository(notification_entity_1.Notification);
        let found = null;
        for (let i = 0; i < 20 && !found; i++) {
            found = await repo.findOne({
                where: { studentId: student.id, type: notification_entity_1.NotificationType.PAYMENT_RECEIVED },
            });
            if (!found)
                await new Promise((r) => setTimeout(r, 100));
        }
        expect(found).not.toBeNull();
        const listRes = await (0, supertest_1.default)(server)
            .get('/api/v1/parent/notifications')
            .set('Authorization', (0, factories_1.authHeader)(app, parent));
        expect(listRes.status).toBe(200);
        expect(listRes.body.some((n) => n.type === notification_entity_1.NotificationType.PAYMENT_RECEIVED)).toBe(true);
    });
});
//# sourceMappingURL=parent-notifications.e2e-spec.js.map