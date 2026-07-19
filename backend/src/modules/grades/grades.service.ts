import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grade } from './entities/grade.entity';
import { Student } from '../students/entities/student.entity';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
  ) {}

  create(dto: CreateGradeDto, schoolId: string): Promise<Grade> {
    const grade = this.gradeRepo.create({ schoolId, title: dto.title });
    return this.gradeRepo.save(grade);
  }

  findAll(schoolId: string): Promise<Grade[]> {
    return this.gradeRepo.find({ where: { schoolId }, order: { title: 'ASC' } });
  }

  async findOne(id: string, schoolId: string): Promise<Grade> {
    const grade = await this.gradeRepo.findOne({ where: { id, schoolId } });
    if (!grade) {
      throw new NotFoundException('پایه یافت نشد');
    }
    return grade;
  }

  async update(id: string, dto: UpdateGradeDto, schoolId: string): Promise<Grade> {
    const grade = await this.findOne(id, schoolId);
    grade.title = dto.title;
    return this.gradeRepo.save(grade);
  }

  // Blocks deleting a grade that students are still assigned to, rather
  // than silently orphaning their grade_id — same "reject the mutation,
  // don't cascade" reasoning as other reference-list guards in this
  // codebase (e.g. school deactivation checks).
  async remove(id: string, schoolId: string): Promise<void> {
    await this.findOne(id, schoolId);
    const studentCount = await this.studentRepo.count({ where: { gradeId: id } });
    if (studentCount > 0) {
      throw new ConflictException('این پایه به یک یا چند دانش‌آموز اختصاص داده شده و قابل حذف نیست');
    }
    await this.gradeRepo.delete({ id, schoolId });
  }
}
