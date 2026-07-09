import { IsString, MaxLength, IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class CreateClassDto {
  @IsUUID()
  gradeId: string;

  @IsUUID()
  academicYearId: string;

  @IsString()
  @MaxLength(50)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  teacherName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
