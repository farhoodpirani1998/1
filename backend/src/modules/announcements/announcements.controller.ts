import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { toAnnouncementView } from './dto/announcement-view.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

// school_admin-only management surface. Reader-facing access
// (GET /teacher/announcements, GET /parent/announcements) is served by
// TeacherController / ParentController instead, reusing AnnouncementsService
// directly -- same "one controller manages, dedicated portal controllers
// read" shape as ParentModule's /parent/students/:id/attendance and
// /parent/students/:id/assessments reusing AttendanceService /
// AssessmentsService without going through a StudentsController.
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Announcements')
@ApiBearerAuth('access-token')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @ApiOperation({ summary: 'Publish an announcement to the school (visible to teacher/parent/student portals)' })
  @Post()
  @Roles('school_admin')
  async create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    const announcement = await this.announcementsService.create(dto, user.schoolId, user.id);
    return toAnnouncementView(announcement);
  }

  @Get()
  @Roles('school_admin')
  async findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    const result = await this.announcementsService.findAllForSchool(schoolId, query);
    if (Array.isArray(result)) {
      return result.map(toAnnouncementView);
    }
    return { ...result, data: result.data.map(toAnnouncementView) };
  }

  // Global Search's announcement results link here -- roles match
  // SearchController's, not just findAll() above, since accountant/staff
  // can already see an announcement's title in a search result and
  // shouldn't hit a 403 opening it.
  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  async findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    const announcement = await this.announcementsService.findOneForSchool(id, schoolId);
    return toAnnouncementView(announcement);
  }

  @Delete(':id')
  @Roles('school_admin')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    await this.announcementsService.delete(id, schoolId);
  }
}
