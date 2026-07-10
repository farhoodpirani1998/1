import { Test } from '@nestjs/testing';
import { CanActivate, INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const migrationDataSource = require('../../src/database/data-source').default as DataSource;

let migrationsRun = false;

/**
 * Runs the real migration set (src/database/migrations/*.ts) against
 * TEST_DATABASE_URL exactly once per test process — every test file that
 * calls createTestApp() shares the same already-migrated schema instead of
 * re-running migrations per file.
 */
export async function ensureMigrations(): Promise<void> {
  if (migrationsRun) return;
  if (!migrationDataSource.isInitialized) {
    await migrationDataSource.initialize();
  }
  await migrationDataSource.runMigrations();
  migrationsRun = true;
}

const alwaysAllow: CanActivate = { canActivate: () => true };

/**
 * Boots the full application (real AppModule, real guards, real Postgres)
 * the same way main.ts does, so these tests exercise the actual
 * JwtAuthGuard → RolesGuard → PermissionsGuard → controller → service →
 * DB chain, not a mocked substitute.
 *
 * The one deliberate difference from production: the global ThrottlerGuard
 * is overridden to always allow. Login's 5-req/min production limit is a
 * legitimate anti-brute-force control, but every request in a test run
 * shares one source IP, so a normal test suite calling /auth/login more
 * than 5 times would start getting 429s that have nothing to do with what
 * each test is actually checking. This is a test-harness override via
 * Nest's standard overrideGuard, not a change to app.module.ts.
 */
export async function createTestApp(): Promise<INestApplication> {
  await ensureMigrations();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue(alwaysAllow)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

export function getDataSource(app: INestApplication): DataSource {
  return app.get(DataSource);
}

/**
 * Wipes every table between tests (or test files) so tenant-isolation and
 * duplicate-prevention assertions never depend on ordering or leftover
 * rows from a previous run. Tables are named explicitly (not a blanket
 * `TRUNCATE ... CASCADE` over `pg_tables`) so a forgotten new table fails
 * loudly (FK error) instead of silently going untruncated, or a typo'd
 * table silently vanishing from cleanup.
 */
export async function truncateAll(app: INestApplication): Promise<void> {
  const ds = getDataSource(app);
  const tables = [
    'audit_logs',
    'school_settings',
    'homework',
    'timetable_entries',
    'announcements',
    'attendance',
    'teacher_assignments',
    'student_assessments',
    'subjects',
    'notifications',
    'financial_ledger',
    'receipt_counters',
    'payments',
    'installments',
    'tuition_plans',
    'parent_students',
    'students',
    'guardians',
    'grades',
    'academic_years',
    'users',
    'schools',
  ];
  await ds.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
}

export async function closeMigrationDataSource(): Promise<void> {
  if (migrationDataSource.isInitialized) {
    await migrationDataSource.destroy();
  }
}
