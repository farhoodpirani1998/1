"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const student_entity_1 = require("../students/entities/student.entity");
const attendance_entity_1 = require("../attendance/entities/attendance.entity");
const assessment_entity_1 = require("../student-assessments/entities/assessment.entity");
const payment_entity_1 = require("../tuition/entities/payment.entity");
const installment_entity_1 = require("../tuition/entities/installment.entity");
const tuition_plan_entity_1 = require("../tuition/entities/tuition-plan.entity");
const reports_module_1 = require("../reports/reports.module");
const attendance_module_1 = require("../attendance/attendance.module");
const announcements_module_1 = require("../announcements/announcements.module");
const analytics_controller_1 = require("./analytics.controller");
const analytics_service_1 = require("./analytics.service");
let AnalyticsModule = class AnalyticsModule {
};
exports.AnalyticsModule = AnalyticsModule;
exports.AnalyticsModule = AnalyticsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([student_entity_1.Student, attendance_entity_1.Attendance, assessment_entity_1.Assessment, payment_entity_1.Payment, installment_entity_1.Installment, tuition_plan_entity_1.TuitionPlan]),
            reports_module_1.ReportsModule,
            attendance_module_1.AttendanceModule,
            announcements_module_1.AnnouncementsModule,
        ],
        controllers: [analytics_controller_1.AnalyticsController],
        providers: [analytics_service_1.AnalyticsService],
    })
], AnalyticsModule);
//# sourceMappingURL=analytics.module.js.map