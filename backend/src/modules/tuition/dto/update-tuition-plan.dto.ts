import { IsOptional, IsInt, Min, IsString, MaxLength, IsUUID } from 'class-validator';

export class UpdateTuitionPlanDto {
  @IsOptional()
  @IsUUID()
  discountTypeId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountReason?: string;
}
