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
const auth_module_1 = require("./modules/auth/auth.module");
const schools_module_1 = require("./modules/schools/schools.module");
const academic_years_module_1 = require("./modules/academic-years/academic-years.module");
const grades_module_1 = require("./modules/grades/grades.module");
const classes_module_1 = require("./modules/classes/classes.module");
const discount_types_module_1 = require("./modules/discount-types/discount-types.module");
const students_module_1 = require("./modules/students/students.module");
const tuition_module_1 = require("./modules/tuition/tuition.module");
const reports_module_1 = require("./modules/reports/reports.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const scheduler_module_1 = require("./modules/scheduler/scheduler.module");
const users_module_1 = require("./modules/users/users.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
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
                },
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: 20,
                },
            ]),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            schools_module_1.SchoolsModule,
            academic_years_module_1.AcademicYearsModule,
            grades_module_1.GradesModule,
            classes_module_1.ClassesModule,
            discount_types_module_1.DiscountTypesModule,
            students_module_1.StudentsModule,
            tuition_module_1.TuitionModule,
            reports_module_1.ReportsModule,
            notifications_module_1.NotificationsModule,
            scheduler_module_1.SchedulerModule,
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