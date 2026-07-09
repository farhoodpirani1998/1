import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { InstallmentsService } from './installments.service';
import { GenerateInstallmentsDto } from '../dto/generate-installments.dto';
import { QueryInstallmentsDto } from '../dto/query-installments.dto';
import { UpdateInstallmentDto } from '../dto/update-installment.dto';
import { OverrideInstallmentStatusDto } from '../dto/override-installment-status.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../../common/authorization/permissions.guard';
import { RequirePermission } from '../../../common/authorization/require-permission.decorator';
import { Permission } from '../../../common/authorization/permissions';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller()
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Post('tuition-plans/:id/installments/generate')
  @Roles('school_admin', 'accountant')
  generate(
    @Param('id') tuitionPlanId: string,
    @Body() dto: GenerateInstallmentsDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.installmentsService.generate(tuitionPlanId, dto, schoolId);
  }

  // Installment amounts/due dates/payment status are financial history —
  // same sensitivity class as /payments and /reports, so staff is
  // excluded here too (previously had no @Roles, so any authenticated
  // role including staff could list or read any installment).
  @Get('installments')
  @Roles('school_admin', 'accountant')
  findWithFilters(
    @Query() query: QueryInstallmentsDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    // schoolId always comes from the authenticated user's JWT, never from
    // the query string — a client-supplied schoolId is ignored so
    // school_admin/accountant can never read another school's data.
    return this.installmentsService.findWithFilters({ ...query, schoolId });
  }

  @Get('installments/:id')
  @Roles('school_admin', 'accountant')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.installmentsService.findOne(id, schoolId);
  }

  @Patch('installments/:id')
  @Roles('school_admin', 'accountant')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInstallmentDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.installmentsService.update(id, dto, user.schoolId, user.id);
  }

  // Manual lifecycle override (cancel/defer/dispute/reinstate) — a
  // different, rarer action than editing amount/due_date, so it's gated
  // by its own fine-grained permission on top of the role check.
  @Patch('installments/:id/status')
  @Roles('school_admin', 'accountant')
  @RequirePermission(Permission.INSTALLMENT_STATUS_OVERRIDE)
  overrideStatus(
    @Param('id') id: string,
    @Body() dto: OverrideInstallmentStatusDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.installmentsService.overrideStatus(id, dto, user.schoolId, user.id);
  }
}
