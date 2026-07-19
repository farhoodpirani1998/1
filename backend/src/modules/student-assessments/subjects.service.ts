import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

// Postgres error code for a foreign-key violation -- raised when the row
// being deleted is still referenced by another table's subject_id
// (homework, assessments, teacher_assignments, timetable_entries all
// REFERENCE subjects(id) with no ON DELETE CASCADE). Caught in remove()
// below and turned into a friendly Persian message instead of a raw DB
// error, same "catch (err).code" shape school-settings.service.ts
// already uses for its own Postgres error code.
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';

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

  async update(id: string, dto: UpdateSubjectDto, schoolId: string): Promise<Subject> {
    const subject = await this.findOne(id, schoolId);
    subject.title = dto.title;
    return this.subjectRepo.save(subject);
  }

  async remove(id: string, schoolId: string): Promise<void> {
    await this.findOne(id, schoolId);
    try {
      await this.subjectRepo.delete({ id, schoolId });
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === POSTGRES_FOREIGN_KEY_VIOLATION) {
        throw new ConflictException(
          'این درس در تکالیف، ارزیابی‌ها، تخصیص معلمان یا برنامه هفتگی استفاده شده و قابل حذف نیست',
        );
      }
      throw err;
    }
  }
}
