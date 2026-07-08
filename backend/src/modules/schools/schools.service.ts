import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from './entities/school.entity';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  create(dto: CreateSchoolDto): Promise<School> {
    const school = this.schoolRepo.create({ ...dto, isActive: true });
    return this.schoolRepo.save(school);
  }

  findAll(): Promise<School[]> {
    return this.schoolRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<School> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) {
      throw new NotFoundException('مدرسه یافت نشد');
    }
    return school;
  }

  async update(id: string, dto: UpdateSchoolDto): Promise<School> {
    const school = await this.findOne(id);
    Object.assign(school, dto);
    return this.schoolRepo.save(school);
  }

  // No hard delete: a school with historical students/payments should
  // only ever be deactivated, never removed.
  async deactivate(id: string): Promise<School> {
    return this.update(id, { isActive: false });
  }
}
