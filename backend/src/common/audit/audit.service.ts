import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './audit-log.entity';
import {
  normalizePagination,
  type PaginatedResult,
} from '../utils/pagination';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

export interface RecordAuditParams {
  schoolId: string | null;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

/**
 * The only place that writes to `audit_logs`. Deliberately has no
 * update()/remove() — corrections don't exist for an audit trail, only
 * new rows describing what actually happened next.
 *
 * A logging failure here must never break the business action that
 * triggered it (a payment that already committed shouldn't fail because
 * the audit insert had a hiccup), so `record()` swallows and logs its own
 * errors rather than throwing. This mirrors how NotificationsService
 * failures are handled in the existing event listeners.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(params: RecordAuditParams): Promise<void> {
    try {
      await this.auditRepo.insert({
        schoolId: params.schoolId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: (params.oldValue as any) ?? null,
        newValue: (params.newValue as any) ?? null,
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${params.action} on ${params.entityType}:${params.entityId}`,
        err as Error,
      );
    }
  }

  async findForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async findForSchool(schoolId: string, limit = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { schoolId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Backs GET /audit-logs (AuditController). `schoolId` is resolved by the
   * controller from the authenticated user, never from the query string —
   * `null` means "no schoolId filter" (super_admin, sees every school),
   * a real id means "scoped to exactly this school" (school_admin). This
   * is the only difference from findForSchool() above: everything else
   * (indexes used, append-only shape of what's returned) is the same.
   *
   * Reuses normalizePagination() (common/utils/pagination.ts) rather than
   * a new pagination implementation — same DEFAULT_PAGE_LIMIT/
   * MAX_PAGE_LIMIT ceiling every other list endpoint in this codebase
   * already applies. Always returns the wrapped PaginatedResult shape
   * (unlike findAll()-style endpoints elsewhere that conditionally return
   * a plain array): this is a new, dedicated read endpoint with no legacy
   * plain-array caller to stay compatible with.
   */
  async findWithFilters(
    schoolId: string | null,
    filters: QueryAuditLogsDto,
  ): Promise<PaginatedResult<AuditLog>> {
    const { page, limit, skip } = normalizePagination(filters);

    const qb = this.auditRepo.createQueryBuilder('audit');

    if (schoolId !== null) {
      qb.andWhere('audit.schoolId = :schoolId', { schoolId });
    }
    if (filters.action !== undefined) {
      qb.andWhere('audit.action = :action', { action: filters.action });
    }
    if (filters.entityType !== undefined) {
      qb.andWhere('audit.entityType = :entityType', { entityType: filters.entityType });
    }
    if (filters.entityId !== undefined) {
      qb.andWhere('audit.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters.userId !== undefined) {
      qb.andWhere('audit.userId = :userId', { userId: filters.userId });
    }
    if (filters.dateFrom !== undefined) {
      qb.andWhere('audit.createdAt >= :dateFrom', { dateFrom: new Date(filters.dateFrom) });
    }
    if (filters.dateTo !== undefined) {
      qb.andWhere('audit.createdAt <= :dateTo', { dateTo: new Date(filters.dateTo) });
    }

    qb.orderBy('audit.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
