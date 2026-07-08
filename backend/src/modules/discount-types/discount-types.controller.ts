import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { DiscountTypesService } from './discount-types.service';
import { CreateDiscountTypeDto } from './dto/create-discount-type.dto';
import { UpdateDiscountTypeDto } from './dto/update-discount-type.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('discount-types')
export class DiscountTypesController {
  constructor(private readonly discountTypesService: DiscountTypesService) {}

  @Post()
  @Roles('school_admin')
  create(@Body() dto: CreateDiscountTypeDto, @CurrentUser('schoolId') schoolId: string) {
    return this.discountTypesService.create(dto, schoolId);
  }

  @Get()
  findAll(@CurrentUser('schoolId') schoolId: string) {
    return this.discountTypesService.findAll(schoolId);
  }

  @Patch(':id')
  @Roles('school_admin')
  update(@Param('id') id: string, @Body() dto: UpdateDiscountTypeDto, @CurrentUser('schoolId') schoolId: string) {
    return this.discountTypesService.update(id, dto, schoolId);
  }
}
