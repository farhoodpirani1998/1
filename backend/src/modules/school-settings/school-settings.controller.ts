import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SchoolSettingsService } from './school-settings.service';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';
import { toSchoolSettingsView } from './dto/school-settings-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// school_admin-only. schoolId always comes from the authenticated user's
// own token (CurrentUser), never from the request body/params -- there
// is no :schoolId route param anywhere in this controller, so a
// school_admin can never address another school's settings even by
// guessing an id. Same tenant-isolation shape as every other
// school_admin-scoped controller in this codebase.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SchoolSettingsController {
  constructor(private readonly schoolSettingsService: SchoolSettingsService) {}

  @Get()
  @Roles('school_admin')
  async findMine(@CurrentUser('schoolId') schoolId: string) {
    const settings = await this.schoolSettingsService.findOrCreate(schoolId);
    return toSchoolSettingsView(settings);
  }

  @Put()
  @Roles('school_admin')
  async update(
    @Body() dto: UpdateSchoolSettingsDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    const settings = await this.schoolSettingsService.update(schoolId, dto);
    return toSchoolSettingsView(settings);
  }
}
