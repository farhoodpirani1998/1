/**
 * Domain Events
 * -------------
 * Plain classes carrying "something happened" — emitted via
 * @nestjs/event-emitter's EventEmitter2 *after* the DB transaction that
 * caused them has committed. Listeners (Notifications, future Reporting
 * cache invalidation, webhooks, etc.) subscribe to these instead of being
 * called directly from PaymentsService/TuitionPlansService.
 *
 * Why this matters: today, if you want "send SMS when a payment is
 * recorded", the only way is to import NotificationsService straight into
 * PaymentsService and call it inline — coupling a financial write to a
 * messaging side-effect, in the same try/catch, sharing failure modes.
 * With events, PaymentsService doesn't know Notifications exists at all.
 *
 * Event name constants live next to each class so listeners and emitters
 * both import from one place instead of hardcoding strings.
 */

export const DOMAIN_EVENTS = {
  TUITION_PLAN_CREATED: 'tuition-plan.created',
  TUITION_PLAN_UPDATED: 'tuition-plan.updated',
  INSTALLMENTS_GENERATED: 'installments.generated',
  INSTALLMENT_UPDATED: 'installment.updated',
  PAYMENT_RECORDED: 'payment.recorded',
  PAYMENT_VOIDED: 'payment.voided',
  INSTALLMENT_STATUS_CHANGED: 'installment.status-changed',
} as const;

export class TuitionPlanCreatedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly tuitionPlanId: string,
    public readonly baseAmount: number,
    public readonly discountAmount: number,
    public readonly finalAmount: number,
    public readonly performedBy: string,
  ) {}
}

/**
 * Emitted by TuitionPlansService.update() — the only field-level edits a
 * plan supports today are discountAmount/discountReason (before any
 * installment exists). oldValue/newValue carry just those two fields, so
 * the audit trail shows exactly what changed, not a full-entity dump.
 */
export class TuitionPlanUpdatedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly tuitionPlanId: string,
    public readonly oldValue: { discountAmount: number; discountReason: string | null },
    public readonly newValue: { discountAmount: number; discountReason: string | null },
    public readonly performedBy: string,
  ) {}
}

export class InstallmentsGeneratedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly tuitionPlanId: string,
    public readonly installmentIds: string[],
  ) {}
}

export class PaymentRecordedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly installmentId: string,
    public readonly paymentId: string,
    public readonly amount: number,
    public readonly remainingAfter: number,
    public readonly performedBy: string,
    public readonly wasIdempotentReplay: boolean,
  ) {}
}

export class PaymentVoidedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly installmentId: string,
    public readonly paymentId: string,
    public readonly amount: number,
    public readonly reason: string,
    public readonly performedBy: string,
  ) {}
}

/**
 * Emitted by InstallmentsService.update() — the due_date/amount edit path,
 * distinct from INSTALLMENT_STATUS_CHANGED which covers status
 * transitions only. Only the fields that actually changed are meaningful
 * to compare; oldValue/newValue always carry both fields for a simple,
 * consistent audit shape even if only one changed.
 */
export class InstallmentUpdatedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly installmentId: string,
    public readonly oldValue: { dueDate: string; amount: number },
    public readonly newValue: { dueDate: string; amount: number },
    public readonly performedBy: string,
  ) {}
}

export class InstallmentStatusChangedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly installmentId: string,
    public readonly fromStatus: string,
    public readonly toStatus: string,
    public readonly performedBy: string | null, // null when the scheduler/cron did it
  ) {}
}
