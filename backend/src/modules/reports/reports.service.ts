import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Installment, InstallmentStatus } from '../tuition/entities/installment.entity';
import { TuitionPlan } from '../tuition/entities/tuition-plan.entity';
import { Payment } from '../tuition/entities/payment.entity';
import { Student } from '../students/entities/student.entity';
import { LedgerEntry, LedgerEntryType } from '../ledger/entities/ledger-entry.entity';

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

export interface MonthlyIncome {
  year: number;
  month: number;
  totalIncome: number;
  paymentCount: number;
}

export interface DebtorStudent {
  studentId: string;
  studentFullName: string;
  outstandingBalance: number;
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
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
  ) {}

  /**
   * Total cash collected in a given month — reads only from
   * `financial_ledger` (PAYMENT entries, which are stored as negative
   * amounts by convention) instead of scanning/joining `payments`. Because
   * the ledger is append-only and narrowly indexed on (school_id,
   * created_at), this stays fast as history grows, and it's naturally
   * cacheable per (schoolId, year, month) once that month is in the past
   * — a closed month's income never changes.
   */
  async monthlyIncome(schoolId: string, year: number, month: number): Promise<MonthlyIncome> {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const raw = await this.ledgerRepo
      .createQueryBuilder('l')
      .where('l.schoolId = :schoolId', { schoolId })
      .andWhere('l.entryType = :type', { type: LedgerEntryType.PAYMENT })
      .andWhere('l.createdAt >= :start AND l.createdAt < :end', { start, end })
      .select('COALESCE(SUM(-l.amount), 0)', 'totalIncome')
      .addSelect('COUNT(*)', 'paymentCount')
      .getRawOne<{ totalIncome: string; paymentCount: string }>();

    return {
      year,
      month,
      totalIncome: Number(raw?.totalIncome ?? 0),
      paymentCount: Number(raw?.paymentCount ?? 0),
    };
  }

  /**
   * Every student with a positive running ledger balance (i.e. still owes
   * money), sorted by amount owed. This is the "لیست دانش‌آموزان بدهکار"
   * gap — previously the only way to see this was one student at a time
   * via studentStatement().
   */
  async debtorStudents(schoolId: string, limit = 100): Promise<DebtorStudent[]> {
    const raw = await this.ledgerRepo
      .createQueryBuilder('l')
      .innerJoin('l.student', 'student')
      .where('l.schoolId = :schoolId', { schoolId })
      .select('l.studentId', 'studentId')
      .addSelect('student.fullName', 'studentFullName')
      .addSelect('SUM(l.amount)', 'outstandingBalance')
      .groupBy('l.studentId')
      .addGroupBy('student.fullName')
      .having('SUM(l.amount) > 0')
      .orderBy('SUM(l.amount)', 'DESC')
      .limit(limit)
      .getRawMany<{ studentId: string; studentFullName: string; outstandingBalance: string }>();

    return raw.map((r) => ({
      studentId: r.studentId,
      studentFullName: r.studentFullName,
      outstandingBalance: Number(r.outstandingBalance),
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
