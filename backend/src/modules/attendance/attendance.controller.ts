import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { QueryAttendanceByDateDto } from './dto/query-attendance-by-date.dto';
import { toAttendanceView } from './dto/attendance-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Taking/correcting attendance: same role pair as POST /students and
  // PATCH /students/:id (school_admin, staff). accountant, being
  // financial-only elsewhere in the app, is not granted a write here;
  // 'parent' is never granted this route, same as every staff-facing
  // endpoint outside /parent/*.
  @Post()
  @Roles('school_admin', 'staff')
  async create(@Body() dto: CreateAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    const attendance = await this.attendanceService.record(dto, user.schoolId, user.id);
    return toAttendanceView(attendance);
  }

  // Read access matches GET /students/:id (school_admin, accountant,
  // staff can all see a student's own record).
  @Get('student/:id')
  @Roles('school_admin', 'accountant', 'staff')
  async findByStudent(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    const records = await this.attendanceService.findByStudent(id, schoolId);
    return records.map(toAttendanceView);
  }

  // Whole-school roster for one calendar day, optionally narrowed by
  // gradeId/academicYearId. Same role gate as the student-scoped read
  // above -- this is an operational view, not a financial one, so it
  // follows the students/grades read convention rather than the
  // reports/tuition one.
  @Get('date/:date')
  @Roles('school_admin', 'accountant', 'staff')
  async findByDate(
    @Param('date') date: string,
    @Query() query: QueryAttendanceByDateDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    const records = await this.attendanceService.findByDate(date, schoolId, query);
    return records.map(toAttendanceView);
  }
}
