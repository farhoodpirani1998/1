import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

// GET /guardians — school_admin-facing guardian directory. Same
// "search + bounded pagination" shape as QueryStudentsDto: `search`
// matches against full_name OR phone (a front-desk user is just as
// likely to look a guardian up by phone as by name), and page/limit
// default/cap via the shared normalizePagination() helper in
// GuardiansService.findAllForSchool().
export class QueryGuardiansDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
