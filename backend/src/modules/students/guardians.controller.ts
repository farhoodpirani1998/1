import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { QueryGuardiansDto } from './dto/query-guardians.dto';
import { toGuardianView, toGuardianViewWithStudents } from './dto/guardian-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

// Sprint 2 (Educational Operations): guardian file management. Read
// access matches GET /students (school_admin, accountant, staff) — a
// guardian's file is exactly as sensitive as the student roster it's
// derived from. Write access (correcting contact info) matches
// PATCH /students/:id (school_admin, staff) — accountant stays
// read-only here, same as everywhere else guardians appear.
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Guardians')
@ApiBearerAuth('access-token')
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get()
  @Roles('school_admin', 'accountant', 'staff')
  async findAll(@Query() query: QueryGuardiansDto, @CurrentUser('schoolId') schoolId: string) {
    const guardians = await this.guardiansService.findAllForSchool(schoolId, query);
    return guardians.map(toGuardianView);
  }

  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  async findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    const { guardian, students } = await this.guardiansService.findOneForSchool(id, schoolId);
    return toGuardianViewWithStudents(guardian, students);
  }

  @Patch(':id')
  @Roles('school_admin', 'staff')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGuardianDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    const guardian = await this.guardiansService.update(id, dto, schoolId);
    return toGuardianView(guardian);
  }
}
