"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimetableModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const timetable_entry_entity_1 = require("./entities/timetable-entry.entity");
const academic_year_entity_1 = require("../academic-years/entities/academic-year.entity");
const grade_entity_1 = require("../grades/entities/grade.entity");
const subject_entity_1 = require("../student-assessments/entities/subject.entity");
const user_entity_1 = require("../users/entities/user.entity");
const student_entity_1 = require("../students/entities/student.entity");
const parent_student_entity_1 = require("../parent/entities/parent-student.entity");
const teacher_assignment_entity_1 = require("../teacher/entities/teacher-assignment.entity");
const timetable_controller_1 = require("./timetable.controller");
const timetable_service_1 = require("./timetable.service");
let TimetableModule = class TimetableModule {
};
exports.TimetableModule = TimetableModule;
exports.TimetableModule = TimetableModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                timetable_entry_entity_1.TimetableEntry,
                academic_year_entity_1.AcademicYear,
                grade_entity_1.Grade,
                subject_entity_1.Subject,
                user_entity_1.User,
                student_entity_1.Student,
                parent_student_entity_1.ParentStudent,
                teacher_assignment_entity_1.TeacherAssignment,
            ]),
        ],
        controllers: [timetable_controller_1.TimetableController],
        providers: [timetable_service_1.TimetableService],
        exports: [timetable_service_1.TimetableService],
    })
], TimetableModule);
//# sourceMappingURL=timetable.module.js.map