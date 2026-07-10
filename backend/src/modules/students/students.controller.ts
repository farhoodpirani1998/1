import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
// Phase 5D: Student Profile.
import { StudentProfileService } from './profile/student-profile.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly studentProfileService: StudentProfileService,
  ) {}

  @Post()
  @Roles('school_admin', 'staff')
  create(
    @Body() dto: CreateStudentDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.studentsService.create(dto, schoolId);
  }

  // Full student roster — same sensitivity class as tuition-plans below.
  // Phase 5A added the 'parent' role, which must NEVER get a school-wide
  // list this way (a parent may only see their own linked children, via
  // GET /parent/students). Previously had no @Roles here, which was fine
  // when every non-admin/non-super role was staff, but 'parent' being
  // authenticated is not the same as 'parent' being allowed here.
  @Get()
  @Roles('school_admin', 'accountant', 'staff')
  findWithFilters(
    @Query() query: QueryStudentsDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.studentsService.findWithFilters(query, schoolId);
  }

  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  findOne(
    @Param('id') id: string,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.studentsService.findOne(id, schoolId);
  }

  // Phase 5D: Student Profile. Aggregates student/school/grade/academic
  // year, parent contacts, tuition & payment summaries (via
  // StudentProfileService, which reuses ReportsService's existing
  // tuition/payment aggregation), plus attendance history (Phase 5E, via
  // AttendanceService) and remaining empty future-ready sections
  // (grades/documents/announcements). Same role gate as the
  // other student-financial-adjacent read endpoints
  // (GET /reports/student/:id/statement) — staff can see the student
  // record but not the financial summary embedded in the profile.
  @Get(':id/profile')
  @Roles('school_admin', 'accountant')
  getProfile(
    @Param('id') id: string,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.studentProfileService.getForSchoolAdmin(id, schoolId);
  }

  @Patch(':id')
  @Roles('school_admin', 'staff')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.studentsService.update(id, dto, schoolId);
  }

  @Delete(':id')
  @Roles('school_admin')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    await this.studentsService.softDelete(id, schoolId);
  }
}
