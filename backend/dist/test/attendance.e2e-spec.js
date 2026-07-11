"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const test_app_1 = require("./setup/test-app");
const factories_1 = require("./setup/factories");
describe('Attendance (Phase 5E e2e)', () => {
    let app;
    let server;
    let schoolA;
    let schoolB;
    let schoolAdminA;
    let staffA;
    let accountantA;
    let schoolAdminB;
    let parentA;
    let otherParentA;
    let parentB;
    let acadYearA;
    let gradeA;
    let gradeA2;
    let studentA1;
    let studentA2;
    let studentB1;
    beforeAll(async () => {
        app = await (0, test_app_1.createTestApp)();
        server = app.getHttpServer();
    });
    afterAll(async () => {
        await (0, test_app_1.closeTestApp)(app);
    });
    beforeEach(async () => {
        await (0, test_app_1.truncateAll)(app);
        schoolA = await (0, factories_1.createSchool)(app, { name: 'School A' });
        schoolB = await (0, factories_1.createSchool)(app, { name: 'School B' });
        schoolAdminA = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolA.id });
        staffA = await (0, factories_1.createUser)(app, { role: factories_1.Role.STAFF, schoolId: schoolA.id });
        accountantA = await (0, factories_1.createUser)(app, { role: factories_1.Role.ACCOUNTANT, schoolId: schoolA.id });
        schoolAdminB = await (0, factories_1.createUser)(app, { role: factories_1.Role.SCHOOL_ADMIN, schoolId: schoolB.id });
        parentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id, fullName: 'Parent A' });
        otherParentA = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolA.id, fullName: 'Other Parent A' });
        parentB = await (0, factories_1.createUser)(app, { role: factories_1.Role.PARENT, schoolId: schoolB.id, fullName: 'Parent B' });
        acadYearA = await (0, factories_1.createAcademicYear)(app, schoolA.id, { title: '1404-1405', isCurrent: true });
        gradeA = await (0, factories_1.createGrade)(app, schoolA.id, { title: 'Grade 7' });
        gradeA2 = await (0, factories_1.createGrade)(app, schoolA.id, { title: 'Grade 8' });
        studentA1 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA.id,
            fullName: 'Student A1',
        });
        studentA2 = await (0, factories_1.createStudent)(app, schoolA.id, {
            academicYearId: acadYearA.id,
            gradeId: gradeA2.id,
            fullName: 'Student A2',
        });
        const acadYearB = await (0, factories_1.createAcademicYear)(app, schoolB.id);
        const gradeB = await (0, factories_1.createGrade)(app, schoolB.id);
        studentB1 = await (0, factories_1.createStudent)(app, schoolB.id, {
            academicYearId: acadYearB.id,
            gradeId: gradeB.id,
            fullName: 'Student B1',
        });
        await (0, factories_1.linkParentStudent)(app, parentA.id, studentA1.id);
    });
    describe('POST /attendance', () => {
        it('school_admin can record attendance for a student', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, date: '2026-07-05', status: 'present' });
            expect(res.status).toBe(201);
            expect(res.body.studentId).toBe(studentA1.id);
            expect(res.body.status).toBe('present');
            expect(res.body.date).toBe('2026-07-05');
        });
        it('staff can record attendance', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, staffA))
                .send({ studentId: studentA1.id, date: '2026-07-05', status: 'absent' });
            expect(res.status).toBe(201);
            expect(res.body.status).toBe('absent');
        });
        it('rejects accountant and parent from recording attendance', async () => {
            const accountantRes = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, accountantA))
                .send({ studentId: studentA1.id, date: '2026-07-05', status: 'present' });
            expect(accountantRes.status).toBe(403);
            const parentRes = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, parentA))
                .send({ studentId: studentA1.id, date: '2026-07-05', status: 'present' });
            expect(parentRes.status).toBe(403);
        });
        it('resubmitting the same student+date corrects the row instead of duplicating it', async () => {
            const first = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, date: '2026-07-05', status: 'absent' });
            expect(first.status).toBe(201);
            const second = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, date: '2026-07-05', status: 'late', note: 'Arrived 20 min late' });
            expect(second.status).toBe(201);
            expect(second.body.id).toBe(first.body.id);
            expect(second.body.status).toBe('late');
            expect(second.body.note).toBe('Arrived 20 min late');
            const history = await (0, supertest_1.default)(server)
                .get(`/api/v1/attendance/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(history.body).toHaveLength(1);
        });
        it('rejects a student from another school (tenant isolation)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentB1.id, date: '2026-07-05', status: 'present' });
            expect(res.status).toBe(403);
        });
        it('rejects a nonexistent studentId', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: '00000000-0000-0000-0000-000000000000', date: '2026-07-05', status: 'present' });
            expect(res.status).toBe(404);
        });
    });
    describe('DTO validation', () => {
        it('rejects an unknown status enum value', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, date: '2026-07-05', status: 'on_vacation' });
            expect(res.status).toBe(400);
        });
        it('rejects a malformed date', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, date: 'not-a-date', status: 'present' });
            expect(res.status).toBe(400);
        });
        it('rejects a missing studentId', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ date: '2026-07-05', status: 'present' });
            expect(res.status).toBe(400);
        });
        it('rejects an unknown field (whitelist)', async () => {
            const res = await (0, supertest_1.default)(server)
                .post('/api/v1/attendance')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA))
                .send({ studentId: studentA1.id, date: '2026-07-05', status: 'present', extraField: 'nope' });
            expect(res.status).toBe(400);
        });
        it('rejects a malformed date on GET /attendance/date/:date', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/attendance/date/not-a-date')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(400);
        });
    });
    describe('GET /attendance/student/:id', () => {
        beforeEach(async () => {
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                academicYearId: acadYearA.id,
                date: '2026-07-01',
                status: factories_1.AttendanceStatus.PRESENT,
            });
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                academicYearId: acadYearA.id,
                date: '2026-07-02',
                status: factories_1.AttendanceStatus.EXCUSED,
            });
        });
        it('returns the student history ordered most-recent first', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/attendance/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].date).toBe('2026-07-02');
            expect(res.body[1].date).toBe('2026-07-01');
        });
        it('allows accountant and staff to read', async () => {
            const accountantRes = await (0, supertest_1.default)(server)
                .get(`/api/v1/attendance/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, accountantA));
            expect(accountantRes.status).toBe(200);
            const staffRes = await (0, supertest_1.default)(server)
                .get(`/api/v1/attendance/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, staffA));
            expect(staffRes.status).toBe(200);
        });
        it('rejects parent role on the staff-side endpoint', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/attendance/student/${studentA1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(403);
        });
        it('404s for a student belonging to another school', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/attendance/student/${studentB1.id}`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(404);
        });
    });
    describe('GET /attendance/date/:date', () => {
        beforeEach(async () => {
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                academicYearId: acadYearA.id,
                date: '2026-07-05',
                status: factories_1.AttendanceStatus.PRESENT,
            });
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolA.id,
                studentId: studentA2.id,
                academicYearId: acadYearA.id,
                date: '2026-07-05',
                status: factories_1.AttendanceStatus.ABSENT,
            });
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolB.id,
                studentId: studentB1.id,
                academicYearId: (await (0, factories_1.createAcademicYear)(app, schoolB.id)).id,
                date: '2026-07-05',
                status: factories_1.AttendanceStatus.PRESENT,
            });
        });
        it('returns only this school\'s records for the date', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/attendance/date/2026-07-05')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            const studentIds = res.body.map((r) => r.studentId).sort();
            expect(studentIds).toEqual([studentA1.id, studentA2.id].sort());
        });
        it('returns an empty list for a date with no records', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/attendance/date/2026-01-01')
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
        it('filters by gradeId', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/attendance/date/2026-07-05')
                .query({ gradeId: gradeA.id })
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].studentId).toBe(studentA1.id);
        });
        it('rejects parent role', async () => {
            const res = await (0, supertest_1.default)(server)
                .get('/api/v1/attendance/date/2026-07-05')
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(403);
        });
    });
    describe('GET /parent/students/:id/attendance', () => {
        beforeEach(async () => {
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                academicYearId: acadYearA.id,
                date: '2026-07-01',
                status: factories_1.AttendanceStatus.LATE,
                note: 'Bus was delayed',
            });
        });
        it('returns the linked child\'s attendance, without staff-only fields', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/attendance`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentA));
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].status).toBe('late');
            expect(res.body[0].note).toBe('Bus was delayed');
            expect(res.body[0].recordedById).toBeUndefined();
            expect(res.body[0].studentId).toBeUndefined();
        });
        it('404s for a parent not linked to the student', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/attendance`)
                .set('Authorization', (0, factories_1.authHeader)(app, otherParentA));
            expect(res.status).toBe(404);
        });
        it('404s for a parent in another school, even with a linked-looking id', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/attendance`)
                .set('Authorization', (0, factories_1.authHeader)(app, parentB));
            expect(res.status).toBe(404);
        });
        it('rejects non-parent roles', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/parent/students/${studentA1.id}/attendance`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(403);
        });
    });
    describe('Student profile attendance section', () => {
        it('is populated (available: true) once attendance records exist', async () => {
            await (0, factories_1.createAttendance)(app, {
                schoolId: schoolA.id,
                studentId: studentA1.id,
                academicYearId: acadYearA.id,
                date: '2026-07-01',
                status: factories_1.AttendanceStatus.PRESENT,
            });
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA1.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.attendance.available).toBe(true);
            expect(res.body.attendance.records).toHaveLength(1);
            expect(res.body.attendance.records[0].status).toBe('present');
        });
        it('is available but empty when no attendance records exist yet', async () => {
            const res = await (0, supertest_1.default)(server)
                .get(`/api/v1/students/${studentA2.id}/profile`)
                .set('Authorization', (0, factories_1.authHeader)(app, schoolAdminA));
            expect(res.status).toBe(200);
            expect(res.body.attendance.available).toBe(true);
            expect(res.body.attendance.records).toEqual([]);
        });
    });
});
//# sourceMappingURL=attendance.e2e-spec.js.map