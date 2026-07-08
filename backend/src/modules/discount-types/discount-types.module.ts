import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountType } from './entities/discount-type.entity';
import { DiscountTypesController } from './discount-types.controller';
import { DiscountTypesService } from './discount-types.service';

@Module({
  imports: [TypeOrmModule.forFeature([DiscountType])],
  controllers: [DiscountTypesController],
  providers: [DiscountTypesService],
  exports: [DiscountTypesService],
})
export class DiscountTypesModule {}
