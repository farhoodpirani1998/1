import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { UpdateTimetableEntryDto } from './dto/update-timetable-entry.dto';
import { QueryTimetableDto } from './dto/query-timetable.dto';
import { toTimetableEntryView } from './dto/timetable-entry-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// school_admin-only management surface. Reader-facing access
// (GET /teacher/timetable, GET /parent/students/:id/timetable) is served
// by TeacherController / ParentController instead, reusing
// TimetableService directly -- same "one controller manages, dedicated
// portal controllers read" shape as AnnouncementsController /
// AnnouncementsService.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Post()
  @Roles('school_admin')
  async create(@Body() dto: CreateTimetableEntryDto, @CurrentUser('schoolId') schoolId: string) {
    const entry = await this.timetableService.create(dto, schoolId);
    return toTimetableEntryView(entry);
  }

  @Get()
  @Roles('school_admin')
  async findAll(@Query() query: QueryTimetableDto, @CurrentUser('schoolId') schoolId: string) {
    const entries = await this.timetableService.findAllForSchool(schoolId, query);
    return entries.map(toTimetableEntryView);
  }

  @Put(':id')
  @Roles('school_admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTimetableEntryDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    const entry = await this.timetableService.update(id, dto, schoolId);
    return toTimetableEntryView(entry);
  }

  @Delete(':id')
  @Roles('school_admin')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    await this.timetableService.remove(id, schoolId);
  }
}
