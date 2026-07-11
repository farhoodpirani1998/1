import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { AcademicYear } from '../../src/modules/academic-years/entities/academic-year.entity';
import { Grade } from '../../src/modules/grades/entities/grade.entity';
import { Guardian } from '../../src/modules/students/entities/guardian.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { TuitionPlan } from '../../src/modules/tuition/entities/tuition-plan.entity';
import { Installment, InstallmentStatus } from '../../src/modules/tuition/entities/installment.entity';
import { Payment, PaymentMethod } from '../../src/modules/tuition/entities/payment.entity';
import { ParentStudent } from '../../src/modules/parent/entities/parent-student.entity';
import { LedgerEntry, LedgerEntryType, LedgerReferenceType } from '../../src/modules/ledger/entities/ledger-entry.entity';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from '../../src/modules/notifications/entities/notification.entity';
import { Attendance, AttendanceStatus } from '../../src/modules/attendance/entities/attendance.entity';
import { Subject } from '../../src/modules/student-assessments/entities/subject.entity';
import { Assessment, AssessmentTerm } from '../../src/modules/student-assessments/entities/assessment.entity';
import { TeacherAssignment } from '../../src/modules/teacher/entities/teacher-assignment.entity';
import { Announcement, AnnouncementTargetType } from '../../src/modules/announcements/entities/announcement.entity';
import {
  StudentDocument,
  StudentDocumentType,
} from '../../src/modules/student-documents/entities/student-document.entity';
import { TimetableEntry, Weekday } from '../../src/modules/timetable/entities/timetable-entry.entity';
import { Homework } from '../../src/modules/homework/entities/homework.entity';
import { SchoolSettings } from '../../src/modules/school-settings/entities/school-settings.entity';
import { Role } from '../../src/common/authorization/roles.enum';
import { getDataSource } from './test-app';

let phoneCounter = 9_000_000;
function uniquePhone(): string {
  phoneCounter += 1;
  return `+989${String(phoneCounter).padStart(9, '0')}`;
}

export async function createSchool(
  app: INestApplication,
  overrides: Partial<School> = {},
): Promise<School> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(School);
  const school = repo.create({
    name: overrides.name ?? `Test School ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    address: overrides.address ?? null,
    phone: overrides.phone ?? null,
    isActive: overrides.isActive ?? true,
  } as any);
  return repo.save(school as any);
}

export const TEST_PASSWORD = 'Passw0rd!2345';

export async function createUser(
  app: INestApplication,
  overrides: Partial<User> & { role: string; schoolId?: string | null; plainPassword?: string },
): Promise<User> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(User);
  const plainPassword = overrides.plainPassword ?? TEST_PASSWORD;
  // Low bcrypt cost (4) — these are test fixtures, not real credentials;
  // keeps the (many) factory calls in a test suite fast.
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

export async function createAcademicYear(
  app: INestApplication,
  schoolId: string,
  overrides: Partial<AcademicYear> = {},
): Promise<AcademicYear> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(AcademicYear);
  const year = repo.create({
    schoolId,
    title: overrides.title ?? `140${Math.floor(Math.random() * 5) + 1}-140${Math.floor(Math.random() * 5) + 2}`,
    startDate: overrides.startDate ?? '2025-09-23',
    endDate: overrides.endDate ?? '2026-06-21',
    isCurrent: overrides.isCurrent ?? false,
  });
  return repo.save(year);
}

export async function createGrade(
  app: INestApplication,
  schoolId: string,
  overrides: Partial<Grade> = {},
): Promise<Grade> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Grade);
  const grade = repo.create({
    schoolId,
    title: overrides.title ?? `Grade ${Math.floor(Math.random() * 1000)}`,
  });
  return repo.save(grade);
}

export async function createGuardian(
  app: INestApplication,
  schoolId: string,
  overrides: Partial<Guardian> = {},
): Promise<Guardian> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Guardian);
  const guardian = repo.create({
    schoolId,
    fullName: overrides.fullName ?? 'Test Guardian',
    phone: overrides.phone ?? uniquePhone(),
    nationalId: overrides.nationalId ?? null,
  });
  return repo.save(guardian);
}

export async function createStudent(
  app: INestApplication,
  schoolId: string,
  opts: {
    academicYearId?: string;
    gradeId?: string;
    guardianId?: string;
    fullName?: string;
  } = {},
): Promise<Student> {
  const ds = getDataSource(app);
  const academicYearId = opts.academicYearId ?? (await createAcademicYear(app, schoolId)).id;
  const gradeId = opts.gradeId ?? (await createGrade(app, schoolId)).id;
  const guardianId = opts.guardianId ?? (await createGuardian(app, schoolId)).id;

  const repo = ds.getRepository(Student);
  const student = repo.create({
    schoolId,
    academicYearId,
    gradeId,
    guardianId,
    fullName: opts.fullName ?? 'Test Student',
  });
  return repo.save(student);
}

export async function createTuitionPlan(
  app: INestApplication,
  opts: {
    studentId: string;
    academicYearId: string;
    baseAmount?: number;
    discountAmount?: number;
  },
): Promise<TuitionPlan> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(TuitionPlan);
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

export async function createInstallment(
  app: INestApplication,
  opts: {
    tuitionPlanId: string;
    installmentNumber?: number;
    amount?: number;
    dueDate?: string;
    status?: InstallmentStatus;
    paidAmount?: number;
  },
): Promise<Installment> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Installment);
  const installment = repo.create({
    tuitionPlanId: opts.tuitionPlanId,
    installmentNumber: opts.installmentNumber ?? 1,
    amount: opts.amount ?? 10_000_000,
    dueDate: opts.dueDate ?? '2026-12-01',
    status: opts.status ?? InstallmentStatus.PENDING,
    paidAmount: opts.paidAmount ?? 0,
  });
  return repo.save(installment);
}

export async function linkParentStudent(
  app: INestApplication,
  parentId: string,
  studentId: string,
): Promise<ParentStudent> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(ParentStudent);
  const link = repo.create({ parentId, studentId });
  return repo.save(link);
}

export async function createPayment(
  app: INestApplication,
  opts: {
    installmentId: string;
    amount?: number;
    paymentMethod?: PaymentMethod;
    paidAt?: Date;
    receivedById?: string;
  },
): Promise<Payment> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Payment);
  const payment = repo.create({
    installmentId: opts.installmentId,
    amount: opts.amount ?? 5_000_000,
    paymentMethod: opts.paymentMethod ?? PaymentMethod.CASH,
    paidAt: opts.paidAt ?? new Date(),
    receivedById: opts.receivedById ?? null,
    referenceNumber: null,
    note: null,
    idempotencyKey: null,
  });
  return repo.save(payment);
}

export { PaymentMethod, InstallmentStatus };

/**
 * Phase 5J: creates a financial_ledger row directly, bypassing
 * LedgerService's transactional insert path, so analytics tests can seed
 * exact monthly-income fixtures (ReportsService.monthlyIncome reads only
 * from this table, never from `payments` directly) without driving the
 * full create-plan/pay-installment flow through its APIs.
 */
export async function createLedgerEntry(
  app: INestApplication,
  opts: {
    schoolId: string;
    studentId: string;
    entryType?: LedgerEntryType;
    amount: number;
    referenceType?: LedgerReferenceType;
    referenceId: string;
    createdAt?: Date;
  },
): Promise<LedgerEntry> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(LedgerEntry);
  const entry = repo.create({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    entryType: opts.entryType ?? LedgerEntryType.PAYMENT,
    amount: opts.amount,
    referenceType: opts.referenceType ?? LedgerReferenceType.PAYMENT,
    referenceId: opts.referenceId,
  });
  const saved = await repo.save(entry);
  if (opts.createdAt) {
    // createdAt has a DB-level default (now()); overriding it after insert
    // is the simplest way for a test to control which month a ledger
    // entry falls into, same convention createNotification() already uses.
    await repo.update(saved.id, { createdAt: opts.createdAt });
    saved.createdAt = opts.createdAt;
  }
  return saved;
}

export { LedgerEntryType, LedgerReferenceType };

/**
 * Signs a token with the exact payload shape JwtStrategy.validate() expects
 * (see src/modules/auth/strategies/jwt.strategy.ts), bypassing the
 * throttled POST /auth/login endpoint. JwtStrategy still runs its real DB
 * lookups (isActive, tokenVersion, school active) against whatever `user`
 * row already exists — this only skips re-deriving the payload from a
 * password check, it does not weaken what's actually enforced per-request.
 */
/**
 * Phase 5C: creates a notification row directly (bypassing the
 * BullMQ/event-emitter flow) so parent-notification tests can set up
 * exact fixtures — type, read/unread state, created_at ordering — without
 * needing a worker to actually process a queued job.
 */
export async function createNotification(
  app: INestApplication,
  opts: {
    studentId: string;
    installmentId: string;
    type?: NotificationType;
    status?: NotificationStatus;
    readAt?: Date | null;
    createdAt?: Date;
  },
): Promise<Notification> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Notification);
  const notification = repo.create({
    studentId: opts.studentId,
    installmentId: opts.installmentId,
    channel: 'sms',
    type: opts.type ?? NotificationType.OVERDUE_INSTALLMENT,
    status: opts.status ?? NotificationStatus.PENDING,
    readAt: opts.readAt ?? null,
  });
  const saved = await repo.save(notification);
  if (opts.createdAt) {
    // createdAt has a DB-level default (now()); overriding it after insert
    // is the simplest way for a test to control ordering deterministically.
    await repo.update(saved.id, { createdAt: opts.createdAt });
    saved.createdAt = opts.createdAt;
  }
  return saved;
}

/**
 * Phase 5E: creates an attendance row directly, bypassing
 * AttendanceService.record()'s upsert path, so tests can seed exact
 * multi-day/multi-student fixtures without one POST per row.
 */
export async function createAttendance(
  app: INestApplication,
  opts: {
    schoolId: string;
    studentId: string;
    academicYearId: string;
    date: string;
    status?: AttendanceStatus;
    note?: string | null;
    recordedById?: string | null;
  },
): Promise<Attendance> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Attendance);
  const attendance = repo.create({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    academicYearId: opts.academicYearId,
    date: opts.date,
    status: opts.status ?? AttendanceStatus.PRESENT,
    note: opts.note ?? null,
    recordedById: opts.recordedById ?? null,
  });
  return repo.save(attendance);
}

export { AttendanceStatus };

/**
 * Phase 5F: creates a subject directly, same convention as createGrade.
 */
export async function createSubject(
  app: INestApplication,
  schoolId: string,
  overrides: Partial<Subject> = {},
): Promise<Subject> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Subject);
  const subject = repo.create({
    schoolId,
    title: overrides.title ?? `Subject ${Math.floor(Math.random() * 1000)}`,
  });
  return repo.save(subject);
}

/**
 * Phase 5F: creates an assessment row directly, bypassing
 * AssessmentsService.record()'s upsert path, so tests can seed exact
 * multi-subject/multi-term fixtures without one POST per row.
 */
export async function createAssessment(
  app: INestApplication,
  opts: {
    schoolId: string;
    studentId: string;
    subjectId: string;
    academicYearId: string;
    term?: AssessmentTerm;
    score?: number;
    maxScore?: number;
    note?: string | null;
    recordedById?: string | null;
  },
): Promise<Assessment> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Assessment);
  const assessment = repo.create({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    subjectId: opts.subjectId,
    academicYearId: opts.academicYearId,
    term: opts.term ?? AssessmentTerm.FIRST_TERM,
    score: opts.score ?? 18,
    maxScore: opts.maxScore ?? 20,
    note: opts.note ?? null,
    recordedById: opts.recordedById ?? null,
  });
  return repo.save(assessment);
}

export { AssessmentTerm };

/**
 * Phase 5G: creates a teacher_assignments row directly, bypassing
 * TeacherService.assign()'s idempotent-upsert path, so tests can seed
 * exact multi-grade/multi-subject fixtures without one POST per row.
 */
export async function createTeacherAssignment(
  app: INestApplication,
  opts: {
    schoolId: string;
    teacherId: string;
    gradeId: string;
    subjectId: string;
  },
): Promise<TeacherAssignment> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(TeacherAssignment);
  const assignment = repo.create({
    schoolId: opts.schoolId,
    teacherId: opts.teacherId,
    gradeId: opts.gradeId,
    subjectId: opts.subjectId,
  });
  return repo.save(assignment);
}

/**
 * Phase 5H: creates an announcement row directly, bypassing
 * AnnouncementsService.create(), so tests can seed exact
 * multi-audience/multi-school fixtures without one POST per row.
 */
export async function createAnnouncement(
  app: INestApplication,
  opts: {
    schoolId: string;
    title?: string;
    message?: string;
    targetType?: AnnouncementTargetType;
    createdById?: string | null;
  },
): Promise<Announcement> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Announcement);
  const announcement = repo.create({
    schoolId: opts.schoolId,
    title: opts.title ?? 'Test Announcement',
    message: opts.message ?? 'Test announcement message.',
    targetType: opts.targetType ?? AnnouncementTargetType.ALL,
    createdById: opts.createdById ?? null,
  });
  return repo.save(announcement);
}

export { AnnouncementTargetType };

/**
 * Phase 5I: creates a student_documents row directly, bypassing
 * StudentDocumentsService.create(), so tests can seed exact
 * multi-type/multi-school fixtures without one POST per row.
 */
export async function createStudentDocument(
  app: INestApplication,
  opts: {
    schoolId: string;
    studentId: string;
    title?: string;
    documentType?: StudentDocumentType;
    fileUrl?: string;
    description?: string | null;
    uploadedById?: string | null;
  },
): Promise<StudentDocument> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(StudentDocument);
  const document = repo.create({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    title: opts.title ?? 'Test Document',
    documentType: opts.documentType ?? StudentDocumentType.OTHER,
    fileUrl: opts.fileUrl ?? 'https://storage.example.com/doc.pdf',
    description: opts.description ?? null,
    uploadedById: opts.uploadedById ?? null,
  });
  return repo.save(document);
}

export { StudentDocumentType };

/**
 * Phase 5K: creates a timetable_entries row directly, bypassing
 * TimetableService.create()'s relation/assignment/overlap checks, so
 * tests can seed exact fixtures (including deliberately-overlapping rows,
 * to prove the *API* rejects them) without depending on those checks
 * already passing at insert time.
 */
export async function createTimetableEntry(
  app: INestApplication,
  opts: {
    schoolId: string;
    academicYearId: string;
    gradeId: string;
    subjectId: string;
    teacherId: string;
    weekday?: Weekday;
    startTime?: string;
    endTime?: string;
    room?: string | null;
  },
): Promise<TimetableEntry> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(TimetableEntry);
  const entry = repo.create({
    schoolId: opts.schoolId,
    academicYearId: opts.academicYearId,
    gradeId: opts.gradeId,
    subjectId: opts.subjectId,
    teacherId: opts.teacherId,
    weekday: opts.weekday ?? Weekday.SATURDAY,
    startTime: opts.startTime ?? '08:00',
    endTime: opts.endTime ?? '09:00',
    room: opts.room ?? null,
  });
  return repo.save(entry);
}

export { Weekday };

/**
 * Phase 5L: creates a homework row directly, bypassing
 * HomeworkService.create()'s relation/assignment checks, so tests can
 * seed exact multi-grade/multi-subject fixtures without one POST per row.
 */
export async function createHomework(
  app: INestApplication,
  opts: {
    schoolId: string;
    academicYearId: string;
    gradeId: string;
    subjectId: string;
    teacherId: string;
    title?: string;
    description?: string;
    dueDate?: string;
    attachmentUrl?: string | null;
  },
): Promise<Homework> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(Homework);
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

export async function createSchoolSettings(
  app: INestApplication,
  schoolId: string,
  overrides: Partial<SchoolSettings> = {},
): Promise<SchoolSettings> {
  const ds = getDataSource(app);
  const repo = ds.getRepository(SchoolSettings);
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
    weekStartsOn: overrides.weekStartsOn ?? Weekday.SATURDAY,
    workingDays: overrides.workingDays ?? [
      Weekday.SATURDAY,
      Weekday.SUNDAY,
      Weekday.MONDAY,
      Weekday.TUESDAY,
      Weekday.WEDNESDAY,
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

export function signToken(
  app: INestApplication,
  user: Pick<User, 'id' | 'schoolId' | 'role' | 'tokenVersion'>,
): string {
  const jwt = app.get(JwtService);
  return jwt.sign({
    sub: user.id,
    schoolId: user.schoolId,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
}

export function authHeader(app: INestApplication, user: Pick<User, 'id' | 'schoolId' | 'role' | 'tokenVersion'>) {
  return `Bearer ${signToken(app, user)}`;
}

export { Role };
