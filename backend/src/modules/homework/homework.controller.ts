import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { QueryHomeworkDto } from './dto/query-homework.dto';
import { toHomeworkView } from './dto/homework-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// school_admin-only read surface. Teacher-side management
// (POST/PUT/DELETE/GET /teacher/homework) and parent-side read
// (GET /parent/students/:id/homework) are served by TeacherController /
// ParentController instead, reusing HomeworkService directly -- same
// "one controller manages nothing here, dedicated portal controllers
// write/read" shape as TimetableController / AnnouncementsController.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('homework')
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Get()
  @Roles('school_admin')
  async findAll(@Query() query: QueryHomeworkDto, @CurrentUser('schoolId') schoolId: string) {
    const homework = await this.homeworkService.findAllForSchool(schoolId, query);
    return homework.map(toHomeworkView);
  }

  // Global Search's homework results link here -- roles match
  // SearchController's, not just findAll() above, since accountant/staff
  // can already see a homework row's title/due date in a search result
  // and shouldn't hit a 403 opening it.
  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  async findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    const homework = await this.homeworkService.findOneForSchool(id, schoolId);
    return toHomeworkView(homework);
  }
}
