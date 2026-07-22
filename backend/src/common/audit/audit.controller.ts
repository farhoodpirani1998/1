import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '../authorization/roles.enum';

/**
 * Sprint 2 — Feature 3 Part 2: read-only access to `audit_logs`. Nothing
 * here ever writes — that's still AuditService.record()/AuditEventsListener
 * exclusively (see audit.service.ts's own comment on why there's no
 * update()/remove()).
 *
 * Restricted to super_admin/school_admin: audit rows include security
 * events (logins, lockouts, password changes) and financial reversals,
 * which is more sensitive than the entity data the actions describe, so
 * this deliberately does not follow the broader
 * accountant/staff-can-read-financials pattern the rest of the tuition
 * module uses.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'school_admin')
@ApiTags('Audit')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // Tenant isolation: schoolId is never read from the query string.
  // - school_admin: always scoped to their own token's schoolId — a
  //   school_admin can never see another school's rows no matter what
  //   they pass in the query.
  // - super_admin: RolesGuard already lets super_admin bypass any
  //   @Roles() list, and super_admin's own schoolId is null (same "no
  //   single school" shape as everywhere else this role appears), so
  //   passing null through to AuditService.findWithFilters() correctly
  //   means "every school".
  @Get()
  findAll(
    @Query() query: QueryAuditLogsDto,
    @CurrentUser('role') role: string,
    @CurrentUser('schoolId') schoolId: string | null,
  ) {
    const scopedSchoolId = role === Role.SUPER_ADMIN ? null : schoolId;
    return this.auditService.findWithFilters(scopedSchoolId, query);
  }
}
