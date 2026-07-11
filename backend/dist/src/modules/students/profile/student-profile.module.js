"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentProfileModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const student_entity_1 = require("../entities/student.entity");
const parent_student_entity_1 = require("../../parent/entities/parent-student.entity");
const user_entity_1 = require("../../users/entities/user.entity");
const reports_module_1 = require("../../reports/reports.module");
const attendance_module_1 = require("../../attendance/attendance.module");
const student_assessments_module_1 = require("../../student-assessments/student-assessments.module");
const student_documents_module_1 = require("../../student-documents/student-documents.module");
const homework_module_1 = require("../../homework/homework.module");
const student_profile_service_1 = require("./student-profile.service");
let StudentProfileModule = class StudentProfileModule {
};
exports.StudentProfileModule = StudentProfileModule;
exports.StudentProfileModule = StudentProfileModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([student_entity_1.Student, parent_student_entity_1.ParentStudent, user_entity_1.User]),
            reports_module_1.ReportsModule,
            attendance_module_1.AttendanceModule,
            student_assessments_module_1.StudentAssessmentsModule,
            student_documents_module_1.StudentDocumentsModule,
            homework_module_1.HomeworkModule,
        ],
        providers: [student_profile_service_1.StudentProfileService],
        exports: [student_profile_service_1.StudentProfileService],
    })
], StudentProfileModule);
//# sourceMappingURL=student-profile.module.js.map