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
  AccountLockedEvent,
  InstallmentAddedEvent,
  InstallmentRemovedEvent,
  InstallmentWrittenOffEvent,
  InstallmentsRenegotiatedEvent,
  LoginSucceededEvent,
  PasswordChangedEvent,
  PasswordResetEvent,
  UserCreatedEvent,
  UserStatusChangedEvent,
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

  // Sprint 2 — Feature 3A: gap-fill -- InstallmentsService.addOne() has
  // emitted this event since it was added, but no listener consumed it
  // until now, so manual installment additions had no audit row at all.
  @OnEvent(DOMAIN_EVENTS.INSTALLMENT_ADDED)
  async onInstallmentAdded(event: InstallmentAddedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.performedBy,
      action: AuditAction.INSTALLMENT_ADDED,
      entityType: 'installment',
      entityId: event.installmentId,
      newValue: { tuitionPlanId: event.tuitionPlanId, amount: event.amount, dueDate: event.dueDate },
    });
  }

  // Sprint 2 — Feature 3A: gap-fill -- this is the only audit row a manual
  // installment removal gets. InstallmentsService.remove() hard-deletes
  // the row (no accompanying INSTALLMENT_STATUS_CHANGED), so without this
  // handler the row's removal left no trace anywhere.
  @OnEvent(DOMAIN_EVENTS.INSTALLMENT_REMOVED)
  async onInstallmentRemoved(event: InstallmentRemovedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.performedBy,
      action: AuditAction.INSTALLMENT_REMOVED,
      entityType: 'installment',
      entityId: event.installmentId,
      oldValue: { tuitionPlanId: event.tuitionPlanId, amount: event.amount },
      newValue: { reason: event.reason },
    });
  }

  // Sprint 2 — Feature 3A: gap-fill -- INSTALLMENT_STATUS_CHANGED already
  // records the generic pending->written_off transition, but not the
  // forgiven amount/reason this event carries, so it gets its own row
  // alongside that one (same "one domain event, one audit row" rule as
  // every other handler in this file).
  @OnEvent(DOMAIN_EVENTS.INSTALLMENT_WRITTEN_OFF)
  async onInstallmentWrittenOff(event: InstallmentWrittenOffEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.performedBy,
      action: AuditAction.INSTALLMENT_WRITTEN_OFF,
      entityType: 'installment',
      entityId: event.installmentId,
      newValue: { amountWrittenOff: event.amountWrittenOff, reason: event.reason },
    });
  }

  // Sprint 2 — Feature 3A: gap-fill -- one row per renegotiate() call,
  // carrying both id lists so the swap can be reconstructed without
  // re-querying installments that may since have changed again.
  @OnEvent(DOMAIN_EVENTS.INSTALLMENTS_RENEGOTIATED)
  async onInstallmentsRenegotiated(event: InstallmentsRenegotiatedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.performedBy,
      action: AuditAction.INSTALLMENTS_RENEGOTIATED,
      entityType: 'tuition_plan',
      entityId: event.tuitionPlanId,
      oldValue: { cancelledInstallmentIds: event.cancelledInstallmentIds },
      newValue: { newInstallmentIds: event.newInstallmentIds },
    });
  }

  // Sprint 2 — Feature 2B: one row per lock transition (AuthService only
  // emits this event once, at the moment the lock is set — see
  // domain-events.ts). userId is the locked account itself; there is no
  // separate "performed by" actor for a brute-force lockout.
  @OnEvent(DOMAIN_EVENTS.ACCOUNT_LOCKED)
  async onAccountLocked(event: AccountLockedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.userId,
      action: AuditAction.ACCOUNT_LOCKED,
      entityType: 'user',
      entityId: event.userId,
      newValue: { lockedUntil: event.lockedUntil.toISOString() },
    });
  }

  // Sprint 2 — Feature 3A: emitted once per successful login. Deliberately
  // records only identifierType, never the actual phone/username value or
  // any credential material -- see LoginSucceededEvent. Ordinary failed
  // attempts are never audited (only ACCOUNT_LOCKED above is), so this
  // handler is the only login-related row besides that one.
  @OnEvent(DOMAIN_EVENTS.LOGIN_SUCCEEDED)
  async onLoginSucceeded(event: LoginSucceededEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.userId,
      action: AuditAction.LOGIN_SUCCEEDED,
      entityType: 'user',
      entityId: event.userId,
      newValue: { identifierType: event.identifierType },
    });
  }

  // Sprint 2 — Feature 3A: self-service password change (AuthService.
  // changePassword). No passwordHash/password on the event, so there is
  // nothing sensitive to accidentally record here.
  @OnEvent(DOMAIN_EVENTS.PASSWORD_CHANGED)
  async onPasswordChanged(event: PasswordChangedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.userId,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'user',
      entityId: event.userId,
    });
  }

  // Sprint 2 — Feature 3A: forgot-password-flow reset (AuthService.
  // resetPassword), distinct from PASSWORD_CHANGED's self-service path so
  // the audit trail can tell the two apart. Same no-credential-material
  // rule as above.
  @OnEvent(DOMAIN_EVENTS.PASSWORD_RESET)
  async onPasswordReset(event: PasswordResetEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.userId,
      action: AuditAction.PASSWORD_RESET,
      entityType: 'user',
      entityId: event.userId,
    });
  }

  // Sprint 2 — Feature 3A: emitted by AuthService.register(). userId/
  // schoolId only -- no fullName/phone/role, same reasoning as
  // UserCreatedEvent's own comment.
  @OnEvent(DOMAIN_EVENTS.USER_CREATED)
  async onUserCreated(event: UserCreatedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.userId,
      action: AuditAction.USER_CREATED,
      entityType: 'user',
      entityId: event.userId,
    });
  }

  // Sprint 2 — Feature 3A: emitted by UsersService.update() only on the
  // isActive-toggling branch (activate/deactivate another user).
  @OnEvent(DOMAIN_EVENTS.USER_STATUS_CHANGED)
  async onUserStatusChanged(event: UserStatusChangedEvent) {
    await this.audit.record({
      schoolId: event.schoolId,
      userId: event.userId,
      action: AuditAction.USER_STATUS_CHANGED,
      entityType: 'user',
      entityId: event.userId,
      oldValue: { isActive: event.oldStatus },
      newValue: { isActive: event.newStatus },
    });
  }
}
