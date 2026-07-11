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
exports.Student = exports.StudentStatus = void 0;
const typeorm_1 = require("typeorm");
const school_entity_1 = require("../../schools/entities/school.entity");
const guardian_entity_1 = require("./guardian.entity");
const academic_year_entity_1 = require("../../academic-years/entities/academic-year.entity");
const grade_entity_1 = require("../../grades/entities/grade.entity");
var StudentStatus;
(function (StudentStatus) {
    StudentStatus["ACTIVE"] = "active";
    StudentStatus["WITHDRAWN"] = "withdrawn";
    StudentStatus["GRADUATED"] = "graduated";
})(StudentStatus || (exports.StudentStatus = StudentStatus = {}));
let Student = class Student {
};
exports.Student = Student;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Student.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => school_entity_1.School, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'school_id' }),
    __metadata("design:type", school_entity_1.School)
], Student.prototype, "school", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'school_id' }),
    __metadata("design:type", String)
], Student.prototype, "schoolId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => guardian_entity_1.Guardian, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'guardian_id' }),
    __metadata("design:type", Object)
], Student.prototype, "guardian", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'guardian_id', nullable: true }),
    __metadata("design:type", Object)
], Student.prototype, "guardianId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => academic_year_entity_1.AcademicYear, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'academic_year_id' }),
    __metadata("design:type", academic_year_entity_1.AcademicYear)
], Student.prototype, "academicYear", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'academic_year_id' }),
    __metadata("design:type", String)
], Student.prototype, "academicYearId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => grade_entity_1.Grade, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'grade_id' }),
    __metadata("design:type", grade_entity_1.Grade)
], Student.prototype, "grade", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'grade_id' }),
    __metadata("design:type", String)
], Student.prototype, "gradeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'full_name', length: 150 }),
    __metadata("design:type", String)
], Student.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'national_id', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], Student.prototype, "nationalId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: StudentStatus.ACTIVE }),
    __metadata("design:type", String)
], Student.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'enrollment_date', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Student.prototype, "enrollmentDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Student.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at' }),
    __metadata("design:type", Object)
], Student.prototype, "deletedAt", void 0);
exports.Student = Student = __decorate([
    (0, typeorm_1.Entity)('students')
], Student);
//# sourceMappingURL=student.entity.js.map