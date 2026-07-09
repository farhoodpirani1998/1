import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TuitionPlan } from '../entities/tuition-plan.entity';
import { Student } from '../../students/entities/student.entity';
import { DiscountType } from '../../discount-types/entities/discount-type.entity';
import { CreateTuitionPlanDto } from '../dto/create-tuition-plan.dto';
import { UpdateTuitionPlanDto } from '../dto/update-tuition-plan.dto';

@Injectable()
export class TuitionPlansService {
  constructor(
    @InjectRepository(TuitionPlan)
    private readonly tuitionPlanRepo: Repository<TuitionPlan>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(DiscountType)
    private readonly discountTypeRepo: Repository<DiscountType>,
  ) {}

  /**
   * Resolves the final discount amount: an explicit discountAmount always
   * wins (this is how "manager approves a bigger discount than the
   * default" works); otherwise, if a discountTypeId was given, the type's
   * defaultPercent is applied to baseAmount.
   */
  private async resolveDiscountAmount(
    baseAmount: number,
    discountTypeId: string | undefined,
    discountAmount: number | undefined,
    schoolId: string,
  ): Promise<number> {
    if (discountAmount !== undefined) {
      return discountAmount;
    }
    if (!discountTypeId) {
      return 0;
    }

    const type = await this.discountTypeRepo.findOne({ where: { id: discountTypeId, schoolId } });
    if (!type) {
      throw new NotFoundException('نوع تخفیف یافت نشد');
    }
    if (!type.defaultPercent) {
      return 0;
    }
    return Math.round((baseAmount * Number(type.defaultPercent)) / 100);
  }

  async create(dto: CreateTuitionPlanDto, schoolId: string): Promise<TuitionPlan> {
    // Tenant enforcement: the student must belong to the same school as
    // the authenticated user, otherwise a school_admin could create a
    // tuition plan for another school's student just by guessing a UUID.
    const student = await this.studentRepo.findOne({ where: { id: dto.studentId } });
    if (!student) {
      throw new NotFoundException('دانش‌آموز یافت نشد');
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException('این دانش‌آموز متعلق به مدرسه دیگری است');
    }

    const discount = await this.resolveDiscountAmount(
      dto.baseAmount,
      dto.discountTypeId,
      dto.discountAmount,
      schoolId,
    );
    if (discount > dto.baseAmount) {
      throw new BadRequestException('مبلغ تخفیف نمی‌تواند از شهریه پایه بیشتر باشد');
    }

    const plan = this.tuitionPlanRepo.create({
      studentId: dto.studentId,
      academicYearId: dto.academicYearId,
      baseAmount: dto.baseAmount,
      discountAmount: discount,
      discountTypeId: dto.discountTypeId ?? null,
      discountReason: dto.discountReason ?? null,
      finalAmount: dto.baseAmount - discount,
    });

    return this.tuitionPlanRepo.save(plan);
  }

  async findOne(id: string): Promise<TuitionPlan> {
    const plan = await this.tuitionPlanRepo.findOne({
      where: { id },
      relations: ['installments'],
    });
    if (!plan) {
      throw new NotFoundException('برنامه شهریه یافت نشد');
    }
    return plan;
  }

  async findByStudent(studentId: string): Promise<TuitionPlan[]> {
    return this.tuitionPlanRepo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateTuitionPlanDto, schoolId: string): Promise<TuitionPlan> {
    const plan = await this.findOne(id);

    if (plan.installments?.length) {
      throw new BadRequestException('پس از ساخته‌شدن اقساط، امکان ویرایش تخفیف وجود ندارد');
    }

    if (dto.discountTypeId !== undefined || dto.discountAmount !== undefined) {
      const discount = await this.resolveDiscountAmount(
        Number(plan.baseAmount),
        dto.discountTypeId,
        dto.discountAmount,
        schoolId,
      );
      if (discount > Number(plan.baseAmount)) {
        throw new BadRequestException('مبلغ تخفیف نمی‌تواند از شهریه پایه بیشتر باشد');
      }
      plan.discountAmount = discount;
      plan.discountTypeId = dto.discountTypeId ?? plan.discountTypeId;
      plan.finalAmount = Number(plan.baseAmount) - discount;
    }
    if (dto.discountReason !== undefined) {
      plan.discountReason = dto.discountReason;
    }

    return this.tuitionPlanRepo.save(plan);
  }
}
