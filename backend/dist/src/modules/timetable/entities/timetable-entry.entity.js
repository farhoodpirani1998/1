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
exports.TimetableEntry = exports.Weekday = void 0;
const typeorm_1 = require("typeorm");
const school_entity_1 = require("../../schools/entities/school.entity");
const academic_year_entity_1 = require("../../academic-years/entities/academic-year.entity");
const grade_entity_1 = require("../../grades/entities/grade.entity");
const subject_entity_1 = require("../../student-assessments/entities/subject.entity");
const user_entity_1 = require("../../users/entities/user.entity");
var Weekday;
(function (Weekday) {
    Weekday[Weekday["SATURDAY"] = 0] = "SATURDAY";
    Weekday[Weekday["SUNDAY"] = 1] = "SUNDAY";
    Weekday[Weekday["MONDAY"] = 2] = "MONDAY";
    Weekday[Weekday["TUESDAY"] = 3] = "TUESDAY";
    Weekday[Weekday["WEDNESDAY"] = 4] = "WEDNESDAY";
    Weekday[Weekday["THURSDAY"] = 5] = "THURSDAY";
    Weekday[Weekday["FRIDAY"] = 6] = "FRIDAY";
})(Weekday || (exports.Weekday = Weekday = {}));
let TimetableEntry = class TimetableEntry {
};
exports.TimetableEntry = TimetableEntry;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TimetableEntry.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => school_entity_1.School, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'school_id' }),
    __metadata("design:type", school_entity_1.School)
], TimetableEntry.prototype, "school", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'school_id' }),
    __metadata("design:type", String)
], TimetableEntry.prototype, "schoolId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => academic_year_entity_1.AcademicYear, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'academic_year_id' }),
    __metadata("design:type", academic_year_entity_1.AcademicYear)
], TimetableEntry.prototype, "academicYear", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'academic_year_id' }),
    __metadata("design:type", String)
], TimetableEntry.prototype, "academicYearId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => grade_entity_1.Grade, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'grade_id' }),
    __metadata("design:type", grade_entity_1.Grade)
], TimetableEntry.prototype, "grade", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'grade_id' }),
    __metadata("design:type", String)
], TimetableEntry.prototype, "gradeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => subject_entity_1.Subject, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'subject_id' }),
    __metadata("design:type", subject_entity_1.Subject)
], TimetableEntry.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subject_id' }),
    __metadata("design:type", String)
], TimetableEntry.prototype, "subjectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'teacher_id' }),
    __metadata("design:type", user_entity_1.User)
], TimetableEntry.prototype, "teacher", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'teacher_id' }),
    __metadata("design:type", String)
], TimetableEntry.prototype, "teacherId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint' }),
    __metadata("design:type", Number)
], TimetableEntry.prototype, "weekday", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_time', type: 'time' }),
    __metadata("design:type", String)
], TimetableEntry.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'end_time', type: 'time' }),
    __metadata("design:type", String)
], TimetableEntry.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], TimetableEntry.prototype, "room", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], TimetableEntry.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], TimetableEntry.prototype, "updatedAt", void 0);
exports.TimetableEntry = TimetableEntry = __decorate([
    (0, typeorm_1.Entity)('timetable_entries')
], TimetableEntry);
//# sourceMappingURL=timetable-entry.entity.js.map