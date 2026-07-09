import { IsOptional, IsUUID, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
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

  // Phase 4A: pagination — both optional, defaults/ceiling applied in
  // StudentsService via the shared normalizePagination() helper so a
  // request with no params still gets a bounded result set instead of
  // the entire school's student list.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
