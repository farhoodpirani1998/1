import { IsString, MaxLength, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateDiscountTypeDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultPercent?: number;
}
