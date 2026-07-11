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
exports.LedgerEntry = exports.LedgerReferenceType = exports.LedgerEntryType = void 0;
const typeorm_1 = require("typeorm");
const school_entity_1 = require("../../schools/entities/school.entity");
const student_entity_1 = require("../../students/entities/student.entity");
const tuition_plan_entity_1 = require("../../tuition/entities/tuition-plan.entity");
const user_entity_1 = require("../../users/entities/user.entity");
var LedgerEntryType;
(function (LedgerEntryType) {
    LedgerEntryType["CHARGE"] = "CHARGE";
    LedgerEntryType["DISCOUNT"] = "DISCOUNT";
    LedgerEntryType["PAYMENT"] = "PAYMENT";
    LedgerEntryType["VOID"] = "VOID";
})(LedgerEntryType || (exports.LedgerEntryType = LedgerEntryType = {}));
var LedgerReferenceType;
(function (LedgerReferenceType) {
    LedgerReferenceType["TUITION_PLAN"] = "tuition_plan";
    LedgerReferenceType["PAYMENT"] = "payment";
})(LedgerReferenceType || (exports.LedgerReferenceType = LedgerReferenceType = {}));
let LedgerEntry = class LedgerEntry {
};
exports.LedgerEntry = LedgerEntry;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LedgerEntry.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => school_entity_1.School),
    (0, typeorm_1.JoinColumn)({ name: 'school_id' }),
    __metadata("design:type", school_entity_1.School)
], LedgerEntry.prototype, "school", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'school_id' }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "schoolId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => student_entity_1.Student),
    (0, typeorm_1.JoinColumn)({ name: 'student_id' }),
    __metadata("design:type", student_entity_1.Student)
], LedgerEntry.prototype, "student", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'student_id' }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "studentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tuition_plan_entity_1.TuitionPlan, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'tuition_plan_id' }),
    __metadata("design:type", Object)
], LedgerEntry.prototype, "tuitionPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tuition_plan_id', nullable: true }),
    __metadata("design:type", Object)
], LedgerEntry.prototype, "tuitionPlanId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'entry_type', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "entryType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 14, scale: 0 }),
    __metadata("design:type", Number)
], LedgerEntry.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reference_type', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "referenceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reference_id' }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "referenceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'performed_by' }),
    __metadata("design:type", Object)
], LedgerEntry.prototype, "performedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'performed_by', nullable: true }),
    __metadata("design:type", Object)
], LedgerEntry.prototype, "performedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], LedgerEntry.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], LedgerEntry.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], LedgerEntry.prototype, "createdAt", void 0);
exports.LedgerEntry = LedgerEntry = __decorate([
    (0, typeorm_1.Entity)('financial_ledger')
], LedgerEntry);
//# sourceMappingURL=ledger-entry.entity.js.map