import { IsOptional, IsInt, Min, IsString, MaxLength } from 'class-validator';

export class UpdateTuitionPlanDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountReason?: string;
}
