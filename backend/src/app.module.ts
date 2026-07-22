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
import { ClassesModule } from './modules/classes/classes.module';
import { StudentsModule } from './modules/students/students.module';
// ADR-001 Task 4A-1: self-service foundation for the future /student/*
// portal -- no controller yet, so this adds no new routes.
import { StudentModule } from './modules/student/student.module';
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
import { FounderModule } from './modules/founder/founder.module';
import { AuditModule } from './common/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { ObservabilityModule } from './common/logging/observability.module';
import { validateEnv } from './config/env.validation';
import { ThrottlerRedisStorageService } from './common/throttler/redis-throttler-storage.factory';
import { ThrottlerRedisStorageModule } from './common/throttler/throttler-redis-storage.module';

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
      // Sprint 3 Phase 1 — reliability hardening: TypeORM had no visibility
      // into slow queries. Any query exceeding this threshold is logged as
      // a warning by TypeORM's own logger, independent of the `logging`
      // option (which stays unset/off here) -- this only surfaces outliers,
      // it doesn't turn on full query logging. Threshold is configurable
      // via DB_SLOW_QUERY_THRESHOLD_MS (see env.validation.ts) since what
      // counts as "slow" varies by environment; defaults to 1s when unset.
      maxQueryExecutionTime: Number(process.env.DB_SLOW_QUERY_THRESHOLD_MS ?? 1000),
      // Sprint 3 Phase 2 — reliability hardening: previously relied on
      // node-postgres's own defaults (a pool max of 10, no explicit
      // connect/idle timeouts) with no way to tune per instance, making
      // Postgres connection exhaustion hard to diagnose once running
      // several app instances behind a load balancer. `max` is
      // configurable via DB_POOL_MAX (see env.validation.ts) since the
      // right ceiling depends on how many instances share the database's
      // connection limit; connectionTimeoutMillis/idleTimeoutMillis are
      // fixed at safe, documented defaults rather than also being
      // env-driven, matching this task's scope.
      extra: {
        // Preserves pg's current default of 10 when unset.
        max: Number(process.env.DB_POOL_MAX ?? 10),
        // How long a new connection attempt waits before failing, so a
        // saturated/unreachable Postgres surfaces as a fast, clear error
        // instead of a request hanging indefinitely.
        connectionTimeoutMillis: 10_000,
        // How long a connection can sit idle in the pool before being
        // closed, so instances don't hold onto more connections than
        // they're actually using under lighter traffic.
        idleTimeoutMillis: 30_000,
      },
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

    // Redis-backed storage (see redis-throttler-storage.factory.ts) so the
    // 20/min default and auth's 5/min (@Throttle() in auth.controller.ts)
    // are enforced against one shared counter across all app instances,
    // not per-instance in memory. Limits themselves are unchanged.
    //
    // Sprint 3 Phase 1 — reliability hardening: forRootAsync + inject
    // (rather than forRoot's plain synchronous options object) is what
    // lets Nest's DI container own ThrottlerRedisStorageService, so its
    // OnModuleDestroy hook actually runs and the Redis connection closes
    // cleanly on shutdown instead of leaking.
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerRedisStorageModule],
      inject: [ThrottlerRedisStorageService],
      useFactory: (redisStorage: ThrottlerRedisStorageService) => ({
        throttlers: [
          {
            ttl: 60000, // 1 minute window
            limit: 20, // generous default; login itself uses a stricter @Throttle()
          },
        ],
        storage: redisStorage.storage,
      }),
    }),

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
    ClassesModule,
    StudentsModule,
    StudentModule,
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
    FounderModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
