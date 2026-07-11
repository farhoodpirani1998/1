"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const teacher_assignment_entity_1 = require("./entities/teacher-assignment.entity");
const user_entity_1 = require("../users/entities/user.entity");
const student_entity_1 = require("../students/entities/student.entity");
const grade_entity_1 = require("../grades/entities/grade.entity");
const subject_entity_1 = require("../student-assessments/entities/subject.entity");
const teacher_controller_1 = require("./teacher.controller");
const teacher_service_1 = require("./teacher.service");
const attendance_module_1 = require("../attendance/attendance.module");
const student_assessments_module_1 = require("../student-assessments/student-assessments.module");
const announcements_module_1 = require("../announcements/announcements.module");
const timetable_module_1 = require("../timetable/timetable.module");
const homework_module_1 = require("../homework/homework.module");
let TeacherModule = class TeacherModule {
};
exports.TeacherModule = TeacherModule;
exports.TeacherModule = TeacherModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([teacher_assignment_entity_1.TeacherAssignment, user_entity_1.User, student_entity_1.Student, grade_entity_1.Grade, subject_entity_1.Subject]),
            attendance_module_1.AttendanceModule,
            student_assessments_module_1.StudentAssessmentsModule,
            announcements_module_1.AnnouncementsModule,
            timetable_module_1.TimetableModule,
            homework_module_1.HomeworkModule,
        ],
        controllers: [teacher_controller_1.TeacherController],
        providers: [teacher_service_1.TeacherService],
        exports: [teacher_service_1.TeacherService],
    })
], TeacherModule);
//# sourceMappingURL=teacher.module.js.map