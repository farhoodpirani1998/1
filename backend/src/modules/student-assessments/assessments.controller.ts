import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { toAssessmentView } from './dto/assessment-view.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Assessments')
@ApiBearerAuth('access-token')
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  // Recording/correcting a score: same role pair as POST /attendance
  // (school_admin, staff). accountant, being financial-only elsewhere in
  // the app, is not granted a write here; 'parent' is never granted this
  // route, same as every staff-facing endpoint outside /parent/*.
  @ApiOperation({ summary: "Record (or correct) a student's assessment score" })
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
  async findByStudent(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    const result = await this.assessmentsService.findByStudent(id, schoolId, query);
    if (Array.isArray(result)) {
      return result.map(toAssessmentView);
    }
    return { ...result, data: result.data.map(toAssessmentView) };
  }

  @ApiOperation({ summary: "Compiled report card for a student across all subjects" })
  @Get('student/:id/report-card')
  @Roles('school_admin', 'accountant', 'staff')
  getReportCard(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.assessmentsService.getReportCard(id, schoolId);
  }
}
