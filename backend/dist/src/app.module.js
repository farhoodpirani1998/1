"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const throttler_1 = require("@nestjs/throttler");
const event_emitter_1 = require("@nestjs/event-emitter");
const auth_module_1 = require("./modules/auth/auth.module");
const schools_module_1 = require("./modules/schools/schools.module");
const academic_years_module_1 = require("./modules/academic-years/academic-years.module");
const grades_module_1 = require("./modules/grades/grades.module");
const students_module_1 = require("./modules/students/students.module");
const parent_module_1 = require("./modules/parent/parent.module");
const attendance_module_1 = require("./modules/attendance/attendance.module");
const student_assessments_module_1 = require("./modules/student-assessments/student-assessments.module");
const teacher_module_1 = require("./modules/teacher/teacher.module");
const announcements_module_1 = require("./modules/announcements/announcements.module");
const student_documents_module_1 = require("./modules/student-documents/student-documents.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const timetable_module_1 = require("./modules/timetable/timetable.module");
const homework_module_1 = require("./modules/homework/homework.module");
const tuition_module_1 = require("./modules/tuition/tuition.module");
const reports_module_1 = require("./modules/reports/reports.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const scheduler_module_1 = require("./modules/scheduler/scheduler.module");
const users_module_1 = require("./modules/users/users.module");
const ledger_module_1 = require("./modules/ledger/ledger.module");
const school_settings_module_1 = require("./modules/school-settings/school-settings.module");
const search_module_1 = require("./modules/search/search.module");
const audit_module_1 = require("./common/audit/audit.module");
const health_module_1 = require("./modules/health/health.module");
const observability_module_1 = require("./common/logging/observability.module");
const env_validation_1 = require("./config/env.validation");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, validate: env_validation_1.validateEnv }),
            event_emitter_1.EventEmitterModule.forRoot({ global: true }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'postgres',
                url: process.env.DATABASE_URL,
                autoLoadEntities: true,
                migrations: ['dist/database/migrations/*.js'],
                migrationsRun: false,
                synchronize: false,
            }),
            bullmq_1.BullModule.forRoot({
                connection: {
                    host: process.env.REDIS_HOST ?? 'localhost',
                    port: Number(process.env.REDIS_PORT ?? 6379),
                    password: process.env.REDIS_PASSWORD || undefined,
                },
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: 20,
                },
            ]),
            observability_module_1.ObservabilityModule,
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            schools_module_1.SchoolsModule,
            academic_years_module_1.AcademicYearsModule,
            grades_module_1.GradesModule,
            students_module_1.StudentsModule,
            parent_module_1.ParentModule,
            attendance_module_1.AttendanceModule,
            student_assessments_module_1.StudentAssessmentsModule,
            teacher_module_1.TeacherModule,
            announcements_module_1.AnnouncementsModule,
            student_documents_module_1.StudentDocumentsModule,
            analytics_module_1.AnalyticsModule,
            timetable_module_1.TimetableModule,
            homework_module_1.HomeworkModule,
            ledger_module_1.LedgerModule,
            audit_module_1.AuditModule,
            tuition_module_1.TuitionModule,
            reports_module_1.ReportsModule,
            notifications_module_1.NotificationsModule,
            scheduler_module_1.SchedulerModule,
            school_settings_module_1.SchoolSettingsModule,
            search_module_1.SearchModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map