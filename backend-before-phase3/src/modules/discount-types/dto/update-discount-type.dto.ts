import { IsString, MaxLength, IsOptional, IsNumber, Min, Max, IsBoolean } from 'class-validator';

export class UpdateDiscountTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
