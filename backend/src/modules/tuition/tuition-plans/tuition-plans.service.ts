import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TuitionPlan } from '../entities/tuition-plan.entity';
import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { Student } from '../../students/entities/student.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { CreateTuitionPlanDto } from '../dto/create-tuition-plan.dto';
import { UpdateTuitionPlanDto } from '../dto/update-tuition-plan.dto';
import { LedgerService } from '../../ledger/ledger.service';
import { splitAmount } from '../utils/split-amount';
import {
  DISCOUNT_CEILING_RATIO,
  Permission,
  roleHasPermission,
} from '../../../common/authorization/permissions';
import {
  DOMAIN_EVENTS,
  TuitionPlanCreatedEvent,
  TuitionPlanUpdatedEvent,
  InstallmentUpdatedEvent,
} from '../../../common/events/domain-events';

@Injectable()
export class TuitionPlansService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly ledger: LedgerService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    dto: CreateTuitionPlanDto,
    schoolId: string,
    actingUser: { id: string; role: string },
  ): Promise<TuitionPlan> {
    const discount = dto.discountAmount ?? 0;
    if (discount > dto.baseAmount) {
      throw new BadRequestException(
        'مبلغ تخفیف نمی‌تواند از شهریه پایه بیشتر باشد',
      );
    }

    // Authorization granularity: a role without DISCOUNT_UNLIMITED can
    // still give a discount, but only up to its ceiling ratio. Above that,
    // it needs a school_admin (who holds DISCOUNT_UNLIMITED).
    if (discount > 0 && !roleHasPermission(actingUser.role, Permission.DISCOUNT_UNLIMITED)) {
      const ceiling = (DISCOUNT_CEILING_RATIO[actingUser.role] ?? 0) * dto.baseAmount;
      if (discount > ceiling) {
        throw new ForbiddenException(
          `تخفیف بیش از ${(DISCOUNT_CEILING_RATIO[actingUser.role] ?? 0) * 100}% نیاز به تأیید مدیر مدرسه دارد`,
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      // Tenant enforcement: the student must belong to the same school as
      // the authenticated user (from JWT via CurrentUser), otherwise a
      // school_admin could create a tuition plan for another school's
      // student just by guessing/enumerating a UUID.
      const student = await manager.findOne(Student, { where: { id: dto.studentId } });
      if (!student) {
        throw new NotFoundException('دانش‌آموز یافت نشد');
      }
      if (student.schoolId !== schoolId) {
        throw new ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
      }

      // Same tenant check for academicYearId — otherwise a school_admin
      // could file a tuition plan under another school's academic year by
      // guessing/enumerating its UUID, same class of bug as studentId above.
      const academicYear = await manager.findOne(AcademicYear, {
        where: { id: dto.academicYearId },
      });
      if (!academicYear) {
        throw new NotFoundException('سال تحصیلی یافت نشد');
      }
      if (academicYear.schoolId !== schoolId) {
        throw new ForbiddenException('این سال تحصیلی متعلق به مدرسه دیگری است');
      }

      // One tuition plan per (student, academic year) — the unique index
      // added in the TuitionPlanUniqueStudentYear migration is the real
      // race-condition backstop; this app-level check just gives a clean
      // error message, same pattern as InstallmentsService.generate().
      const duplicate = await manager.findOne(TuitionPlan, {
        where: { studentId: dto.studentId, academicYearId: dto.academicYearId },
      });
      if (duplicate) {
        throw new BadRequestException(
          'برای این دانش‌آموز در این سال تحصیلی قبلاً یک برنامه شهریه ثبت شده است',
        );
      }

      const plan = manager.create(TuitionPlan, {
        studentId: dto.studentId,
        academicYearId: dto.academicYearId,
        baseAmount: dto.baseAmount,
        discountAmount: discount,
        discountReason: dto.discountReason ?? null,
        finalAmount: dto.baseAmount - discount,
      });
      const saved = await manager.save(plan);

      await this.ledger.recordCharge(manager, {
        schoolId,
        studentId: dto.studentId,
        tuitionPlanId: saved.id,
        baseAmount: dto.baseAmount,
        discountAmount: discount,
        performedBy: actingUser.id,
      });

      this.events.emit(
        DOMAIN_EVENTS.TUITION_PLAN_CREATED,
        new TuitionPlanCreatedEvent(
          schoolId,
          dto.studentId,
          saved.id,
          dto.baseAmount,
          discount,
          saved.finalAmount,
          actingUser.id,
        ),
      );

      return saved;
    });
  }

  async findOne(id: string, schoolId: string): Promise<TuitionPlan> {
    // Tenant enforcement via the student join — same pattern as
    // InstallmentsService.findOne — so a plan ID from another school can
    // never be read just by guessing/enumerating a UUID.
    const plan = await this.dataSource
      .getRepository(TuitionPlan)
      .createQueryBuilder('plan')
      .innerJoin('plan.student', 'student')
      .leftJoinAndSelect('plan.installments', 'installments')
      .where('plan.id = :id', { id })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .getOne();
    if (!plan) {
      throw new NotFoundException('برنامه شهریه یافت نشد');
    }
    return plan;
  }

  async findByStudent(studentId: string, schoolId: string): Promise<TuitionPlan[]> {
    // schoolId always comes from the authenticated user's JWT — filtering
    // through the student join means a studentId from another school
    // simply returns no rows instead of leaking that school's plans.
    return this.dataSource
      .getRepository(TuitionPlan)
      .createQueryBuilder('plan')
      .innerJoin('plan.student', 'student')
      .where('plan.studentId = :studentId', { studentId })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .orderBy('plan.createdAt', 'DESC')
      .getMany();
  }

  async update(
    id: string,
    dto: UpdateTuitionPlanDto,
    actingUser: { id: string; role?: string },
    schoolId: string,
  ): Promise<TuitionPlan> {
    const result = await this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(TuitionPlan, {
        where: { id },
        relations: ['installments'],
      });
      if (!plan) {
        throw new NotFoundException('برنامه شهریه یافت نشد');
      }

      // Tenant enforcement: without this, a school_admin/accountant could
      // edit another school's tuition plan discount just by guessing its
      // UUID — findOne() above deliberately doesn't filter by schoolId
      // (the plan itself doesn't carry school_id), so it must be checked
      // explicitly here via the owning student, same as create().
      const owner = await manager.findOne(Student, { where: { id: plan.studentId } });
      if (!owner || owner.schoolId !== schoolId) {
        throw new ForbiddenException('این برنامه شهریه متعلق به مدرسه دیگری است');
      }

      const discountChanging =
        dto.discountAmount !== undefined && dto.discountAmount !== plan.discountAmount;

      // Editing a discount after the family already has a schedule in
      // front of them is a bigger deal than editing it up-front — no
      // per-role ceiling exception here (unlike create()), only
      // DISCOUNT_UNLIMITED (school_admin) can do it at all, regardless of
      // how small the change is.
      if (plan.installments?.length && discountChanging) {
        if (!actingUser.role || !roleHasPermission(actingUser.role, Permission.DISCOUNT_UNLIMITED)) {
          throw new ForbiddenException(
            'ویرایش تخفیف پس از ساخته‌شدن اقساط فقط توسط مدیر مدرسه مجاز است',
          );
        }
      }

      // Snapshot before mutation — this is what TuitionPlanUpdatedEvent
      // (and, downstream, the audit log) needs to show "what changed".
      const before = {
        discountAmount: Number(plan.discountAmount),
        discountReason: plan.discountReason,
      };
      let changed = false;
      const installmentUpdates: { installment: Installment; before: { amount: number } }[] = [];

      if (discountChanging) {
        if (dto.discountAmount! > plan.baseAmount) {
          throw new BadRequestException(
            'مبلغ تخفیف نمی‌تواند از شهریه پایه بیشتر باشد',
          );
        }

        // The original CHARGE/DISCOUNT ledger entries from create() are
        // never edited (append-only) — instead we book the *delta* as a
        // new DISCOUNT entry, so the ledger's running sum still matches
        // plan.finalAmount exactly.
        const delta = dto.discountAmount! - plan.discountAmount;
        const newFinalAmount = plan.baseAmount - dto.discountAmount!;

        if (plan.installments?.length) {
          // Re-fetch with a row lock rather than trusting the relation
          // loaded above: a concurrent payment (PaymentsService.create
          // takes its own pessimistic_write on the installment) could
          // move an installment from PENDING to PARTIAL between that
          // load and this write, and we must not redistribute over a
          // status that's already stale.
          const lockedInstallments = await manager
            .createQueryBuilder(Installment, 'installment')
            .where('installment.tuitionPlanId = :tuitionPlanId', { tuitionPlanId: plan.id })
            .setLock('pessimistic_write')
            .getMany();

          // Still-adjustable installments (PENDING/OVERDUE — these
          // always have paidAmount 0, see InstallmentStateMachine).
          // PAID/PARTIAL/CANCELLED/DEFERRED/DISPUTED/WRITTEN_OFF keep
          // their existing amount untouched — money already moved, or a
          // human already made a manual call on them.
          const adjustable = lockedInstallments.filter(
            (i) => i.status === InstallmentStatus.PENDING || i.status === InstallmentStatus.OVERDUE,
          );
          const lockedSum = lockedInstallments
            .filter((i) => !adjustable.includes(i))
            .reduce((acc, i) => acc + Number(i.amount), 0);
          const remainingToDistribute = newFinalAmount - lockedSum;

          if (remainingToDistribute < 0) {
            throw new BadRequestException(
              'این تخفیف باعث می‌شود مبلغ نهایی از جمع اقساط پرداخت‌شده/قطعی کمتر شود',
            );
          }
          if (adjustable.length === 0 && remainingToDistribute !== 0) {
            throw new BadRequestException(
              'قسط قابل‌تعدیلی (pending/overdue) برای اعمال این تغییر باقی نمانده است',
            );
          }

          const shares = splitAmount(remainingToDistribute, adjustable.length);
          adjustable.forEach((installment, idx) => {
            const oldAmount = Number(installment.amount);
            const newAmount = shares[idx];
            if (newAmount !== oldAmount) {
              installmentUpdates.push({ installment, before: { amount: oldAmount } });
              installment.amount = newAmount;
            }
          });
          if (installmentUpdates.length) {
            await manager.save(installmentUpdates.map((u) => u.installment));
          }
        }

        if (delta !== 0) {
          await this.ledger.recordDiscountAdjustment(manager, {
            schoolId: owner.schoolId,
            studentId: plan.studentId,
            tuitionPlanId: plan.id,
            deltaDiscount: delta,
            performedBy: actingUser.id,
          });
        }
        plan.discountAmount = dto.discountAmount!;
        plan.finalAmount = newFinalAmount;
        changed = true;
      }
      if (dto.discountReason !== undefined && dto.discountReason !== plan.discountReason) {
        plan.discountReason = dto.discountReason;
        changed = true;
      }

      const saved = await manager.save(plan);
      return { saved, before, changed, installmentUpdates };
    });

    if (result.changed) {
      this.events.emit(
        DOMAIN_EVENTS.TUITION_PLAN_UPDATED,
        new TuitionPlanUpdatedEvent(
          schoolId,
          result.saved.studentId,
          result.saved.id,
          result.before,
          {
            discountAmount: Number(result.saved.discountAmount),
            discountReason: result.saved.discountReason,
          },
          actingUser.id,
        ),
      );
      for (const u of result.installmentUpdates) {
        this.events.emit(
          DOMAIN_EVENTS.INSTALLMENT_UPDATED,
          new InstallmentUpdatedEvent(
            schoolId,
            result.saved.studentId,
            u.installment.id,
            { dueDate: u.installment.dueDate, amount: u.before.amount },
            { dueDate: u.installment.dueDate, amount: Number(u.installment.amount) },
            actingUser.id,
          ),
        );
      }
    }

    return result.saved;
  }
}
