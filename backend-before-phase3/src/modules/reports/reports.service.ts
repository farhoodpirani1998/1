import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Installment, InstallmentStatus } from '../tuition/entities/installment.entity';
import { TuitionPlan } from '../tuition/entities/tuition-plan.entity';
import { Payment } from '../tuition/entities/payment.entity';
import { Student } from '../students/entities/student.entity';

export interface OverdueSummary {
  overdueInstallmentCount: number;
  overdueStudentCount: number;
  totalOverdueAmount: number;
}

export interface StudentStatement {
  student: { id: string; fullName: string };
  tuitionPlans: Array<{
    id: string;
    academicYearId: string;
    baseAmount: number;
    discountAmount: number;
    finalAmount: number;
    installments: Array<{
      id: string;
      installmentNumber: number;
      amount: number;
      paidAmount: number;
      dueDate: string;
      status: InstallmentStatus;
      payments: Array<{
        id: string;
        amount: number;
        paymentMethod: string | null;
        paidAt: Date;
      }>;
    }>;
  }>;
  totals: {
    totalDue: number;
    totalPaid: number;
    totalRemaining: number;
  };
}

export interface IncomePoint {
  date: string; // YYYY-MM-DD
  totalAmount: number;
  paymentCount: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(TuitionPlan)
    private readonly tuitionPlanRepo: Repository<TuitionPlan>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
  ) {}

  /**
   * Income grouped by calendar day between `from` and `to` (inclusive).
   * Covers both "daily income" (pass a single day as from=to) and
   * "monthly income" (pass the month's first/last day) — the frontend
   * just decides the range and, for monthly, sums the returned points.
   */
  async income(schoolId: string, from: string, to: string): Promise<IncomePoint[]> {
    const raw = await this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.installment', 'installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .where('student.schoolId = :schoolId', { schoolId })
      .andWhere('payment.paidAt BETWEEN :from AND :to', { from, to })
      .select("to_char(payment.paidAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'totalAmount')
      .addSelect('COUNT(payment.id)', 'paymentCount')
      .groupBy("to_char(payment.paidAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; totalAmount: string; paymentCount: string }>();

    return raw.map((row) => ({
      date: row.date,
      totalAmount: Number(row.totalAmount),
      paymentCount: Number(row.paymentCount),
    }));
  }

  async overdueSummary(schoolId: string): Promise<OverdueSummary> {
    const raw = await this.installmentRepo
      .createQueryBuilder('installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .where('student.schoolId = :schoolId', { schoolId })
      .andWhere('installment.status = :status', {
        status: InstallmentStatus.OVERDUE,
      })
      .select('COUNT(DISTINCT installment.id)', 'overdueInstallmentCount')
      .addSelect('COUNT(DISTINCT student.id)', 'overdueStudentCount')
      .addSelect(
        'COALESCE(SUM(installment.amount - installment.paidAmount), 0)',
        'totalOverdueAmount',
      )
      .getRawOne<{
        overdueInstallmentCount: string;
        overdueStudentCount: string;
        totalOverdueAmount: string;
      }>();

    return {
      overdueInstallmentCount: Number(raw?.overdueInstallmentCount ?? 0),
      overdueStudentCount: Number(raw?.overdueStudentCount ?? 0),
      totalOverdueAmount: Number(raw?.totalOverdueAmount ?? 0),
    };
  }

  async studentStatement(studentId: string, schoolId: string): Promise<StudentStatement> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, schoolId },
    });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }

    const plans = await this.tuitionPlanRepo.find({
      where: { studentId },
      relations: ['installments', 'installments.payments'],
      order: { createdAt: 'DESC' },
    });

    let totalDue = 0;
    let totalPaid = 0;

    const tuitionPlans = plans.map((plan) => {
      totalDue += Number(plan.finalAmount);

      const installments = (plan.installments ?? [])
        .sort((a, b) => a.installmentNumber - b.installmentNumber)
        .map((installment) => {
          totalPaid += Number(installment.paidAmount);
          return {
            id: installment.id,
            installmentNumber: installment.installmentNumber,
            amount: Number(installment.amount),
            paidAmount: Number(installment.paidAmount),
            dueDate: installment.dueDate,
            status: installment.status,
            payments: (installment.payments ?? []).map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              paymentMethod: p.paymentMethod,
              paidAt: p.paidAt,
            })),
          };
        });

      return {
        id: plan.id,
        academicYearId: plan.academicYearId,
        baseAmount: Number(plan.baseAmount),
        discountAmount: Number(plan.discountAmount),
        finalAmount: Number(plan.finalAmount),
        installments,
      };
    });

    return {
      student: { id: student.id, fullName: student.fullName },
      tuitionPlans,
      totals: {
        totalDue,
        totalPaid,
        totalRemaining: totalDue - totalPaid,
      },
    };
  }
}
