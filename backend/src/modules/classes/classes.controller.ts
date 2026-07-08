import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles('school_admin')
  create(@Body() dto: CreateClassDto, @CurrentUser('schoolId') schoolId: string) {
    return this.classesService.create(dto, schoolId);
  }

  @Get()
  findAll(@Query('academicYearId') academicYearId: string | undefined, @CurrentUser('schoolId') schoolId: string) {
    return this.classesService.findAll(schoolId, academicYearId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.classesService.findOne(id, schoolId);
  }

  @Patch(':id')
  @Roles('school_admin')
  update(@Param('id') id: string, @Body() dto: UpdateClassDto, @CurrentUser('schoolId') schoolId: string) {
    return this.classesService.update(id, dto, schoolId);
  }
}
