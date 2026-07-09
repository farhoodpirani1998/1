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
  });
  return repo.save(school);
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

/**
 * Signs a token with the exact payload shape JwtStrategy.validate() expects
 * (see src/modules/auth/strategies/jwt.strategy.ts), bypassing the
 * throttled POST /auth/login endpoint. JwtStrategy still runs its real DB
 * lookups (isActive, tokenVersion, school active) against whatever `user`
 * row already exists — this only skips re-deriving the payload from a
 * password check, it does not weaken what's actually enforced per-request.
 */
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
