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
exports.AuditEventsListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const audit_service_1 = require("./audit.service");
const audit_log_entity_1 = require("./audit-log.entity");
const domain_events_1 = require("../events/domain-events");
let AuditEventsListener = class AuditEventsListener {
    constructor(audit) {
        this.audit = audit;
    }
    async onTuitionPlanCreated(event) {
        await this.audit.record({
            schoolId: event.schoolId,
            userId: event.performedBy,
            action: audit_log_entity_1.AuditAction.CREATE_TUITION_PLAN,
            entityType: 'tuition_plan',
            entityId: event.tuitionPlanId,
            newValue: {
                studentId: event.studentId,
                baseAmount: event.baseAmount,
                discountAmount: event.discountAmount,
                finalAmount: event.finalAmount,
            },
        });
        if (event.discountAmount > 0) {
            await this.audit.record({
                schoolId: event.schoolId,
                userId: event.performedBy,
                action: audit_log_entity_1.AuditAction.DISCOUNT_APPLIED,
                entityType: 'tuition_plan',
                entityId: event.tuitionPlanId,
                newValue: { discountAmount: event.discountAmount },
            });
        }
    }
    async onTuitionPlanUpdated(event) {
        await this.audit.record({
            schoolId: event.schoolId,
            userId: event.performedBy,
            action: audit_log_entity_1.AuditAction.UPDATE_TUITION_PLAN,
            entityType: 'tuition_plan',
            entityId: event.tuitionPlanId,
            oldValue: event.oldValue,
            newValue: event.newValue,
        });
    }
    async onInstallmentsGenerated(event) {
        for (const installmentId of event.installmentIds) {
            await this.audit.record({
                schoolId: event.schoolId,
                userId: null,
                action: audit_log_entity_1.AuditAction.CREATE_INSTALLMENT,
                entityType: 'installment',
                entityId: installmentId,
                newValue: { tuitionPlanId: event.tuitionPlanId },
            });
        }
    }
    async onInstallmentUpdated(event) {
        await this.audit.record({
            schoolId: event.schoolId,
            userId: event.performedBy,
            action: audit_log_entity_1.AuditAction.UPDATE_INSTALLMENT,
            entityType: 'installment',
            entityId: event.installmentId,
            oldValue: event.oldValue,
            newValue: event.newValue,
        });
    }
    async onPaymentRecorded(event) {
        if (event.wasIdempotentReplay)
            return;
        await this.audit.record({
            schoolId: event.schoolId,
            userId: event.performedBy,
            action: audit_log_entity_1.AuditAction.CREATE_PAYMENT,
            entityType: 'payment',
            entityId: event.paymentId,
            newValue: {
                installmentId: event.installmentId,
                amount: event.amount,
                remainingAfter: event.remainingAfter,
            },
        });
    }
    async onPaymentVoided(event) {
        await this.audit.record({
            schoolId: event.schoolId,
            userId: event.performedBy,
            action: audit_log_entity_1.AuditAction.VOID_PAYMENT,
            entityType: 'payment',
            entityId: event.paymentId,
            oldValue: { amount: event.amount },
            newValue: { reason: event.reason },
        });
    }
    async onInstallmentStatusChanged(event) {
        await this.audit.record({
            schoolId: event.schoolId || null,
            userId: event.performedBy,
            action: audit_log_entity_1.AuditAction.UPDATE_INSTALLMENT,
            entityType: 'installment',
            entityId: event.installmentId,
            oldValue: { status: event.fromStatus },
            newValue: { status: event.toStatus },
        });
    }
};
exports.AuditEventsListener = AuditEventsListener;
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.DOMAIN_EVENTS.TUITION_PLAN_CREATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [domain_events_1.TuitionPlanCreatedEvent]),
    __metadata("design:returntype", Promise)
], AuditEventsListener.prototype, "onTuitionPlanCreated", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.DOMAIN_EVENTS.TUITION_PLAN_UPDATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [domain_events_1.TuitionPlanUpdatedEvent]),
    __metadata("design:returntype", Promise)
], AuditEventsListener.prototype, "onTuitionPlanUpdated", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.DOMAIN_EVENTS.INSTALLMENTS_GENERATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [domain_events_1.InstallmentsGeneratedEvent]),
    __metadata("design:returntype", Promise)
], AuditEventsListener.prototype, "onInstallmentsGenerated", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.DOMAIN_EVENTS.INSTALLMENT_UPDATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [domain_events_1.InstallmentUpdatedEvent]),
    __metadata("design:returntype", Promise)
], AuditEventsListener.prototype, "onInstallmentUpdated", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.DOMAIN_EVENTS.PAYMENT_RECORDED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [domain_events_1.PaymentRecordedEvent]),
    __metadata("design:returntype", Promise)
], AuditEventsListener.prototype, "onPaymentRecorded", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.DOMAIN_EVENTS.PAYMENT_VOIDED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [domain_events_1.PaymentVoidedEvent]),
    __metadata("design:returntype", Promise)
], AuditEventsListener.prototype, "onPaymentVoided", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [domain_events_1.InstallmentStatusChangedEvent]),
    __metadata("design:returntype", Promise)
], AuditEventsListener.prototype, "onInstallmentStatusChanged", null);
exports.AuditEventsListener = AuditEventsListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_service_1.AuditService])
], AuditEventsListener);
//# sourceMappingURL=audit-events.listener.js.map