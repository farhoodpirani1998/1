import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import { Student } from './entities/student.entity';
import { Guardian } from './entities/guardian.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { GuardiansService } from './guardians.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly guardiansService: GuardiansService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateStudentDto, schoolId: string): Promise<Student> {
    if (!dto.guardianId && !dto.newGuardian) {
      throw new BadRequestException(
        'باید یا guardianId یا اطلاعات یک والد جدید ارسال شود',
      );
    }
    if (dto.guardianId && dto.newGuardian) {
      throw new BadRequestException(
        'فقط یکی از guardianId یا newGuardian باید ارسال شود، نه هر دو',
      );
    }

    // Wrapped in a transaction: guardian creation and student creation
    // succeed or fail together.
    const student = await this.dataSource.transaction(async (manager) => {
      let guardianId = dto.guardianId;

      if (dto.newGuardian) {
        const guardian = await this.guardiansService.findOrCreate(
          dto.newGuardian,
          schoolId,
          manager,
        );
        guardianId = guardian.id;
      }

      const entity = manager.getRepository(Student).create({
        schoolId,
        guardianId,
        classId: dto.classId,
        fullName: dto.fullName,
        nationalId: dto.nationalId ?? null,
        birthDate: dto.birthDate ?? null,
        address: dto.address ?? null,
        enrollmentDate: dto.enrollmentDate ?? null,
      });

      return manager.getRepository(Student).save(entity);
    });

    // Best-effort: a welcome SMS failing to queue shouldn't roll back the
    // enrollment itself, so this happens after the transaction commits.
    await this.notificationsService.queueWelcomeMessage(student.id);

    return student;
  }

  async findWithFilters(query: QueryStudentsDto, schoolId: string): Promise<Student[]> {
    const qb = this.studentRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.guardian', 'guardian')
      .leftJoinAndSelect('student.class', 'class')
      .leftJoinAndSelect('class.grade', 'grade')
      .where('student.schoolId = :schoolId', { schoolId });

    if (query.status) {
      qb.andWhere('student.status = :status', { status: query.status });
    }
    if (query.classId) {
      qb.andWhere('student.classId = :classId', { classId: query.classId });
    }
    if (query.search) {
      qb.andWhere('student.fullName ILIKE :search', { search: `%${query.search}%` });
    }

    return qb.orderBy('student.fullName', 'ASC').getMany();
  }

  async findOne(id: string, schoolId: string): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id, schoolId },
      relations: ['guardian', 'class', 'class.grade', 'class.academicYear'],
    });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    return student;
  }

  async update(id: string, dto: UpdateStudentDto, schoolId: string): Promise<Student> {
    const student = await this.findOne(id, schoolId);
    Object.assign(student, dto);
    await this.studentRepo.save(student);
    // Re-fetch: a changed classId means the previously-loaded `class`
    // relation object is now stale, so return a clean read instead of
    // reusing the in-memory entity from before the save.
    return this.findOne(id, schoolId);
  }

  async softDelete(id: string, schoolId: string): Promise<void> {
    await this.findOne(id, schoolId); // ensures it exists and belongs to this school
    await this.studentRepo.softDelete(id);
  }

  async findArchived(schoolId: string): Promise<Student[]> {
    return this.studentRepo.find({
      where: { schoolId, deletedAt: Not(IsNull()) },
      withDeleted: true,
      relations: ['class', 'class.grade'],
      order: { deletedAt: 'DESC' },
    });
  }

  /**
   * Cross-school search, used only by the super_admin transfer flow.
   * Every other read path in this service is scoped to one school —
   * this is the deliberate, narrow exception, gated by @Roles('super_admin')
   * at the controller.
   */
  async searchAll(search: string): Promise<Student[]> {
    return this.studentRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.school', 'school')
      .leftJoinAndSelect('student.guardian', 'guardian')
      .where('student.fullName ILIKE :search', { search: `%${search}%` })
      .orderBy('student.fullName', 'ASC')
      .limit(20)
      .getMany();
  }

  async restore(id: string, schoolId: string): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id, schoolId },
      withDeleted: true,
    });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    await this.studentRepo.restore(id);
    return this.findOne(id, schoolId);
  }

  /**
   * Moves a student to a different school. Only meaningful for super_admin,
   * since it crosses the tenant boundary that every other operation enforces.
   * The student's class is cleared (classes are school-specific) — the
   * receiving school must assign a new class. Tuition/installment/payment
   * history stays attached to the student and simply moves with them.
   *
   * Guardian handling: if this is the guardian's only child at the old
   * school, the guardian record moves with them. Otherwise a new guardian
   * record is created at the target school (since guardians are scoped to
   * one school and may still have other children at the old one).
   */
  async transfer(id: string, targetSchoolId: string): Promise<Student> {
    return this.dataSource.transaction(async (manager) => {
      const studentRepo = manager.getRepository(Student);
      const guardianRepo = manager.getRepository(Guardian);

      const student = await studentRepo.findOne({ where: { id } });
      if (!student) {
        throw new NotFoundException('دانش‌آموز یافت نشد');
      }
      if (student.schoolId === targetSchoolId) {
        throw new BadRequestException('مدرسه‌ی مقصد نمی‌تواند همان مدرسه‌ی فعلی باشد');
      }
      const currentSchoolId = student.schoolId;

      let newGuardianId: string | null = student.guardianId;

      if (student.guardianId) {
        const siblingsRemaining = await studentRepo.count({
          where: { guardianId: student.guardianId, schoolId: currentSchoolId, id: Not(id) },
        });

        if (siblingsRemaining === 0) {
          // Only child at the old school — move the guardian record itself.
          await guardianRepo.update(student.guardianId, { schoolId: targetSchoolId });
        } else {
          // Other children remain — duplicate the guardian into the new school.
          const oldGuardian = await guardianRepo.findOne({ where: { id: student.guardianId } });
          if (oldGuardian) {
            const duplicated = guardianRepo.create({
              schoolId: targetSchoolId,
              fullName: oldGuardian.fullName,
              phone: oldGuardian.phone,
              nationalId: oldGuardian.nationalId,
            });
            const saved = await guardianRepo.save(duplicated);
            newGuardianId = saved.id;
          }
        }
      }

      student.schoolId = targetSchoolId;
      student.guardianId = newGuardianId;
      student.classId = null; // must be reassigned in the new school
      student.transferredFromSchoolId = currentSchoolId;
      return studentRepo.save(student);
    });
  }
}
