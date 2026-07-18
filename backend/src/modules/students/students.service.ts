import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Student } from './entities/student.entity';
import { Guardian } from './entities/guardian.entity';
import { Grade } from '../grades/entities/grade.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { User } from '../users/entities/user.entity';
import { ParentStudent } from '../parent/entities/parent-student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { CreateStudentParentDto } from './dto/create-student-parent.dto';
import {
  StudentParentView,
  toStudentParentView,
  toStudentParentViewFromUser,
} from './dto/student-parent-view.dto';
import { GuardiansService } from './guardians.service';
import { normalizePagination } from '../../common/utils/pagination';
import { Role } from '../../common/authorization/roles.enum';
import type { BulkImportRowResult, BulkImportStudentsResult } from './dto/bulk-import-result.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ParentStudent)
    private readonly parentStudentRepo: Repository<ParentStudent>,
    private readonly guardiansService: GuardiansService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
    return this.dataSource.transaction(async (manager) => {
      let guardianId = dto.guardianId;

      if (dto.newGuardian) {
        const guardian = await this.guardiansService.findOrCreate(
          dto.newGuardian,
          schoolId,
          manager,
        );
        guardianId = guardian.id;
      } else if (dto.guardianId) {
        // Tenant enforcement: an explicit guardianId must belong to the
        // same school — otherwise a school_admin could attach a student
        // to another school's guardian just by guessing/enumerating a
        // UUID. The findOrCreate() path above is already safe since it
        // always scopes to `schoolId`.
        const guardian = await manager.findOne(Guardian, {
          where: { id: dto.guardianId },
        });
        if (!guardian) {
          throw new NotFoundException('والد یافت نشد');
        }
        if (guardian.schoolId !== schoolId) {
          throw new ForbiddenException('این والد متعلق به مدرسه دیگری است');
        }
      }

      // Tenant enforcement: academicYearId and gradeId must both belong to
      // the same school as the authenticated user, same class of check as
      // guardianId above.
      const academicYear = await manager.findOne(AcademicYear, {
        where: { id: dto.academicYearId },
      });
      if (!academicYear) {
        throw new NotFoundException('سال تحصیلی یافت نشد');
      }
      if (academicYear.schoolId !== schoolId) {
        throw new ForbiddenException('این سال تحصیلی متعلق به مدرسه دیگری است');
      }

      const grade = await manager.findOne(Grade, { where: { id: dto.gradeId } });
      if (!grade) {
        throw new NotFoundException('پایه یافت نشد');
      }
      if (grade.schoolId !== schoolId) {
        throw new ForbiddenException('این پایه متعلق به مدرسه دیگری است');
      }

      const student = manager.getRepository(Student).create({
        schoolId,
        guardianId,
        academicYearId: dto.academicYearId,
        gradeId: dto.gradeId,
        fullName: dto.fullName,
        nationalId: dto.nationalId ?? null,
        enrollmentDate: dto.enrollmentDate ?? null,
      });

      return manager.getRepository(Student).save(student);
    });
  }

  // Sprint 1 (Bulk Import): row-by-row wrapper around create() above —
  // deliberately not one big transaction. A single bad row (duplicate
  // nationalId, unknown gradeId, etc.) must not roll back or block every
  // other valid row in the same file, since the caller is importing a
  // whole spreadsheet at once and wants to know exactly which rows
  // succeeded. Each row still gets its own transaction via create(), so
  // a row is either fully created (student + guardian) or not created
  // at all — never half-written.
  async bulkImport(dtos: CreateStudentDto[], schoolId: string): Promise<BulkImportStudentsResult> {
    const results: BulkImportRowResult[] = [];

    for (let index = 0; index < dtos.length; index++) {
      try {
        const student = await this.create(dtos[index], schoolId);
        results.push({ index, success: true, studentId: student.id, fullName: student.fullName });
      } catch (err) {
        const message =
          err instanceof BadRequestException ||
          err instanceof NotFoundException ||
          err instanceof ForbiddenException
            ? (err.getResponse() as { message?: string })?.message ?? err.message
            : 'خطای غیرمنتظره در ثبت این ردیف';
        results.push({
          index,
          success: false,
          fullName: dtos[index]?.fullName,
          error: typeof message === 'string' ? message : String(message),
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return {
      totalRows: dtos.length,
      successCount,
      failureCount: dtos.length - successCount,
      results,
    };
  }

  async findWithFilters(
    query: QueryStudentsDto,
    schoolId: string,
  ): Promise<Student[]> {
    const qb = this.studentRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.guardian', 'guardian')
      .leftJoinAndSelect('student.grade', 'grade')
      .where('student.schoolId = :schoolId', { schoolId });

    if (query.status) {
      qb.andWhere('student.status = :status', { status: query.status });
    }
    if (query.gradeId) {
      qb.andWhere('student.gradeId = :gradeId', { gradeId: query.gradeId });
    }
    if (query.academicYearId) {
      qb.andWhere('student.academicYearId = :academicYearId', {
        academicYearId: query.academicYearId,
      });
    }
    if (query.search) {
      qb.andWhere('student.fullName ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    // Phase 4A: bounded result set by default (DEFAULT_PAGE_LIMIT), and
    // page/limit are honored when the caller passes them — previously this
    // ran unbounded, so a school with a large student roster loaded every
    // row (plus its guardian/grade joins) on every list request.
    const { limit, skip } = normalizePagination(query);

    return qb
      .orderBy('student.fullName', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();
  }

  async findOne(id: string, schoolId: string): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { id, schoolId },
      relations: ['guardian', 'grade', 'academicYear'],
    });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    return student;
  }

  async update(
    id: string,
    dto: UpdateStudentDto,
    schoolId: string,
  ): Promise<Student> {
    const student = await this.findOne(id, schoolId);

    // Tenant enforcement: a gradeId change must stay within the same
    // school, same class of check as create().
    if (dto.gradeId !== undefined) {
      const grade = await this.dataSource
        .getRepository(Grade)
        .findOne({ where: { id: dto.gradeId } });
      if (!grade) {
        throw new NotFoundException('پایه یافت نشد');
      }
      if (grade.schoolId !== schoolId) {
        throw new ForbiddenException('این پایه متعلق به مدرسه دیگری است');
      }
    }

    Object.assign(student, dto);
    return this.studentRepo.save(student);
  }

  async softDelete(id: string, schoolId: string): Promise<void> {
    await this.findOne(id, schoolId); // ensures it exists and belongs to this school
    await this.studentRepo.softDelete(id);
  }

  /**
   * POST /students/:id/parent — school_admin/staff: create (or, if the
   * phone number already belongs to a parent-role account in this same
   * school — e.g. a sibling's parent — reuse) a parent-portal login and
   * link it to this student, in one step.
   *
   * Tenant enforcement: the student must belong to the caller's own
   * school, same 404-on-cross-school shape as findOne(). schoolId for a
   * freshly created parent account always comes from the authenticated
   * caller's token (passed in here), never from the request body.
   *
   * The link itself is created with the same idempotent
   * "find-or-create the (parentId, studentId) row" shape as
   * ParentService.link() — duplicated here rather than imported (see
   * students.module.ts for why importing ParentModule directly would
   * create a circular module dependency).
   */
  async addParent(
    studentId: string,
    dto: CreateStudentParentDto,
    schoolId: string,
  ): Promise<StudentParentView> {
    // Ensures the student exists and belongs to this school before any
    // user/link is created.
    await this.findOne(studentId, schoolId);

    let parent = await this.userRepo.findOne({ where: { phone: dto.phone } });

    if (parent) {
      // A phone number is the login identifier for every role — reusing
      // it here only makes sense if it's already a parent account in
      // this same school (the sibling case). Anything else (a
      // school_admin/staff/teacher login, or a parent from a different
      // school) must not be silently taken over.
      if (parent.role !== Role.PARENT || parent.schoolId !== schoolId) {
        throw new ConflictException(
          'این شماره تلفن قبلاً برای کاربر دیگری ثبت شده است',
        );
      }
    } else {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      parent = this.userRepo.create({
        schoolId,
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash,
        role: Role.PARENT,
        isActive: true,
      });
      parent = await this.userRepo.save(parent);
    }

    let link = await this.parentStudentRepo.findOne({
      where: { parentId: parent.id, studentId },
    });
    if (!link) {
      link = await this.parentStudentRepo.save(
        this.parentStudentRepo.create({ parentId: parent.id, studentId }),
      );
    }

    return toStudentParentViewFromUser(parent, link.id);
  }

  /**
   * GET /students/:id/parents — school_admin/staff: every parent-portal
   * login currently linked to this student, including the link row id
   * (needed by the frontend to call the existing DELETE
   * /parent/link/:id). Same tenant check as addParent()/findOne().
   */
  async getParents(studentId: string, schoolId: string): Promise<StudentParentView[]> {
    await this.findOne(studentId, schoolId);
    const links = await this.parentStudentRepo.find({
      where: { studentId },
      relations: ['parent'],
    });
    return links.map(toStudentParentView);
  }
}
