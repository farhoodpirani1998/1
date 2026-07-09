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
  @IsUUID()
  discountTypeId?: string;

  // If omitted while discountTypeId is given, computed from the discount
  // type's defaultPercent. Always allowed to override in either direction
  // (e.g. manager approving a bigger discount than the default).
  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  discountReason?: string;
}
