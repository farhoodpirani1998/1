import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { toAnnouncementView } from './dto/announcement-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

// school_admin-only management surface. Reader-facing access
// (GET /teacher/announcements, GET /parent/announcements) is served by
// TeacherController / ParentController instead, reusing AnnouncementsService
// directly -- same "one controller manages, dedicated portal controllers
// read" shape as ParentModule's /parent/students/:id/attendance and
// /parent/students/:id/assessments reusing AttendanceService /
// AssessmentsService without going through a StudentsController.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @Roles('school_admin')
  async create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    const announcement = await this.announcementsService.create(dto, user.schoolId, user.id);
    return toAnnouncementView(announcement);
  }

  @Get()
  @Roles('school_admin')
  async findAll(@CurrentUser('schoolId') schoolId: string) {
    const announcements = await this.announcementsService.findAllForSchool(schoolId);
    return announcements.map(toAnnouncementView);
  }

  @Delete(':id')
  @Roles('school_admin')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    await this.announcementsService.delete(id, schoolId);
  }
}
