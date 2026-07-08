import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AcademicYear } from './entities/academic-year.entity';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(
    @InjectRepository(AcademicYear)
    private readonly academicYearRepo: Repository<AcademicYear>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateAcademicYearDto, schoolId: string): Promise<AcademicYear> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AcademicYear);

      // If this year is being marked current, unset the previous current
      // year first — the DB's partial unique index on (school_id) WHERE
      // is_current is the real guard against races, but doing it here too
      // means a plain "create as current" doesn't need a second API call.
      if (dto.isCurrent) {
        await repo.update({ schoolId, isCurrent: true }, { isCurrent: false });
      }

      const year = repo.create({
        schoolId,
        title: dto.title,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        isCurrent: dto.isCurrent ?? false,
      });
      return repo.save(year);
    });
  }

  findAll(schoolId: string): Promise<AcademicYear[]> {
    return this.academicYearRepo.find({
      where: { schoolId },
      order: { startDate: 'DESC' },
    });
  }

  async findOne(id: string, schoolId: string): Promise<AcademicYear> {
    const year = await this.academicYearRepo.findOne({ where: { id, schoolId } });
    if (!year) {
      throw new NotFoundException('سال تحصیلی یافت نشد');
    }
    return year;
  }

  async update(
    id: string,
    dto: UpdateAcademicYearDto,
    schoolId: string,
  ): Promise<AcademicYear> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AcademicYear);
      const year = await repo.findOne({ where: { id, schoolId } });
      if (!year) {
        throw new NotFoundException('سال تحصیلی یافت نشد');
      }

      if (dto.isCurrent) {
        await repo.update(
          { schoolId, isCurrent: true },
          { isCurrent: false },
        );
      }

      Object.assign(year, dto);
      return repo.save(year);
    });
  }
}
