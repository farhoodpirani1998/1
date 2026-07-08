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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Post('tuition-plans/:id/installments/generate')
  @Roles('school_admin', 'accountant')
  generate(
    @Param('id') tuitionPlanId: string,
    @Body() dto: GenerateInstallmentsDto,
  ) {
    return this.installmentsService.generate(tuitionPlanId, dto);
  }

  @Get('installments')
  findWithFilters(
    @Query() query: QueryInstallmentsDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    // schoolId always comes from the authenticated user's JWT, never from
    // the query string — a client-supplied schoolId is ignored so
    // school_admin/accountant/staff can never read another school's data.
    return this.installmentsService.findWithFilters({ ...query, schoolId });
  }

  @Get('installments/:id')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.installmentsService.findOne(id, schoolId);
  }

  @Patch('installments/:id')
  @Roles('school_admin', 'accountant')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInstallmentDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.installmentsService.update(id, dto, schoolId);
  }
}
