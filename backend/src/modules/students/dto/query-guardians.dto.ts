import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// GET /guardians — school_admin-facing guardian directory. Same
// "search + bounded pagination" shape as QueryStudentsDto: `search`
// matches against full_name OR phone (a front-desk user is just as
// likely to look a guardian up by phone as by name), and page/limit
// default/cap via the shared normalizePagination() helper in
// GuardiansService.findAllForSchool().
//
// Sprint 1 — Feature 5: page/limit moved to PaginationQueryDto (pure
// extraction, same validators).
export class QueryGuardiansDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
