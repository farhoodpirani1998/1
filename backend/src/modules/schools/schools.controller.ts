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
} from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

// Only super_admin manages schools — school_admin/accountant/staff never
// touch this controller, since they belong to a single school already
// resolved through their JWT (school_id claim).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@ApiTags('Schools')
@ApiBearerAuth('access-token')
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @ApiOperation({ summary: 'Create a new school (super_admin only, platform-wide)' })
  @Roles('super_admin')
  @Post()
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Roles('super_admin')
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.schoolsService.findAll(query);
  }

  @Roles('super_admin')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(id);
  }

  @Roles('super_admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Deactivate a school (soft-disable, super_admin only)' })
  @Roles('super_admin')
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.schoolsService.deactivate(id);
  }
}
