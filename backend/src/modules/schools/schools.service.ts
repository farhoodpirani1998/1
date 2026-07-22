import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from './entities/school.entity';
import { Student } from '../students/entities/student.entity';
import { User } from '../users/entities/user.entity';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import {
  normalizePagination,
  wantsPaginatedResponse,
  type PaginationParams,
  type PaginatedResult,
} from '../../common/utils/pagination';

export type SchoolWithCounts = School & { studentCount: number; userCount: number };

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

  // Adds studentCount/userCount per school for SchoolsPage.tsx's stat
  // columns. One aggregate query (LEFT JOIN + COUNT DISTINCT, grouped by
  // school) instead of N+1 count queries per school.
  //
  // `student.deleted_at IS NULL` on the join condition excludes archived
  // (soft-deleted) students from the count, matching how every other
  // students query in this codebase treats withdrawn/archived rows.
  //
  // Sprint 1 Feature 5: page/limit are applied as skip()/take() on this
  // same raw query builder, deliberately NOT converted to entity-level
  // pagination -- Postgres applies LIMIT/OFFSET *after* GROUP BY, so
  // skip/take here still slices one row per school (a grouped row),
  // never a raw ungrouped student/user row. The total for the paginated
  // shape is a plain `schoolRepo.count()`, not a count of this grouped
  // query: findAll() has no WHERE filter of its own and the LEFT JOINs
  // never drop a school row (a school with zero students/users still
  // gets one row, with both counts at 0), so "every school" and "every
  // grouped row this query would produce" are always the same number.
  async findAll(
    query: PaginationParams = {},
  ): Promise<SchoolWithCounts[] | PaginatedResult<SchoolWithCounts>> {
    const qb = this.schoolRepo
      .createQueryBuilder('school')
      .leftJoin(Student, 'student', 'student.school_id = school.id AND student.deleted_at IS NULL')
      .leftJoin(User, 'appUser', 'appUser.school_id = school.id')
      .select('school.id', 'id')
      .addSelect('school.name', 'name')
      .addSelect('school.address', 'address')
      .addSelect('school.phone', 'phone')
      .addSelect('school.is_active', 'isActive')
      .addSelect('COUNT(DISTINCT student.id)', 'studentCount')
      .addSelect('COUNT(DISTINCT appUser.id)', 'userCount')
      .groupBy('school.id')
      .orderBy('school.name', 'ASC');

    if (wantsPaginatedResponse(query)) {
      const { page, limit, skip } = normalizePagination(query);
      const [raw, total] = await Promise.all([
        qb.skip(skip).take(limit).getRawMany(),
        this.schoolRepo.count(),
      ]);
      return {
        data: raw.map((row) => this.toSchoolWithCounts(row)),
        total,
        page,
        limit,
      };
    }

    const raw = await qb.getRawMany();
    return raw.map((row) => this.toSchoolWithCounts(row));
  }

  // pg returns COUNT(...) as a string (bigint) — coerce to number for
  // the API response. Split out of findAll() only so the paginated and
  // plain-array branches above share the exact same row-shaping, rather
  // than duplicating the parseInt calls in both.
  private toSchoolWithCounts(row: any): SchoolWithCounts {
    return {
      ...row,
      studentCount: parseInt(row.studentCount, 10),
      userCount: parseInt(row.userCount, 10),
    };
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
