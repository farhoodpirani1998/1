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

  // Financial history (charges/discounts/payments) for a student — same
  // sensitivity as the other report endpoints below, so it gets the same
  // role restriction. Previously had no @Roles here, which meant staff
  // (who can view/edit student records but shouldn't see financial
  // history) could hit it too.
  @Get('student/:id/statement')
  @Roles('school_admin', 'accountant')
  studentStatement(
    @Param('id') studentId: string,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.reportsService.studentStatement(studentId, schoolId);
  }

  @Get('monthly-income')
  @Roles('school_admin', 'accountant')
  monthlyIncome(
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.reportsService.monthlyIncome(schoolId, Number(year), Number(month));
  }

  @Get('debtor-students')
  @Roles('school_admin', 'accountant')
  debtorStudents(@CurrentUser('schoolId') schoolId: string) {
    return this.reportsService.debtorStudents(schoolId);
  }
}
