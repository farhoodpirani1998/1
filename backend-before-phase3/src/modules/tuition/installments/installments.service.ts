import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { TuitionPlan } from '../entities/tuition-plan.entity';
import { GenerateInstallmentsDto } from '../dto/generate-installments.dto';
import { QueryInstallmentsDto } from '../dto/query-installments.dto';
import { UpdateInstallmentDto } from '../dto/update-installment.dto';

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(TuitionPlan)
    private readonly tuitionPlanRepo: Repository<TuitionPlan>,
  ) {}

  async generate(
    tuitionPlanId: string,
    dto: GenerateInstallmentsDto,
  ): Promise<Installment[]> {
    const plan = await this.tuitionPlanRepo.findOne({
      where: { id: tuitionPlanId },
      relations: ['installments'],
    });
    if (!plan) {
      throw new NotFoundException('برنامه شهریه یافت نشد');
    }
    if (plan.installments?.length) {
      throw new BadRequestException('برای این برنامه شهریه قبلاً قسط ساخته شده است');
    }

    // Split final_amount into `count` equal installments; put the rounding
    // remainder on the last installment so the sum always matches exactly.
    const baseShare = Math.floor(Number(plan.finalAmount) / dto.count);
    const remainder = Number(plan.finalAmount) - baseShare * dto.count;

    const installments: Installment[] = [];
    const start = new Date(dto.startDate);

    for (let i = 0; i < dto.count; i++) {
      const dueDate = new Date(start);
      dueDate.setDate(dueDate.getDate() + i * dto.intervalDays);

      const isLast = i === dto.count - 1;
      const amount = baseShare + (isLast ? remainder : 0);

      installments.push(
        this.installmentRepo.create({
          tuitionPlanId: plan.id,
          installmentNumber: i + 1,
          amount,
          dueDate: dueDate.toISOString().slice(0, 10),
          status: InstallmentStatus.PENDING,
          paidAmount: 0,
        }),
      );
    }

    return this.installmentRepo.save(installments);
  }

  async findWithFilters(query: QueryInstallmentsDto): Promise<Installment[]> {
    const qb = this.installmentRepo
      .createQueryBuilder('installment')
      .leftJoinAndSelect('installment.tuitionPlan', 'plan')
      .leftJoinAndSelect('plan.student', 'student');

    if (query.status) {
      qb.andWhere('installment.status = :status', { status: query.status });
    }
    if (query.studentId) {
      qb.andWhere('plan.studentId = :studentId', {
        studentId: query.studentId,
      });
    }
    // schoolId filtering should ultimately be enforced server-side from the
    // authenticated user's tenant context, not trusted from client input:
    if (query.schoolId) {
      qb.andWhere('student.schoolId = :schoolId', {
        schoolId: query.schoolId,
      });
    }

    return qb.orderBy('installment.dueDate', 'ASC').getMany();
  }

  async findOne(id: string, schoolId: string): Promise<Installment> {
    const installment = await this.installmentRepo
      .createQueryBuilder('installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .leftJoinAndSelect('installment.payments', 'payments')
      .where('installment.id = :id', { id })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .getOne();
    if (!installment) {
      throw new NotFoundException('قسط یافت نشد');
    }
    return installment;
  }

  async update(id: string, dto: UpdateInstallmentDto, schoolId: string): Promise<Installment> {
    const installment = await this.findOne(id, schoolId);
    if (dto.dueDate !== undefined) installment.dueDate = dto.dueDate;
    if (dto.amount !== undefined) installment.amount = dto.amount;
    // status is recalculated by the DB trigger (sync_installment_status)
    // on UPDATE, so we don't set it manually here.
    return this.installmentRepo.save(installment);
  }

  /**
   * Called by the nightly cron job. Marks installments overdue when their
   * due_date has passed and nothing was paid — this covers the case where
   * no row-level UPDATE happens to fire the DB trigger on its own.
   * Returns the newly-overdue installments (with studentId) so the caller
   * can queue SMS reminders for exactly the ones that just flipped status.
   */
  async markOverdueInstallments(): Promise<{ id: string; studentId: string }[]> {
    const candidates = await this.installmentRepo
      .createQueryBuilder('installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .where('installment.dueDate < CURRENT_DATE')
      .andWhere('installment.status = :pending', {
        pending: InstallmentStatus.PENDING,
      })
      .select(['installment.id AS id', 'plan.studentId AS "studentId"'])
      .getRawMany<{ id: string; studentId: string }>();

    if (candidates.length === 0) {
      return [];
    }

    await this.installmentRepo
      .createQueryBuilder()
      .update(Installment)
      .set({ status: InstallmentStatus.OVERDUE })
      .where('id IN (:...ids)', { ids: candidates.map((c) => c.id) })
      .execute();

    return candidates;
  }
}
