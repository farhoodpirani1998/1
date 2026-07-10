import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { TuitionPlan } from '../entities/tuition-plan.entity';
import { GenerateInstallmentsDto } from '../dto/generate-installments.dto';
import { QueryInstallmentsDto } from '../dto/query-installments.dto';
import { UpdateInstallmentDto } from '../dto/update-installment.dto';
import { OverrideInstallmentStatusDto } from '../dto/override-installment-status.dto';
import { InstallmentStateMachine } from '../state-machine/installment-state-machine';
import {
  DOMAIN_EVENTS,
  InstallmentsGeneratedEvent,
  InstallmentUpdatedEvent,
  InstallmentStatusChangedEvent,
} from '../../../common/events/domain-events';
import { normalizePagination } from '../../../common/utils/pagination';

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(TuitionPlan)
    private readonly tuitionPlanRepo: Repository<TuitionPlan>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async generate(
    tuitionPlanId: string,
    dto: GenerateInstallmentsDto,
    schoolId: string,
  ): Promise<Installment[]> {
    const plan = await this.tuitionPlanRepo.findOne({
      where: { id: tuitionPlanId },
      relations: ['installments', 'student'],
    });
    if (!plan) {
      throw new NotFoundException('برنامه شهریه یافت نشد');
    }
    // Tenant enforcement: without this, any school_admin/accountant could
    // generate installments for another school's tuition plan just by
    // guessing/enumerating its UUID — the same class of check already
    // applied everywhere else in this service (findOne, update,
    // overrideStatus) via the student join.
    if (plan.student.schoolId !== schoolId) {
      throw new ForbiddenException('این برنامه شهریه متعلق به مدرسه دیگری است');
    }
    // Guards the DB-level unique index (tuition_plan_id, installment_number)
    // added in the ledger migration — this app-level check gives a clean
    // error message; the unique index is the actual race-condition backstop.
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

    const saved = await this.installmentRepo.save(installments);

    this.events.emit(
      DOMAIN_EVENTS.INSTALLMENTS_GENERATED,
      new InstallmentsGeneratedEvent(
        schoolId,
        plan.studentId,
        plan.id,
        saved.map((i) => i.id),
      ),
    );

    return saved;
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

    // Phase 4A: bounded result set by default — this previously ran
    // unbounded (leftJoinAndSelect on tuitionPlan + student for every
    // matching installment), so a school with a large installment history
    // loaded its entire table on every list request.
    const { limit, skip } = normalizePagination(query);

    return qb
      .orderBy('installment.dueDate', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();
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

  async update(
    id: string,
    dto: UpdateInstallmentDto,
    schoolId: string,
    performedBy: string,
  ): Promise<Installment> {
    const installment = await this.findOne(id, schoolId);

    const before = { dueDate: installment.dueDate, amount: Number(installment.amount) };
    let changed = false;

    if (dto.dueDate !== undefined && dto.dueDate !== installment.dueDate) {
      installment.dueDate = dto.dueDate;
      changed = true;
    }
    if (dto.amount !== undefined && dto.amount !== installment.amount) {
      installment.amount = dto.amount;
      changed = true;
    }
    // Status is no longer touched by a DB trigger — it's untouched here
    // too. Editing due_date/amount doesn't re-derive status on its own;
    // the next payment (or the nightly cron) will run it through
    // InstallmentStateMachine and pick up the new numbers.
    const saved = await this.installmentRepo.save(installment);

    if (changed) {
      const ownership = await this.dataSource
        .createQueryBuilder()
        .select('plan.student_id', 'studentId')
        .from('tuition_plans', 'plan')
        .innerJoin('installments', 'i', 'i.tuition_plan_id = plan.id')
        .where('i.id = :id', { id })
        .getRawOne<{ studentId: string }>();

      this.events.emit(
        DOMAIN_EVENTS.INSTALLMENT_UPDATED,
        new InstallmentUpdatedEvent(
          schoolId,
          ownership?.studentId ?? '',
          saved.id,
          before,
          { dueDate: saved.dueDate, amount: Number(saved.amount) },
          performedBy,
        ),
      );
    }

    return saved;
  }

  /**
   * Manual transitions that a human decides, not money or dates:
   * CANCELLED / DEFERRED / DISPUTED, or moving back out of them. Requires
   * Permission.INSTALLMENT_STATUS_OVERRIDE at the controller layer.
   * Always goes through the state machine, so e.g. you can't cancel an
   * installment that's already PAID.
   */
  async overrideStatus(
    id: string,
    dto: OverrideInstallmentStatusDto,
    schoolId: string,
    performedBy: string,
  ): Promise<Installment> {
    return this.dataSource.transaction(async (manager) => {
      const installment = await manager
        .createQueryBuilder(Installment, 'installment')
        .innerJoin('installment.tuitionPlan', 'plan')
        .innerJoin('plan.student', 'student')
        .where('installment.id = :id', { id })
        .andWhere('student.schoolId = :schoolId', { schoolId })
        .setLock('pessimistic_write')
        .getOne();

      if (!installment) {
        throw new NotFoundException('قسط یافت نشد');
      }

      InstallmentStateMachine.assertTransition(installment.status, dto.status);
      const previous = installment.status;
      installment.status = dto.status;
      await manager.save(installment);

      const ownership = await manager
        .createQueryBuilder()
        .select('plan.studentId', 'studentId')
        .from('tuition_plans', 'plan')
        .innerJoin('installments', 'i', 'i.tuition_plan_id = plan.id')
        .where('i.id = :id', { id })
        .getRawOne<{ studentId: string }>();

      this.events.emit(
        DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED,
        new InstallmentStatusChangedEvent(
          schoolId,
          ownership!.studentId,
          installment.id,
          previous,
          dto.status,
          performedBy,
        ),
      );

      return installment;
    });
  }

  /**
   * Called by the nightly cron job. Marks installments overdue when their
   * due_date has passed and nothing was paid. Runs every candidate through
   * the state machine (so it's the same rules as everywhere else) and
   * emits InstallmentStatusChangedEvent per installment — the
   * notifications listener picks that up to queue reminders, replacing
   * the old direct service-to-service call from the cron job.
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
      .addSelect('plan.id', 'planId')
      .getRawMany<{ id: string; studentId: string; planId: string }>();

    if (candidates.length === 0) {
      return [];
    }

    InstallmentStateMachine.assertTransition(
      InstallmentStatus.PENDING,
      InstallmentStatus.OVERDUE,
    );

    await this.installmentRepo
      .createQueryBuilder()
      .update(Installment)
      .set({ status: InstallmentStatus.OVERDUE })
      .where('id IN (:...ids)', { ids: candidates.map((c) => c.id) })
      .execute();

    for (const c of candidates) {
      // schoolId isn't loaded here to keep this query cheap for a
      // potentially large nightly batch; listeners that need it can look
      // it up from studentId. performedBy is null — this is the scheduler,
      // not a person.
      this.events.emit(
        DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED,
        new InstallmentStatusChangedEvent(
          '', // filled in by listener if needed via studentId lookup
          c.studentId,
          c.id,
          InstallmentStatus.PENDING,
          InstallmentStatus.OVERDUE,
          null,
        ),
      );
    }

    return candidates;
  }

  /**
   * Phase 5C: candidates for the "installment due soon" reminder — pending
   * installments whose due_date is exactly `daysAhead` days from today.
   * Read-only (unlike markOverdueInstallments, no status change happens
   * when something is merely *approaching* its due date), so this only
   * ever matches a given installment on the one calendar day where
   * due_date - daysAhead = today — no separate "already notified"
   * bookkeeping needed, same as how markOverdueInstallments naturally
   * stops matching once status leaves PENDING.
   */
  async findUpcomingDueInstallments(
    daysAhead: number,
  ): Promise<{ id: string; studentId: string }[]> {
    return this.installmentRepo
      .createQueryBuilder('installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .where(
        `installment.dueDate = (CURRENT_DATE + make_interval(days => :daysAhead))::date`,
        { daysAhead },
      )
      .andWhere('installment.status = :pending', {
        pending: InstallmentStatus.PENDING,
      })
      .select(['installment.id AS id', 'plan.studentId AS "studentId"'])
      .getRawMany<{ id: string; studentId: string }>();
  }
}
