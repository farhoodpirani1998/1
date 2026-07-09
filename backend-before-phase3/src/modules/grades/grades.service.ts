import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grade } from './entities/grade.entity';
import { CreateGradeDto } from './dto/create-grade.dto';

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade)
    private readonly gradeRepo: Repository<Grade>,
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
}
