import { BadRequestException } from '@nestjs/common';
import { InstallmentStatus } from '../entities/installment.entity';

/**
 * Installment State Machine
 * --------------------------
 * This used to live inside a Postgres trigger (`sync_installment_status`)
 * that recomputed status from paid_amount/due_date on every write, with no
 * concept of "is this transition even allowed". That meant a CANCELLED or
 * DISPUTED installment (statuses we didn't have, but needed) could never be
 * modeled, and nothing stopped a PAID installment from silently flipping
 * back to PENDING if paid_amount ever got zeroed out by a bug.
 *
 * Rules encoded here:
 *  - Legal transitions are explicit (see TRANSITIONS below).
 *  - Terminal states (PAID, CANCELLED) cannot transition automatically —
 *    only an explicit authorized action can move out of them.
 *  - Automatic transitions (derived from paid_amount vs due_date) only
 *    happen from "live" states: PENDING, PARTIAL, OVERDUE.
 *  - DEFERRED/DISPUTED are manual-only states a staff member puts an
 *    installment into; the automatic derivation never assigns them and
 *    never moves *out* of them on its own — a human has to resolve it.
 */

const TRANSITIONS: Record<InstallmentStatus, InstallmentStatus[]> = {
  [InstallmentStatus.PENDING]: [
    InstallmentStatus.PARTIAL,
    InstallmentStatus.PAID,
    InstallmentStatus.OVERDUE,
    InstallmentStatus.CANCELLED,
    InstallmentStatus.DEFERRED,
    InstallmentStatus.DISPUTED,
  ],
  [InstallmentStatus.OVERDUE]: [
    InstallmentStatus.PARTIAL,
    InstallmentStatus.PAID,
    InstallmentStatus.CANCELLED,
    InstallmentStatus.DEFERRED,
    InstallmentStatus.DISPUTED,
  ],
  [InstallmentStatus.PARTIAL]: [
    InstallmentStatus.PAID,
    InstallmentStatus.OVERDUE,
    InstallmentStatus.CANCELLED,
    InstallmentStatus.DEFERRED,
    InstallmentStatus.DISPUTED,
  ],
  [InstallmentStatus.DEFERRED]: [
    InstallmentStatus.PENDING,
    InstallmentStatus.PARTIAL,
    InstallmentStatus.PAID,
    InstallmentStatus.CANCELLED,
  ],
  [InstallmentStatus.DISPUTED]: [
    InstallmentStatus.PENDING,
    InstallmentStatus.PARTIAL,
    InstallmentStatus.PAID,
    InstallmentStatus.CANCELLED,
  ],
  [InstallmentStatus.PAID]: [
    // Only a void of the payment that made it PAID can pull it back —
    // PaymentsService.void() calls this explicitly, it's not automatic.
    InstallmentStatus.PARTIAL,
    InstallmentStatus.PENDING,
  ],
  [InstallmentStatus.CANCELLED]: [], // terminal
};

export class InstallmentStateMachine {
  static assertTransition(
    from: InstallmentStatus,
    to: InstallmentStatus,
  ): void {
    if (from === to) return; // no-op transitions are always fine
    const allowed = TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `انتقال وضعیت از «${from}» به «${to}» مجاز نیست`,
      );
    }
  }

  /**
   * Derives the "natural" status from money/dates alone — this is the
   * automatic part that used to be the DB trigger. Only ever called from
   * a live state (see class comment); manual states are left alone by
   * callers before this is invoked.
   */
  static deriveFromAmounts(
    paidAmount: number,
    totalAmount: number,
    dueDate: string,
  ): InstallmentStatus.PENDING | InstallmentStatus.PARTIAL | InstallmentStatus.PAID | InstallmentStatus.OVERDUE {
    if (paidAmount >= totalAmount) return InstallmentStatus.PAID;
    if (paidAmount > 0) return InstallmentStatus.PARTIAL;
    const isPastDue = new Date(dueDate) < new Date(new Date().toDateString());
    return isPastDue ? InstallmentStatus.OVERDUE : InstallmentStatus.PENDING;
  }

  static isLiveState(status: InstallmentStatus): boolean {
    return [
      InstallmentStatus.PENDING,
      InstallmentStatus.PARTIAL,
      InstallmentStatus.OVERDUE,
    ].includes(status);
  }
}
