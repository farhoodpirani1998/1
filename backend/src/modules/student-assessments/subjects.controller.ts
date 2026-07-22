import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

// Same role gates as GradesController: school_admin manages the list,
// school_admin/accountant/staff can read it (staff need it to pick a
// subject when posting an assessment; accountant is read-only here same
// as it is on /grades). 'parent' is never granted this route, same as
// every staff-facing endpoint outside /parent/*.
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Subjects')
@ApiBearerAuth('access-token')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @Roles('school_admin')
  create(@Body() dto: CreateSubjectDto, @CurrentUser('schoolId') schoolId: string) {
    return this.subjectsService.create(dto, schoolId);
  }

  @Get()
  @Roles('school_admin', 'accountant', 'staff')
  findAll(@CurrentUser('schoolId') schoolId: string) {
    return this.subjectsService.findAll(schoolId);
  }

  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.subjectsService.findOne(id, schoolId);
  }

  @Patch(':id')
  @Roles('school_admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.subjectsService.update(id, dto, schoolId);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.subjectsService.remove(id, schoolId);
  }
}
