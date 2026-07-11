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
exports.Installment = exports.InstallmentStatus = void 0;
const typeorm_1 = require("typeorm");
const tuition_plan_entity_1 = require("./tuition-plan.entity");
const payment_entity_1 = require("./payment.entity");
var InstallmentStatus;
(function (InstallmentStatus) {
    InstallmentStatus["PENDING"] = "pending";
    InstallmentStatus["PAID"] = "paid";
    InstallmentStatus["OVERDUE"] = "overdue";
    InstallmentStatus["PARTIAL"] = "partial";
    InstallmentStatus["CANCELLED"] = "cancelled";
    InstallmentStatus["DEFERRED"] = "deferred";
    InstallmentStatus["DISPUTED"] = "disputed";
})(InstallmentStatus || (exports.InstallmentStatus = InstallmentStatus = {}));
let Installment = class Installment {
};
exports.Installment = Installment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Installment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tuition_plan_entity_1.TuitionPlan, (plan) => plan.installments, {
        nullable: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'tuition_plan_id' }),
    __metadata("design:type", tuition_plan_entity_1.TuitionPlan)
], Installment.prototype, "tuitionPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tuition_plan_id' }),
    __metadata("design:type", String)
], Installment.prototype, "tuitionPlanId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'installment_number', type: 'int' }),
    __metadata("design:type", Number)
], Installment.prototype, "installmentNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 14, scale: 0 }),
    __metadata("design:type", Number)
], Installment.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'due_date', type: 'date' }),
    __metadata("design:type", String)
], Installment.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: InstallmentStatus.PENDING,
    }),
    __metadata("design:type", String)
], Installment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'paid_amount',
        type: 'numeric',
        precision: 14,
        scale: 0,
        default: 0,
    }),
    __metadata("design:type", Number)
], Installment.prototype, "paidAmount", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => payment_entity_1.Payment, (payment) => payment.installment),
    __metadata("design:type", Array)
], Installment.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Installment.prototype, "createdAt", void 0);
exports.Installment = Installment = __decorate([
    (0, typeorm_1.Entity)('installments')
], Installment);
//# sourceMappingURL=installment.entity.js.map