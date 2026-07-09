import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Guardian } from './entities/guardian.entity';
import { CreateGuardianDto } from './dto/create-guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(
    @InjectRepository(Guardian)
    private readonly guardianRepo: Repository<Guardian>,
  ) {}

  /**
   * Reuses an existing guardian by phone within the same school instead of
   * creating a duplicate — common when a second child from the same family
   * enrolls. Accepts an optional transactional EntityManager so it can be
   * called from inside StudentsService's create() transaction.
   */
  async findOrCreate(
    dto: CreateGuardianDto,
    schoolId: string,
    manager?: EntityManager,
  ): Promise<Guardian> {
    const repo = manager ? manager.getRepository(Guardian) : this.guardianRepo;

    const existing = await repo.findOne({
      where: { phone: dto.phone, schoolId },
    });
    if (existing) {
      return existing;
    }

    const guardian = repo.create({
      schoolId,
      fullName: dto.fullName,
      phone: dto.phone,
      nationalId: dto.nationalId ?? null,
    });
    return repo.save(guardian);
  }

  async findOne(id: string): Promise<Guardian> {
    const guardian = await this.guardianRepo.findOne({ where: { id } });
    if (!guardian) {
      throw new NotFoundException('والد یافت نشد');
    }
    return guardian;
  }
}
