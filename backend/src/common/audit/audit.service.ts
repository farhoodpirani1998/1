import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './audit-log.entity';

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
}
