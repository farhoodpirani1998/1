"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = exports.Weekday = exports.StudentDocumentType = exports.AnnouncementTargetType = exports.AssessmentTerm = exports.AttendanceStatus = exports.LedgerReferenceType = exports.LedgerEntryType = exports.InstallmentStatus = exports.PaymentMethod = exports.TEST_PASSWORD = void 0;
exports.createSchool = createSchool;
exports.createUser = createUser;
exports.createAcademicYear = createAcademicYear;
exports.createGrade = createGrade;
exports.createGuardian = createGuardian;
exports.createStudent = createStudent;
exports.createTuitionPlan = createTuitionPlan;
exports.createInstallment = createInstallment;
exports.linkParentStudent = linkParentStudent;
exports.createPayment = createPayment;
exports.createLedgerEntry = createLedgerEntry;
exports.createNotification = createNotification;
exports.createAttendance = createAttendance;
exports.createSubject = createSubject;
exports.createAssessment = createAssessment;
exports.createTeacherAssignment = createTeacherAssignment;
exports.createAnnouncement = createAnnouncement;
exports.createStudentDocument = createStudentDocument;
exports.createTimetableEntry = createTimetableEntry;
exports.createHomework = createHomework;
exports.createSchoolSettings = createSchoolSettings;
exports.signToken = signToken;
exports.authHeader = authHeader;
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const school_entity_1 = require("../../src/modules/schools/entities/school.entity");
const user_entity_1 = require("../../src/modules/users/entities/user.entity");
const academic_year_entity_1 = require("../../src/modules/academic-years/entities/academic-year.entity");
const grade_entity_1 = require("../../src/modules/grades/entities/grade.entity");
const guardian_entity_1 = require("../../src/modules/students/entities/guardian.entity");
const student_entity_1 = require("../../src/modules/students/entities/student.entity");
const tuition_plan_entity_1 = require("../../src/modules/tuition/entities/tuition-plan.entity");
const installment_entity_1 = require("../../src/modules/tuition/entities/installment.entity");
Object.defineProperty(exports, "InstallmentStatus", { enumerable: true, get: function () { return installment_entity_1.InstallmentStatus; } });
const payment_entity_1 = require("../../src/modules/tuition/entities/payment.entity");
Object.defineProperty(exports, "PaymentMethod", { enumerable: true, get: function () { return payment_entity_1.PaymentMethod; } });
const parent_student_entity_1 = require("../../src/modules/parent/entities/parent-student.entity");
const ledger_entry_entity_1 = require("../../src/modules/ledger/entities/ledger-entry.entity");
Object.defineProperty(exports, "LedgerEntryType", { enumerable: true, get: function () { return ledger_entry_entity_1.LedgerEntryType; } });
Object.defineProperty(exports, "LedgerReferenceType", { enumerable: true, get: function () { return ledger_entry_entity_1.LedgerReferenceType; } });
const notification_entity_1 = require("../../src/modules/notifications/entities/notification.entity");
const attendance_entity_1 = require("../../src/modules/attendance/entities/attendance.entity");
Object.defineProperty(exports, "AttendanceStatus", { enumerable: true, get: function () { return attendance_entity_1.AttendanceStatus; } });
const subject_entity_1 = require("../../src/modules/student-assessments/entities/subject.entity");
const assessment_entity_1 = require("../../src/modules/student-assessments/entities/assessment.entity");
Object.defineProperty(exports, "AssessmentTerm", { enumerable: true, get: function () { return assessment_entity_1.AssessmentTerm; } });
const teacher_assignment_entity_1 = require("../../src/modules/teacher/entities/teacher-assignment.entity");
const announcement_entity_1 = require("../../src/modules/announcements/entities/announcement.entity");
Object.defineProperty(exports, "AnnouncementTargetType", { enumerable: true, get: function () { return announcement_entity_1.AnnouncementTargetType; } });
const student_document_entity_1 = require("../../src/modules/student-documents/entities/student-document.entity");
Object.defineProperty(exports, "StudentDocumentType", { enumerable: true, get: function () { return student_document_entity_1.StudentDocumentType; } });
const timetable_entry_entity_1 = require("../../src/modules/timetable/entities/timetable-entry.entity");
Object.defineProperty(exports, "Weekday", { enumerable: true, get: function () { return timetable_entry_entity_1.Weekday; } });
const homework_entity_1 = require("../../src/modules/homework/entities/homework.entity");
const school_settings_entity_1 = require("../../src/modules/school-settings/entities/school-settings.entity");
const roles_enum_1 = require("../../src/common/authorization/roles.enum");
Object.defineProperty(exports, "Role", { enumerable: true, get: function () { return roles_enum_1.Role; } });
const test_app_1 = require("./test-app");
let phoneCounter = 9_000_000;
function uniquePhone() {
    phoneCounter += 1;
    return `+989${String(phoneCounter).padStart(9, '0')}`;
}
async function createSchool(app, overrides = {}) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(school_entity_1.School);
    const school = repo.create({
        name: overrides.name ?? `Test School ${Date.now()}-${Math.random().toString(36).slice(2)}`,
        address: overrides.address ?? null,
        phone: overrides.phone ?? null,
        isActive: overrides.isActive ?? true,
    });
    return repo.save(school);
}
exports.TEST_PASSWORD = 'Passw0rd!2345';
async function createUser(app, overrides) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(user_entity_1.User);
    const plainPassword = overrides.plainPassword ?? exports.TEST_PASSWORD;
    const passwordHash = await bcrypt.hash(plainPassword, 4);
    const user = repo.create({
        schoolId: overrides.schoolId ?? null,
        fullName: overrides.fullName ?? 'Test User',
        phone: overrides.phone ?? uniquePhone(),
        passwordHash,
        role: overrides.role,
        isActive: overrides.isActive ?? true,
        tokenVersion: overrides.tokenVersion ?? 0,
    });
    return repo.save(user);
}
async function createAcademicYear(app, schoolId, overrides = {}) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(academic_year_entity_1.AcademicYear);
    const year = repo.create({
        schoolId,
        title: overrides.title ?? `140${Math.floor(Math.random() * 5) + 1}-140${Math.floor(Math.random() * 5) + 2}`,
        startDate: overrides.startDate ?? '2025-09-23',
        endDate: overrides.endDate ?? '2026-06-21',
        isCurrent: overrides.isCurrent ?? false,
    });
    return repo.save(year);
}
async function createGrade(app, schoolId, overrides = {}) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(grade_entity_1.Grade);
    const grade = repo.create({
        schoolId,
        title: overrides.title ?? `Grade ${Math.floor(Math.random() * 1000)}`,
    });
    return repo.save(grade);
}
async function createGuardian(app, schoolId, overrides = {}) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(guardian_entity_1.Guardian);
    const guardian = repo.create({
        schoolId,
        fullName: overrides.fullName ?? 'Test Guardian',
        phone: overrides.phone ?? uniquePhone(),
        nationalId: overrides.nationalId ?? null,
    });
    return repo.save(guardian);
}
async function createStudent(app, schoolId, opts = {}) {
    const ds = (0, test_app_1.getDataSource)(app);
    const academicYearId = opts.academicYearId ?? (await createAcademicYear(app, schoolId)).id;
    const gradeId = opts.gradeId ?? (await createGrade(app, schoolId)).id;
    const guardianId = opts.guardianId ?? (await createGuardian(app, schoolId)).id;
    const repo = ds.getRepository(student_entity_1.Student);
    const student = repo.create({
        schoolId,
        academicYearId,
        gradeId,
        guardianId,
        fullName: opts.fullName ?? 'Test Student',
    });
    return repo.save(student);
}
async function createTuitionPlan(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(tuition_plan_entity_1.TuitionPlan);
    const baseAmount = opts.baseAmount ?? 100_000_000;
    const discountAmount = opts.discountAmount ?? 0;
    const plan = repo.create({
        studentId: opts.studentId,
        academicYearId: opts.academicYearId,
        baseAmount,
        discountAmount,
        finalAmount: baseAmount - discountAmount,
    });
    return repo.save(plan);
}
async function createInstallment(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(installment_entity_1.Installment);
    const installment = repo.create({
        tuitionPlanId: opts.tuitionPlanId,
        installmentNumber: opts.installmentNumber ?? 1,
        amount: opts.amount ?? 10_000_000,
        dueDate: opts.dueDate ?? '2026-12-01',
        status: opts.status ?? installment_entity_1.InstallmentStatus.PENDING,
        paidAmount: opts.paidAmount ?? 0,
    });
    return repo.save(installment);
}
async function linkParentStudent(app, parentId, studentId) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(parent_student_entity_1.ParentStudent);
    const link = repo.create({ parentId, studentId });
    return repo.save(link);
}
async function createPayment(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(payment_entity_1.Payment);
    const payment = repo.create({
        installmentId: opts.installmentId,
        amount: opts.amount ?? 5_000_000,
        paymentMethod: opts.paymentMethod ?? payment_entity_1.PaymentMethod.CASH,
        paidAt: opts.paidAt ?? new Date(),
        receivedById: opts.receivedById ?? null,
        referenceNumber: null,
        note: null,
        idempotencyKey: null,
    });
    return repo.save(payment);
}
async function createLedgerEntry(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(ledger_entry_entity_1.LedgerEntry);
    const entry = repo.create({
        schoolId: opts.schoolId,
        studentId: opts.studentId,
        entryType: opts.entryType ?? ledger_entry_entity_1.LedgerEntryType.PAYMENT,
        amount: opts.amount,
        referenceType: opts.referenceType ?? ledger_entry_entity_1.LedgerReferenceType.PAYMENT,
        referenceId: opts.referenceId,
    });
    const saved = await repo.save(entry);
    if (opts.createdAt) {
        await repo.update(saved.id, { createdAt: opts.createdAt });
        saved.createdAt = opts.createdAt;
    }
    return saved;
}
async function createNotification(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(notification_entity_1.Notification);
    const notification = repo.create({
        studentId: opts.studentId,
        installmentId: opts.installmentId,
        channel: 'sms',
        type: opts.type ?? notification_entity_1.NotificationType.OVERDUE_INSTALLMENT,
        status: opts.status ?? notification_entity_1.NotificationStatus.PENDING,
        readAt: opts.readAt ?? null,
    });
    const saved = await repo.save(notification);
    if (opts.createdAt) {
        await repo.update(saved.id, { createdAt: opts.createdAt });
        saved.createdAt = opts.createdAt;
    }
    return saved;
}
async function createAttendance(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(attendance_entity_1.Attendance);
    const attendance = repo.create({
        schoolId: opts.schoolId,
        studentId: opts.studentId,
        academicYearId: opts.academicYearId,
        date: opts.date,
        status: opts.status ?? attendance_entity_1.AttendanceStatus.PRESENT,
        note: opts.note ?? null,
        recordedById: opts.recordedById ?? null,
    });
    return repo.save(attendance);
}
async function createSubject(app, schoolId, overrides = {}) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(subject_entity_1.Subject);
    const subject = repo.create({
        schoolId,
        title: overrides.title ?? `Subject ${Math.floor(Math.random() * 1000)}`,
    });
    return repo.save(subject);
}
async function createAssessment(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(assessment_entity_1.Assessment);
    const assessment = repo.create({
        schoolId: opts.schoolId,
        studentId: opts.studentId,
        subjectId: opts.subjectId,
        academicYearId: opts.academicYearId,
        term: opts.term ?? assessment_entity_1.AssessmentTerm.FIRST_TERM,
        score: opts.score ?? 18,
        maxScore: opts.maxScore ?? 20,
        note: opts.note ?? null,
        recordedById: opts.recordedById ?? null,
    });
    return repo.save(assessment);
}
async function createTeacherAssignment(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(teacher_assignment_entity_1.TeacherAssignment);
    const assignment = repo.create({
        schoolId: opts.schoolId,
        teacherId: opts.teacherId,
        gradeId: opts.gradeId,
        subjectId: opts.subjectId,
    });
    return repo.save(assignment);
}
async function createAnnouncement(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(announcement_entity_1.Announcement);
    const announcement = repo.create({
        schoolId: opts.schoolId,
        title: opts.title ?? 'Test Announcement',
        message: opts.message ?? 'Test announcement message.',
        targetType: opts.targetType ?? announcement_entity_1.AnnouncementTargetType.ALL,
        createdById: opts.createdById ?? null,
    });
    return repo.save(announcement);
}
async function createStudentDocument(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(student_document_entity_1.StudentDocument);
    const document = repo.create({
        schoolId: opts.schoolId,
        studentId: opts.studentId,
        title: opts.title ?? 'Test Document',
        documentType: opts.documentType ?? student_document_entity_1.StudentDocumentType.OTHER,
        fileUrl: opts.fileUrl ?? 'https://storage.example.com/doc.pdf',
        description: opts.description ?? null,
        uploadedById: opts.uploadedById ?? null,
    });
    return repo.save(document);
}
async function createTimetableEntry(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(timetable_entry_entity_1.TimetableEntry);
    const entry = repo.create({
        schoolId: opts.schoolId,
        academicYearId: opts.academicYearId,
        gradeId: opts.gradeId,
        subjectId: opts.subjectId,
        teacherId: opts.teacherId,
        weekday: opts.weekday ?? timetable_entry_entity_1.Weekday.SATURDAY,
        startTime: opts.startTime ?? '08:00',
        endTime: opts.endTime ?? '09:00',
        room: opts.room ?? null,
    });
    return repo.save(entry);
}
async function createHomework(app, opts) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(homework_entity_1.Homework);
    const homework = repo.create({
        schoolId: opts.schoolId,
        academicYearId: opts.academicYearId,
        gradeId: opts.gradeId,
        subjectId: opts.subjectId,
        teacherId: opts.teacherId,
        title: opts.title ?? 'Test Homework',
        description: opts.description ?? 'Read chapter 1 and answer the questions.',
        dueDate: opts.dueDate ?? '2026-12-15',
        attachmentUrl: opts.attachmentUrl ?? null,
    });
    return repo.save(homework);
}
async function createSchoolSettings(app, schoolId, overrides = {}) {
    const ds = (0, test_app_1.getDataSource)(app);
    const repo = ds.getRepository(school_settings_entity_1.SchoolSettings);
    const settings = repo.create({
        schoolId,
        schoolName: overrides.schoolName ?? 'Test School Settings',
        logoUrl: overrides.logoUrl ?? null,
        address: overrides.address ?? null,
        phone: overrides.phone ?? null,
        email: overrides.email ?? null,
        website: overrides.website ?? null,
        timezone: overrides.timezone ?? 'Asia/Tehran',
        language: overrides.language ?? 'fa',
        currency: overrides.currency ?? 'IRR',
        weekStartsOn: overrides.weekStartsOn ?? timetable_entry_entity_1.Weekday.SATURDAY,
        workingDays: overrides.workingDays ?? [
            timetable_entry_entity_1.Weekday.SATURDAY,
            timetable_entry_entity_1.Weekday.SUNDAY,
            timetable_entry_entity_1.Weekday.MONDAY,
            timetable_entry_entity_1.Weekday.TUESDAY,
            timetable_entry_entity_1.Weekday.WEDNESDAY,
        ],
        passingScore: overrides.passingScore ?? 10,
        attendanceLateMinutes: overrides.attendanceLateMinutes ?? 15,
        tuitionReminderDays: overrides.tuitionReminderDays ?? 7,
        smsEnabled: overrides.smsEnabled ?? true,
        emailEnabled: overrides.emailEnabled ?? false,
        primaryColor: overrides.primaryColor ?? null,
        secondaryColor: overrides.secondaryColor ?? null,
    });
    return repo.save(settings);
}
function signToken(app, user) {
    const jwt = app.get(jwt_1.JwtService);
    return jwt.sign({
        sub: user.id,
        schoolId: user.schoolId,
        role: user.role,
        tokenVersion: user.tokenVersion,
    });
}
function authHeader(app, user) {
    return `Bearer ${signToken(app, user)}`;
}
//# sourceMappingURL=factories.js.map