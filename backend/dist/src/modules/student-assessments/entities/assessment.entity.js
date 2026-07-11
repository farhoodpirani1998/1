"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Assessment = exports.AssessmentTerm = void 0;
const typeorm_1 = require("typeorm");
const school_entity_1 = require("../../schools/entities/school.entity");
const student_entity_1 = require("../../students/entities/student.entity");
const subject_entity_1 = require("./subject.entity");
const academic_year_entity_1 = require("../../academic-years/entities/academic-year.entity");
const user_entity_1 = require("../../users/entities/user.entity");
var AssessmentTerm;
(function (AssessmentTerm) {
    AssessmentTerm["FIRST_TERM"] = "first_term";
    AssessmentTerm["SECOND_TERM"] = "second_term";
})(AssessmentTerm || (exports.AssessmentTerm = AssessmentTerm = {}));
let Assessment = class Assessment {
};
exports.Assessment = Assessment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Assessment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => school_entity_1.School, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'school_id' }),
    __metadata("design:type", school_entity_1.School)
], Assessment.prototype, "school", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'school_id' }),
    __metadata("design:type", String)
], Assessment.prototype, "schoolId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => student_entity_1.Student, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'student_id' }),
    __metadata("design:type", student_entity_1.Student)
], Assessment.prototype, "student", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'student_id' }),
    __metadata("design:type", String)
], Assessment.prototype, "studentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => subject_entity_1.Subject, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'subject_id' }),
    __metadata("design:type", subject_entity_1.Subject)
], Assessment.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subject_id' }),
    __metadata("design:type", String)
], Assessment.prototype, "subjectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => academic_year_entity_1.AcademicYear, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'academic_year_id' }),
    __metadata("design:type", academic_year_entity_1.AcademicYear)
], Assessment.prototype, "academicYear", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'academic_year_id' }),
    __metadata("design:type", String)
], Assessment.prototype, "academicYearId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], Assessment.prototype, "term", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 5, scale: 2 }),
    __metadata("design:type", Number)
], Assessment.prototype, "score", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_score', type: 'numeric', precision: 5, scale: 2, default: 20 }),
    __metadata("design:type", Number)
], Assessment.prototype, "maxScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Assessment.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'recorded_by' }),
    __metadata("design:type", Object)
], Assessment.prototype, "recordedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recorded_by', nullable: true }),
    __metadata("design:type", Object)
], Assessment.prototype, "recordedById", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Assessment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Assessment.prototype, "updatedAt", void 0);
exports.Assessment = Assessment = __decorate([
    (0, typeorm_1.Entity)('student_assessments')
], Assessment);
//# sourceMappingURL=assessment.entity.js.map