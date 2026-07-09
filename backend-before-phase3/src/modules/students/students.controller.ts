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
  HttpCode,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { TransferStudentDto } from './dto/transfer-student.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('school_admin', 'staff')
  create(@Body() dto: CreateStudentDto, @CurrentUser('schoolId') schoolId: string) {
    return this.studentsService.create(dto, schoolId);
  }

  @Get()
  findWithFilters(@Query() query: QueryStudentsDto, @CurrentUser('schoolId') schoolId: string) {
    return this.studentsService.findWithFilters(query, schoolId);
  }

  // Must come before ':id' or Nest would try to match "archived" as an id.
  @Get('archived')
  findArchived(@CurrentUser('schoolId') schoolId: string) {
    return this.studentsService.findArchived(schoolId);
  }

  // Cross-school search for the transfer flow — super_admin only.
  @Get('search-all')
  @Roles('super_admin')
  searchAll(@Query('search') search: string) {
    return this.studentsService.searchAll(search ?? '');
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.studentsService.findOne(id, schoolId);
  }

  @Patch(':id')
  @Roles('school_admin', 'staff')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @CurrentUser('schoolId') schoolId: string) {
    return this.studentsService.update(id, dto, schoolId);
  }

  @Delete(':id')
  @Roles('school_admin')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    await this.studentsService.softDelete(id, schoolId);
  }

  @Post(':id/restore')
  @Roles('school_admin')
  restore(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.studentsService.restore(id, schoolId);
  }

  // Crosses the tenant boundary — only super_admin may call this.
  @Post(':id/transfer')
  @Roles('super_admin')
  transfer(@Param('id') id: string, @Body() dto: TransferStudentDto) {
    return this.studentsService.transfer(id, dto.targetSchoolId);
  }
}
