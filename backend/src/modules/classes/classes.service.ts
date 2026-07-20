import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from './entities/class.entity';
import { Grade } from '../grades/entities/grade.entity';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { Student } from '../students/entities/student.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { QueryClassesDto } from './dto/query-classes.dto';

const CLASS_RELATIONS = ['grade', 'academicYear'];

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(AcademicYear)
    private readonly academicYearRepo: Repository<AcademicYear>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(TeacherAssignment)
    private readonly assignmentRepo: Repository<TeacherAssignment>,
  ) {}

  /**
   * Tenant enforcement mirrors StudentsService.create()'s shape for
   * gradeId/academicYearId: each fetched by id alone, then its schoolId
   * compared to the caller's -- NotFound if it doesn't exist at all,
   * Forbidden if it exists but belongs to another school.
   */
  async create(dto: CreateClassDto, schoolId: string): Promise<Class> {
    const grade = await this.gradeRepo.findOne({ where: { id: dto.gradeId } });
    if (!grade) {
      throw new NotFoundException('پایه یافت نشد');
    }
    if (grade.schoolId !== schoolId) {
      throw new ForbiddenException('این پایه متعلق به مدرسه دیگری است');
    }

    const academicYear = await this.academicYearRepo.findOne({ where: { id: dto.academicYearId } });
    if (!academicYear) {
      throw new NotFoundException('سال تحصیلی یافت نشد');
    }
    if (academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('این سال تحصیلی متعلق به مدرسه دیگری است');
    }

    const existing = await this.classRepo.findOne({
      where: { gradeId: dto.gradeId, academicYearId: dto.academicYearId, title: dto.title },
    });
    if (existing) {
      throw new ConflictException('کلاسی با همین نام برای این پایه و سال تحصیلی قبلاً ثبت شده است');
    }

    const created = this.classRepo.create({
      schoolId,
      gradeId: dto.gradeId,
      academicYearId: dto.academicYearId,
      title: dto.title,
    });
    const saved = await this.classRepo.save(created);
    return (await this.classRepo.findOne({
      where: { id: saved.id },
      relations: CLASS_RELATIONS,
    })) as Class;
  }

  findAll(schoolId: string, query: QueryClassesDto): Promise<Class[]> {
    return this.classRepo.find({
      where: {
        schoolId,
        ...(query.gradeId ? { gradeId: query.gradeId } : {}),
        ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      },
      relations: CLASS_RELATIONS,
      order: { title: 'ASC' },
    });
  }

  async findOne(id: string, schoolId: string): Promise<Class> {
    const klass = await this.classRepo.findOne({
      where: { id, schoolId },
      relations: CLASS_RELATIONS,
    });
    if (!klass) {
      throw new NotFoundException('کلاس یافت نشد');
    }
    return klass;
  }

  async update(id: string, dto: UpdateClassDto, schoolId: string): Promise<Class> {
    const klass = await this.findOne(id, schoolId);
    const duplicate = await this.classRepo.findOne({
      where: { gradeId: klass.gradeId, academicYearId: klass.academicYearId, title: dto.title },
    });
    if (duplicate && duplicate.id !== id) {
      throw new ConflictException('کلاسی با همین نام برای این پایه و سال تحصیلی قبلاً ثبت شده است');
    }
    klass.title = dto.title;
    await this.classRepo.save(klass);
    return this.findOne(id, schoolId);
  }

  /**
   * Blocks deleting a class that students or teacher assignments still
   * point to, rather than silently orphaning class_id -- same "reject
   * the mutation, don't cascade" reasoning GradesService.remove() uses
   * for a grade with students on it.
   */
  async remove(id: string, schoolId: string): Promise<void> {
    await this.findOne(id, schoolId);

    const studentCount = await this.studentRepo.count({ where: { classId: id } });
    if (studentCount > 0) {
      throw new ConflictException('این کلاس به یک یا چند دانش‌آموز اختصاص داده شده و قابل حذف نیست');
    }

    const assignmentCount = await this.assignmentRepo.count({ where: { classId: id } });
    if (assignmentCount > 0) {
      throw new ConflictException('این کلاس به یک یا چند معلم تخصیص داده شده و قابل حذف نیست');
    }

    await this.classRepo.delete({ id, schoolId });
  }
}
