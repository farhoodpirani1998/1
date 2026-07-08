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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('installments/:id/payments')
  @Roles('school_admin', 'accountant')
  create(
    @Param('id') installmentId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.paymentsService.create(installmentId, dto, user.id, user.schoolId);
  }

  @Get('payments')
  findAll(
    @Query('studentId') studentId: string | undefined,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.paymentsService.findAll(schoolId, studentId);
  }

  @Delete('payments/:id')
  @Roles('school_admin')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    await this.paymentsService.softDelete(id, schoolId);
  }
}
