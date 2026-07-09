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
exports.Class = void 0;
const typeorm_1 = require("typeorm");
const school_entity_1 = require("../../schools/entities/school.entity");
const grade_entity_1 = require("../../grades/entities/grade.entity");
const academic_year_entity_1 = require("../../academic-years/entities/academic-year.entity");
let Class = class Class {
};
exports.Class = Class;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Class.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => school_entity_1.School, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'school_id' }),
    __metadata("design:type", school_entity_1.School)
], Class.prototype, "school", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'school_id' }),
    __metadata("design:type", String)
], Class.prototype, "schoolId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => grade_entity_1.Grade, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'grade_id' }),
    __metadata("design:type", grade_entity_1.Grade)
], Class.prototype, "grade", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'grade_id' }),
    __metadata("design:type", String)
], Class.prototype, "gradeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => academic_year_entity_1.AcademicYear, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'academic_year_id' }),
    __metadata("design:type", academic_year_entity_1.AcademicYear)
], Class.prototype, "academicYear", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'academic_year_id' }),
    __metadata("design:type", String)
], Class.prototype, "academicYearId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50 }),
    __metadata("design:type", String)
], Class.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'teacher_name', length: 150, nullable: true }),
    __metadata("design:type", Object)
], Class.prototype, "teacherName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Object)
], Class.prototype, "capacity", void 0);
exports.Class = Class = __decorate([
    (0, typeorm_1.Entity)('classes')
], Class);
//# sourceMappingURL=class.entity.js.map