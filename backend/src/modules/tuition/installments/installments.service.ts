import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { TuitionPlan } from '../entities/tuition-plan.entity';
import { GenerateInstallmentsDto } from '../dto/generate-installments.dto';
import { QueryInstallmentsDto } from '../dto/query-installments.dto';
import { UpdateInstallmentDto } from '../dto/update-installment.dto';
import { OverrideInstallmentStatusDto } from '../dto/override-installment-status.dto';
import { WriteOffInstallmentDto } from '../dto/write-off-installment.dto';
import { AddInstallmentDto } from '../dto/add-installment.dto';
import { RemoveInstallmentDto } from '../dto/remove-installment.dto';
import { RenegotiateInstallmentsDto } from '../dto/renegotiate-installments.dto';
import { InstallmentStateMachine } from '../state-machine/installment-state-machine';
import { splitAmount } from '../utils/split-amount';
import { LedgerService } from '../../ledger/ledger.service';
import {
  DOMAIN_EVENTS,
  InstallmentsGeneratedEvent,
  InstallmentUpdatedEvent,
  InstallmentStatusChangedEvent,
  InstallmentWrittenOffEvent,
  InstallmentAddedEvent,
  InstallmentRemovedEvent,
  InstallmentsRenegotiatedEvent,
} from '../../../common/events/domain-events';
import {
  normalizePagination,
  wantsPaginatedResponse,
  type PaginatedResult,
} from '../../../common/utils/pagination';

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
    private readonly ledger: LedgerService,
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
    const shares = splitAmount(Number(plan.finalAmount), dto.count);

    const installments: Installment[] = [];
    const start = new Date(dto.startDate);

    for (let i = 0; i < dto.count; i++) {
      const dueDate = new Date(start);
      dueDate.setDate(dueDate.getDate() + i * dto.intervalDays);

      const amount = shares[i];

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

  async findWithFilters(
    query: QueryInstallmentsDto,
  ): Promise<Installment[] | PaginatedResult<Installment>> {
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
    // Phase 4B: name search — matches InstallmentsPage's previous
    // client-side nameFilter, now applied server-side so it still works
    // once the list is genuinely paginated (see QueryInstallmentsDto).
    if (query.search) {
      qb.andWhere('student.fullName ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    // Phase 4A: bounded result set by default — this previously ran
    // unbounded (leftJoinAndSelect on tuitionPlan + student for every
    // matching installment), so a school with a large installment history
    // loaded its entire table on every list request.
    const { page, limit, skip } = normalizePagination(query);

    // Phase 4B: real total via getManyAndCount, wrapped only when the
    // caller explicitly asked for pagination — see StudentsService for
    // the identical pattern/rationale.
    const [data, total] = await qb
      .orderBy('installment.dueDate', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    if (wantsPaginatedResponse(query)) {
      return { data, total, page, limit };
    }
    return data;
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
  ): Promise<Installment & { amountMismatchWarning?: string }> {
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

    // Soft check (Phase 5P): a manual amount edit can silently break the
    // invariant that installment amounts sum to the plan's finalAmount —
    // nothing in generate()/update() enforced that before. This never
    // blocks the edit (an admin may be doing this on purpose, e.g. mid-way
    // through a manual renegotiation), it just surfaces a warning in the
    // response so the mismatch isn't discovered weeks later in a report.
    // Cancelled/written-off installments are excluded since they no
    // longer represent money the student is expected to pay.
    let amountMismatchWarning: string | undefined;
    if (changed && dto.amount !== undefined) {
      const siblings = await this.installmentRepo.find({
        where: { tuitionPlanId: saved.tuitionPlanId },
      });
      const relevantSum = siblings
        .filter(
          (s) =>
            s.status !== InstallmentStatus.CANCELLED &&
            s.status !== InstallmentStatus.WRITTEN_OFF,
        )
        .reduce((acc, s) => acc + Number(s.amount), 0);
      const plan = await this.tuitionPlanRepo.findOne({
        where: { id: saved.tuitionPlanId },
      });
      if (plan && relevantSum !== Number(plan.finalAmount)) {
        amountMismatchWarning = `جمع اقساط (${relevantSum.toLocaleString('fa-IR')} تومان) دیگر با مبلغ نهایی شهریه (${Number(
          plan.finalAmount,
        ).toLocaleString('fa-IR')} تومان) برابر نیست`;
      }
    }

    (saved as Installment & { amountMismatchWarning?: string }).amountMismatchWarning =
      amountMismatchWarning;

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

  /**
   * Forgives whatever is left owed on one installment (PENDING/OVERDUE —
   * or PARTIAL, forgiving just the remainder after a partial payment).
   * Requires Permission.INSTALLMENT_WRITE_OFF at the controller layer —
   * this moves money off the books without any cash coming in, so it's
   * kept separate from the ordinary status override.
   *
   * Distinct from overrideStatus(id, {status: 'cancelled'}): cancelling
   * says "this charge no longer applies" (e.g. entered by mistake);
   * writing off says "the charge was valid, we're choosing not to
   * collect it" — the ledger entry (WRITE_OFF, not a status change alone)
   * is what makes that distinction visible in financial reports.
   */
  async writeOff(
    id: string,
    dto: WriteOffInstallmentDto,
    schoolId: string,
    performedBy: string,
  ): Promise<Installment> {
    const result = await this.dataSource.transaction(async (manager) => {
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
      if (!InstallmentStateMachine.isLiveState(installment.status)) {
        throw new BadRequestException(
          `نمی‌توان قسطی با وضعیت «${installment.status}» را بخشید`,
        );
      }

      const remaining = Number(installment.amount) - Number(installment.paidAmount);
      if (remaining <= 0) {
        throw new BadRequestException('چیزی برای بخشش روی این قسط باقی نمانده است');
      }

      InstallmentStateMachine.assertTransition(installment.status, InstallmentStatus.WRITTEN_OFF);
      const previousStatus = installment.status;
      installment.status = InstallmentStatus.WRITTEN_OFF;
      const saved = await manager.save(installment);

      const ownership = await manager
        .createQueryBuilder()
        .select('plan.studentId', 'studentId')
        .from('tuition_plans', 'plan')
        .innerJoin('installments', 'i', 'i.tuition_plan_id = plan.id')
        .where('i.id = :id', { id })
        .getRawOne<{ studentId: string }>();

      await this.ledger.recordWriteOff(manager, {
        schoolId,
        studentId: ownership!.studentId,
        tuitionPlanId: installment.tuitionPlanId,
        installmentId: installment.id,
        amount: remaining,
        reason: dto.reason,
        performedBy,
      });

      return { saved, studentId: ownership!.studentId, remaining, previousStatus };
    });

    // Emitted only after the transaction commits — same reasoning as
    // PaymentsService.applyStateMachine()'s doc: a listener (e.g.
    // notifications telling the parent) must never fire against a
    // write-off that could still roll back.
    this.events.emit(
      DOMAIN_EVENTS.INSTALLMENT_WRITTEN_OFF,
      new InstallmentWrittenOffEvent(
        schoolId,
        result.studentId,
        result.saved.tuitionPlanId,
        result.saved.id,
        result.remaining,
        dto.reason,
        performedBy,
      ),
    );
    this.events.emit(
      DOMAIN_EVENTS.INSTALLMENT_STATUS_CHANGED,
      new InstallmentStatusChangedEvent(
        schoolId,
        result.studentId,
        result.saved.id,
        result.previousStatus,
        InstallmentStatus.WRITTEN_OFF,
        performedBy,
      ),
    );

    return result.saved;
  }

  /**
   * Appends one installment to a plan that already has a generated
   * schedule — e.g. a fee was missed when the schedule was first built,
   * or a family agreed to an extra installment outside the normal split.
   * Requires Permission.INSTALLMENT_SCHEDULE_EDIT. The amount is given
   * explicitly rather than auto-computed: unlike renegotiate() this
   * isn't meant to rebalance anything, just add one more line item.
   * installmentNumber is re-derived by due date across the whole plan
   * afterward (see renumberByDueDate) so numbering stays contiguous and
   * chronological even if the new installment's due date falls before
   * an existing one.
   */
  async addInstallment(
    tuitionPlanId: string,
    dto: AddInstallmentDto,
    schoolId: string,
    performedBy: string,
  ): Promise<Installment> {
    const result = await this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(TuitionPlan, {
        where: { id: tuitionPlanId },
        relations: ['student', 'installments'],
      });
      if (!plan) {
        throw new NotFoundException('برنامه شهریه یافت نشد');
      }
      if (plan.student.schoolId !== schoolId) {
        throw new ForbiddenException('این برنامه شهریه متعلق به مدرسه دیگری است');
      }
      if (!plan.installments?.length) {
        throw new BadRequestException(
          'ابتدا باید اقساط اولیه را از طریق /installments/generate بسازید',
        );
      }

      const maxNumber = Math.max(...plan.installments.map((i) => i.installmentNumber));
      const created = manager.create(Installment, {
        tuitionPlanId: plan.id,
        installmentNumber: maxNumber + 1,
        amount: dto.amount,
        dueDate: dto.dueDate,
        status: InstallmentStatus.PENDING,
        paidAmount: 0,
      });
      const saved = await manager.save(created);
      await this.renumberByDueDate(manager, plan.id);

      const fresh = await manager.findOne(Installment, { where: { id: saved.id } });
      return { installment: fresh!, studentId: plan.studentId, tuitionPlanId: plan.id };
    });

    this.events.emit(
      DOMAIN_EVENTS.INSTALLMENT_ADDED,
      new InstallmentAddedEvent(
        schoolId,
        result.studentId,
        result.tuitionPlanId,
        result.installment.id,
        Number(result.installment.amount),
        result.installment.dueDate,
        performedBy,
      ),
    );

    return result.installment;
  }

  /**
   * Removes one installment from a plan. Deliberately restricted to
   * PENDING only (not OVERDUE, PARTIAL, PAID, or any manual state) — the
   * moment money has moved or a due date has passed, that history needs
   * to stay visible (via cancel/write-off/status-override) rather than
   * disappear. Requires Permission.INSTALLMENT_SCHEDULE_EDIT and a
   * reason, for the same audit reasons as overrideStatus/writeOff.
   *
   * installmentNumber isn't a foreign key anywhere (payments reference
   * installmentId, never installmentNumber), so renumbering the
   * remainder by due date afterward is safe — no historical reference
   * breaks.
   */
  async removeInstallment(
    id: string,
    dto: RemoveInstallmentDto,
    schoolId: string,
    performedBy: string,
  ): Promise<{ id: string }> {
    const result = await this.dataSource.transaction(async (manager) => {
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
      if (installment.status !== InstallmentStatus.PENDING) {
        throw new BadRequestException(
          'فقط اقساطی با وضعیت «pending» قابل حذف‌اند — قسط سررسیدگذشته، پرداخت‌شده یا در وضعیت دستی دیگر را باید لغو یا بخشید',
        );
      }

      const ownership = await manager
        .createQueryBuilder()
        .select('plan.studentId', 'studentId')
        .from('tuition_plans', 'plan')
        .innerJoin('installments', 'i', 'i.tuition_plan_id = plan.id')
        .where('i.id = :id', { id })
        .getRawOne<{ studentId: string }>();

      const tuitionPlanId = installment.tuitionPlanId;
      const amount = Number(installment.amount);
      await manager.delete(Installment, id);
      await this.renumberByDueDate(manager, tuitionPlanId);

      return { studentId: ownership!.studentId, tuitionPlanId, amount };
    });

    this.events.emit(
      DOMAIN_EVENTS.INSTALLMENT_REMOVED,
      new InstallmentRemovedEvent(
        schoolId,
        result.studentId,
        result.tuitionPlanId,
        id,
        result.amount,
        dto.reason,
        performedBy,
      ),
    );

    return { id };
  }

  /**
   * Cancels every still-unpaid (PENDING/OVERDUE) installment on a plan
   * and replaces them with a fresh schedule covering exactly their
   * combined amount — e.g. a family renegotiates the pace of what's
   * left after paying some installments on the original plan. Anything
   * already PAID/PARTIAL/CANCELLED/DEFERRED/DISPUTED/WRITTEN_OFF is left
   * completely untouched; only the unpaid remainder moves.
   * Requires Permission.INSTALLMENT_SCHEDULE_EDIT.
   */
  async renegotiate(
    tuitionPlanId: string,
    dto: RenegotiateInstallmentsDto,
    schoolId: string,
    performedBy: string,
  ): Promise<Installment[]> {
    const result = await this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(TuitionPlan, {
        where: { id: tuitionPlanId },
        relations: ['student'],
      });
      if (!plan) {
        throw new NotFoundException('برنامه شهریه یافت نشد');
      }
      if (plan.student.schoolId !== schoolId) {
        throw new ForbiddenException('این برنامه شهریه متعلق به مدرسه دیگری است');
      }

      const installments = await manager
        .createQueryBuilder(Installment, 'installment')
        .where('installment.tuitionPlanId = :tuitionPlanId', { tuitionPlanId })
        .setLock('pessimistic_write')
        .getMany();

      const adjustable = installments.filter(
        (i) => i.status === InstallmentStatus.PENDING || i.status === InstallmentStatus.OVERDUE,
      );
      if (adjustable.length === 0) {
        throw new BadRequestException(
          'قسط پرداخت‌نشده‌ای برای این برنامه شهریه باقی نمانده تا تنظیم مجدد شود',
        );
      }

      const remainingBalance = adjustable.reduce((acc, i) => acc + Number(i.amount), 0);
      const lockedNumbers = installments
        .filter((i) => !adjustable.includes(i))
        .map((i) => i.installmentNumber);
      const maxLockedNumber = lockedNumbers.length ? Math.max(...lockedNumbers) : 0;

      for (const inst of adjustable) {
        InstallmentStateMachine.assertTransition(inst.status, InstallmentStatus.CANCELLED);
        inst.status = InstallmentStatus.CANCELLED;
      }
      await manager.save(adjustable);

      const shares = splitAmount(remainingBalance, dto.count);
      const start = new Date(dto.startDate);
      const newInstallments = shares.map((amount, i) => {
        const dueDate = new Date(start);
        dueDate.setDate(dueDate.getDate() + i * dto.intervalDays);
        return manager.create(Installment, {
          tuitionPlanId: plan.id,
          installmentNumber: maxLockedNumber + i + 1,
          amount,
          dueDate: dueDate.toISOString().slice(0, 10),
          status: InstallmentStatus.PENDING,
          paidAmount: 0,
        });
      });
      const savedNew = await manager.save(newInstallments);
      await this.renumberByDueDate(manager, plan.id);

      const fresh = await manager.find(Installment, {
        where: { tuitionPlanId: plan.id },
        order: { installmentNumber: 'ASC' },
      });

      return {
        studentId: plan.studentId,
        tuitionPlanId: plan.id,
        cancelledIds: adjustable.map((i) => i.id),
        newIds: savedNew.map((i) => i.id),
        fresh,
      };
    });

    this.events.emit(
      DOMAIN_EVENTS.INSTALLMENTS_RENEGOTIATED,
      new InstallmentsRenegotiatedEvent(
        schoolId,
        result.studentId,
        result.tuitionPlanId,
        result.cancelledIds,
        result.newIds,
        performedBy,
      ),
    );

    return result.fresh;
  }

  /**
   * Re-derives installmentNumber for every installment on a plan from
   * due-date order (ties broken by creation order), so numbering always
   * reads as a contiguous, chronological "قسط ۱، قسط ۲، ..." regardless
   * of what's been added/removed/rescheduled. Safe because nothing keys
   * off installmentNumber as an identifier — always call this from
   * inside the same transaction as the add/remove/renegotiate that
   * needed it.
   */
  private async renumberByDueDate(manager: EntityManager, tuitionPlanId: string): Promise<void> {
    const rows = await manager.find(Installment, {
      where: { tuitionPlanId },
      order: { dueDate: 'ASC', createdAt: 'ASC' },
    });
    for (let i = 0; i < rows.length; i++) {
      const num = i + 1;
      if (rows[i].installmentNumber !== num) {
        await manager.update(Installment, rows[i].id, { installmentNumber: num });
      }
    }
  }
}
