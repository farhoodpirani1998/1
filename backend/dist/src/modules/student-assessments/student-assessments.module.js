"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentAssessmentsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const assessment_entity_1 = require("./entities/assessment.entity");
const subject_entity_1 = require("./entities/subject.entity");
const student_entity_1 = require("../students/entities/student.entity");
const parent_student_entity_1 = require("../parent/entities/parent-student.entity");
const subjects_controller_1 = require("./subjects.controller");
const subjects_service_1 = require("./subjects.service");
const assessments_controller_1 = require("./assessments.controller");
const assessments_service_1 = require("./assessments.service");
let StudentAssessmentsModule = class StudentAssessmentsModule {
};
exports.StudentAssessmentsModule = StudentAssessmentsModule;
exports.StudentAssessmentsModule = StudentAssessmentsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([assessment_entity_1.Assessment, subject_entity_1.Subject, student_entity_1.Student, parent_student_entity_1.ParentStudent])],
        controllers: [subjects_controller_1.SubjectsController, assessments_controller_1.AssessmentsController],
        providers: [subjects_service_1.SubjectsService, assessments_service_1.AssessmentsService],
        exports: [assessments_service_1.AssessmentsService, subjects_service_1.SubjectsService],
    })
], StudentAssessmentsModule);
//# sourceMappingURL=student-assessments.module.js.map