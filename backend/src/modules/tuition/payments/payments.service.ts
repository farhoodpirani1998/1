import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Payment } from '../entities/payment.entity';
import { Installment } from '../entities/installment.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { LedgerService } from '../../ledger/ledger.service';
import { InstallmentStateMachine } from '../state-machine/installment-state-machine';
import { gregorianToJalaliYear } from '../../../common/utils/jalali';
import { normalizePagination, PaginationParams } from '../../../common/utils/pagination';
import {
  DOMAIN_EVENTS,
  PaymentRecordedEvent,
  PaymentVoidedEvent,
  InstallmentStatusChangedEvent,
} from '../../../common/events/domain-events';

/** Postgres error code for a unique-constraint violation. */
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly ledger: LedgerService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Registers a payment against an installment.
   *
   * Transaction does five things atomically:
   *  1. Idempotency check — if `idempotencyKey` was already used *for the
   *     same logical payment* (same installment, amount, method,
   *     reference number, and paid date), return the original payment
   *     untouched (no duplicate, no error — retries are supposed to be
   *     safe). If the key was reused with *different* payment data, that
   *     is a client bug, not a retry — throws ConflictException rather
   *     than silently returning the old payment (see
   *     isSameLogicalPayment()).
   *  2. Row-locks the installment, re-validates tenant + overpayment.
   *  3. Inserts the payment row.
   *  4. Writes a PAYMENT entry to the immutable ledger.
   *  5. Runs the installment through the state machine (derives new status
   *     from the now-current paid_amount, asserts the transition is legal).
   *
   * All domain events (PaymentRecordedEvent and, if the installment's
   * status changed, InstallmentStatusChangedEvent) are collected during
   * the transaction but only emitted after it commits — listeners (e.g.
   * Notifications) never run against uncommitted state, and a
   * slow/failing SMS provider can never roll back a real payment.
   *
   * Idempotency race handling: the idempotency check above happens
   * *before* the installment row is locked, so two concurrent requests
   * carrying the *same* idempotencyKey can both pass that check and race
   * to insert — the DB's unique index (uq_payments_idempotency_key) is
   * the real backstop. If that happens, the loser's INSERT fails with a
   * Postgres unique-violation (23505), which aborts its transaction; we
   * catch that outside the transaction and re-fetch the winner's payment
   * so the loser still gets back a clean idempotent-replay result instead
   * of a 500 — again subject to the same semantic-match check.
   */
  async create(
    installmentId: string,
    dto: CreatePaymentDto,
    receivedById: string,
    schoolId: string,
  ): Promise<{ payment: Payment; installment: Installment; idempotentReplay: boolean }> {
    let result: {
      payment: Payment;
      installment: Installment;
      idempotentReplay: boolean;
      statusChangeEvent: InstallmentStatusChangedEvent | null;
    };

    try {
      result = await this.dataSource.transaction(async (manager) => {
        if (dto.idempotencyKey) {
          const existing = await manager.findOne(Payment, {
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (existing) {
            if (!this.isSameLogicalPayment(existing, installmentId, dto)) {
              // Same key, different payment — a client bug (or a key
              // collision), not a safe retry. Returning the old payment
              // here would silently substitute one payment's data for
              // another's; refusing is the correct behavior.
              throw new ConflictException(
                'این کد یکتا قبلاً برای پرداختی با اطلاعات متفاوت استفاده شده است',
              );
            }
            const installment = await manager.findOne(Installment, {
              where: { id: existing.installmentId },
            });
            return {
              payment: existing,
              installment: installment!,
              idempotentReplay: true,
              statusChangeEvent: null,
            };
          }
        }

        const installment = await manager.findOne(Installment, {
          where: { id: installmentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!installment) {
          throw new NotFoundException('قسط یافت نشد');
        }
        if (!InstallmentStateMachine.isLiveState(installment.status)) {
          throw new BadRequestException(
            `نمی‌توان برای قسطی با وضعیت «${installment.status}» پرداخت ثبت کرد`,
          );
        }

        const ownership = await manager
          .createQueryBuilder()
          .select('student.school_id', 'schoolId')
          .addSelect('student.id', 'studentId')
          .addSelect('plan.id', 'tuitionPlanId')
          .from('students', 'student')
          .innerJoin('tuition_plans', 'plan', 'plan.student_id = student.id')
          .where('plan.id = :planId', { planId: installment.tuitionPlanId })
          .getRawOne<{ schoolId: string; studentId: string; tuitionPlanId: string }>();

        if (!ownership || ownership.schoolId !== schoolId) {
          throw new ForbiddenException('این قسط متعلق به مدرسه‌ی دیگری است');
        }

        const remaining = Number(installment.amount) - Number(installment.paidAmount);
        if (dto.amount > remaining) {
          throw new BadRequestException(
            `مبلغ پرداختی از باقیمانده قسط (${remaining.toLocaleString('fa-IR')} تومان) بیشتر است`,
          );
        }

        const payment = manager.create(Payment, {
          installmentId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber ?? null,
          receivedById,
          paidAt: new Date(dto.paidAt),
          note: dto.note ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
        });
        const savedPayment = await manager.save(payment);

        // Receipt number, e.g. "1405-000001": year-scoped, per-school
        // sequence. The INSERT ... ON CONFLICT DO UPDATE is itself atomic in
        // Postgres, so two concurrent payments for the same school/year can
        // never be handed the same number — no separate row lock needed.
        const jalaliYear = gregorianToJalaliYear(new Date(dto.paidAt));
        const counterRows: Array<{ last_number: number }> = await manager.query(
          `INSERT INTO receipt_counters (school_id, jalali_year, last_number)
           VALUES ($1, $2, 1)
           ON CONFLICT (school_id, jalali_year)
           DO UPDATE SET last_number = receipt_counters.last_number + 1
           RETURNING last_number`,
          [schoolId, jalaliYear],
        );
        savedPayment.receiptNumber = `${jalaliYear}-${String(counterRows[0].last_number).padStart(6, '0')}`;
        await manager.save(savedPayment);

        await this.ledger.recordPayment(manager, {
          schoolId,
          studentId: ownership.studentId,
          tuitionPlanId: ownership.tuitionPlanId,
          paymentId: savedPayment.id,
          amount: dto.amount,
          performedBy: receivedById,
        });

        const { installment: updatedInstallment, statusChangeEvent } =
          await this.applyStateMachine(
            manager,
            installment,
            schoolId,
            ownership.studentId,
            receivedById,
          );

        return {
          payment: savedPayment,
          installment: updatedInstallment,
          idempotentReplay: false,
          statusChangeEvent,
        };
      });
    } catch (err) {
      if (dto.idempotencyKey && this.isUniqueViolation(err, 'uq_payments_idempotency_key')) {
        // Lost the race to another concurrent request using the same
        // idempotencyKey — the winner's row is now committed, so fetch it
        // and hand back the same clean replay result we'd give if we'd
        // seen it before starting (subject to the same semantic-match
        // check: if the two concurrent requests actually carried
        // different payment data under the same key, that's a conflict,
        // not a retry).
        const existing = await this.paymentRepo.findOne({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          if (!this.isSameLogicalPayment(existing, installmentId, dto)) {
            throw new ConflictException(
              'این کد یکتا قبلاً برای پرداختی با اطلاعات متفاوت استفاده شده است',
            );
          }
          const installment = await this.dataSource
            .getRepository(Installment)
            .findOne({ where: { id: existing.installmentId } });
          return { payment: existing, installment: installment!, idempotentReplay: true };
        }
      }
      throw err;
    }

    if (!result.idempotentReplay) {
      const remaining = Number(result.installment.amount) - Number(result.installment.paidAmount);
      this.events.emit(
        DOMAIN_EVENTS.PAYMENT_RECORDED,
        new PaymentRecordedEvent(
          schoolId,
          result.installment.id,
          result.payment.installmentId,
          result.payment.id,
          Number(result.payment.amount),
          remaining,
          receivedById,
          false,
        ),
      );
      if (result.statusChangeEvent) {
        this.events.emit(DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED, result.statusChangeEvent);
      }
    }

    return {
      payment: result.payment,
      installment: result.installment,
      idempotentReplay: result.idempotentReplay,
    };
  }

  /** True if `err` is a Postgres unique-violation on the given constraint. */
  private isUniqueViolation(err: unknown, constraint: string): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as unknown as { driverError?: { code?: string; constraint?: string } }).driverError
        ?.code === PG_UNIQUE_VIOLATION &&
      (err as unknown as { driverError?: { constraint?: string } }).driverError?.constraint ===
        constraint
    );
  }

  /**
   * An idempotency key is only a safe "replay" when the request it's
   * attached to is the *same* logical payment as the one already stored
   * under that key — same installment, amount, method, reference number,
   * and paid date. If any of those differ, the key has been reused for a
   * genuinely different payment (a client-side bug generating the same
   * key twice, or a copy-pasted key), and returning the old payment would
   * silently substitute one payment's data for another's. Note text is
   * deliberately excluded from the comparison — it's free-form and not
   * part of what makes two payments "the same transaction".
   */
  private isSameLogicalPayment(
    existing: Payment,
    installmentId: string,
    dto: CreatePaymentDto,
  ): boolean {
    return (
      existing.installmentId === installmentId &&
      Number(existing.amount) === Number(dto.amount) &&
      existing.paymentMethod === dto.paymentMethod &&
      (existing.referenceNumber ?? null) === (dto.referenceNumber ?? null) &&
      new Date(existing.paidAt).getTime() === new Date(dto.paidAt).getTime()
    );
  }

  /**
   * Recalculates status from the installment's current paid_amount (the DB
   * trigger `recalc_installment_paid` already recomputed paid_amount
   * itself — that's pure arithmetic, safe to leave in Postgres). Derives
   * the natural status, and — if it changed — asserts the transition is
   * legal via the state machine.
   *
   * Returns the (possibly unchanged) installment plus the status-change
   * event to emit, rather than emitting it itself — event consistency fix
   * (Phase 4A): this method always runs inside an open transaction (called
   * from create()/void()), so emitting here would fire the event *before*
   * the transaction commits. Emitting inside a
   * `dataSource.transaction(...)` callback means a listener could react
   * to a payment/void that isn't actually durable yet if anything later
   * in that same transaction fails and rolls back. Callers collect this
   * return value and emit it themselves only after the transaction
   * promise resolves — same pattern already used for
   * PaymentRecordedEvent/PaymentVoidedEvent.
   */
  private async applyStateMachine(
    manager: EntityManager,
    installmentBeforeTrigger: Installment,
    schoolId: string,
    studentId: string,
    performedBy: string | null,
  ): Promise<{ installment: Installment; statusChangeEvent: InstallmentStatusChangedEvent | null }> {
    const fresh = await manager.findOne(Installment, {
      where: { id: installmentBeforeTrigger.id },
    });
    if (!fresh) throw new NotFoundException('قسط یافت نشد');

    if (!InstallmentStateMachine.isLiveState(fresh.status)) {
      // manual state (deferred/disputed/cancelled) — don't auto-derive over it
      return { installment: fresh, statusChangeEvent: null };
    }

    const naturalStatus = InstallmentStateMachine.deriveFromAmounts(
      Number(fresh.paidAmount),
      Number(fresh.amount),
      fresh.dueDate as unknown as string,
    );

    if (naturalStatus !== fresh.status) {
      InstallmentStateMachine.assertTransition(fresh.status, naturalStatus);
      const previous = fresh.status;
      fresh.status = naturalStatus;
      await manager.save(fresh);

      return {
        installment: fresh,
        statusChangeEvent: new InstallmentStatusChangedEvent(
          schoolId,
          studentId,
          fresh.id,
          previous,
          naturalStatus,
          performedBy,
        ),
      };
    }

    return { installment: fresh, statusChangeEvent: null };
  }

  async findAll(
    schoolId: string,
    studentId?: string,
    pagination: PaginationParams = {},
  ): Promise<Payment[]> {
    const qb = this.paymentRepo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.installment', 'installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .addSelect(['student.id', 'student.fullName'])
      .where('student.schoolId = :schoolId', { schoolId })
      .orderBy('payment.paidAt', 'DESC');

    if (studentId) {
      qb.andWhere('plan.studentId = :studentId', { studentId });
    }

    // Phase 4A: bounded result set by default — this previously ran
    // unbounded, so a school's full payment history (financial data,
    // meant to only grow) loaded entirely on every list request.
    const { limit, skip } = normalizePagination(pagination);

    return qb.skip(skip).take(limit).getMany();
  }

  /**
   * GET /payments/:id/receipt — a clean data endpoint, not a PDF (per the
   * roadmap: "prepare clean data endpoint first"). Whatever renders the
   * printable receipt (a future PDF job, a frontend print view) reads
   * from this shape rather than re-deriving it from raw entities.
   */
  async getReceipt(id: string, schoolId: string): Promise<{
    receiptNumber: string | null;
    amount: number;
    paymentMethod: string | null;
    paidAt: Date;
    school: { name: string; address: string | null; phone: string | null };
    student: { id: string; fullName: string };
    receivedBy: { id: string; fullName: string } | null;
  }> {
    const raw = await this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.installment', 'installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .innerJoin('student.school', 'school')
      .leftJoin('payment.receivedBy', 'receivedBy')
      .select('payment.receiptNumber', 'receiptNumber')
      .addSelect('payment.amount', 'amount')
      .addSelect('payment.paymentMethod', 'paymentMethod')
      .addSelect('payment.paidAt', 'paidAt')
      .addSelect('school.name', 'schoolName')
      .addSelect('school.address', 'schoolAddress')
      .addSelect('school.phone', 'schoolPhone')
      .addSelect('student.id', 'studentId')
      .addSelect('student.fullName', 'studentFullName')
      .addSelect('receivedBy.id', 'receivedById')
      .addSelect('receivedBy.fullName', 'receivedByFullName')
      .where('payment.id = :id', { id })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .getRawOne<{
        receiptNumber: string | null;
        amount: string;
        paymentMethod: string | null;
        paidAt: Date;
        schoolName: string;
        schoolAddress: string | null;
        schoolPhone: string | null;
        studentId: string;
        studentFullName: string;
        receivedById: string | null;
        receivedByFullName: string | null;
      }>();

    if (!raw) {
      throw new NotFoundException('پرداخت یافت نشد یا متعلق به مدرسه‌ی دیگری است');
    }

    return {
      receiptNumber: raw.receiptNumber,
      amount: Number(raw.amount),
      paymentMethod: raw.paymentMethod,
      paidAt: raw.paidAt,
      school: { name: raw.schoolName, address: raw.schoolAddress, phone: raw.schoolPhone },
      student: { id: raw.studentId, fullName: raw.studentFullName },
      receivedBy: raw.receivedById
        ? { id: raw.receivedById, fullName: raw.receivedByFullName! }
        : null,
    };
  }

  /**
   * Replaces the old bare `softDelete()`. Voiding a payment now:
   *  - requires a reason (VoidPaymentDto),
   *  - records who did it (voidedBy, via the new voided_by/void_reason cols),
   *  - writes a VOID entry to the ledger reversing the PAYMENT entry,
   *  - re-runs the installment through the state machine (it may fall
   *    back from PAID to PARTIAL/PENDING),
   *  - emits PaymentVoidedEvent instead of silently disappearing.
   *
   * Requires Permission.PAYMENT_VOID at the controller layer — see
   * PaymentsController.
   *
   * Two reliability fixes (Phase 4A):
   *  1. Double-void: the payment lookup previously used a raw
   *     `createQueryBuilder` join, which — unlike the repository's
   *     find()/findOne() — does *not* automatically exclude soft-deleted
   *     rows. That meant voiding an already-voided payment silently
   *     "succeeded" a second time and wrote a second VOID entry to the
   *     ledger, double-reversing it. `payment.deletedAt IS NULL` is now
   *     explicit in the query.
   *  2. Concurrent payment vs. void on the same installment: create()
   *     already takes a `pessimistic_write` lock on the installment row;
   *     void() didn't, so a payment being recorded and a payment being
   *     voided for the same installment could interleave and derive
   *     status from a stale read. The same lock is taken here before any
   *     write.
   */
  async void(
    id: string,
    reason: string,
    voidedById: string,
    schoolId: string,
  ): Promise<void> {
    const { voidedEvent, statusChangeEvent } = await this.dataSource.transaction(
      async (manager) => {
        const payment = await manager
          .createQueryBuilder(Payment, 'payment')
          .innerJoin('payment.installment', 'installment')
          .innerJoin('installment.tuitionPlan', 'plan')
          .innerJoin('plan.student', 'student')
          .where('payment.id = :id', { id })
          .andWhere('student.schoolId = :schoolId', { schoolId })
          .andWhere('payment.deletedAt IS NULL')
          .getOne();

        if (!payment) {
          throw new NotFoundException(
            'پرداخت یافت نشد، قبلاً باطل شده، یا متعلق به مدرسه‌ی دیگری است',
          );
        }

        // Lock the installment row for the remainder of this transaction
        // — see method doc above for why this must match create()'s lock.
        const installment = await manager.findOne(Installment, {
          where: { id: payment.installmentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!installment) {
          throw new NotFoundException('قسط یافت نشد');
        }

        payment.voidedById = voidedById;
        payment.voidReason = reason;
        await manager.save(payment);
        // Soft delete — recalc_installment_paid fires on this UPDATE
        // (deleted_at write) too, so paid_amount corrects itself.
        await manager.softDelete(Payment, id);

        const ownership = await manager
          .createQueryBuilder()
          .select('student.id', 'studentId')
          .addSelect('plan.id', 'tuitionPlanId')
          .from('students', 'student')
          .innerJoin('tuition_plans', 'plan', 'plan.student_id = student.id')
          .where('plan.id = :planId', { planId: installment.tuitionPlanId })
          .getRawOne<{ studentId: string; tuitionPlanId: string }>();

        await this.ledger.recordVoid(manager, {
          schoolId,
          studentId: ownership!.studentId,
          tuitionPlanId: ownership!.tuitionPlanId,
          paymentId: payment.id,
          amount: Number(payment.amount),
          reason,
          performedBy: voidedById,
        });

        const { statusChangeEvent } = await this.applyStateMachine(
          manager,
          installment,
          schoolId,
          ownership!.studentId,
          voidedById,
        );

        return {
          voidedEvent: new PaymentVoidedEvent(
            schoolId,
            ownership!.studentId,
            payment.installmentId,
            payment.id,
            Number(payment.amount),
            reason,
            voidedById,
          ),
          statusChangeEvent,
        };
      },
    );

    // Emitted only after the transaction above has committed — see
    // applyStateMachine()'s doc for why this can't happen inside it.
    this.events.emit(DOMAIN_EVENTS.PAYMENT_VOIDED, voidedEvent);
    if (statusChangeEvent) {
      this.events.emit(DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED, statusChangeEvent);
    }
  }
}
