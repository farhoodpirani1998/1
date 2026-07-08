import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Installment } from '../entities/installment.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Registers a payment against an installment. Runs inside a DB
   * transaction with a row lock on the installment so two concurrent
   * payments can't both pass the overpayment check and double-spend
   * the remaining balance. paid_amount/status on the installment are
   * then recalculated automatically by the `recalc_installment_paid`
   * and `sync_installment_status` triggers once the payment row commits.
   */
  async create(
    installmentId: string,
    dto: CreatePaymentDto,
    receivedById: string,
    schoolId: string,
  ): Promise<{ payment: Payment; installment: Installment }> {
    const result = await this.dataSource.transaction(async (manager) => {
      const installment = await manager.findOne(Installment, {
        where: { id: installmentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!installment) {
        throw new NotFoundException('قسط یافت نشد');
      }

      // Tenant check: the installment's plan -> student must belong to the
      // caller's own school. Also grabs the student id here since we need
      // it afterwards to queue the confirmation SMS.
      const ownership = await manager
        .createQueryBuilder()
        .select('student.school_id', 'schoolId')
        .addSelect('student.id', 'studentId')
        .from('students', 'student')
        .innerJoin('tuition_plans', 'plan', 'plan.student_id = student.id')
        .where('plan.id = :planId', { planId: installment.tuitionPlanId })
        .getRawOne<{ schoolId: string; studentId: string }>();

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
      });
      const savedPayment = await manager.save(payment);

      // Triggers update paid_amount/status on commit; re-fetch for a
      // response that reflects the post-trigger state.
      const updatedInstallment = await manager.findOne(Installment, {
        where: { id: installmentId },
      });

      return { payment: savedPayment, installment: updatedInstallment!, studentId: ownership.studentId };
    });

    // Best-effort, after commit: a notification failing to queue must never
    // undo an already-successful payment.
    await this.notificationsService.queuePaymentConfirmation(
      installmentId,
      result.studentId,
      Number(result.payment.amount),
    );

    return { payment: result.payment, installment: result.installment };
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

  async softDelete(id: string, schoolId: string): Promise<void> {
    const payment = await this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.installment', 'installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .where('payment.id = :id', { id })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .getOne();
    if (!payment) {
      throw new NotFoundException('پرداخت یافت نشد');
    }
    // Soft delete only — the recalc_installment_paid trigger fires on
    // DELETE too, so paid_amount/status correct themselves automatically.
    await this.paymentRepo.softDelete(id);
  }
}
