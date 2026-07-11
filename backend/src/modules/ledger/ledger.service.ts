import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  LedgerEntry,
  LedgerEntryType,
  LedgerReferenceType,
} from './entities/ledger-entry.entity';

/**
 * LedgerService
 * -------------
 * The only place that writes to `financial_ledger`. Every method takes the
 * `manager` of an already-open transaction (from PaymentsService /
 * TuitionPlansService) so the ledger row commits atomically with the
 * business row that caused it — a payment and its ledger entry either both
 * exist or neither does.
 *
 * No update/delete methods exist here on purpose, and the DB trigger
 * (trg_forbid_ledger_update) backs that up even against a future bug.
 */
@Injectable()
export class LedgerService {
  async recordCharge(
    manager: EntityManager,
    params: {
      schoolId: string;
      studentId: string;
      tuitionPlanId: string;
      baseAmount: number;
      discountAmount: number;
      performedBy: string;
    },
  ): Promise<void> {
    const entries: Partial<LedgerEntry>[] = [
      {
        schoolId: params.schoolId,
        studentId: params.studentId,
        tuitionPlanId: params.tuitionPlanId,
        entryType: LedgerEntryType.CHARGE,
        amount: params.baseAmount,
        referenceType: LedgerReferenceType.TUITION_PLAN,
        referenceId: params.tuitionPlanId,
        performedById: params.performedBy,
      },
    ];

    if (params.discountAmount > 0) {
      entries.push({
        schoolId: params.schoolId,
        studentId: params.studentId,
        tuitionPlanId: params.tuitionPlanId,
        entryType: LedgerEntryType.DISCOUNT,
        amount: -params.discountAmount,
        referenceType: LedgerReferenceType.TUITION_PLAN,
        referenceId: params.tuitionPlanId,
        performedById: params.performedBy,
      });
    }

    await manager.getRepository(LedgerEntry).insert(entries as any);
  }

  /**
   * Books a later correction to a plan's discount (e.g. an admin edits the
   * discount before installments are generated). `deltaDiscount` is signed:
   * positive means the discount grew (student owes less), negative means
   * it shrank (student owes more). The original create()-time entries are
   * never touched — this is always a new row.
   */
  async recordDiscountAdjustment(
    manager: EntityManager,
    params: {
      schoolId: string;
      studentId: string;
      tuitionPlanId: string;
      deltaDiscount: number;
      performedBy: string;
      reason?: string;
    },
  ): Promise<void> {
    if (params.deltaDiscount === 0) return;
    await manager.getRepository(LedgerEntry).insert({
      schoolId: params.schoolId,
      studentId: params.studentId,
      tuitionPlanId: params.tuitionPlanId,
      entryType: LedgerEntryType.DISCOUNT,
      amount: -params.deltaDiscount, // grew discount → negative (owes less)
      referenceType: LedgerReferenceType.TUITION_PLAN,
      referenceId: params.tuitionPlanId,
      performedById: params.performedBy,
      reason: params.reason ?? null,
    });
  }

  async recordPayment(
    manager: EntityManager,
    params: {
      schoolId: string;
      studentId: string;
      tuitionPlanId: string | null;
      paymentId: string;
      amount: number;
      performedBy: string;
    },
  ): Promise<void> {
    await manager.getRepository(LedgerEntry).insert({
      schoolId: params.schoolId,
      studentId: params.studentId,
      tuitionPlanId: params.tuitionPlanId,
      entryType: LedgerEntryType.PAYMENT,
      amount: -params.amount,
      referenceType: LedgerReferenceType.PAYMENT,
      referenceId: params.paymentId,
      performedById: params.performedBy,
    });
  }

  async recordVoid(
    manager: EntityManager,
    params: {
      schoolId: string;
      studentId: string;
      tuitionPlanId: string | null;
      paymentId: string;
      amount: number;
      reason: string;
      performedBy: string;
    },
  ): Promise<void> {
    await manager.getRepository(LedgerEntry).insert({
      schoolId: params.schoolId,
      studentId: params.studentId,
      tuitionPlanId: params.tuitionPlanId,
      entryType: LedgerEntryType.VOID,
      amount: params.amount,
      referenceType: LedgerReferenceType.PAYMENT,
      referenceId: params.paymentId,
      performedById: params.performedBy,
      reason: params.reason,
    });
  }

  /** Current outstanding balance for one student: sum of all ledger rows. */
  async studentBalance(manager: EntityManager, studentId: string): Promise<number> {
    const raw = await manager
      .getRepository(LedgerEntry)
      .createQueryBuilder('l')
      .where('l.studentId = :studentId', { studentId })
      .select('COALESCE(SUM(l.amount), 0)', 'balance')
      .getRawOne<{ balance: string }>();
    return Number(raw?.balance ?? 0);
  }
}
