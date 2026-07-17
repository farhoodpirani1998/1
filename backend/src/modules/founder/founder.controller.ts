import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { FounderService } from './founder.service';
import { LinkFounderSchoolDto } from './dto/link-founder-school.dto';
import { QueryStudentsDto } from '../students/dto/query-students.dto';
import { GetDashboardQueryDto } from '../analytics/dto/get-dashboard-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Phase 5O: Founder (مؤسس) Portal.
//
// Every 'founder'-role route here is read-only and scoped to only the
// schools this founder owns (see FounderService.assertOwnsSchool) — a
// founder never gets a @Roles() grant on any staff-facing endpoint,
// same isolation shape as ParentController / TeacherController. The
// link/unlink pair at the bottom is the only mutating part of this
// controller, and is super_admin-only (same "management lives next to
// the read routes it configures" shape ParentController.link/unlink
// already uses).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('founder')
export class FounderController {
  constructor(private readonly founderService: FounderService) {}

  @Get('schools')
  @Roles('founder')
  findMySchools(@CurrentUser('id') founderId: string) {
    return this.founderService.findMySchools(founderId);
  }

  // Aggregated dashboard across every school this founder owns — one
  // row per school plus grand totals. See GET /founder/schools/:schoolId
  // /dashboard for the full single-school analytics view.
  @Get('overview')
  @Roles('founder')
  getOverview(@CurrentUser('id') founderId: string) {
    return this.founderService.getOverview(founderId);
  }

  @Get('schools/:schoolId/dashboard')
  @Roles('founder')
  getSchoolDashboard(
    @Param('schoolId') schoolId: string,
    @Query() query: GetDashboardQueryDto,
    @CurrentUser('id') founderId: string,
  ) {
    return this.founderService.getSchoolDashboard(founderId, schoolId, query);
  }

  @Get('schools/:schoolId/students')
  @Roles('founder')
  getStudents(
    @Param('schoolId') schoolId: string,
    @Query() query: QueryStudentsDto,
    @CurrentUser('id') founderId: string,
  ) {
    return this.founderService.getStudents(founderId, schoolId, query);
  }

  @Get('schools/:schoolId/teachers')
  @Roles('founder')
  getTeachers(@Param('schoolId') schoolId: string, @CurrentUser('id') founderId: string) {
    return this.founderService.getTeachers(founderId, schoolId);
  }

  @Get('schools/:schoolId/staff')
  @Roles('founder')
  getStaff(@Param('schoolId') schoolId: string, @CurrentUser('id') founderId: string) {
    return this.founderService.getStaff(founderId, schoolId);
  }

  @Get('schools/:schoolId/tuition')
  @Roles('founder')
  getTuition(@Param('schoolId') schoolId: string, @CurrentUser('id') founderId: string) {
    return this.founderService.getTuitionOverview(founderId, schoolId);
  }

  // Admin-side management of the founder <-> school relationship itself.
  // A founder account is created via POST /auth/register with
  // role: 'founder' (no schoolId), then a super_admin links it to the
  // school(s) it owns here — same two-step shape as a parent login
  // getting linked to students via POST /parent/link.
  @Post('link')
  @Roles('super_admin')
  link(@Body() dto: LinkFounderSchoolDto) {
    return this.founderService.link(dto);
  }

  @Delete('link/:id')
  @Roles('super_admin')
  @HttpCode(204)
  async unlink(@Param('id') id: string) {
    await this.founderService.unlink(id);
  }
}
