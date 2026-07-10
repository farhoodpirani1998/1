import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { GetDashboardQueryDto } from './dto/get-dashboard-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Phase 5J: Analytics Dashboard Foundation.
//
// school_admin only -- unlike /reports/* (school_admin + accountant), this
// endpoint surfaces attendance/assessment data alongside financials, which
// accountant has no standing reason to see, so the role list is
// intentionally narrower than ReportsController's.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles('school_admin')
  getDashboard(@Query() query: GetDashboardQueryDto, @CurrentUser('schoolId') schoolId: string) {
    return this.analyticsService.getDashboard(schoolId, query);
  }
}
