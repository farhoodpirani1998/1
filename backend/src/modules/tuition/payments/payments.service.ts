import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Payment } from '../entities/payment.entity';
import { Installment } from '../entities/installment.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { LedgerService } from '../../ledger/ledger.service';
import { InstallmentStateMachine } from '../state-machine/installment-state-machine';
import { gregorianToJalaliYear } from '../../../common/utils/jalali';
import {
  DOMAIN_EVENTS,
  PaymentRecordedEvent,
  PaymentVoidedEvent,
  InstallmentStatusChangedEvent,
} from '../../../common/events/domain-events';

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
   *  1. Idempotency check — if `idempotencyKey` was already used, return the
   *     original payment untouched (no duplicate, no error — retries are
   *     supposed to be safe).
   *  2. Row-locks the installment, re-validates tenant + overpayment.
   *  3. Inserts the payment row.
   *  4. Writes a PAYMENT entry to the immutable ledger.
   *  5. Runs the installment through the state machine (derives new status
   *     from the now-current paid_amount, asserts the transition is legal).
   *
   * A PaymentRecordedEvent is emitted after commit — listeners (e.g.
   * Notifications) never run inside this transaction, so a slow/failing
   * SMS provider can never roll back a real payment.
   */
  async create(
    installmentId: string,
    dto: CreatePaymentDto,
    receivedById: string,
    schoolId: string,
  ): Promise<{ payment: Payment; installment: Installment; idempotentReplay: boolean }> {
    const result = await this.dataSource.transaction(async (manager) => {
      if (dto.idempotencyKey) {
        const existing = await manager.findOne(Payment, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          const installment = await manager.findOne(Installment, {
            where: { id: existing.installmentId },
          });
          return { payment: existing, installment: installment!, idempotentReplay: true };
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

      const updatedInstallment = await this.applyStateMachine(
        manager,
        installment,
        schoolId,
        ownership.studentId,
        receivedById,
      );

      return { payment: savedPayment, installment: updatedInstallment, idempotentReplay: false };
    });

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
    }

    return result;
  }

  /**
   * Recalculates status from the installment's current paid_amount (the DB
   * trigger `recalc_installment_paid` already recomputed paid_amount
   * itself — that's pure arithmetic, safe to leave in Postgres). Derives
   * the natural status, and — if it changed — asserts the transition is
   * legal via the state machine and emits InstallmentStatusChangedEvent.
   */
  private async applyStateMachine(
    manager: EntityManager,
    installmentBeforeTrigger: Installment,
    schoolId: string,
    studentId: string,
    performedBy: string | null,
  ): Promise<Installment> {
    const fresh = await manager.findOne(Installment, {
      where: { id: installmentBeforeTrigger.id },
    });
    if (!fresh) throw new NotFoundException('قسط یافت نشد');

    if (!InstallmentStateMachine.isLiveState(fresh.status)) {
      // manual state (deferred/disputed/cancelled) — don't auto-derive over it
      return fresh;
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

      this.events.emit(
        DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED,
        new InstallmentStatusChangedEvent(
          schoolId,
          studentId,
          fresh.id,
          previous,
          naturalStatus,
          performedBy,
        ),
      );
    }

    return fresh;
  }

  async findAll(schoolId: string, studentId?: string): Promise<Payment[]> {
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

    return qb.getMany();
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
   */
  async void(
    id: string,
    reason: string,
    voidedById: string,
    schoolId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .createQueryBuilder(Payment, 'payment')
        .innerJoin('payment.installment', 'installment')
        .innerJoin('installment.tuitionPlan', 'plan')
        .innerJoin('plan.student', 'student')
        .where('payment.id = :id', { id })
        .andWhere('student.schoolId = :schoolId', { schoolId })
        .getOne();

      if (!payment) {
        throw new NotFoundException('پرداخت یافت نشد یا متعلق به مدرسه‌ی دیگری است');
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
        .innerJoin('installments', 'installment', 'installment.tuition_plan_id = plan.id')
        .where('installment.id = :installmentId', { installmentId: payment.installmentId })
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

      const installment = await manager.findOne(Installment, {
        where: { id: payment.installmentId },
      });
      if (installment) {
        await this.applyStateMachine(manager, installment, schoolId, ownership!.studentId, voidedById);
      }

      this.events.emit(
        DOMAIN_EVENTS.PAYMENT_VOIDED,
        new PaymentVoidedEvent(
          schoolId,
          ownership!.studentId,
          payment.installmentId,
          payment.id,
          Number(payment.amount),
          reason,
          voidedById,
        ),
      );
    });
  }
}
