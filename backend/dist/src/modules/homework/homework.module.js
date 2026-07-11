"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeworkModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const homework_entity_1 = require("./entities/homework.entity");
const academic_year_entity_1 = require("../academic-years/entities/academic-year.entity");
const grade_entity_1 = require("../grades/entities/grade.entity");
const subject_entity_1 = require("../student-assessments/entities/subject.entity");
const student_entity_1 = require("../students/entities/student.entity");
const parent_student_entity_1 = require("../parent/entities/parent-student.entity");
const teacher_assignment_entity_1 = require("../teacher/entities/teacher-assignment.entity");
const homework_controller_1 = require("./homework.controller");
const homework_service_1 = require("./homework.service");
let HomeworkModule = class HomeworkModule {
};
exports.HomeworkModule = HomeworkModule;
exports.HomeworkModule = HomeworkModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                homework_entity_1.Homework,
                academic_year_entity_1.AcademicYear,
                grade_entity_1.Grade,
                subject_entity_1.Subject,
                student_entity_1.Student,
                parent_student_entity_1.ParentStudent,
                teacher_assignment_entity_1.TeacherAssignment,
            ]),
        ],
        controllers: [homework_controller_1.HomeworkController],
        providers: [homework_service_1.HomeworkService],
        exports: [homework_service_1.HomeworkService],
    })
], HomeworkModule);
//# sourceMappingURL=homework.module.js.map