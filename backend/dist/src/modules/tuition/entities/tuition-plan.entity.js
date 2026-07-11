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
exports.TuitionPlan = void 0;
const typeorm_1 = require("typeorm");
const student_entity_1 = require("../../students/entities/student.entity");
const academic_year_entity_1 = require("../../academic-years/entities/academic-year.entity");
const installment_entity_1 = require("./installment.entity");
let TuitionPlan = class TuitionPlan {
};
exports.TuitionPlan = TuitionPlan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TuitionPlan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => student_entity_1.Student, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'student_id' }),
    __metadata("design:type", student_entity_1.Student)
], TuitionPlan.prototype, "student", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'student_id' }),
    __metadata("design:type", String)
], TuitionPlan.prototype, "studentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => academic_year_entity_1.AcademicYear, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'academic_year_id' }),
    __metadata("design:type", academic_year_entity_1.AcademicYear)
], TuitionPlan.prototype, "academicYear", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'academic_year_id' }),
    __metadata("design:type", String)
], TuitionPlan.prototype, "academicYearId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'base_amount', type: 'numeric', precision: 14, scale: 0 }),
    __metadata("design:type", Number)
], TuitionPlan.prototype, "baseAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'discount_amount',
        type: 'numeric',
        precision: 14,
        scale: 0,
        default: 0,
    }),
    __metadata("design:type", Number)
], TuitionPlan.prototype, "discountAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'discount_reason', type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], TuitionPlan.prototype, "discountReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'final_amount', type: 'numeric', precision: 14, scale: 0 }),
    __metadata("design:type", Number)
], TuitionPlan.prototype, "finalAmount", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => installment_entity_1.Installment, (installment) => installment.tuitionPlan),
    __metadata("design:type", Array)
], TuitionPlan.prototype, "installments", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], TuitionPlan.prototype, "createdAt", void 0);
exports.TuitionPlan = TuitionPlan = __decorate([
    (0, typeorm_1.Entity)('tuition_plans')
], TuitionPlan);
//# sourceMappingURL=tuition-plan.entity.js.map