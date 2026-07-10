import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { QuerySearchDto } from './dto/query-search.dto';
import { SearchResultsView } from './dto/search-result-view.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Phase 5N: Global Search.
//
// Staff-facing only -- school_admin, accountant, and staff -- same
// "@Roles() lists exactly the staff roles that may see this" shape as
// every other staff-only controller (HomeworkController's GET /homework,
// AnnouncementsController). Never granted to 'parent' or 'teacher': both
// already have their own narrower, purpose-built read surfaces
// (/parent/*, /teacher/*) and a global cross-entity search over the
// whole school is out of scope for either portal role.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Roles('school_admin', 'accountant', 'staff')
  async search(
    @Query() query: QuerySearchDto,
    @CurrentUser('schoolId') schoolId: string,
  ): Promise<SearchResultsView> {
    return this.searchService.search(query, schoolId);
  }
}
