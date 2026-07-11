"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const parent_student_entity_1 = require("./entities/parent-student.entity");
const user_entity_1 = require("../users/entities/user.entity");
const student_entity_1 = require("../students/entities/student.entity");
const tuition_plan_entity_1 = require("../tuition/entities/tuition-plan.entity");
const installment_entity_1 = require("../tuition/entities/installment.entity");
const payment_entity_1 = require("../tuition/entities/payment.entity");
const notification_entity_1 = require("../notifications/entities/notification.entity");
const parent_controller_1 = require("./parent.controller");
const parent_service_1 = require("./parent.service");
const student_profile_module_1 = require("../students/profile/student-profile.module");
const attendance_module_1 = require("../attendance/attendance.module");
const student_assessments_module_1 = require("../student-assessments/student-assessments.module");
const announcements_module_1 = require("../announcements/announcements.module");
const student_documents_module_1 = require("../student-documents/student-documents.module");
const timetable_module_1 = require("../timetable/timetable.module");
const homework_module_1 = require("../homework/homework.module");
let ParentModule = class ParentModule {
};
exports.ParentModule = ParentModule;
exports.ParentModule = ParentModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                parent_student_entity_1.ParentStudent,
                user_entity_1.User,
                student_entity_1.Student,
                tuition_plan_entity_1.TuitionPlan,
                installment_entity_1.Installment,
                payment_entity_1.Payment,
                notification_entity_1.Notification,
            ]),
            student_profile_module_1.StudentProfileModule,
            attendance_module_1.AttendanceModule,
            student_assessments_module_1.StudentAssessmentsModule,
            announcements_module_1.AnnouncementsModule,
            student_documents_module_1.StudentDocumentsModule,
            timetable_module_1.TimetableModule,
            homework_module_1.HomeworkModule,
        ],
        controllers: [parent_controller_1.ParentController],
        providers: [parent_service_1.ParentService],
        exports: [parent_service_1.ParentService],
    })
], ParentModule);
//# sourceMappingURL=parent.module.js.map