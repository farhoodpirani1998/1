import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('academic-years')
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Post()
  @Roles('school_admin')
  create(
    @Body() dto: CreateAcademicYearDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.academicYearsService.create(dto, schoolId);
  }

  // Previously had no @Roles, so any authenticated role was let through.
  // Phase 5A's new 'parent' role must be excluded here same as everywhere
  // else outside /parent/*; existing school_admin/accountant/staff access
  // is unchanged.
  @Get()
  @Roles('school_admin', 'accountant', 'staff')
  findAll(@CurrentUser('schoolId') schoolId: string) {
    return this.academicYearsService.findAll(schoolId);
  }

  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.academicYearsService.findOne(id, schoolId);
  }

  @Patch(':id')
  @Roles('school_admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.academicYearsService.update(id, dto, schoolId);
  }
}
