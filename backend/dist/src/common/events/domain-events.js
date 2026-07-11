"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallmentStatusChangedEvent = exports.InstallmentUpdatedEvent = exports.PaymentVoidedEvent = exports.PaymentRecordedEvent = exports.InstallmentsGeneratedEvent = exports.TuitionPlanUpdatedEvent = exports.TuitionPlanCreatedEvent = exports.DOMAIN_EVENTS = void 0;
exports.DOMAIN_EVENTS = {
    TUITION_PLAN_CREATED: 'tuition-plan.created',
    TUITION_PLAN_UPDATED: 'tuition-plan.updated',
    INSTALLMENTS_GENERATED: 'installments.generated',
    INSTALLMENT_UPDATED: 'installment.updated',
    PAYMENT_RECORDED: 'payment.recorded',
    PAYMENT_VOIDED: 'payment.voided',
    INSTALLMENT_STATUS_CHANGED: 'installment.status-changed',
};
class TuitionPlanCreatedEvent {
    constructor(schoolId, studentId, tuitionPlanId, baseAmount, discountAmount, finalAmount, performedBy) {
        this.schoolId = schoolId;
        this.studentId = studentId;
        this.tuitionPlanId = tuitionPlanId;
        this.baseAmount = baseAmount;
        this.discountAmount = discountAmount;
        this.finalAmount = finalAmount;
        this.performedBy = performedBy;
    }
}
exports.TuitionPlanCreatedEvent = TuitionPlanCreatedEvent;
class TuitionPlanUpdatedEvent {
    constructor(schoolId, studentId, tuitionPlanId, oldValue, newValue, performedBy) {
        this.schoolId = schoolId;
        this.studentId = studentId;
        this.tuitionPlanId = tuitionPlanId;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.performedBy = performedBy;
    }
}
exports.TuitionPlanUpdatedEvent = TuitionPlanUpdatedEvent;
class InstallmentsGeneratedEvent {
    constructor(schoolId, studentId, tuitionPlanId, installmentIds) {
        this.schoolId = schoolId;
        this.studentId = studentId;
        this.tuitionPlanId = tuitionPlanId;
        this.installmentIds = installmentIds;
    }
}
exports.InstallmentsGeneratedEvent = InstallmentsGeneratedEvent;
class PaymentRecordedEvent {
    constructor(schoolId, studentId, installmentId, paymentId, amount, remainingAfter, performedBy, wasIdempotentReplay) {
        this.schoolId = schoolId;
        this.studentId = studentId;
        this.installmentId = installmentId;
        this.paymentId = paymentId;
        this.amount = amount;
        this.remainingAfter = remainingAfter;
        this.performedBy = performedBy;
        this.wasIdempotentReplay = wasIdempotentReplay;
    }
}
exports.PaymentRecordedEvent = PaymentRecordedEvent;
class PaymentVoidedEvent {
    constructor(schoolId, studentId, installmentId, paymentId, amount, reason, performedBy) {
        this.schoolId = schoolId;
        this.studentId = studentId;
        this.installmentId = installmentId;
        this.paymentId = paymentId;
        this.amount = amount;
        this.reason = reason;
        this.performedBy = performedBy;
    }
}
exports.PaymentVoidedEvent = PaymentVoidedEvent;
class InstallmentUpdatedEvent {
    constructor(schoolId, studentId, installmentId, oldValue, newValue, performedBy) {
        this.schoolId = schoolId;
        this.studentId = studentId;
        this.installmentId = installmentId;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.performedBy = performedBy;
    }
}
exports.InstallmentUpdatedEvent = InstallmentUpdatedEvent;
class InstallmentStatusChangedEvent {
    constructor(schoolId, studentId, installmentId, fromStatus, toStatus, performedBy) {
        this.schoolId = schoolId;
        this.studentId = studentId;
        this.installmentId = installmentId;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.performedBy = performedBy;
    }
}
exports.InstallmentStatusChangedEvent = InstallmentStatusChangedEvent;
//# sourceMappingURL=domain-events.js.map