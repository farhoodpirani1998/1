import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Student } from './entities/student.entity';
import { Guardian } from './entities/guardian.entity';
import { Grade } from '../grades/entities/grade.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { GuardiansService } from './guardians.service';
import { normalizePagination } from '../../common/utils/pagination';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
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
}
