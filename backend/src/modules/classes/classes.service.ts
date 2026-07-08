import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from './entities/class.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
  ) {}

  create(dto: CreateClassDto, schoolId: string): Promise<Class> {
    const klass = this.classRepo.create({
      schoolId,
      gradeId: dto.gradeId,
      academicYearId: dto.academicYearId,
      title: dto.title,
      teacherName: dto.teacherName ?? null,
      capacity: dto.capacity ?? null,
    });
    return this.classRepo.save(klass);
  }

  findAll(schoolId: string, academicYearId?: string): Promise<Class[]> {
    return this.classRepo.find({
      where: academicYearId ? { schoolId, academicYearId } : { schoolId },
      relations: ['grade'],
      order: { title: 'ASC' },
    });
  }

  async findOne(id: string, schoolId: string): Promise<Class> {
    const klass = await this.classRepo.findOne({ where: { id, schoolId }, relations: ['grade'] });
    if (!klass) {
      throw new NotFoundException('کلاس یافت نشد');
    }
    return klass;
  }

  async update(id: string, dto: UpdateClassDto, schoolId: string): Promise<Class> {
    const klass = await this.findOne(id, schoolId);
    Object.assign(klass, dto);
    return this.classRepo.save(klass);
  }
}
