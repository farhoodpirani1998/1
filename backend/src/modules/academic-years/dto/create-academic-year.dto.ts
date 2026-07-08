import { IsString, MaxLength, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class CreateAcademicYearDto {
  @IsString()
  @MaxLength(50)
  title: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
