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
import { TuitionPlansService } from './tuition-plans.service';
import { CreateTuitionPlanDto } from '../dto/create-tuition-plan.dto';
import { UpdateTuitionPlanDto } from '../dto/update-tuition-plan.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tuition-plans')
export class TuitionPlansController {
  constructor(private readonly tuitionPlansService: TuitionPlansService) {}

  @Post()
  @Roles('school_admin', 'accountant')
  create(
    @Body() dto: CreateTuitionPlanDto,
    @CurrentUser() user: { id: string; schoolId: string; role: string },
  ) {
    return this.tuitionPlansService.create(dto, user.schoolId, { id: user.id, role: user.role });
  }

  // Financial data (base/discount/final amounts) — previously had no
  // @Roles, so any authenticated role was let through. Phase 5A's new
  // 'parent' role must be excluded here same as everywhere else outside
  // /parent/*; the existing school_admin/accountant/staff access is
  // unchanged.
  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.tuitionPlansService.findOne(id, schoolId);
  }

  @Get()
  @Roles('school_admin', 'accountant', 'staff')
  findByStudent(
    @Query('studentId') studentId: string,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.tuitionPlansService.findByStudent(studentId, schoolId);
  }

  @Patch(':id')
  @Roles('school_admin', 'accountant')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTuitionPlanDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.tuitionPlansService.update(id, dto, user, user.schoolId);
  }
}
