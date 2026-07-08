import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscountType } from './entities/discount-type.entity';
import { CreateDiscountTypeDto } from './dto/create-discount-type.dto';
import { UpdateDiscountTypeDto } from './dto/update-discount-type.dto';

@Injectable()
export class DiscountTypesService {
  constructor(
    @InjectRepository(DiscountType)
    private readonly discountTypeRepo: Repository<DiscountType>,
  ) {}

  create(dto: CreateDiscountTypeDto, schoolId: string): Promise<DiscountType> {
    const type = this.discountTypeRepo.create({
      schoolId,
      title: dto.title,
      defaultPercent: dto.defaultPercent ?? null,
      isActive: true,
    });
    return this.discountTypeRepo.save(type);
  }

  findAll(schoolId: string): Promise<DiscountType[]> {
    return this.discountTypeRepo.find({ where: { schoolId }, order: { title: 'ASC' } });
  }

  async findOne(id: string, schoolId: string): Promise<DiscountType> {
    const type = await this.discountTypeRepo.findOne({ where: { id, schoolId } });
    if (!type) {
      throw new NotFoundException('نوع تخفیف یافت نشد');
    }
    return type;
  }

  async update(id: string, dto: UpdateDiscountTypeDto, schoolId: string): Promise<DiscountType> {
    const type = await this.findOne(id, schoolId);
    Object.assign(type, dto);
    return this.discountTypeRepo.save(type);
  }
}
