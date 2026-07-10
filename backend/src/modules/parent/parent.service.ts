import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ParentStudent } from './entities/parent-student.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { TuitionPlan } from '../tuition/entities/tuition-plan.entity';
import { Installment } from '../tuition/entities/installment.entity';
import { Payment } from '../tuition/entities/payment.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { LinkParentDto } from './dto/link-parent.dto';
import { QueryParentNotificationsDto } from './dto/query-parent-notifications.dto';
import { Role } from '../../common/authorization/roles.enum';
import { normalizePagination } from '../../common/utils/pagination';

const STUDENT_RELATIONS = ['student', 'student.grade', 'student.academicYear', 'student.school'];

@Injectable()
export class ParentService {
  constructor(
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(TuitionPlan)
    private readonly tuitionPlanRepo: Repository<TuitionPlan>,
    @InjectRepository(Installment)
    private readonly installmentRepo: Repository<Installment>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * school_admin-only: attaches an existing parent-role user to an existing
   * student. Both must already belong to the caller's own school —
   * mirrors the tenant-enforcement pattern in StudentsService.create()
   * (guardianId/academicYearId/gradeId checks) so a school_admin can never
   * link across schools, whether by guessing a UUID or by copy/pasting one
   * from a support ticket.
   *
   * Idempotent: linking the same (parent, student) pair twice returns the
   * existing row instead of erroring or duplicating — same shape as
   * GuardiansService.findOrCreate().
   */
  async link(dto: LinkParentDto, schoolId: string): Promise<ParentStudent> {
    const parent = await this.userRepo.findOne({ where: { id: dto.parentId } });
    if (!parent) {
      throw new NotFoundException('والد یافت نشد');
    }
    if (parent.role !== Role.PARENT) {
      throw new BadRequestException('این کاربر نقش والد ندارد');
    }
    if (parent.schoolId !== schoolId) {
      throw new ForbiddenException('این والد متعلق به مدرسه دیگری است');
    }

    const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
    }

    const existing = await this.parentStudentRepo.findOne({
      where: { parentId: dto.parentId, studentId: dto.studentId },
    });
    if (existing) {
      return existing;
    }

    const link = this.parentStudentRepo.create({
      parentId: dto.parentId,
      studentId: dto.studentId,
    });
    return this.parentStudentRepo.save(link);
  }

  /**
   * school_admin-only: removes a link. Scoped by schoolId through the
   * linked student, same belt-and-suspenders check as elsewhere — even
   * though `id` is a random UUID for the join row itself (unguessable in
   * practice), this keeps the same tenant-safety shape as every other
   * remove/update in the app rather than trusting the UUID alone.
   */
  async unlink(id: string, schoolId: string): Promise<void> {
    const link = await this.parentStudentRepo.findOne({
      where: { id },
      relations: ['student'],
    });
    if (!link || link.student.schoolId !== schoolId) {
      throw new NotFoundException('این ارتباط یافت نشد');
    }
    await this.parentStudentRepo.delete(id);
  }

  /**
   * The two /parent/students read endpoints. `schoolId` (from the parent's
   * own JWT) is re-checked against student.schoolId even though a parent
   * can only ever be linked to students of their own school via link()
   * above — defense in depth, same reasoning as JwtStrategy re-checking
   * school.isActive on every request rather than trusting the token.
   */
  async findMyStudents(parentId: string, schoolId: string): Promise<Student[]> {
    const links = await this.parentStudentRepo.find({
      where: { parentId },
      relations: STUDENT_RELATIONS,
    });
    return links
      .map((link) => link.student)
      .filter((student) => student.schoolId === schoolId);
  }

  async findMyStudent(studentId: string, parentId: string, schoolId: string): Promise<Student> {
    const link = await this.parentStudentRepo.findOne({
      where: { parentId, studentId },
      relations: STUDENT_RELATIONS,
    });
    if (!link || link.student.schoolId !== schoolId) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    return link.student;
  }

  /**
   * Retrieves the tuition plan for a student, with access control checks.
   * Parent must be linked to the student, and both must belong to the same school.
   * Returns the most recent tuition plan for the student.
   */
  async getStudentTuition(
    studentId: string,
    parentId: string,
    schoolId: string,
  ): Promise<TuitionPlan> {
    // Verify the parent is linked to this student and both are in the same school
    await this.findMyStudent(studentId, parentId, schoolId);

    // Query tuition plans using the same tenant-safe pattern as TuitionPlansService
    const plan = await this.tuitionPlanRepo
      .createQueryBuilder('plan')
      .innerJoin('plan.student', 'student')
      .leftJoinAndSelect('plan.academicYear', 'academicYear')
      .leftJoinAndSelect('plan.installments', 'installments')
      .where('plan.studentId = :studentId', { studentId })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .orderBy('plan.createdAt', 'DESC')
      .getOne();

    if (!plan) {
      throw new NotFoundException('برنامه شهریه برای این دانش‌آموز یافت نشد');
    }

    return plan;
  }

  /**
   * Retrieves installments for a student's tuition plan, with access control.
   * Returns all installments sorted by due date, including payment information.
   */
  async getStudentInstallments(
    studentId: string,
    parentId: string,
    schoolId: string,
  ): Promise<Installment[]> {
    // Verify the parent is linked to this student and both are in the same school
    await this.findMyStudent(studentId, parentId, schoolId);

    // Query installments using the same tenant-safe pattern as InstallmentsService
    const installments = await this.installmentRepo
      .createQueryBuilder('installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .leftJoinAndSelect('installment.payments', 'payments')
      .where('plan.studentId = :studentId', { studentId })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .andWhere('payments.deletedAt IS NULL')
      .orderBy('installment.dueDate', 'ASC')
      .addOrderBy('installment.installmentNumber', 'ASC')
      .getMany();

    return installments;
  }

  /**
   * Retrieves payment history for a student's tuition plan, with access control.
   * Returns only non-voided payments sorted by payment date (most recent first).
   */
  async getStudentPaymentHistory(
    studentId: string,
    parentId: string,
    schoolId: string,
  ): Promise<Payment[]> {
    // Verify the parent is linked to this student and both are in the same school
    await this.findMyStudent(studentId, parentId, schoolId);

    // Query payments using the same tenant-safe pattern as PaymentsService
    // Excludes soft-deleted (voided) payments by default via repository.find()
    const payments = await this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.installment', 'installment')
      .innerJoin('installment.tuitionPlan', 'plan')
      .innerJoin('plan.student', 'student')
      .where('plan.studentId = :studentId', { studentId })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .andWhere('payment.deletedAt IS NULL')
      .orderBy('payment.paidAt', 'DESC')
      .getMany();

    return payments;
  }

  /**
   * Phase 5C: the parent's notification inbox — spans *all* students the
   * parent is linked to (not scoped to one student, unlike the
   * tuition/installments/payments endpoints above), since a parent with
   * several children wants one combined list. Tenant-safe the same way:
   * joins through parent_students (ownership) and students.school_id
   * (defense in depth against a token whose schoolId doesn't match, same
   * reasoning as findMyStudent()).
   */
  async getMyNotifications(
    parentId: string,
    schoolId: string,
    query: QueryParentNotificationsDto,
  ): Promise<Notification[]> {
    const qb = this.notificationRepo
      .createQueryBuilder('notification')
      .innerJoinAndSelect('notification.student', 'student')
      .innerJoinAndSelect('notification.installment', 'installment')
      .innerJoin(
        'parent_students',
        'ps',
        'ps.student_id = notification.studentId AND ps.parent_id = :parentId',
        { parentId },
      )
      .where('student.schoolId = :schoolId', { schoolId });

    if (query.isRead === true) {
      qb.andWhere('notification.readAt IS NOT NULL');
    } else if (query.isRead === false) {
      qb.andWhere('notification.readAt IS NULL');
    }

    const { limit, skip } = normalizePagination(query);

    return qb
      .orderBy('notification.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();
  }

  /**
   * Marks a single notification read. Ownership check mirrors
   * findMyStudent(): the notification's student must be linked to this
   * parent AND belong to this parent's school, or it's treated as
   * NotFound (never Forbidden) — same "don't reveal whether the ID
   * exists at all" shape used everywhere else a parent probes an ID that
   * isn't theirs.
   */
  async markNotificationRead(
    id: string,
    parentId: string,
    schoolId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepo
      .createQueryBuilder('notification')
      .innerJoinAndSelect('notification.student', 'student')
      .innerJoinAndSelect('notification.installment', 'installment')
      .innerJoin(
        'parent_students',
        'ps',
        'ps.student_id = notification.studentId AND ps.parent_id = :parentId',
        { parentId },
      )
      .where('notification.id = :id', { id })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .getOne();

    if (!notification) {
      throw new NotFoundException('اعلان یافت نشد');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepo.save(notification);
    }

    return notification;
  }
}
