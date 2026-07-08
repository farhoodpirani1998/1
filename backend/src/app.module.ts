import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AuthModule } from './modules/auth/auth.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { GradesModule } from './modules/grades/grades.module';
import { ClassesModule } from './modules/classes/classes.module';
import { DiscountTypesModule } from './modules/discount-types/discount-types.module';
import { StudentsModule } from './modules/students/students.module';
import { TuitionModule } from './modules/tuition/tuition.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

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
      },
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute window
        limit: 20, // generous default; login itself uses a stricter @Throttle()
      },
    ]),

    AuthModule,
    UsersModule,
    SchoolsModule,
    AcademicYearsModule,
    GradesModule,
    ClassesModule,
    DiscountTypesModule,
    StudentsModule,
    TuitionModule,
    ReportsModule,
    NotificationsModule,
    SchedulerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
