import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { InstallmentsService } from './installments.service';
import { GenerateInstallmentsDto } from '../dto/generate-installments.dto';
import { QueryInstallmentsDto } from '../dto/query-installments.dto';
import { UpdateInstallmentDto } from '../dto/update-installment.dto';
import { OverrideInstallmentStatusDto } from '../dto/override-installment-status.dto';
import { WriteOffInstallmentDto } from '../dto/write-off-installment.dto';
import { AddInstallmentDto } from '../dto/add-installment.dto';
import { RemoveInstallmentDto } from '../dto/remove-installment.dto';
import { RenegotiateInstallmentsDto } from '../dto/renegotiate-installments.dto';
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

  // Appends one installment to an already-generated schedule. Same
  // sensitivity class as renegotiate/remove — changing the shape of a
  // schedule the family has already seen — so it's school_admin-only and
  // gated by the dedicated permission rather than the broader
  // school_admin/accountant split used for ordinary generation.
  @Post('tuition-plans/:id/installments')
  @Roles('school_admin')
  @RequirePermission(Permission.INSTALLMENT_SCHEDULE_EDIT)
  addInstallment(
    @Param('id') tuitionPlanId: string,
    @Body() dto: AddInstallmentDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.installmentsService.addInstallment(tuitionPlanId, dto, user.schoolId, user.id);
  }

  // Rebuilds the unpaid remainder of a plan's schedule into a new set of
  // installments — everything already paid/cancelled/deferred/disputed/
  // written-off is left untouched. See InstallmentsService.renegotiate().
  @Post('tuition-plans/:id/installments/renegotiate')
  @Roles('school_admin')
  @RequirePermission(Permission.INSTALLMENT_SCHEDULE_EDIT)
  renegotiate(
    @Param('id') tuitionPlanId: string,
    @Body() dto: RenegotiateInstallmentsDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.installmentsService.renegotiate(tuitionPlanId, dto, user.schoolId, user.id);
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

  // Forgives whatever remains owed on this installment. school_admin-only
  // — see InstallmentsService.writeOff() for why this is kept apart from
  // overrideStatus's plain 'cancelled' transition.
  @Patch('installments/:id/write-off')
  @Roles('school_admin')
  @RequirePermission(Permission.INSTALLMENT_WRITE_OFF)
  writeOff(
    @Param('id') id: string,
    @Body() dto: WriteOffInstallmentDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.installmentsService.writeOff(id, dto, user.schoolId, user.id);
  }

  // Only a PENDING installment can be removed outright — see
  // InstallmentsService.removeInstallment() for the reasoning.
  @Delete('installments/:id')
  @Roles('school_admin')
  @RequirePermission(Permission.INSTALLMENT_SCHEDULE_EDIT)
  @HttpCode(200)
  removeInstallment(
    @Param('id') id: string,
    @Body() dto: RemoveInstallmentDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.installmentsService.removeInstallment(id, dto, user.schoolId, user.id);
  }
}
