import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AuthModule } from './modules/auth/auth.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { GradesModule } from './modules/grades/grades.module';
import { StudentsModule } from './modules/students/students.module';
import { ParentModule } from './modules/parent/parent.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { StudentAssessmentsModule } from './modules/student-assessments/student-assessments.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { StudentDocumentsModule } from './modules/student-documents/student-documents.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { HomeworkModule } from './modules/homework/homework.module';
import { TuitionModule } from './modules/tuition/tuition.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { UsersModule } from './modules/users/users.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { SchoolSettingsModule } from './modules/school-settings/school-settings.module';
import { SearchModule } from './modules/search/search.module';
import { AuditModule } from './common/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { ObservabilityModule } from './common/logging/observability.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    // Domain Events backbone. `global: true` so any module's EventEmitter2
    // injection and any module's @OnEvent listener talk to the same bus
    // without each feature module needing to re-import this.
    EventEmitterModule.forRoot({ global: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      migrations: ['dist/database/migrations/*.js'],
      migrationsRun: false, // run explicitly via `npm run migration:run`, not on boot
      synchronize: false, // schema is owned by migrations, not entity introspection
    }),

    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        // Undefined (not empty string) when unset, so ioredis skips AUTH
        // in dev; env.validation.ts already refuses to boot in production
        // without REDIS_PASSWORD set.
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute window
        limit: 20, // generous default; login itself uses a stricter @Throttle()
      },
    ]),

    // Phase 4B: request-id tracking, structured HTTP logging, and
    // userId/schoolId log enrichment. Self-contained (see
    // common/logging/observability.module.ts) — no other module changes.
    ObservabilityModule,
    // Phase 4B: /api/v1/health, /api/v1/health/live, /api/v1/health/ready
    // (HealthController's 'health' path + the global 'api/v1' prefix set
    // in main.ts -- see docs/DEPLOYMENT.md for the full table).
    HealthModule,

    AuthModule,
    UsersModule,
    SchoolsModule,
    AcademicYearsModule,
    GradesModule,
    StudentsModule,
    ParentModule,
    AttendanceModule,
    StudentAssessmentsModule,
    TeacherModule,
    AnnouncementsModule,
    StudentDocumentsModule,
    AnalyticsModule,
    TimetableModule,
    HomeworkModule,
    LedgerModule,
    AuditModule,
    TuitionModule,
    ReportsModule,
    NotificationsModule,
    SchedulerModule,
    SchoolSettingsModule,
    SearchModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
