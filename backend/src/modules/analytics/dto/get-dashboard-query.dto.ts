import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// All three knobs are optional, capped narrowing parameters on top of
// AnalyticsService's own defaults (see DEFAULT_RECENT_LIMIT /
// DEFAULT_TREND_DAYS / DEFAULT_MONTHS_BACK) -- same "@Type(() => Number)
// + bounded @Min/@Max" pattern QueryParentNotificationsDto already uses
// for its page/limit fields, so a malformed or out-of-range query string
// 400s before it ever reaches a query.
export class GetDashboardQueryDto {
  // How many rows each "recent activity" list (payments/attendance/
  // assessments/announcements) returns.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  recentLimit?: number;

  // How many trailing days the attendance-trend chart covers.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  trendDays?: number;

  // How many trailing calendar months the monthly-payments /
  // monthly-registrations charts cover.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  monthsBack?: number;
}
