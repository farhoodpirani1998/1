import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post()
  @Roles('school_admin')
  create(@Body() dto: CreateGradeDto, @CurrentUser('schoolId') schoolId: string) {
    return this.gradesService.create(dto, schoolId);
  }

  // Previously had no @Roles, so any authenticated role was let through.
  // Phase 5A's new 'parent' role must be excluded here same as everywhere
  // else outside /parent/*; existing school_admin/accountant/staff access
  // is unchanged.
  @Get()
  @Roles('school_admin', 'accountant', 'staff')
  findAll(@CurrentUser('schoolId') schoolId: string) {
    return this.gradesService.findAll(schoolId);
  }

  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.gradesService.findOne(id, schoolId);
  }
}
