import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { QueryClassesDto } from './dto/query-classes.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Classes')
@ApiBearerAuth('access-token')
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @ApiOperation({ summary: 'Create a class for the current school' })
  @Post()
  @Roles('school_admin')
  create(@Body() dto: CreateClassDto, @CurrentUser('schoolId') schoolId: string) {
    return this.classesService.create(dto, schoolId);
  }

  @Get()
  @Roles('school_admin', 'accountant', 'staff')
  findAll(@Query() query: QueryClassesDto, @CurrentUser('schoolId') schoolId: string) {
    return this.classesService.findAll(schoolId, query);
  }

  @Get(':id')
  @Roles('school_admin', 'accountant', 'staff')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.classesService.findOne(id, schoolId);
  }

  @Patch(':id')
  @Roles('school_admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.classesService.update(id, dto, schoolId);
  }

  @Delete(':id')
  @Roles('school_admin')
  remove(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.classesService.remove(id, schoolId);
  }
}
