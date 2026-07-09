import { IsOptional, IsUUID, IsEnum, IsString, MaxLength } from 'class-validator';
import { StudentStatus } from '../entities/student.entity';

export class UpdateStudentDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;
}
