import { IsOptional, IsUUID, IsEnum, IsString } from 'class-validator';
import { StudentStatus } from '../entities/student.entity';

export class QueryStudentsDto {
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  search?: string; // matches against full_name
}
