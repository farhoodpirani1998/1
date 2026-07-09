import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { VoidPaymentDto } from '../dto/void-payment.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../../../common/authorization/permissions.guard';
import { RequirePermission } from '../../../common/authorization/require-permission.decorator';
import { Permission } from '../../../common/authorization/permissions';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('installments/:id/payments')
  @Roles('school_admin', 'accountant')
  async create(
    @Param('id') installmentId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    const result = await this.paymentsService.create(installmentId, dto, user.id, user.schoolId);
    return result;
  }

  // Payment history is financial data — staff shouldn't see it by
  // default (previously had no @Roles here, so any authenticated role
  // including staff could list every payment for the school).
  //
  // page/limit are optional (Phase 4A pagination); omitting them still
  // returns an array, just bounded by DEFAULT_PAGE_LIMIT instead of the
  // school's entire payment history.
  @Get('payments')
  @Roles('school_admin', 'accountant')
  findAll(
    @Query('studentId') studentId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.paymentsService.findAll(schoolId, studentId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // Clean data endpoint for a printable receipt — no PDF generation yet,
  // per the roadmap. Same financial-history restriction as the list
  // endpoint above; previously had no @Roles, letting staff pull any
  // receipt for the school.
  @Get('payments/:id/receipt')
  @Roles('school_admin', 'accountant')
  getReceipt(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.paymentsService.getReceipt(id, schoolId);
  }

  // Voiding money that already moved is a bigger deal than recording it,
  // so this is school_admin-only *and* gated by the finer-grained
  // PAYMENT_VOID permission (today the two line up, but the permission
  // layer means we can loosen the role without silently loosening this).
  @Delete('payments/:id')
  @Roles('school_admin')
  @RequirePermission(Permission.PAYMENT_VOID)
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @Body() dto: VoidPaymentDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    await this.paymentsService.void(id, dto.reason, user.id, user.schoolId);
  }
}
