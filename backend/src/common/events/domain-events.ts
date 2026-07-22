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
  INSTALLMENT_WRITTEN_OFF: 'installment.written-off',
  INSTALLMENT_ADDED: 'installment.added',
  INSTALLMENT_REMOVED: 'installment.removed',
  INSTALLMENTS_RENEGOTIATED: 'installments.renegotiated',
  // Sprint 2 — Feature 2B: emitted once, at the moment an account
  // transitions into a lock (not on every failed attempt) -- see
  // AuthService.login.
  ACCOUNT_LOCKED: 'account.locked',
  // Sprint 2 — Feature 3A: security/user-management coverage.
  LOGIN_SUCCEEDED: 'auth.login-succeeded',
  PASSWORD_CHANGED: 'auth.password-changed',
  PASSWORD_RESET: 'auth.password-reset',
  USER_CREATED: 'user.created',
  USER_STATUS_CHANGED: 'user.status-changed',
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

/**
 * Emitted by InstallmentsService.writeOff() in addition to
 * INSTALLMENT_STATUS_CHANGED — carries the forgiven amount and reason,
 * which the generic status-changed event doesn't have room for and which
 * notifications/reporting listeners specifically care about here.
 */
export class InstallmentWrittenOffEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly tuitionPlanId: string,
    public readonly installmentId: string,
    public readonly amountWrittenOff: number,
    public readonly reason: string,
    public readonly performedBy: string,
  ) {}
}

export class InstallmentAddedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly tuitionPlanId: string,
    public readonly installmentId: string,
    public readonly amount: number,
    public readonly dueDate: string,
    public readonly performedBy: string,
  ) {}
}

export class InstallmentRemovedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly tuitionPlanId: string,
    public readonly installmentId: string,
    public readonly amount: number,
    public readonly reason: string,
    public readonly performedBy: string,
  ) {}
}

/**
 * Emitted once per renegotiate() call — cancelledInstallmentIds are the
 * unpaid installments that were replaced, newInstallmentIds are what
 * replaced them. Both ids lists so a listener can reconcile the swap
 * without re-querying.
 */
export class InstallmentsRenegotiatedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly studentId: string,
    public readonly tuitionPlanId: string,
    public readonly cancelledInstallmentIds: string[],
    public readonly newInstallmentIds: string[],
    public readonly performedBy: string,
  ) {}
}

/**
 * Emitted by AuthService.login() exactly once, on the attempt that pushes
 * failedLoginAttempts to the configured threshold and sets lockedUntil --
 * not on every failed attempt while already locked, and not on attempts
 * before the threshold is reached. schoolId is whatever the account's own
 * schoolId is (null for super_admin/founder, same as everywhere else this
 * shape appears); there is no "performedBy" since the actor here is
 * whoever supplied the bad password, not an authenticated user.
 */
export class AccountLockedEvent {
  constructor(
    public readonly userId: string,
    public readonly schoolId: string | null,
    public readonly lockedUntil: Date,
  ) {}
}

/**
 * Sprint 2 — Feature 3A: emitted by AuthService.login() once the password
 * check, lock check, and school-active check have all passed -- i.e. the
 * same point a token is about to be issued. identifierType records which
 * field the request logged in with (LoginDto only allows one of
 * phone/username per attempt, enforced earlier in login()), so the audit
 * row can show what kind of login this was without storing the actual
 * phone/username value itself.
 */
export class LoginSucceededEvent {
  constructor(
    public readonly userId: string,
    public readonly schoolId: string | null,
    public readonly identifierType: 'phone' | 'username',
  ) {}
}

/**
 * Sprint 2 — Feature 3A: emitted by AuthService.changePassword() after the
 * new passwordHash has been saved. No password/passwordHash on this event
 * on purpose -- only the fact that a change happened is audit-worthy, not
 * any credential material.
 */
export class PasswordChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly schoolId: string | null,
  ) {}
}

/**
 * Sprint 2 — Feature 3A: emitted by AuthService.resetPassword() after the
 * new passwordHash has been saved and the reset code cleared. Same
 * no-credential-material rule as PasswordChangedEvent.
 */
export class PasswordResetEvent {
  constructor(
    public readonly userId: string,
    public readonly schoolId: string | null,
  ) {}
}

/**
 * Sprint 2 — Feature 3A: emitted by AuthService.register() after the new
 * User row is saved. userId/schoolId only -- no fullName/phone/role, so
 * this event carries no PII beyond what AuditLog already keys audit rows
 * on for every other entity.
 */
export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly schoolId: string | null,
  ) {}
}

/**
 * Sprint 2 — Feature 3A: emitted by UsersService.update() only on the
 * branch that actually flips isActive (same branch that bumps
 * tokenVersion) -- editing just fullName/phone does not emit this.
 * oldStatus/newStatus are the isActive booleans, not free-text status
 * strings, matching what UpdateUserDto/the User entity actually store.
 */
export class UserStatusChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly schoolId: string | null,
    public readonly oldStatus: boolean,
    public readonly newStatus: boolean,
  ) {}
}

