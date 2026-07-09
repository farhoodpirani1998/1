import { IsUUID, IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTuitionPlanDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  academicYearId: string;

  @IsInt()
  @Min(0)
  baseAmount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number = 0;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountReason?: string;
}
