import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { toAssessmentView } from './dto/assessment-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  // Recording/correcting a score: same role pair as POST /attendance
  // (school_admin, staff). accountant, being financial-only elsewhere in
  // the app, is not granted a write here; 'parent' is never granted this
  // route, same as every staff-facing endpoint outside /parent/*.
  @Post()
  @Roles('school_admin', 'staff')
  async create(@Body() dto: CreateAssessmentDto, @CurrentUser() user: AuthenticatedUser) {
    const assessment = await this.assessmentsService.record(dto, user.schoolId, user.id);
    return toAssessmentView(assessment);
  }

  // Read access matches GET /attendance/student/:id (school_admin,
  // accountant, staff can all see a student's own record).
  @Get('student/:id')
  @Roles('school_admin', 'accountant', 'staff')
  async findByStudent(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    const records = await this.assessmentsService.findByStudent(id, schoolId);
    return records.map(toAssessmentView);
  }

  @Get('student/:id/report-card')
  @Roles('school_admin', 'accountant', 'staff')
  getReportCard(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.assessmentsService.getReportCard(id, schoolId);
  }
}
