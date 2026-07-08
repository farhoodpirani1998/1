import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overdue-summary')
  @Roles('school_admin', 'accountant')
  overdueSummary(@CurrentUser('schoolId') schoolId: string) {
    return this.reportsService.overdueSummary(schoolId);
  }

  // Used for both "daily income" (from=to=same day) and "monthly income"
  // (from/to spanning the month) — the frontend picks the range.
  @Get('income')
  @Roles('school_admin', 'accountant')
  income(
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.reportsService.income(schoolId, from, to);
  }

  @Get('student/:id/statement')
  studentStatement(
    @Param('id') studentId: string,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.reportsService.studentStatement(studentId, schoolId);
  }
}
