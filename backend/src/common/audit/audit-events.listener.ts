import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from './audit.service';
import { AuditAction } from './audit-log.entity';
import {
  DOMAIN_EVENTS,
  TuitionPlanCreatedEvent,
  TuitionPlanUpdatedEvent,
  InstallmentsGeneratedEvent,
  InstallmentUpdatedEvent,
  PaymentRecordedEvent,
  PaymentVoidedEvent,
  InstallmentStatusChangedEvent,
} from '../events/domain-events';

/**
 * Same pattern as NotificationsModule's PaymentEventsListener: reacts to
 * domain events emitted *after* the causing transaction has committed, so
 * PaymentsService / TuitionPlansService / InstallmentsService never need
 * to import AuditService directly. This is why Phase 1's audit
 * requirement could be added without touching any of those existing,
 * already-working files.
 *
 * TuitionPlansService.update() and InstallmentsService.update() now emit
 * TUITION_PLAN_UPDATED / INSTALLMENT_UPDATED (added alongside this
 * listener's handlers below), so manual edits to a plan's discount and to
 * an installment's due_date/amount are audited the same way as every
 * other financial action.
 */
@Injectable()
export class AuditEventsListener {
  constructor(private readonly audit: AuditService) {}

  @OnEvent(DOMAIN_EVENTS.TUITION_PLAN_CREATED)
  async onTuitionPlanCreated(event: TuitionPlanCreatedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.performedBy,
      action: AuditAction.CREATE_TUITION_PLAN,
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
        action: AuditAction.DISCOUNT_APPLIED,
        entityType: 'tuition_plan',
        entityId: event.tuitionPlanId,
        newValue: { discountAmount: event.discountAmount },
      });
    }
  }

  @OnEvent(DOMAIN_EVENTS.TUITION_PLAN_UPDATED)
  async onTuitionPlanUpdated(event: TuitionPlanUpdatedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.performedBy,
      action: AuditAction.UPDATE_TUITION_PLAN,
      entityType: 'tuition_plan',
      entityId: event.tuitionPlanId,
      oldValue: event.oldValue,
      newValue: event.newValue,
    });
  }

  @OnEvent(DOMAIN_EVENTS.INSTALLMENTS_GENERATED)
  async onInstallmentsGenerated(event: InstallmentsGeneratedEvent) {
    for (const installmentId of event.installmentIds) {
      await this.audit.record({
        schoolId: event.schoolId,
        userId: null, // generation isn't attributed to a specific actor today
        action: AuditAction.CREATE_INSTALLMENT,
        entityType: 'installment',
        entityId: installmentId,
        newValue: { tuitionPlanId: event.tuitionPlanId },
      });
    }
  }

  @OnEvent(DOMAIN_EVENTS.INSTALLMENT_UPDATED)
  async onInstallmentUpdated(event: InstallmentUpdatedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.performedBy,
      action: AuditAction.UPDATE_INSTALLMENT,
      entityType: 'installment',
      entityId: event.installmentId,
      oldValue: event.oldValue,
      newValue: event.newValue,
    });
  }

  @OnEvent(DOMAIN_EVENTS.PAYMENT_RECORDED)
  async onPaymentRecorded(event: PaymentRecordedEvent) {
    if (event.wasIdempotentReplay) return; // no new fact happened — don't log twice
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.performedBy,
      action: AuditAction.CREATE_PAYMENT,
      entityType: 'payment',
      entityId: event.paymentId,
      newValue: {
        installmentId: event.installmentId,
        amount: event.amount,
        remainingAfter: event.remainingAfter,
      },
    });
  }

  @OnEvent(DOMAIN_EVENTS.PAYMENT_VOIDED)
  async onPaymentVoided(event: PaymentVoidedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.performedBy,
      action: AuditAction.VOID_PAYMENT,
      entityType: 'payment',
      entityId: event.paymentId,
      oldValue: { amount: event.amount },
      newValue: { reason: event.reason },
    });
  }

  @OnEvent(DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED)
  async onInstallmentStatusChanged(event: InstallmentStatusChangedEvent) {
    await this.audit.record({
      schoolId: event.schoolId || null, // the nightly cron emits '' — normalize to null
      userId: event.performedBy,
      action: AuditAction.UPDATE_INSTALLMENT,
      entityType: 'installment',
      entityId: event.installmentId,
      oldValue: { status: event.fromStatus },
      newValue: { status: event.toStatus },
    });
  }
}
