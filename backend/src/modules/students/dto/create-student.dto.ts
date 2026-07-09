import {
  IsString,
  MaxLength,
  IsOptional,
  IsUUID,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateGuardianDto } from './create-guardian.dto';

export class CreateStudentDto {
  @IsUUID()
  academicYearId: string;

  @IsUUID()
  gradeId: string;

  @IsString()
  @MaxLength(150)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nationalId?: string;

  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  // Provide exactly one of these two:
  @IsOptional()
  @IsUUID()
  guardianId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateGuardianDto)
  newGuardian?: CreateGuardianDto;
}
