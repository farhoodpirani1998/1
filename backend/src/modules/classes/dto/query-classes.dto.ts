import { IsOptional, IsUUID } from 'class-validator';

export class QueryClassesDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}
