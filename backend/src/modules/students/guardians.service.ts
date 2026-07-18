import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Guardian } from './entities/guardian.entity';
import { Student } from './entities/student.entity';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { QueryGuardiansDto } from './dto/query-guardians.dto';
import { normalizePagination } from '../../common/utils/pagination';

@Injectable()
export class GuardiansService {
  constructor(
    @InjectRepository(Guardian)
    private readonly guardianRepo: Repository<Guardian>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
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

  /**
   * GET /guardians — school_admin/staff-facing guardian directory,
   * optionally narrowed by a search term matched against fullName OR
   * phone. Same bounded-pagination shape as
   * StudentsService.findWithFilters() (Phase 4A) — a school with a
   * large family roster must never load every guardian row on every
   * request.
   */
  async findAllForSchool(schoolId: string, query: QueryGuardiansDto): Promise<Guardian[]> {
    const qb = this.guardianRepo
      .createQueryBuilder('guardian')
      .where('guardian.schoolId = :schoolId', { schoolId });

    if (query.search) {
      qb.andWhere('(guardian.fullName ILIKE :search OR guardian.phone ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const { limit, skip } = normalizePagination(query);

    return qb.orderBy('guardian.fullName', 'ASC').skip(skip).take(limit).getMany();
  }

  /**
   * GET /guardians/:id — one guardian's file: their own info plus every
   * student currently linked to them (guardian_id on the students row),
   * including soft-deleted/withdrawn ones so the file stays a complete
   * history rather than silently dropping a withdrawn sibling. Tenant
   * check follows StudentsService.findOne()'s shape: a single
   * schoolId-scoped existence check, so a wrong-tenant id 404s exactly
   * like a nonexistent one.
   */
  async findOneForSchool(id: string, schoolId: string): Promise<{ guardian: Guardian; students: Student[] }> {
    const guardian = await this.guardianRepo.findOne({ where: { id, schoolId } });
    if (!guardian) {
      throw new NotFoundException('والد یافت نشد');
    }
    const students = await this.studentRepo.find({
      where: { guardianId: id },
      relations: ['grade'],
      withDeleted: true,
    });
    return { guardian, students };
  }

  /**
   * PATCH /guardians/:id — corrects a guardian's own contact info
   * (fullName/phone/nationalId). Tenant-checked the same way
   * findOneForSchool() is. A changed phone is checked against every
   * other guardian in the same school first: findOrCreate() reuses a
   * guardian by (schoolId, phone), so silently letting two guardian rows
   * share a phone here would make a future sibling enrollment reuse the
   * wrong one.
   */
  async update(id: string, dto: UpdateGuardianDto, schoolId: string): Promise<Guardian> {
    const guardian = await this.guardianRepo.findOne({ where: { id, schoolId } });
    if (!guardian) {
      throw new NotFoundException('والد یافت نشد');
    }

    if (dto.phone && dto.phone !== guardian.phone) {
      const conflict = await this.guardianRepo.findOne({
        where: { phone: dto.phone, schoolId },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException('این شماره تلفن قبلاً برای والد دیگری ثبت شده است');
      }
    }

    Object.assign(guardian, dto);
    return this.guardianRepo.save(guardian);
  }
}
