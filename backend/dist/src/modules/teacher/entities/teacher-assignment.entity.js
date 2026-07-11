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
exports.TeacherAssignment = void 0;
const typeorm_1 = require("typeorm");
const school_entity_1 = require("../../schools/entities/school.entity");
const user_entity_1 = require("../../users/entities/user.entity");
const grade_entity_1 = require("../../grades/entities/grade.entity");
const subject_entity_1 = require("../../student-assessments/entities/subject.entity");
let TeacherAssignment = class TeacherAssignment {
};
exports.TeacherAssignment = TeacherAssignment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TeacherAssignment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => school_entity_1.School, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'school_id' }),
    __metadata("design:type", school_entity_1.School)
], TeacherAssignment.prototype, "school", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'school_id' }),
    __metadata("design:type", String)
], TeacherAssignment.prototype, "schoolId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'teacher_id' }),
    __metadata("design:type", user_entity_1.User)
], TeacherAssignment.prototype, "teacher", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'teacher_id' }),
    __metadata("design:type", String)
], TeacherAssignment.prototype, "teacherId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => grade_entity_1.Grade, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'grade_id' }),
    __metadata("design:type", grade_entity_1.Grade)
], TeacherAssignment.prototype, "grade", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'grade_id' }),
    __metadata("design:type", String)
], TeacherAssignment.prototype, "gradeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => subject_entity_1.Subject, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'subject_id' }),
    __metadata("design:type", subject_entity_1.Subject)
], TeacherAssignment.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subject_id' }),
    __metadata("design:type", String)
], TeacherAssignment.prototype, "subjectId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], TeacherAssignment.prototype, "createdAt", void 0);
exports.TeacherAssignment = TeacherAssignment = __decorate([
    (0, typeorm_1.Entity)('teacher_assignments'),
    (0, typeorm_1.Unique)('uq_teacher_assignment', ['teacherId', 'gradeId', 'subjectId'])
], TeacherAssignment);
//# sourceMappingURL=teacher-assignment.entity.js.map