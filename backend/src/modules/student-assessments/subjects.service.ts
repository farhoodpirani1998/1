import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';

// Mirrors GradesService exactly (same shape as modules/grades) -- a
// subject is the same kind of small, school-scoped reference list a
// grade level is, just for a different concept.
@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
  ) {}

  create(dto: CreateSubjectDto, schoolId: string): Promise<Subject> {
    const subject = this.subjectRepo.create({ schoolId, title: dto.title });
    return this.subjectRepo.save(subject);
  }

  findAll(schoolId: string): Promise<Subject[]> {
    return this.subjectRepo.find({ where: { schoolId }, order: { title: 'ASC' } });
  }

  async findOne(id: string, schoolId: string): Promise<Subject> {
    const subject = await this.subjectRepo.findOne({ where: { id, schoolId } });
    if (!subject) {
      throw new NotFoundException('درس یافت نشد');
    }
    return subject;
  }
}
